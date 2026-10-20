import z from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z
    .string()
    .email({ message: "Invalid email address" })
    .max(100, { message: "Email must be less than 100 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(100, { message: "Password must be less than 100 characters" }),
  role: z
    .enum(["CUSTOMER", "DRIVER"], {
      message: "Role must be either 'CUSTOMER' or 'DRIVER'",
    })
    .default("CUSTOMER"),
  vehicleType: z
    .enum(["CAR", "BIKE"], {
      message: "Vehicle type must be either 'car' or 'bike'",
    })
    .optional(),
});
