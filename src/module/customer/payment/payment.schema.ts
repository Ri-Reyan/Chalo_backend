import z from "zod";

export const createCheckoutSessionSchema = z.object({
  rideId: z.string().nullable().optional(),
  tempRideId: z.string().nullable().optional(),
  fare: z.number().optional(),
  pickup: z.string().optional(),
  destination: z.string().optional(),
  vehicleType: z.enum(["BIKE", "CAR"]).optional().default("BIKE"),
});

export const verifyPaymentSchema = z.object({
  sessionId: z.string().min(1, { message: "Stripe Session ID is required" }),
  rideId: z.string().nullable().optional(),
  tempRideId: z.string().nullable().optional(),
});

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

