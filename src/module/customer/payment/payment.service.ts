import prisma from "../../../lib/prisma.js";
import AppError from "../../../global/AppError.js";
import stripe from "../../../lib/stripe.js";
import matchingService from "../../matching/matching.service.js";
import {
  emitToRide,
  emitToUser,
  emitToDrivers,
  emitToDriverVehicle,
} from "../../../lib/socket.js";
import {
  getPendingRide,
  deletePendingRide,
  setProcessedSession,
  getProcessedSession,
} from "../ride/rideCache.service.js";
import type {
  CreateCheckoutSessionInput,
  VerifyPaymentInput,
} from "./payment.schema.js";

const getClientBaseUrl = () => {
  return process.env.CLIENT_URL || "http://localhost:3000";
};

const createCheckoutSessionService = async (
  input: CreateCheckoutSessionInput,
) => {
  const { rideId, tempRideId } = input;
  const targetTempId =
    tempRideId || (rideId?.startsWith("temp_") ? rideId : undefined);

  // If pre-payment pending ride in Redis
  if (targetTempId) {
    const pendingRide = await getPendingRide(targetTempId);
    if (!pendingRide) {
      throw new AppError(
        "Pending ride session not found or expired in cache.",
        404,
      );
    }

    const fare = input.fare ? Number(input.fare) : pendingRide.fare;
    const unitAmount = Math.max(50, Math.round(fare * 100));
    const clientBaseUrl = getClientBaseUrl();
    const vehicleName =
      pendingRide.vehicleType === "BIKE" ? "Motorbike" : "Car";
    const pickup = input.pickup || pendingRide.pickup;
    const destination = input.destination || pendingRide.destination;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Chalo ${vehicleName} Ride`,
              description: `${pickup} → ${destination} (${Number(pendingRide.distanceKm)} km)`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      client_reference_id: targetTempId,
      metadata: {
        tempRideId: targetTempId,
        customerId: pendingRide.customerId,
        vehicleType: pendingRide.vehicleType,
        fare: String(fare),
        pickup,
        destination,
        pickupLat: String(pendingRide.pickupLat),
        pickupLng: String(pendingRide.pickupLng),
        destinationLat: String(pendingRide.destinationLat),
        destinationLng: String(pendingRide.destinationLng),
        distanceKm: String(pendingRide.distanceKm),
      },
      success_url: `${clientBaseUrl}/customer/payment/success?session_id={CHECKOUT_SESSION_ID}&temp_ride_id=${targetTempId}`,
      cancel_url: `${clientBaseUrl}/customer/payment/cancel?temp_ride_id=${targetTempId}`,
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      rideId: targetTempId,
      tempRideId: targetTempId,
      fare,
      vehicleType: pendingRide.vehicleType,
    };
  }

  // Fallback for existing database ride
  if (!rideId) {
    throw new AppError("Ride ID or temporary ride ID is required.", 400);
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      customer: true,
      payment: true,
    },
  });

  if (!ride) {
    throw new AppError("Ride record not found.", 404);
  }

  const fare = input.fare ? Number(input.fare) : Number(ride.fare);
  const unitAmount = Math.max(50, Math.round(fare * 100));
  const clientBaseUrl = getClientBaseUrl();
  const vehicleName = ride.vehicleType === "BIKE" ? "Motorbike" : "Car";
  const pickup = input.pickup || "Pickup Location";
  const destination = input.destination || "Destination Drop-off";

  // Create real Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Chalo ${vehicleName} Ride`,
            description: `${pickup} → ${destination} (${Number(ride.distanceKm)} km)`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      rideId: ride.id,
      customerId: ride.customerId,
      vehicleType: ride.vehicleType,
      fare: String(fare),
      pickup,
      destination,
      pickupLat: String(ride.pickupLat),
      pickupLng: String(ride.pickupLng),
      destinationLat: String(ride.destinationLat),
      destinationLng: String(ride.destinationLng),
      distanceKm: String(ride.distanceKm),
    },
    success_url: `${clientBaseUrl}/customer/payment/success?session_id={CHECKOUT_SESSION_ID}&ride_id=${ride.id}`,
    cancel_url: `${clientBaseUrl}/customer/payment/cancel?ride_id=${ride.id}`,
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url,
    rideId: ride.id,
    fare,
    vehicleType: ride.vehicleType,
  };
};

