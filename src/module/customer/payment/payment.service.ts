import prisma from "../../../lib/prisma.js";
import AppError from "../../../global/AppError.js";
import stripe from "../../../lib/stripe.js";
import matchingService from "../../matching/matching.service.js";
import { emitToRide, emitToUser } from "../../../lib/socket.js";
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

const verifyPaymentSessionService = async (input: VerifyPaymentInput) => {
  const { sessionId } = input;

  // 1. Idempotency Check: Was this session already processed?
  const alreadyProcessedRideId = await getProcessedSession(sessionId);
  if (alreadyProcessedRideId) {
    const existingRide = await prisma.ride.findUnique({
      where: { id: alreadyProcessedRideId },
      include: {
        customer: true,
        payment: true,
      },
    });

    if (existingRide) {
      return {
        rideId: existingRide.id,
        fare: Number(existingRide.fare),
        distanceKm: Number(existingRide.distanceKm),
        vehicleType: existingRide.vehicleType,
        status: existingRide.status,
        paymentStatus: existingRide.payment?.status || "HELD",
        customer: {
          id: existingRide.customer?.id || existingRide.customerId,
          name: existingRide.customer?.name || "Customer",
        },
      };
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
          payment: true,
        },
      });

      if (existingRide) {
        return {
          rideId: existingRide.id,
          fare: Number(existingRide.fare),
          distanceKm: Number(existingRide.distanceKm),
          vehicleType: existingRide.vehicleType,
          status: existingRide.status,
          paymentStatus: existingRide.payment?.status || "HELD",
          customer: {
            id: existingRide.customer?.id || existingRide.customerId,
            name: existingRide.customer?.name || "Customer",
          },
        };
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

  // 3. If temporary ride in Redis: Create PostgreSQL records only after payment confirmation!
  if (tempRideId) {
    // Check if a ride was already created for this tempRideId
    const existingRideId = await getProcessedSession(tempRideId);
    if (existingRideId) {
      const existingRide = await prisma.ride.findUnique({
        where: { id: existingRideId },
        include: { customer: true, payment: true },
      });
      if (existingRide) {
        await deletePendingRide(tempRideId);
        await setProcessedSession(sessionId, existingRide.id);
        return {
          rideId: existingRide.id,
          fare: Number(existingRide.fare),
          distanceKm: Number(existingRide.distanceKm),
          vehicleType: existingRide.vehicleType,
          status: existingRide.status,
          paymentStatus: existingRide.payment?.status || "HELD",
          customer: {
            id: existingRide.customer?.id || existingRide.customerId,
            name: existingRide.customer?.name || "Customer",
          },
        };
      }
    }

    const pendingRide = await getPendingRide(tempRideId);

    if (pendingRide) {
      // Clear the temporary payload immediately to prevent any concurrent duplicate insertion
      await deletePendingRide(tempRideId);

      // Create Ride and Payment transactionally in PostgreSQL
      const [newRide, newPayment] = await prisma.$transaction(async (tx) => {
        const ride = await tx.ride.create({
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

        const payment = await tx.payment.create({
          data: {
            rideId: ride.id,
            amount: pendingRide.fare,
            status: "HELD",
          },
        });

        return [ride, payment];
      });

      // Record session and tempRideId as processed for idempotency
      await setProcessedSession(sessionId, newRide.id);
      await setProcessedSession(tempRideId, newRide.id);

      // Trigger 2.0 km radius matching engine (expands to 4.0 km after 30s)
      matchingService.publishRideOffer(newRide.id).catch((err) => {
        console.error(
          "Failed to publish ride offer after Stripe verification:",
          err,
        );
      });

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
        pickup: pendingRide.pickup,
        destination: pendingRide.destination,
        customer: {
          id: newRide.customer?.id || newRide.customerId,
          name: newRide.customer?.name || "Customer",
        },
      };
    }
  }

  // 4. Fallback for existing database ride
  const rideId = session.metadata?.rideId || input.rideId;
  if (!rideId) {
    throw new AppError("No ride reference associated with this payment.", 400);
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      customer: true,
      payment: true,
      driver: true,
    },
  });

  if (!ride) {
    throw new AppError("Associated ride not found.", 404);
  }

  // Transactionally update payment status to HELD and ensure ride is REQUESTED
  await prisma.$transaction(async (tx) => {
    if (ride.payment) {
      await tx.payment.update({
        where: { id: ride.payment.id },
        data: { status: "HELD" },
      });
    }

    await tx.ride.update({
      where: { id: ride.id },
      data: { status: "REQUESTED" },
    });
  });

  // Record session as processed
  await setProcessedSession(sessionId, ride.id);

  // Trigger radius matching to notify eligible drivers within 2km -> 4km
  matchingService.publishRideOffer(ride.id).catch((err) => {
    console.error(
      "Failed to publish ride offer after Stripe verification:",
      err,
    );
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
    status: "REQUESTED",
    paymentStatus: "HELD",
    customer: {
      id: ride.customer?.id || ride.customerId,
      name: ride.customer?.name || "Customer",
    },
  };
};

export const paymentService = {
  createCheckoutSessionService,
  verifyPaymentSessionService,
};

export default paymentService;
