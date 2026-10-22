import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import credentials from "../config/credentials.js";

let io: SocketIOServer | null = null;

export const initSocket = (server: HttpServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        credentials.client_url as string,
      ],
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    const query = socket.handshake.query;
    const initialUserId = query.userId as string | undefined;
    const initialRole = query.role as string | undefined;
    const initialRideId = query.rideId as string | undefined;
    const initialVehicleType = query.vehicleType as string | undefined;

    if (initialUserId) {
      socket.join(`user:${initialUserId}`);
      if (initialRole === "DRIVER") {
        socket.join("drivers:online");
        socket.join("drivers");
        if (initialVehicleType) {
          socket.join(`driver_vehicle_${initialVehicleType}`);
          socket.join(`drivers_${initialVehicleType}`);
          socket.join(`drivers:${initialVehicleType}`);
        }
      }
    }

    if (initialRideId) {
      socket.join(`ride:${initialRideId}`);
    }

    // Explicit driver pool room subscription
    socket.on(
      "join:driver",
      ({
        vehicleType,
        driverId,
      }: {
        vehicleType?: string;
        driverId?: string;
      } = {}) => {
        socket.join("drivers:online");
        socket.join("drivers");
        if (vehicleType) {
          socket.join(`driver_vehicle_${vehicleType}`);
          socket.join(`drivers_${vehicleType}`);
          socket.join(`drivers:${vehicleType}`);
        }
        if (driverId) {
          socket.join(`user:${driverId}`);
        }
      },
    );

    // Client explicitly joins personal user notification channel
    socket.on(
      "join:user",
      ({
        userId,
        role,
        vehicleType,
      }: {
        userId: string;
        role?: string;
        vehicleType?: string;
      }) => {
        if (userId) {
          socket.join(`user:${userId}`);
          if (role === "DRIVER") {
            socket.join("drivers:online");
            socket.join("drivers");
            if (vehicleType) {
              socket.join(`driver_vehicle_${vehicleType}`);
              socket.join(`drivers_${vehicleType}`);
              socket.join(`drivers:${vehicleType}`);
            }
          }
        }
      },
    );

    // Driver toggling online channel
    socket.on(
      "driver:online",
      ({
        driverId,
        vehicleType,
      }: {
        driverId?: string;
        vehicleType?: string;
      } = {}) => {
        socket.join("drivers:online");
        socket.join("drivers");
        if (vehicleType) {
          socket.join(`driver_vehicle_${vehicleType}`);
          socket.join(`drivers_${vehicleType}`);
          socket.join(`drivers:${vehicleType}`);
        }
        if (driverId) {
          socket.join(`user:${driverId}`);
        }
      },
    );

    socket.on(
      "driver:offline",
      ({ vehicleType }: { vehicleType?: string } = {}) => {
        socket.leave("drivers:online");
        socket.leave("drivers");
        if (vehicleType) {
          socket.leave(`driver_vehicle_${vehicleType}`);
          socket.leave(`drivers_${vehicleType}`);
          socket.leave(`drivers:${vehicleType}`);
        }
      },
    );

    // Customer or Driver joining specific ride room for live tracking
    socket.on("ride:join", ({ rideId }: { rideId: string }) => {
      if (rideId) {
        socket.join(`ride:${rideId}`);
      }
    });

    socket.on("ride:leave", ({ rideId }: { rideId: string }) => {
      if (rideId) {
        socket.leave(`ride:${rideId}`);
      }
    });

    // Streaming driver location coordinates during an ongoing trip
    socket.on(
      "driver:location",
      (data: { rideId: string; lat: number; lng: number }) => {
        if (data?.rideId) {
          socket.to(`ride:${data.rideId}`).emit("driver:location", {
            lat: data.lat,
            lng: data.lng,
          });
        }
      },
    );

    socket.on("disconnect", () => {
      // Clean disconnect
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error(
      "Socket.IO is not initialized yet. Call initSocket(server) first.",
    );
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToDrivers = (
  event: string,
  data: any,
  vehicleType?: string,
) => {
  if (!io) return;
  io.to("drivers:online").to("drivers").emit(event, data);
  if (vehicleType) {
    io.to(`driver_vehicle_${vehicleType}`)
      .to(`drivers_${vehicleType}`)
      .to(`drivers:${vehicleType}`)
      .emit(event, data);
  }
};

export const emitToDriverVehicle = (
  vehicleType: string,
  event: string,
  data: any,
) => {
  if (!io) return;
  io.to(`driver_vehicle_${vehicleType}`)
    .to(`drivers_${vehicleType}`)
    .to(`drivers:${vehicleType}`)
    .emit(event, data);
};

export const emitToRide = (rideId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`ride:${rideId}`).emit(event, data);
};
