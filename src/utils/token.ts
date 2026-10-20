import jwt from "jsonwebtoken";

export interface JWTPayloadType {
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

export const verifyToken = <T = JWTPayloadType>(
  token: string,
  secret: string,
): T => {
  return jwt.verify(token, secret) as T;
};
