export interface RegisterServicePayload {
  name: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "DRIVER";
  vehicleType?: "CAR" | "BIKE";
}
