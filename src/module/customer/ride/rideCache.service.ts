import redis from "../../../lib/redis.js";

export interface PendingRideData {
  tempRideId: string;
  customerId: string;
  pickup: string;
  destination: string;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  vehicleType: "BIKE" | "CAR";
  distanceKm: number;
  fare: number;
  createdAt: string;
}

// In-memory fallback map in case Redis is temporarily unreachable or offline
const memoryFallback = new Map<
  string,
  { data: PendingRideData; expiresAt: number }
>();
const sessionProcessedFallback = new Map<
  string,
  { rideId: string; expiresAt: number }
>();

// Clean up expired entries in memory every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryFallback.entries()) {
    if (item.expiresAt < now) {
      memoryFallback.delete(key);
    }
  }
  for (const [key, item] of sessionProcessedFallback.entries()) {
    if (item.expiresAt < now) {
      sessionProcessedFallback.delete(key);
    }
  }
}, 300000).unref();

const PENDING_RIDE_TTL_SECONDS = 900; // 15 minutes TTL
const PROCESSED_SESSION_TTL_SECONDS = 3600; // 1 hour TTL

/**
 * Stores temporary pending ride payload in Redis with a 15-minute TTL.
 */
export const setPendingRide = async (
  tempRideId: string,
  data: PendingRideData,
): Promise<void> => {
  const key = `pending_ride:${tempRideId}`;
  const serialized = JSON.stringify(data);

  // Always update memory fallback for instant offline/blip resiliency
  memoryFallback.set(tempRideId, {
    data,
    expiresAt: Date.now() + PENDING_RIDE_TTL_SECONDS * 1000,
  });

  try {
    await redis.set(key, serialized, { ex: PENDING_RIDE_TTL_SECONDS });
  } catch (err) {
    console.warn(
      `[Redis Warning] Failed to set pending ride in Redis (${tempRideId}). Using resilient in-memory cache:`,
      (err as Error).message,
    );
  }
};

/**
 * Retrieves temporary pending ride payload from Redis or memory fallback.
 */
export const getPendingRide = async (
  tempRideId: string,
): Promise<PendingRideData | null> => {
  const key = `pending_ride:${tempRideId}`;

  try {
    const raw = await redis.get(key);
    if (raw) {
      if (typeof raw === "string") {
        return JSON.parse(raw) as PendingRideData;
      }
      return raw as PendingRideData;
    }
  } catch (err) {
    console.warn(
      `[Redis Warning] Failed to get pending ride from Redis (${tempRideId}):`,
      (err as Error).message,
    );
  }

  // Fallback to in-memory store
  const cached = memoryFallback.get(tempRideId);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.data;
    }
    memoryFallback.delete(tempRideId);
  }

  return null;
};

/**
 * Deletes temporary pending ride payload from Redis and memory fallback.
 */
export const deletePendingRide = async (tempRideId: string): Promise<void> => {
  const key = `pending_ride:${tempRideId}`;
  memoryFallback.delete(tempRideId);

  try {
    await redis.del(key);
  } catch (err) {
    console.warn(
      `[Redis Warning] Failed to delete pending ride (${tempRideId}) from Redis:`,
      (err as Error).message,
    );
  }
};

/**
 * Marks a Stripe checkout session as processed to ensure idempotency.
 */
export const setProcessedSession = async (
  sessionId: string,
  rideId: string,
): Promise<void> => {
  const key = `processed_session:${sessionId}`;

  sessionProcessedFallback.set(sessionId, {
    rideId,
    expiresAt: Date.now() + PROCESSED_SESSION_TTL_SECONDS * 1000,
  });

  try {
    await redis.set(key, rideId, { ex: PROCESSED_SESSION_TTL_SECONDS });
  } catch (err) {
    console.warn(
      `[Redis Warning] Failed to mark session ${sessionId} as processed in Redis:`,
      (err as Error).message,
    );
  }
};

/**
 * Checks if a Stripe checkout session was already processed.
 */
export const getProcessedSession = async (
  sessionId: string,
): Promise<string | null> => {
  const key = `processed_session:${sessionId}`;

  try {
    const existingRideId = await redis.get<string>(key);
    if (existingRideId) {
      return existingRideId;
    }
  } catch (err) {
    console.warn(
      `[Redis Warning] Failed to check processed session in Redis (${sessionId}):`,
      (err as Error).message,
    );
  }

  const cached = sessionProcessedFallback.get(sessionId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rideId;
  }

  return null;
};

export default {
  setPendingRide,
  getPendingRide,
  deletePendingRide,
  setProcessedSession,
  getProcessedSession,
};

