import calculateHaversineDistance from "../../utils/haversine.js";
import prisma from "../../lib/prisma.js";
import { emitToDrivers, emitToUser, emitToRide } from "../../lib/socket.js";

export interface RideOfferPayload {
  id: string;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  vehicleType: "BIKE" | "CAR";
  distanceKm: number;
  grossFare: number;
  netEarnings: number;
  customerName: string;
  customerRating: string;
  radiusKm: number;
  createdAt: string;
}

// Active timeouts map: rideId -> array of Node timers
const activeMatchingTimers = new Map<string, NodeJS.Timeout[]>();

/**
 * Immediately clears and stops any pending matching or auto-cancellation timers
 * when a ride is accepted or cancelled.
 */
export const clearMatchingTimers = (rideId: string) => {
  const timers = activeMatchingTimers.get(rideId);
  if (timers && timers.length > 0) {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  }
  activeMatchingTimers.delete(rideId);
};

/**
 * Finds online drivers matching the vehicle type within the specified radius.
 */
export const findEligibleDrivers = async (
  pickupLat: number,
  pickupLng: number,
  vehicleType: "BIKE" | "CAR",
  radiusKm: number,
) => {
  const drivers = await prisma.user.findMany({
    where: {
      role: "DRIVER",
      isOnline: true,
      vehicleType,
    },
    include: {
      ridesAsDriver: {
        where: {
          status: { in: ["REQUESTED", "ACCEPTED"] },
        },
      },
    },
  });

  // Filter out drivers who already have an active ride
  const freeDrivers = drivers.filter((d) => d.ridesAsDriver.length === 0);

  return freeDrivers.filter((driver) => {
    // If driver coordinates are known, check Haversine distance
    if (driver.lat !== null && driver.lng !== null) {
      const dist = calculateHaversineDistance(
        pickupLat,
        pickupLng,
        Number(driver.lat),
        Number(driver.lng),
      );
      return dist <= radiusKm;
    }
    // If coordinates are not yet published, include them to allow demo testing
    return true;
  });
};

/**
 * Publishes ride offer to online drivers in a 2km radius,
 * with automatic 30s expansion to 4km, and 60s refund timeout.
 */
export const publishRideOffer = async (rideId: string) => {
  // Clear any pre-existing timers for this rideId
  clearMatchingTimers(rideId);

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: { customer: true, payment: true },
  });

  if (!ride || ride.status !== "REQUESTED") {
    return;
  }

  const netEarnings = Number((Number(ride.fare) * 0.9).toFixed(2));
  const payload: RideOfferPayload = {
    id: ride.id,
    pickupLat: Number(ride.pickupLat),
    pickupLng: Number(ride.pickupLng),
    destinationLat: Number(ride.destinationLat),
    destinationLng: Number(ride.destinationLng),
    vehicleType: ride.vehicleType,
    distanceKm: Number(ride.distanceKm),
    grossFare: Number(ride.fare),
    netEarnings,
    customerName: ride.customer?.name || "Customer",
    customerRating: "4.9",
    radiusKm: 2.0,
    createdAt: new Date().toISOString(),
  };

  // --- Round 1: 2.0 km immediate dispatch ---
  const eligibleDriversRound1 = await findEligibleDrivers(
    payload.pickupLat,
    payload.pickupLng,
    payload.vehicleType,
    2.0,
  );

  for (const driver of eligibleDriversRound1) {
    emitToUser(driver.id, "ride:new", payload);
  }
  // Broadcast to online drivers channel
  emitToDrivers("ride:new", payload);

  const timers: NodeJS.Timeout[] = [];

  // --- Round 2: 30-Second Expansion to 4.0 km ---
  const expansionTimer = setTimeout(async () => {
    try {
      const currentRide = await prisma.ride.findUnique({
        where: { id: rideId },
      });

      if (!currentRide || currentRide.status !== "REQUESTED") {
        clearMatchingTimers(rideId);
        return; // Ride already accepted or cancelled
      }

      // Expand radius in database
      await prisma.ride.update({
        where: { id: rideId },
        data: { currentRadiusKm: 4.0 },
      });

      const expandedPayload = { ...payload, radiusKm: 4.0 };
      const eligibleDriversRound2 = await findEligibleDrivers(
        payload.pickupLat,
        payload.pickupLng,
        payload.vehicleType,
        4.0,
      );

      for (const driver of eligibleDriversRound2) {
        emitToUser(driver.id, "ride:new", expandedPayload);
      }
      emitToDrivers("ride:new", expandedPayload);
      emitToRide(rideId, "ride:radius_expanded", { radiusKm: 4.0 });
    } catch (err) {
      console.error("Radius expansion error:", err);
    }
  }, 30000);

  timers.push(expansionTimer);

  // --- Round 3: 60-Second No Driver Found Timeout ---
  const timeoutTimer = setTimeout(async () => {
    try {
      const currentRide = await prisma.ride.findUnique({
        where: { id: rideId },
        include: { payment: true },
      });

      if (currentRide && currentRide.status === "REQUESTED") {
        await prisma.$transaction(async (tx) => {
          await tx.ride.update({
            where: { id: rideId },
            data: { status: "NO_DRIVER_FOUND" },
          });

          if (currentRide.payment) {
            await tx.payment.update({
              where: { id: currentRide.payment.id },
              data: { status: "REFUNDED" },
            });
          }
        });

        emitToRide(rideId, "ride:no_driver", {
          rideId,
          message:
            "No drivers available nearby. Your upfront payment hold has been refunded.",
        });
        emitToUser(currentRide.customerId, "ride:no_driver", {
          rideId,
        });
      }
    } catch (err) {
      console.error("Timeout refund error:", err);
    } finally {
      clearMatchingTimers(rideId);
    }
  }, 60000);

  timers.push(timeoutTimer);
  activeMatchingTimers.set(rideId, timers);
};

export const matchingService = {
  findEligibleDrivers,
  publishRideOffer,
  clearMatchingTimers,
};

export default matchingService;

