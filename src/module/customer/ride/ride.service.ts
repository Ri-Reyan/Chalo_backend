import crypto from "crypto";
import calculateHaversineDistance from "../../../utils/haversine.js";
import prisma from "../../../lib/prisma.js";
import AppError from "../../../global/AppError.js";
import stripe from "../../../lib/stripe.js";
import { emitToRide, emitToUser, emitToDrivers } from "../../../lib/socket.js";
import matchingService from "../../matching/matching.service.js";
import {
  setPendingRide,
  getPendingRide,
  deletePendingRide,
  setProcessedSession,
  getProcessedSession,
} from "./rideCache.service.js";
import type {
  EstimateRideInput,
  CreateRideInput,
  ConfirmPaymentInput,
} from "./ride.schema.js";

// Rate constants defined by MVP architecture (in USD $):
// BIKE: Base $1.00 + $0.20 / km
// CAR: Base $3.00 + $0.50 / km
const FARE_RATES = {
  BIKE: {
    baseFare: 1.0,
    perKmRate: 0.2,
  },
  CAR: {
    baseFare: 3.0,
    perKmRate: 0.5,
  },
} as const;

export interface EstimateRideResult {
  distanceKm: number;
  fare: number;
  vehicleType: "BIKE" | "CAR";
  fares: {
    BIKE: number;
    CAR: number;
  };
  breakdown: {
    baseFare: number;
    perKmRate: number;
    distanceFare: number;
  };
}

export interface CreateRideResult {
  rideId: string;
  tempRideId?: string;
  paymentId?: string;
  fare: number;
  distanceKm: number;
  vehicleType: "BIKE" | "CAR";
  pickup: string;
  destination: string;
  status: string;
  checkoutUrl: string;
}

const estimateRideService = async (
  input: EstimateRideInput,
): Promise<EstimateRideResult> => {
  const { pickupLat, pickupLng, destinationLat, destinationLng, vehicleType } =
    input;

  const rawDist = calculateHaversineDistance(
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
  );
  const distanceKm = Number(rawDist.toFixed(2));

  const bikeBase = FARE_RATES.BIKE.baseFare;
  const bikeDistanceFare = Number((distanceKm * FARE_RATES.BIKE.perKmRate).toFixed(2));
  const bikeTotalFare = Number((bikeBase + bikeDistanceFare).toFixed(2));

  const carBase = FARE_RATES.CAR.baseFare;
  const carDistanceFare = Number((distanceKm * FARE_RATES.CAR.perKmRate).toFixed(2));
  const carTotalFare = Number((carBase + carDistanceFare).toFixed(2));

  const selectedRate = FARE_RATES[vehicleType];
  const selectedDistanceFare = Number((distanceKm * selectedRate.perKmRate).toFixed(2));
  const selectedTotalFare = Number((selectedRate.baseFare + selectedDistanceFare).toFixed(2));

  return {
    distanceKm,
    fare: selectedTotalFare,
    vehicleType,
    fares: {
      BIKE: bikeTotalFare,
      CAR: carTotalFare,
    },
    breakdown: {
      baseFare: selectedRate.baseFare,
      perKmRate: selectedRate.perKmRate,
      distanceFare: selectedDistanceFare,
    },
  };
};

/**
 * Step 1: Pre-Payment Pending Ride Request
 * Stores temporary ride payload in Redis with a 15-minute TTL.
 * Crucially: DOES NOT insert into PostgreSQL until payment is confirmed!
 */
