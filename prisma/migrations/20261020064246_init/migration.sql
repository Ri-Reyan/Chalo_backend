-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'COMPLETED', 'NO_DRIVER_FOUND');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'DRIVER');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BIKE', 'CAR');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('HELD', 'CAPTURED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rides" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "driverId" TEXT,
    "pickupLat" DECIMAL(10,7) NOT NULL,
    "pickupLng" DECIMAL(10,7) NOT NULL,
    "destinationLat" DECIMAL(10,7) NOT NULL,
    "destinationLng" DECIMAL(10,7) NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "distanceKm" DECIMAL(8,2) NOT NULL,
    "fare" DECIMAL(12,2) NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "currentRadiusKm" DECIMAL(6,2) NOT NULL DEFAULT 3.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "vehicleType" "VehicleType",
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_rideId_key" ON "payments"("rideId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "rides_customerId_idx" ON "rides"("customerId");

-- CreateIndex
CREATE INDEX "rides_driverId_idx" ON "rides"("driverId");

-- CreateIndex
CREATE INDEX "rides_status_idx" ON "rides"("status");

-- CreateIndex
CREATE INDEX "rides_status_createdAt_idx" ON "rides"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isOnline_idx" ON "users"("role", "isOnline");

-- CreateIndex
CREATE INDEX "withdrawals_driverId_idx" ON "withdrawals"("driverId");

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
