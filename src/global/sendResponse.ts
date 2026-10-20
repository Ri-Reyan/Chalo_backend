import type { Response } from "express";

interface PayloadType {
  success: boolean;
  statusCode: number;
  message: string;
  error?: unknown;
  data?: any;
  metadata?: any;
}

const sendResponse = (res: Response, payload: PayloadType) => {
  const response = {
    success: payload.success,
    statusCode: payload.statusCode,
    message: payload.message,
    error: payload.error,
    data: payload.data,
    metadata: payload.metadata,
  };

  return res.status(payload.statusCode).json(response);
};

export default sendResponse;
