import jwt from "jsonwebtoken";

interface JWTPayloadType {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "DRIVER";
}

export const genToken = (
  payload: JWTPayloadType,
  secret: string,
  time: jwt.SignOptions["expiresIn"],
) => {
  return jwt.sign(payload, secret, {
    expiresIn: time,
  });
};
