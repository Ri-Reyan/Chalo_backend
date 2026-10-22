import calculateHaversineDistance from "../../utils/haversine.js";
import prisma from "../../lib/prisma.js";
import {
  emitToDrivers,
  emitToUser,
  emitToRide,
  emitToDriverVehicle,
} from "../../lib/socket.js";

export interface RideOfferPayload {
  id: string;
  pickup?: string;
  destination?: string;
  pickupDistanceKm?: number;
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
 * Finds all active online drivers who are free to take a ride (no radius restriction).
 * Prioritizes matching vehicle type, but falls back to all online drivers if none match.
 */
export const findEligibleDrivers = async (
  _pickupLat?: number,
  _pickupLng?: number,
  vehicleType?: "BIKE" | "CAR",
  _radiusKm?: number,
) => {
  const drivers = await prisma.user.findMany({
    where: {
      role: "DRIVER",
      isOnline: true,
      ...(vehicleType ? { vehicleType } : {}),
    },
    include: {
      ridesAsDriver: {
        where: {
          status: { in: ["REQUESTED", "ACCEPTED"] },
        },
      },
    },
  });

  let freeDrivers = drivers.filter((d) => d.ridesAsDriver.length === 0);

  // If no driver of the exact vehicleType is found online, notify ALL online free drivers
  // so no ride request is ever dropped!
  if (freeDrivers.length === 0) {
    const allDrivers = await prisma.user.findMany({
      where: {
        role: "DRIVER",
        isOnline: true,
      },
      include: {
        ridesAsDriver: {
          where: {
            status: { in: ["REQUESTED", "ACCEPTED"] },
          },
        },
      },
    });
    freeDrivers = allDrivers.filter((d) => d.ridesAsDriver.length === 0);
  }

  // NO RADIUS LIMIT: Return all active online free drivers immediately
  return freeDrivers;
};

/**
 * Publishes ride offer to all online drivers without radius limits,
 * with a 10-minute matching window before refund timeout.
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
    pickup: (ride as any).pickup || "Pickup Point",
    destination: (ride as any).destination || "Drop-off Location",
    pickupDistanceKm: 0.5,
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
    radiusKm: 25.0,
    createdAt: new Date().toISOString(),
  };

  // Find all active free drivers without radius restriction
  const eligibleDrivers = await findEligibleDrivers(
    payload.pickupLat,
    payload.pickupLng,
    payload.vehicleType,
  );

  for (const driver of eligibleDrivers) {
    emitToUser(driver.id, "ride:requested", payload);
  }

  // Broadcast cleanly to online drivers and vehicle pool
  emitToDrivers("ride:requested", payload, payload.vehicleType);

  const timers: NodeJS.Timeout[] = [];

  // 10-minute (600s) timeout before no-driver refund (prevents premature timeout while driver is deciding)
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
            "No drivers accepted this trip. Your upfront payment hold has been refunded.",
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
  }, 600000); // 10 minutes (600,000 ms)

  timers.push(timeoutTimer);
  activeMatchingTimers.set(rideId, timers);
};

export const matchingService = {
  findEligibleDrivers,
  publishRideOffer,
  clearMatchingTimers,
};

export default matchingService;

