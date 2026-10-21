import z from "zod";

export const estimateRideSchema = z.object({
  pickupLat: z
    .number()
    .min(-90, { message: "pickupLat must be between -90 and 90" })
    .max(90, { message: "pickupLat must be between -90 and 90" }),
  pickupLng: z
    .number()
    .min(-180, { message: "pickupLng must be between -180 and 180" })
    .max(180, { message: "pickupLng must be between -180 and 180" }),
  destinationLat: z
    .number()
    .min(-90, { message: "destinationLat must be between -90 and 90" })
    .max(90, { message: "destinationLat must be between -90 and 90" }),
  destinationLng: z
    .number()
    .min(-180, { message: "destinationLng must be between -180 and 180" })
    .max(180, { message: "destinationLng must be between -180 and 180" }),
  vehicleType: z.enum(["BIKE", "CAR"]).default("BIKE"),
});

export type EstimateRideInput = z.infer<typeof estimateRideSchema>;

export const createRideSchema = z.object({
  pickup: z.string().min(1, { message: "Pickup location address is required" }),
  destination: z
    .string()
    .min(1, { message: "Destination address is required" }),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  vehicleType: z.enum(["BIKE", "CAR"]).default("BIKE"),
});

export type CreateRideInput = z.infer<typeof createRideSchema>;

export const confirmPaymentSchema = z.object({
  rideId: z.string().min(1, { message: "Ride ID is required" }),
  paymentMethod: z.string().optional().default("pm_card_visa"),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

export const acceptRideSchema = z.object({
  rideId: z.string().min(1, { message: "Ride ID is required" }),
});

export type AcceptRideInput = z.infer<typeof acceptRideSchema>;

export const completeRideSchema = z.object({
  rideId: z.string().min(1, { message: "Ride ID is required" }),
});

export type CompleteRideInput = z.infer<typeof completeRideSchema>;

