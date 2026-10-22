import z from "zod";

export const updateStatusSchema = z.object({
  isOnline: z.boolean(),
  driverId: z.string().optional(),
});

export const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  driverId: z.string().optional(),
});

export const createWithdrawalSchema = z.object({
  amount: z.coerce.number().min(10, { message: "Minimum withdrawal amount is $10.00" }),
  method: z.string().optional(),
  accountNumber: z.string().optional(),
  driverId: z.string().optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;