const createRideService = async (
  input: CreateRideInput,
  authenticatedUserId?: string,
): Promise<CreateRideResult> => {
  const {
    pickup,
    destination,
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    vehicleType,
  } = input;

  const rawDist = calculateHaversineDistance(
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
  );
  const distanceKm = Number(rawDist.toFixed(2));

  const selectedRate = FARE_RATES[vehicleType];
  const distanceFare = Number((distanceKm * selectedRate.perKmRate).toFixed(2));
  const fare = Number((selectedRate.baseFare + distanceFare).toFixed(2));

  // Resolve customer ID
  let customerId = authenticatedUserId;
  if (!customerId) {
    const customer = await prisma.user.findFirst({
      where: { role: "CUSTOMER" },
    });
    if (customer) {
      customerId = customer.id;
    } else {
      const fallback = await prisma.user.create({
        data: {
          name: "Chalo Customer",
          email: "customer@chalo.app",
          passwordHash: "demo_hash",
          role: "CUSTOMER",
        },
      });
      customerId = fallback.id;
    }
  }

  // Generate unique temporary ride ID for Redis
  const tempRideId = `temp_${crypto.randomUUID()}`;

  // Store pre-payment payload in Redis (15 minutes TTL)
  await setPendingRide(tempRideId, {
    tempRideId,
    customerId: customerId!,
    pickup,
    destination,
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    vehicleType,
    distanceKm,
    fare,
    createdAt: new Date().toISOString(),
  });

  // Client checkout fallback URL in case Stripe SDK is not configured
  let checkoutUrl = `/checkout?tempRideId=${tempRideId}&amount=${fare}&distanceKm=${distanceKm}&vehicleType=${vehicleType}&pickup=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(destination)}`;

  try {
    const clientBaseUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const unitAmount = Math.max(50, Math.round(fare * 100));

    // Create real Stripe Checkout Session referencing temporary Redis ride ID
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Chalo ${vehicleType === "BIKE" ? "Motorbike" : "Car"} Ride`,
              description: `${pickup} → ${destination} (${distanceKm} km)`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      client_reference_id: tempRideId,
      metadata: {
        tempRideId,
        customerId: customerId!,
        vehicleType,
        fare: String(fare),
        pickup,
        destination,
      },
      success_url: `${clientBaseUrl}/customer/payment/success?session_id={CHECKOUT_SESSION_ID}&temp_ride_id=${tempRideId}`,
      cancel_url: `${clientBaseUrl}/customer/payment/cancel?temp_ride_id=${tempRideId}`,
    });

    if (session.url) {
      checkoutUrl = session.url;
    }
  } catch (stripeErr) {
    console.warn("Stripe session creation error (using client fallback):", stripeErr);
  }

  return {
    rideId: tempRideId,
    tempRideId,
    paymentId: "pending_payment",
    fare,
    distanceKm,
    vehicleType,
    pickup,
    destination,
    status: "PENDING_PAYMENT",
    checkoutUrl,
  };
};

/**
 * Step 2: Payment Verified / Held
 * Creates PostgreSQL record if from Redis, or updates status to HELD,
 * then triggers Radius Matching Engine to publish ride offers to nearby online drivers.
 */
const confirmPaymentService = async (input: ConfirmPaymentInput) => {
  const { rideId } = input;

  // Handle temporary ride stored in Redis
  if (rideId.startsWith("temp_")) {
    // Check if ride was already created for this tempRideId
    const existingRideId = await getProcessedSession(rideId);
    if (existingRideId) {
      const existing = await prisma.ride.findUnique({
        where: { id: existingRideId },
      });
      if (existing) {
        return {
          rideId: existing.id,
          fare: Number(existing.fare),
          distanceKm: Number(existing.distanceKm),
          vehicleType: existing.vehicleType,
          status: existing.status,
          createdAt: existing.createdAt.toISOString(),
        };
      }
    }

    const pendingRide = await getPendingRide(rideId);
    if (!pendingRide) {
      throw new AppError(
        "Pending ride session not found or expired in cache. Please request again.",
        404,
      );
    }

    // Clean up Redis immediately to prevent double submission
    await deletePendingRide(rideId);

    // Transactionally create permanent Ride and Payment records in PostgreSQL
    const [newRide, newPayment] = await prisma.$transaction(async (tx) => {
      const r = await tx.ride.create({
        data: {
          customerId: pendingRide.customerId,
          pickupLat: pendingRide.pickupLat,
          pickupLng: pendingRide.pickupLng,
          destinationLat: pendingRide.destinationLat,
          destinationLng: pendingRide.destinationLng,
          vehicleType: pendingRide.vehicleType,
          distanceKm: pendingRide.distanceKm,
          fare: pendingRide.fare,
          status: "REQUESTED",
          currentRadiusKm: 2.0,
        },
        include: {
          customer: true,
        },
      });

      const p = await tx.payment.create({
        data: {
          rideId: r.id,
          amount: pendingRide.fare,
          status: "HELD",
        },
      });

      return [r, p];
    });

    await setProcessedSession(rideId, newRide.id);

    // Trigger radius matching to notify eligible drivers within 2km -> 4km
    matchingService.publishRideOffer(newRide.id).catch((err) => {
      console.error("Failed to publish ride offer:", err);
    });

    emitToRide(newRide.id, "ride:published", {
      rideId: newRide.id,
      status: "REQUESTED",
      radiusKm: 2.0,
    });

    emitToUser(newRide.customerId, "ride:published", {
      rideId: newRide.id,
      status: "REQUESTED",
      radiusKm: 2.0,
    });

    return {
      rideId: newRide.id,
      fare: Number(newRide.fare),
      distanceKm: Number(newRide.distanceKm),
      vehicleType: newRide.vehicleType,
      status: newRide.status,
      createdAt: newRide.createdAt.toISOString(),
    };
  }

  // Handle existing database ride
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      payment: true,
      customer: true,
      driver: true,
    },
  });

  if (!ride) {
    throw new AppError("Ride not found", 404);
  }

  // Ensure payment is HELD / Authorized
  if (ride.payment && ride.payment.status !== "HELD") {
    await prisma.payment.update({
      where: { id: ride.payment.id },
      data: { status: "HELD" },
    });
  }

  // Trigger radius matching to notify eligible drivers within 2km -> 4km
  matchingService.publishRideOffer(ride.id).catch((err) => {
    console.error("Failed to publish ride offer:", err);
  });

  emitToRide(ride.id, "ride:published", {
    rideId: ride.id,
    status: "REQUESTED",
    radiusKm: 2.0,
  });

  emitToUser(ride.customerId, "ride:published", {
    rideId: ride.id,
    status: "REQUESTED",
    radiusKm: 2.0,
  });

  return {
    rideId: ride.id,
    fare: Number(ride.fare),
    distanceKm: Number(ride.distanceKm),
    vehicleType: ride.vehicleType,
    status: ride.status,
    createdAt: ride.createdAt.toISOString(),
  };
};

/**
 * Step 2 (Cont.): Driver accepts ride
 * Uses atomic UPDATE with WHERE status = 'REQUESTED' to prevent competing acceptance.
 */
const acceptRideService = async (rideId: string, driverId: string) => {
  // Validate driver
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
  });

  if (!driver || driver.role !== "DRIVER") {
    throw new AppError("Only verified drivers can accept rides.", 403);
  }

  // Atomic update
  const result = await prisma.ride.updateMany({
    where: {
      id: rideId,
      status: "REQUESTED",
    },
    data: {
      driverId,
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new AppError(
      "Ride has already been accepted by another driver.",
      409,
    );
  }

  // Clear all pending matching timers & timeouts for this ride immediately
  matchingService.clearMatchingTimers(rideId);

  // Fetch updated ride details
  const updatedRide = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      customer: true,
      driver: true,
    },
  });

  if (!updatedRide) {
    throw new AppError("Ride not found after acceptance.", 404);
  }

  const driverPayload = {
    id: driver.id,
    name: driver?.name || "Driver",
    vehicleModel:
      updatedRide.vehicleType === "BIKE"
        ? "Honda CB Hornet 160R"
        : "Toyota Corolla Axio (Hybrid)",
    rating: "4.9 ★",
    plateNumber:
      updatedRide.vehicleType === "BIKE"
        ? "DHAKA METRO-HA 4821"
        : "DHAKA METRO-GA 7392",
    lat: driver.lat ? Number(driver.lat) : 23.7925,
    lng: driver.lng ? Number(driver.lng) : 90.4078,
    etaMinutes: 3,
  };

  const responsePayload = {
    rideId: updatedRide.id,
    status: updatedRide.status,
    fare: Number(updatedRide.fare),
    distanceKm: Number(updatedRide.distanceKm),
    vehicleType: updatedRide.vehicleType,
    driver: driverPayload,
    customer: {
      id: updatedRide.customer?.id || updatedRide.customerId,
      name: updatedRide.customer?.name || "Customer",
      rating: "5.0 ★",
    },
    acceptedAt: updatedRide.acceptedAt?.toISOString(),
  };

  // Broadcast to customer and ride room
  emitToRide(rideId, "ride:accepted", responsePayload);
  emitToUser(updatedRide.customerId, "ride:accepted", responsePayload);

  // Broadcast to online drivers channel that this ride is taken
  emitToDrivers("ride:taken", { rideId });

  return responsePayload;
};

/**
 * Step 3: Driver Arrived at Pickup
 */
const driverArrivedService = async (rideId: string, driverId?: string) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
  });

  if (!ride) {
    throw new AppError("Ride not found.", 404);
  }

  if (ride.status !== "ACCEPTED") {
    throw new AppError("Ride is not in ACCEPTED status.", 400);
  }

  const payload = {
    rideId,
    status: "DRIVER_ARRIVED",
    message: "Your driver has arrived at the pickup point.",
  };

  emitToRide(rideId, "driver:arrived", payload);
  emitToUser(ride.customerId, "driver:arrived", payload);

  return payload;
};

/**
 * Step 3: Start Trip
 */
const startRideService = async (rideId: string, driverId?: string) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
  });

  if (!ride) {
    throw new AppError("Ride not found.", 404);
  }

  const payload = {
    rideId,
    status: "IN_TRANSIT",
    message: "Trip has started. Tracking ongoing route.",
  };

  emitToRide(rideId, "ride:started", payload);
  emitToUser(ride.customerId, "ride:started", payload);

  return payload;
};

/**
 * Step 4: Ride Completion & Balance Payout
 * Transactionally updates Ride to COMPLETED, Payment to CAPTURED,
 * and increments Driver balance with 90% take-home ($).
 */
const completeRideService = async (rideId: string, customerId?: string) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      payment: true,
      driver: true,
      customer: true,
    },
  });

  if (!ride) {
    throw new AppError("Ride not found.", 404);
  }

  if (ride.status !== "ACCEPTED") {
    throw new AppError("Only active rides can be completed.", 400);
  }

  const grossFare = Number(ride.fare);
  const netEarnings = Number((grossFare * 0.9).toFixed(2)); // 90% Driver Take-Home ($)

  // Transactionally complete ride, capture payment, and payout driver balance
  await prisma.$transaction(async (tx) => {
    // 1. Update Ride
    await tx.ride.update({
      where: { id: rideId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // 2. Update Payment
    if (ride.payment) {
      await tx.payment.update({
        where: { id: ride.payment.id },
        data: {
          status: "CAPTURED",
        },
      });
    }

    // 3. Increment Driver's balance
    if (ride.driverId) {
      await tx.user.update({
        where: { id: ride.driverId },
        data: {
          balance: {
            increment: netEarnings,
          },
        },
      });
    }
  });

  const completionPayload = {
    rideId: ride.id,
    status: "COMPLETED",
    grossFare,
    netEarnings,
    completedAt: new Date().toISOString(),
  };

  // Notify both customer and driver via Socket.IO
  emitToRide(rideId, "ride:completed", completionPayload);
  emitToUser(ride.customerId, "ride:completed", completionPayload);
  if (ride.driverId) {
    emitToUser(ride.driverId, "ride:completed", completionPayload);
  }

  return completionPayload;
};

/**
 * Ride Cancellation
 */
const cancelRideService = async (rideId: string, cancelledByUserId?: string) => {
  // If this is a temporary pre-payment ride stored in Redis
  if (rideId.startsWith("temp_")) {
    await deletePendingRide(rideId);
    return {
      rideId,
      status: "CANCELLED",
      message: "Pending ride request cancelled successfully.",
    };
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: { payment: true },
  });

  if (!ride) {
    throw new AppError("Ride not found.", 404);
  }

  // Authorization check if userId is provided
  if (
    cancelledByUserId &&
    ride.customerId !== cancelledByUserId &&
    ride.driverId !== cancelledByUserId
  ) {
    throw new AppError("You are not authorized to cancel this ride.", 403);
  }

  if (ride.status === "COMPLETED") {
    throw new AppError("Completed rides cannot be cancelled.", 400);
  }

  if (ride.status === "NO_DRIVER_FOUND") {
    throw new AppError("This ride is already cancelled.", 400);
  }

  // Clear any pending matching or auto-cancellation timers
  matchingService.clearMatchingTimers(rideId);

  await prisma.$transaction(async (tx) => {
    await tx.ride.update({
      where: { id: rideId },
      data: { status: "NO_DRIVER_FOUND" },
    });

    if (ride.payment) {
      await tx.payment.update({
        where: { id: ride.payment.id },
        data: { status: "REFUNDED" },
      });
    }
  });

  const cancelPayload = {
    rideId,
    status: "CANCELLED",
    message: "Ride was cancelled and held payment has been refunded.",
  };

  // Broadcast to ride room, customer, and driver (if assigned)
  emitToRide(rideId, "ride:cancelled", cancelPayload);
  emitToUser(ride.customerId, "ride:cancelled", cancelPayload);
  if (ride.driverId) {
    emitToUser(ride.driverId, "ride:cancelled", cancelPayload);
  }

  // Clear request card from online driver pools
  emitToDrivers("ride:taken", { rideId });

  return cancelPayload;
};

/**
 * Get active ride for Customer or Driver
 */
const getActiveRideService = async (userId: string, role?: string) => {
  const condition =
    role === "DRIVER"
      ? { driverId: userId, status: { in: ["REQUESTED" as const, "ACCEPTED" as const] } }
      : { customerId: userId, status: { in: ["REQUESTED" as const, "ACCEPTED" as const] } };

  const ride = await prisma.ride.findFirst({
    where: condition,
    include: {
      customer: true,
      driver: true,
      payment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!ride) return null;

  return {
    id: ride.id,
    status: ride.status,
    vehicleType: ride.vehicleType,
    distanceKm: Number(ride.distanceKm),
    fare: Number(ride.fare),
    pickupLat: Number(ride.pickupLat),
    pickupLng: Number(ride.pickupLng),
    destinationLat: Number(ride.destinationLat),
    destinationLng: Number(ride.destinationLng),
    paymentStatus: ride.payment?.status || "HELD",
    customer: {
      id: ride.customer?.id || ride.customerId,
      name: ride.customer?.name || "Customer",
      rating: "5.0 ★",
    },
    driver: ride.driver
      ? {
          id: ride.driver.id,
          name: ride.driver.name || "Driver Partner",
          vehicleModel:
            ride.vehicleType === "BIKE"
              ? "Honda CB Hornet 160R"
              : "Toyota Corolla Axio (Hybrid)",
          rating: "4.9 ★",
          plateNumber:
            ride.vehicleType === "BIKE"
              ? "DHAKA METRO-HA 4821"
              : "DHAKA METRO-GA 7392",
          lat: ride.driver.lat ? Number(ride.driver.lat) : 23.7925,
          lng: ride.driver.lng ? Number(ride.driver.lng) : 90.4078,
          etaMinutes: 3,
        }
      : null,
    createdAt: ride.createdAt.toISOString(),
  };
};

/**
 * Get available requested rides for drivers
 */
const getAvailableRidesService = async (driverId?: string) => {
  const rides = await prisma.ride.findMany({
    where: {
      status: "REQUESTED",
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000), // last 15 min
      },
    },
    include: {
      customer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rides.map((ride) => {
    const grossFare = Number(ride.fare);
    const netEarnings = Number((grossFare * 0.9).toFixed(2));
    return {
      id: ride.id,
      pickupLat: Number(ride.pickupLat),
      pickupLng: Number(ride.pickupLng),
      destinationLat: Number(ride.destinationLat),
      destinationLng: Number(ride.destinationLng),
      vehicleType: ride.vehicleType,
      distanceKm: Number(ride.distanceKm),
      grossFare,
      netEarnings,
      customerName: ride.customer?.name || "Customer",
      customerRating: "4.9",
      radiusKm: Number(ride.currentRadiusKm),
      createdAt: ride.createdAt.toISOString(),
    };
  });
};

/**
 * Get ride history for Customer or Driver
 */
const getRideHistoryService = async (userId: string, role?: string) => {
  const isDriver = role === "DRIVER";
  const whereClause = isDriver
    ? { driverId: userId, status: { in: ["COMPLETED" as const, "NO_DRIVER_FOUND" as const] } }
    : { customerId: userId, status: { in: ["COMPLETED" as const, "NO_DRIVER_FOUND" as const] } };

  const rides = await prisma.ride.findMany({
    where: whereClause,
    include: {
      customer: true,
      driver: true,
      payment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rides.map((ride) => {
    const grossFare = Number(ride.fare);
    const netEarnings = Number((grossFare * 0.9).toFixed(2));
    return {
      id: ride.id,
      pickup: "Pickup Point",
      destination: "Drop-off Destination",
      pickupLat: Number(ride.pickupLat),
      pickupLng: Number(ride.pickupLng),
      destinationLat: Number(ride.destinationLat),
      destinationLng: Number(ride.destinationLng),
      vehicleType: ride.vehicleType,
      distanceKm: Number(ride.distanceKm),
      fare: grossFare,
      grossFare,
      netEarnings,
      status: ride.status,
      paymentStatus: ride.payment?.status || "HELD",
      customer: {
        id: ride.customer?.id || ride.customerId,
        name: ride.customer?.name || "Customer",
        rating: "5.0 ★",
      },
      driver: ride.driver
        ? {
            id: ride.driver.id,
            name: ride.driver.name || "Driver Partner",
            vehicleModel:
              ride.vehicleType === "BIKE"
                ? "Honda CB Hornet 160R"
                : "Toyota Corolla Axio (Hybrid)",
            rating: "4.9 ★",
            plateNumber:
              ride.vehicleType === "BIKE"
                ? "DHAKA METRO-HA 4821"
                : "DHAKA METRO-GA 7392",
            etaMinutes: 3,
          }
        : null,
      createdAt: ride.createdAt.toISOString(),
      acceptedAt: ride.acceptedAt?.toISOString() || null,
      completedAt: ride.completedAt?.toISOString() || null,
    };
  });
};

export const rideService = {
  estimateRideService,
  createRideService,
  confirmPaymentService,
  acceptRideService,
  driverArrivedService,
  startRideService,
  completeRideService,
  cancelRideService,
  getActiveRideService,
  getAvailableRidesService,
  getRideHistoryService,
};

export default rideService;
