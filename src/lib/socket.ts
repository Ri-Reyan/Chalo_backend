import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

export const initSocket = (server: HttpServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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

    if (initialUserId) {
      socket.join(`user:${initialUserId}`);
      if (initialRole === "DRIVER") {
        socket.join("drivers:online");
      }
    }

    if (initialRideId) {
      socket.join(`ride:${initialRideId}`);
    }

    // Client explicitly joins personal user notification channel
    socket.on("join:user", ({ userId, role }: { userId: string; role?: string }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        if (role === "DRIVER") {
          socket.join("drivers:online");
        }
      }
    });

    // Driver toggling online channel
    socket.on("driver:online", ({ driverId }: { driverId: string }) => {
      if (driverId) {
        socket.join(`user:${driverId}`);
        socket.join("drivers:online");
      }
    });

    socket.on("driver:offline", () => {
      socket.leave("drivers:online");
    });

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
    throw new Error("Socket.IO is not initialized yet. Call initSocket(server) first.");
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToDrivers = (event: string, data: any) => {
  if (!io) return;
  io.to("drivers:online").emit(event, data);
};

export const emitToRide = (rideId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`ride:${rideId}`).emit(event, data);
};

