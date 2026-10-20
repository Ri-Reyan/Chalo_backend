import AppError from "./AppError.js";
import sendResponse from "./sendResponse.js";

const errorHandler = (err: any, req: any, res: any, next: any) => {
  let error = err;

  if (err.code === "P2002") {
    const field = err.meta.target[0] || "field";
    error = new AppError(`A record with this ${field} already exists.`, 400);
  }

  if (err.code === "P2025") {
    error = new AppError(`The requested record was not found.`, 404);
  }

  if (
    err.code === "ETIMEOUT" ||
    err.code === "ECONNREFUSED" ||
    err.code === "ECONNRESET" ||
    err.code === "ENOTFOUND" ||
    err.code === "EAI_AGAIN" ||
    err.code === "ECONNABORTED" ||
    err.code === "EHOSTUNREACH" ||
    err.code === "EPIPE" ||
    err.code === "ETIMEDOUT" ||
    err.code === "EADDRNOTAVAIL" ||
    err.code === "EADDRINUSE" ||
    err.code === "ENETDOWN" ||
    err.code === "ENETUNREACH" ||
    err.code === "ENETRESET" ||
    err.code === "PrismaClientInitializationError"
  ) {
    error = new AppError(
      "A database connection error occurred. Please try again later.",
      503,
    );
  }

  const statusCode = error.statusCode || 500;

  const message =
    error.message || "Internal Server Error! Please try again later.";

  if (process.env.NODE_ENV === "development") {
    return sendResponse(res, {
      success: false,
      statusCode,
      message,
      error: error,
    });
  }

  if (error.isOperational) {
    return sendResponse(res, {
      success: false,
      statusCode,
      message,
    });
  }

  console.error("UNHANDLED ERROR 💥", error);
  return sendResponse(res, {
    success: false,
    statusCode: 500,
    message: "Internal Server Error! Please try again later.",
  });
};

export default errorHandler;
