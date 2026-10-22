# 🚕 Chalo Backend API & Real-Time Engine

> High-performance, event-driven Node.js & TypeScript backend powering the **Chalo** ride-hailing mobility ecosystem. Features real-time driver dispatching with Socket.IO, automated fare calculation, Stripe escrow payments, and transactional ledger accounting with Prisma & PostgreSQL.

---

## 📑 Table of Contents
- [Overview](#-overview)
- [Problem & Solution](#-problem--solution)
- [Core Architecture & Tech Stack](#-core-architecture--tech-stack)
- [Ride Lifecycle & State Workflow](#-ride-lifecycle--state-workflow)
- [Database Schema (Prisma PostgreSQL)](#-database-schema-prisma-postgresql)
- [Real-Time Socket.IO Protocol](#-real-time-socketio-protocol)
- [API Documentation & Endpoints](#-api-documentation--endpoints)
- [Setup & Installation Guide](#-setup--installation-guide)
- [Environment Variables (.env.example)](#-environment-variables-envexample)
- [Testing & Quality Verification](#-testing--quality-verification)

---

## 🌟 Overview

Chalo Backend is an enterprise-grade REST and WebSocket API built to handle the entire lifecycle of on-demand transportation:
1. **Unified Authentication**: Single credentials endpoint for Customers and Drivers with Argon2 password hashing and dual JWT (HTTP-only cookie + Bearer) architecture.
2. **Dynamic Fare Engine**: Accurate Haversine geodetic distance computing with vehicle-specific base rates and per-kilometer pricing (Motorbike vs. Car).
3. **Escrow Payments via Stripe**: Upfront checkout sessions holding fares in escrow (`HELD`) before dispatch, automatic payout transfer on trip completion (`CAPTURED`), and zero-friction refund execution on expiry/cancellation (`REFUNDED`).
4. **Broadcast Matching System**: Online driver notification via dedicated Socket.IO rooms (`drivers:online`, vehicle-specific pools, and private user channels).
5. **Driver Wallet & Ledger**: 90% net earnings credited transactionally with platform commission deductions and withdrawal accounting.

---

## 🎯 Problem & Solution

### The Problem
Traditional transportation and prototype ride-hailing services suffer from:
- **Payment Insecurity**: Rides booked without verified funds lead to driver cancellations, fare evasion, and uncollectible revenues.
- **Race Conditions in Dispatching**: Multiple drivers accepting the same ride simultaneously leads to ghost bookings and database deadlock.
- **Unreliable Polling**: Conventional HTTP polling drains battery, delays driver alerts, and overburdens application databases.
- **Premature Timeouts**: Restrictive geographic radius limits fail to notify available drivers in less dense areas.

### The Chalo Solution
- **Stripe Upfront Escrow**: Customer funds are verified and held in escrow *before* dispatching begins. If no driver accepts or the ride is cancelled, Stripe handles automatic refunds.
- **Atomic Dispatch Locking**: Ride acceptance uses database atomic updates with conditional WHERE clauses (`status === 'REQUESTED'`). Only the first driver to commit succeeds; others receive immediate `Offer Taken` socket broadcasts.
- **Event-Driven WebSockets**: Instant bi-directional communication for trip requests, driver arrival, in-transit telemetry, and trip completions.
- **Resilient Matching Window**: Extended 10-minute matching window with universal online driver dispatching prevents premature refunding while drivers evaluate incoming offers.

---

## 🏗️ Core Architecture & Tech Stack

```
                          ┌───────────────────────────┐
                          │   Chalo Client (Next.js)   │
                          └─────────────┬─────────────┘
                                        │
                         HTTP REST      │  WebSocket (Socket.IO)
                       (Axios + Auth)   │  (Events & Rooms)
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │                       Chalo Express Application                         │
    │  ┌───────────────────────┐                  ┌───────────────────────┐  │
    │  │  Auth & Middleware    │                  │  Socket.IO Engine     │  │
    │  │  - Argon2 Hash Verify │                  │  - Room Management    │  │
    │  │  - JWT Cookie/Bearer  │                  │  - Event Broadcaster  │  │
    │  │  - Rate Limiter       │                  │  - Driver Channels    │  │
    │  └──────────┬────────────┘                  └───────────┬───────────┘  │
    │             │                                           │              │
    │             ▼                                           ▼              │
    │  ┌──────────────────────────────────────────────────────────────────┐  │
    │  │                      Module Business Services                    │  │
    │  │  • Auth Service          • Ride Service (Distance & Fare)        │  │
    │  │  • Matching Service      • Payment Service (Stripe Escrow)       │  │
    │  │  • Driver Wallet Service • Ride Cache Service (Redis/Memory)     │  │
    │  └───────────────────┬───────────────────────────────┬──────────────┘  │
    └──────────────────────┼───────────────────────────────┼─────────────────┘
                           │                               │
            Prisma ORM     ▼                               ▼   Redis REST API
    ┌───────────────────────────────┐              ┌───────────────────────────┐
    │     PostgreSQL Database       │              │       Upstash Redis       │
    │  - users (Customer/Driver)    │              │  - Session idempotency    │
    │  - rides (Lifecycle state)    │              │  - Temporary ride cache   │
    │  - payments (Escrow status)   │              │  - Rate-limit pipeline    │
    │  - withdrawals (Payout logs)  │              └───────────────────────────┘
    └───────────────────────────────┘
```

| Technology | Purpose |
|---|---|
| **Node.js (v20+) & TypeScript** | Type-safe, high-concurrency runtime environment |
| **Express.js (v5)** | Modular REST routing and middleware architecture |
| **Socket.IO (v4.8)** | Bi-directional real-time event broadcasting and room isolation |
| **Prisma ORM (v7.10)** | Multi-file schema mapping, type-safe queries, connection pooling |
| **PostgreSQL (Supabase)** | Relational ACID-compliant transactional persistence |
| **Upstash Redis** | Serverless rate-limiting and session idempotency caching |
| **Stripe Node SDK** | Upfront escrow checkout sessions and programmatic refunds |
| **Argon2** | Next-generation password hashing resistant to GPU/ASIC attacks |
| **Zod** | Strict runtime schema parsing and request payload validation |

---

## 🔄 Ride Lifecycle & State Workflow

```
[Customer Selects Route]
        │
        ▼
POST /api/rides (Creates Temporary Ride in Redis / DB)
        │
        ▼
Stripe Checkout Session Initialized (Fare Held in Escrow)
        │
        ▼ (Customer Pays via Stripe)
POST /api/payments/verify-session
        │
        ├─────────────────────────────────────────────────┐
        ▼                                                 ▼
Database: Ride status -> REQUESTED            Socket: Broadcast "ride:requested"
Payment: status -> HELD                       to all active online drivers
        │
        ├─────────────────────────────────────────────────┐
        ▼ (Driver accepts)                                ▼ (10 min timeout / Cancel)
POST /api/rides/:id/accept                       Matching Service Timeout / User Cancel
        │                                                 │
        ▼                                                 ▼
Database: status -> ACCEPTED                     Database: status -> NO_DRIVER_FOUND / CANCELLED
Socket: Broadcast "ride:accepted" & "ride:taken" Payment: status -> REFUNDED
        │                                        Socket: Emit "ride:no_driver"
        ▼
Driver arrives -> Socket "driver:arrived"
        │
        ▼
Driver starts trip -> Socket "ride:started"
        │
        ▼
Customer confirms drop-off: POST /api/rides/:id/complete
        │
        ▼
Database: status -> COMPLETED
Payment: status -> CAPTURED
Driver Balance: +90% Net Fare
Platform Cut: 10%
Socket: Broadcast "ride:completed" to ride room
```

---

## 🗄️ Database Schema (Prisma PostgreSQL)

The schema is organized modularly in `prisma/schema/*.prisma`:

### Enums
- `Role`: `CUSTOMER` | `DRIVER`
- `VehicleType`: `BIKE` | `CAR`
- `RideStatus`: `REQUESTED` | `ACCEPTED` | `COMPLETED` | `NO_DRIVER_FOUND` | `CANCELLED`
- `PaymentStatus`: `HELD` | `CAPTURED` | `REFUNDED`
- `WithdrawalStatus`: `PENDING` | `COMPLETED` | `REJECTED`

### Core Models
- **`User`**: ID, name, email, passwordHash, role, vehicleType, isOnline, lat/lng coordinates, balance (Decimal), timestamps.
- **`Ride`**: ID, customerId, driverId (optional), pickup/destination coordinates (Decimal 10,7), vehicleType, distanceKm, fare, status, currentRadiusKm, acceptedAt, completedAt.
- **`Payment`**: ID, rideId (1-to-1 with Ride), amount, status (`HELD` -> `CAPTURED` / `REFUNDED`), timestamps.
- **`Withdrawal`**: ID, driverId, amount, status, timestamps.

---

## 📡 Real-Time Socket.IO Protocol

### Driver Connection & Rooms
- **`join:driver`**: Driver joins `drivers:online`, `drivers`, and vehicle-specific rooms (`driver_vehicle_BIKE` or `driver_vehicle_CAR`).
- **`join:user`**: User joins personal direct notification room `user:<userId>`.
- **`driver:online` / `driver:offline`**: Toggles live dispatch eligibility and room membership.

### Ride Progression Events
- **`ride:requested`**: Broadcast to all online drivers with fare, pickup, destination, and passenger details.
- **`ride:accepted`**: Emitted to ride room and customer when a driver claims the offer.
- **`ride:taken`**: Broadcast to remaining drivers to dismiss the countdown card.
- **`driver:arrived`**: Driver informs passenger of arrival at pickup point.
- **`ride:started`**: Driver initiates the journey toward the destination.
- **`driver:location`**: Driver broadcasts coordinate progression to customer live tracking.
- **`ride:completed`**: Triggered upon passenger arrival confirmation; captures funds and unlocks review modal.
- **`ride:cancelled` / `ride:no_driver`**: Notifies parties of ride voidance and automated refunding.

---

## 🔌 API Documentation & Endpoints

### 1. Authentication (`/api/auth`)
- `POST /api/auth/register`: Create Customer or Driver account.
- `POST /api/auth/login`: Unified login endpoint returning JWT credentials and role.
- `GET /api/auth/me`: Validate active cookie/bearer session and fetch profile.
- `POST /api/auth/logout`: Clears authentication cookies.

### 2. Rides & Dispatching (`/api/rides`)
- `POST /api/rides`: Create a pending ride request and generate Stripe Checkout URL.
- `GET /api/rides/active`: Fetch current active ongoing ride for Customer or Driver.
- `GET /api/rides/available`: Fetch pending available ride offers matching driver vehicle.
- `POST /api/rides/:id/accept`: Atomically claim an offer (Driver only).
- `POST /api/rides/:id/complete`: Confirm arrival, release escrow, and credit driver (Customer only).
- `POST /api/rides/:id/cancel`: Cancel trip and trigger payment refund.
- `GET /api/rides/history`: Retrieve past completed/cancelled trips with receipt breakdown.

### 3. Payments & Escrow (`/api/payments`)
- `POST /api/payments/create-session`: Generate Stripe checkout session for a ride.
- `POST /api/payments/verify-session`: Verify Stripe checkout session, lock escrow hold, and trigger matching dispatch.

### 4. Driver Partner Operations (`/api/drivers`)
- `GET /api/drivers/balance`: Get real-time driver wallet balance and online state.
- `PATCH /api/drivers/status`: Toggle driver availability (`isOnline: boolean`).
- `PATCH /api/drivers/location`: Update driver GPS coordinates.
- `POST /api/drivers/withdraw`: Request settlement payout from available balance.
- `GET /api/drivers/history`: Retrieve driver payout and withdrawal history.

---

## 🚀 Setup & Installation Guide

### Prerequisites
- Node.js `20.x` or higher
- npm, pnpm, or yarn
- PostgreSQL database (Supabase recommended)
- Upstash Redis account (free tier works)
- Stripe account with test API keys

### Step-by-Step Setup

1. **Navigate to the backend directory**:
   ```bash
   cd chalo-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your actual Supabase PostgreSQL URLs, Upstash Redis credentials, and Stripe test keys.

4. **Run Database Migrations & Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The backend API will start on `http://localhost:4000` with hot-reload enabled.

---

## ⚙️ Environment Variables (.env.example)

```env
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

UPSTASH_REDIS_REST_URL="https://[YOUR_INSTANCE].upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_redis_rest_token"

JWT_ACCESS_TOKEN="your_jwt_access_secret_min_32_chars"
JWT_REFRESH_TOKEN="your_jwt_refresh_secret_min_32_chars"
JWT_ACCESS_TOKEN_TIME="15m"
JWT_REFRESH_TOKEN_TIME="7d"

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

---

## 🧪 Testing & Quality Verification

```bash
# Validate Prisma schema definitions
npm run prisma:validate

# Format Prisma schema files
npm run prisma:format

# Compile TypeScript production build
npm run build

# Start production server
npm start
```
