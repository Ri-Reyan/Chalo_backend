import prisma from "../../lib/prisma.js";
import AppError from "../../global/AppError.js";
import type {
  UpdateStatusInput,
  UpdateLocationInput,
  CreateWithdrawalInput,
} from "./driver.schema.js";

const resolveDriverId = async (providedId?: string): Promise<string> => {
  if (providedId) return providedId;
  const defaultDriver = await prisma.user.findFirst({
    where: { role: "DRIVER" },
  });
  if (defaultDriver) return defaultDriver.id;
  throw new AppError("No driver profile found.", 404);
};

const updateStatusService = async (
  input: UpdateStatusInput,
  authenticatedUserId?: string,
) => {
  const driverId = await resolveDriverId(authenticatedUserId || input.driverId);

  const updatedDriver = await prisma.user.update({
    where: { id: driverId },
    data: { isOnline: input.isOnline },
  });

  return {
    driverId: updatedDriver.id,
    isOnline: updatedDriver.isOnline,
    name: updatedDriver.name,
  };
};

const updateLocationService = async (
  input: UpdateLocationInput,
  authenticatedUserId?: string,
) => {
  const driverId = await resolveDriverId(authenticatedUserId || input.driverId);

  const updatedDriver = await prisma.user.update({
    where: { id: driverId },
    data: {
      lat: input.lat,
      lng: input.lng,
    },
  });

  return {
    driverId: updatedDriver.id,
    lat: Number(updatedDriver.lat),
    lng: Number(updatedDriver.lng),
  };
};

const getBalanceService = async (authenticatedUserId?: string) => {
  const driverId = await resolveDriverId(authenticatedUserId);

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    include: {
      withdrawals: {
        orderBy: { createdAt: "desc" },
      },
      ridesAsDriver: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
      },
    },
  });

  if (!driver) {
    throw new AppError("Driver not found.", 404);
  }

  const completedTrips = driver.ridesAsDriver.map((ride) => {
    const grossFare = Number(ride.fare);
    const netEarnings = Number((grossFare * 0.9).toFixed(2));
    return {
      id: ride.id,
      grossFare,
      netEarnings,
      platformCut: Number((grossFare * 0.1).toFixed(2)),
      completedAt: ride.completedAt?.toISOString(),
    };
  });

  const withdrawals = driver.withdrawals.map((w) => ({
    id: w.id,
    amount: Number(w.amount),
    status: w.status,
    createdAt: w.createdAt.toISOString(),
  }));

  return {
    driverId: driver.id,
    name: driver.name,
    balance: Number(driver.balance),
    isOnline: driver.isOnline,
    withdrawals,
    completedTrips,
  };
};

const createWithdrawalService = async (
  input: CreateWithdrawalInput,
  authenticatedUserId?: string,
) => {
  const driverId = await resolveDriverId(authenticatedUserId || input.driverId);
  const requestedAmount = input.amount;

  if (requestedAmount < 10) {
    throw new AppError("Minimum withdrawal threshold is $10.00", 400);
  }

  // Transactionally verify balance, deduct, and create withdrawal
  const withdrawal = await prisma.$transaction(async (tx) => {
    const driver = await tx.user.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new AppError("Driver account not found.", 404);
    }

    const currentBalance = Number(driver.balance);
    if (currentBalance < requestedAmount) {
      throw new AppError(
        `Insufficient balance. Available: $${currentBalance.toFixed(2)}, Requested: $${requestedAmount.toFixed(2)}`,
        400,
      );
    }

    // 1. Deduct balance
    const updatedDriver = await tx.user.update({
      where: { id: driverId },
      data: {
        balance: {
          decrement: requestedAmount,
        },
      },
    });

    // 2. Create Withdrawal record
    const created = await tx.withdrawal.create({
      data: {
        driverId,
        amount: requestedAmount,
        status: "PENDING",
      },
    });

    return {
      withdrawalId: created.id,
      amount: Number(created.amount),
      status: created.status,
      remainingBalance: Number(updatedDriver.balance),
      createdAt: created.createdAt.toISOString(),
    };
  });

  return withdrawal;
};

export const driverService = {
  updateStatusService,
  updateLocationService,
  getBalanceService,
  createWithdrawalService,
};

export default driverService;

