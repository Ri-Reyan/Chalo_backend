import prisma from "../../lib/prisma.js";
import AppError from "../../global/AppError.js";
import stripe from "../../lib/stripe.js";
import matchingService from "../matching/matching.service.js";
import { emitToRide } from "../../lib/socket.js";
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
  const { rideId } = input;

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
  // Stripe requires amount in lowest currency unit (cents), min 50 cents ($0.50)
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

  // Retrieve real Stripe session
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!session) {
    throw new AppError("Stripe checkout session not found.", 404);
  }

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

  const isPaid =
    session.payment_status === "paid" || session.status === "complete";

  if (!isPaid) {
    throw new AppError(
      "Payment has not been completed. Status: " + session.payment_status,
      400,
    );
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

  // Trigger radius matching to notify eligible drivers within 2km -> 4km
  matchingService.publishRideOffer(ride.id).catch((err) => {
    console.error("Failed to publish ride offer after Stripe verification:", err);
  });

  emitToRide(ride.id, "ride:published", {
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
      id: ride.customer.id,
      name: ride.customer.name,
    },
  };
};

export const paymentService = {
  createCheckoutSessionService,
  verifyPaymentSessionService,
};

export default paymentService;