const formatRideResponse = (
  ride: any,
  pickupOverride?: string,
  destinationOverride?: string,
) => {
  return {
    rideId: ride.id,
    fare: Number(ride.fare),
    distanceKm: Number(ride.distanceKm),
    vehicleType: ride.vehicleType,
    status: ride.status,
    paymentStatus: ride.payment?.status || "HELD",
    pickup:
      ride.pickup ||
      pickupOverride ||
      "Pickup Location",
    destination:
      ride.destination ||
      destinationOverride ||
      "Destination Drop-off",
    pickupLat: Number(ride.pickupLat),
    pickupLng: Number(ride.pickupLng),
    destinationLat: Number(ride.destinationLat),
    destinationLng: Number(ride.destinationLng),
    customer: {
      id: ride.customer?.id || ride.customerId,
      name: ride.customer?.name || "Customer",
    },
    driver: ride.driver
      ? {
          id: ride.driver.id,
          name: ride.driver.name,
        }
      : null,
  };
};

const verifyPaymentSessionService = async (input: VerifyPaymentInput) => {
  const { sessionId } = input;

  // 1. Idempotency Check: Was this session already processed?
  const alreadyProcessedRideId = await getProcessedSession(sessionId);
  if (alreadyProcessedRideId) {
    const existingRide = await prisma.ride.findUnique({
      where: { id: alreadyProcessedRideId },
      include: {
        customer: true,
        driver: true,
        payment: true,
      },
    });

    if (existingRide) {
      return formatRideResponse(existingRide);
    }
  }

  // Also check idempotency by tempRideId if already converted
  const targetTempRideId =
    input.tempRideId ||
    (input.rideId?.startsWith("temp_") ? input.rideId : undefined);
  if (targetTempRideId) {
    const existingFromTemp = await getProcessedSession(targetTempRideId);
    if (existingFromTemp) {
      const existingRide = await prisma.ride.findUnique({
        where: { id: existingFromTemp },
        include: {
          customer: true,
          driver: true,
          payment: true,
        },
      });

      if (existingRide) {
        await setProcessedSession(sessionId, existingRide.id);
        return formatRideResponse(existingRide);
      }
    }
  }

  // 2. Retrieve real Stripe session
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!session) {
    throw new AppError("Stripe checkout session not found.", 404);
  }

  const isPaid =
    session.payment_status === "paid" || session.status === "complete";

  if (!isPaid) {
    throw new AppError(
      "Payment has not been completed. Status: " + session.payment_status,
      400,
    );
  }

  const tempRideId =
    session.metadata?.tempRideId ||
    session.client_reference_id ||
    input.tempRideId ||
    (input.rideId?.startsWith("temp_") ? input.rideId : undefined);

  const directRideId =
    session.metadata?.rideId ||
    (input.rideId && !input.rideId.startsWith("temp_") ? input.rideId : undefined);

  // 3. Fallback for pre-existing database ride (e.g. paid after creation)
  if (directRideId) {
    const existingRide = await prisma.ride.findUnique({
      where: { id: directRideId },
      include: {
        customer: true,
        driver: true,
        payment: true,
      },
    });

    if (existingRide) {
      await prisma.$transaction(async (tx) => {
        if (existingRide.payment) {
          await tx.payment.update({
            where: { id: existingRide.payment.id },
            data: { status: "HELD" },
          });
        }
        if (
          existingRide.status === "REQUESTED" ||
          existingRide.status === "NO_DRIVER_FOUND"
        ) {
          await tx.ride.update({
            where: { id: existingRide.id },
            data: { status: "REQUESTED" },
          });
          existingRide.status = "REQUESTED";
        }
      });

      await setProcessedSession(sessionId, existingRide.id);

      if (existingRide.status === "REQUESTED") {
        matchingService.publishRideOffer(existingRide.id).catch((err) => {
          console.error("Failed to publish ride offer after Stripe verification:", err);
        });

        const immediatePayload = {
          id: existingRide.id,
          rideId: existingRide.id,
          pickup: session.metadata?.pickup || "Pickup Location",
          destination: session.metadata?.destination || "Destination Drop-off",
          pickupLat: Number(existingRide.pickupLat),
          pickupLng: Number(existingRide.pickupLng),
          destinationLat: Number(existingRide.destinationLat),
          destinationLng: Number(existingRide.destinationLng),
          vehicleType: existingRide.vehicleType,
          distanceKm: Number(existingRide.distanceKm),
          pickupDistanceKm: 0.5,
          fare: Number(existingRide.fare),
          grossFare: Number(existingRide.fare),
          netEarnings: Number((Number(existingRide.fare) * 0.9).toFixed(2)),
          status: "REQUESTED",
          customerName: existingRide.customer?.name || "Customer",
          customerRating: "4.9 ★",
          createdAt: existingRide.createdAt.toISOString(),
          expiresInSeconds: 30,
        };

        emitToDrivers("ride:requested", immediatePayload, existingRide.vehicleType);

        emitToRide(existingRide.id, "ride:published", {
          rideId: existingRide.id,
          status: "REQUESTED",
          radiusKm: 2.0,
        });

        emitToUser(existingRide.customerId, "ride:published", {
          rideId: existingRide.id,
          status: "REQUESTED",
          radiusKm: 2.0,
        });
      }

      return formatRideResponse(
        existingRide,
        session.metadata?.pickup,
        session.metadata?.destination,
      );
    }
  }

  // 4. Check if a ride was already created for this tempRideId in Redis cache
  if (tempRideId) {
    const existingRideId = await getProcessedSession(tempRideId);
    if (existingRideId) {
      const existingRide = await prisma.ride.findUnique({
        where: { id: existingRideId },
        include: { customer: true, driver: true, payment: true },
      });
      if (existingRide) {
        await deletePendingRide(tempRideId);
        await setProcessedSession(sessionId, existingRide.id);
        return formatRideResponse(
          existingRide,
          session.metadata?.pickup,
          session.metadata?.destination,
        );
      }
    }
  }

  // 5. Check PostgreSQL database directly for existing ride created for this customer around session time
  const customerId = session.metadata?.customerId;
  if (customerId) {
    const sessionCreatedAtMs = session.created ? session.created * 1000 : Date.now();
    const existingDbRide = await prisma.ride.findFirst({
      where: {
        customerId,
        createdAt: {
          gte: new Date(sessionCreatedAtMs - 30 * 60 * 1000),
          lte: new Date(sessionCreatedAtMs + 30 * 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        driver: true,
        payment: true,
      },
    });

    if (existingDbRide) {
      await setProcessedSession(sessionId, existingDbRide.id);
      if (tempRideId) {
        await setProcessedSession(tempRideId, existingDbRide.id);
        await deletePendingRide(tempRideId);
      }
      return formatRideResponse(
        existingDbRide,
        session.metadata?.pickup,
        session.metadata?.destination,
      );
    }
  }

  // 6. No existing ride in database: Create new permanent Ride and Payment records
  const pendingRide = tempRideId ? await getPendingRide(tempRideId) : null;

  let targetCustomerId = customerId || pendingRide?.customerId;
  if (!targetCustomerId) {
    const defaultCustomer = await prisma.user.findFirst({
      where: { role: "CUSTOMER" },
    });
    targetCustomerId = defaultCustomer?.id;
  }

  if (!targetCustomerId) {
    throw new AppError("No customer record associated with this payment.", 400);
  }

  const fare =
    (pendingRide ? Number(pendingRide.fare) : undefined) ||
    (session.metadata?.fare ? Number(session.metadata.fare) : undefined) ||
    (session.amount_total ? session.amount_total / 100 : 5.0);

  const vehicleType =
    pendingRide?.vehicleType ||
    (session.metadata?.vehicleType as "BIKE" | "CAR") ||
    "CAR";

  const pickup =
    pendingRide?.pickup ||
    session.metadata?.pickup ||
    "Pickup Location";

  const destination =
    pendingRide?.destination ||
    session.metadata?.destination ||
    "Destination Drop-off";

  const pickupLat =
    (pendingRide ? Number(pendingRide.pickupLat) : undefined) ||
    (session.metadata?.pickupLat ? Number(session.metadata.pickupLat) : undefined) ||
    23.7925;

  const pickupLng =
    (pendingRide ? Number(pendingRide.pickupLng) : undefined) ||
    (session.metadata?.pickupLng ? Number(session.metadata.pickupLng) : undefined) ||
    90.4078;

  const destinationLat =
    (pendingRide ? Number(pendingRide.destinationLat) : undefined) ||
    (session.metadata?.destinationLat ? Number(session.metadata.destinationLat) : undefined) ||
    23.7808;

  const destinationLng =
    (pendingRide ? Number(pendingRide.destinationLng) : undefined) ||
    (session.metadata?.destinationLng ? Number(session.metadata.destinationLng) : undefined) ||
    90.4192;

  const distanceKm =
    (pendingRide ? Number(pendingRide.distanceKm) : undefined) ||
    (session.metadata?.distanceKm ? Number(session.metadata.distanceKm) : undefined) ||
    4.5;

  // Clear Redis temporary entry immediately to prevent duplicate concurrent creation
  if (tempRideId) {
    await deletePendingRide(tempRideId);
  }

  // Create Ride and Payment transactionally in PostgreSQL
  const [newRide, newPayment] = await prisma.$transaction(async (tx) => {
    const ride = await tx.ride.create({
      data: {
        customerId: targetCustomerId,
        pickupLat,
        pickupLng,
        destinationLat,
        destinationLng,
        vehicleType,
        distanceKm,
        fare,
        status: "REQUESTED",
        currentRadiusKm: 2.0,
      },
      include: {
        customer: true,
      },
    });

    const payment = await tx.payment.create({
      data: {
        rideId: ride.id,
        amount: fare,
        status: "HELD",
      },
    });

    return [ride, payment];
  });

  // Record session and tempRideId as processed for idempotency
  await setProcessedSession(sessionId, newRide.id);
  if (tempRideId) {
    await setProcessedSession(tempRideId, newRide.id);
  }

  // Trigger 2.0 km radius matching engine (expands to 4.0 km after 30s)
  matchingService.publishRideOffer(newRide.id).catch((err) => {
    console.error(
      "Failed to publish ride offer after Stripe verification:",
      err,
    );
  });

  const immediateRidePayload = {
    id: newRide.id,
    rideId: newRide.id,
    pickup,
    destination,
    pickupLat: Number(newRide.pickupLat),
    pickupLng: Number(newRide.pickupLng),
    destinationLat: Number(newRide.destinationLat),
    destinationLng: Number(newRide.destinationLng),
    vehicleType: newRide.vehicleType,
    distanceKm: Number(newRide.distanceKm),
    pickupDistanceKm: 0.5,
    fare: Number(newRide.fare),
    grossFare: Number(newRide.fare),
    netEarnings: Number((Number(newRide.fare) * 0.9).toFixed(2)),
    status: "REQUESTED",
    customerName: newRide.customer?.name || "Customer",
    customerRating: "4.9 ★",
    createdAt: newRide.createdAt.toISOString(),
    expiresInSeconds: 30,
  };

  emitToDrivers("ride:requested", immediateRidePayload, newRide.vehicleType);

  // Real-time notification to ride room and customer
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
    status: "REQUESTED",
    paymentStatus: "HELD",
    pickup,
    destination,
    pickupLat: Number(newRide.pickupLat),
    pickupLng: Number(newRide.pickupLng),
    destinationLat: Number(newRide.destinationLat),
    destinationLng: Number(newRide.destinationLng),
    customer: {
      id: newRide.customer?.id || newRide.customerId,
      name: newRide.customer?.name || "Customer",
    },
    driver: null,
  };
};

export const paymentService = {
  createCheckoutSessionService,
  verifyPaymentSessionService,
};

export default paymentService;
