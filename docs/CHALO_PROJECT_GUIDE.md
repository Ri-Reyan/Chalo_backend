# Chalo --- End-to-End MVP Guide & LLM Handoff Specification

> **Document purpose:** A single source of truth for AI coding agents,
> developers, and reviewers working on Chalo. Read this document before
> inspecting, planning, or changing code.
>
> **Project type:** Full-stack ride-hailing web application built as an
> interview task.
>
> **Delivery target:** A demonstrable MVP within one day. Prioritize the
> complete happy path, correctness of critical state transitions, and a
> polished interface over feature breadth.
>
> **Currency:** USD (\$).
>
> **Status:** Requirements and architecture direction consolidated;
> implementation progress must be verified from the actual repository.
> Do not assume a milestone is complete merely because it is described
> here.

------------------------------------------------------------------------

## 1. Instructions for Any LLM or IDE Agent

You are contributing to **Chalo**, a simplified Uber/Pathao-inspired
ride-hailing web application. This document defines the product scope,
agreed business rules, technical direction, and implementation
boundaries.

### Mandatory operating rules

1.  **Inspect before changing.** Inspect the existing repository,
    package manager, framework versions, directory structure,
    environment setup, database schema, and current implementation
    before editing anything.
2.  **Treat the repository as the source of truth for implementation
    status.** This document defines intended behavior, not proof that
    code already exists.
3.  **Preserve existing working code.** Do not replace the architecture,
    rewrite files, or create a parallel structure without a demonstrated
    need.
4.  **Work in small milestones.** Implement only the requested
    milestone, run relevant checks, report actual results, and stop for
    review.
5.  **Do not silently invent requirements.** If a decision materially
    affects business behavior, security, data integrity, or scope and is
    not specified here, ask a concise clarification. For low-risk
    implementation details, choose the simplest reasonable option and
    document it.
6.  **Never claim a test, migration, build, or deployment succeeded
    unless it was actually run and passed.**
7.  **Do not expose secrets.** Never print, commit, or copy real
    credentials into documentation, source control, or logs.
8.  **Use clear, interview-defensible engineering.** Prefer
    understandable code and reliable database operations over
    unnecessary abstractions.
9.  **Explain material decisions.** The developer is learning and must
    be able to explain the architecture and key implementation choices
    during an interview.
10. **Do not expand MVP scope without approval.** In particular, do not
    add Stripe, Redis, BullMQ, real payouts, admin dashboards, or
    unrelated features unless explicitly requested.
11. **When requirements conflict:** use the latest explicit product
    decisions in this document for agreed changes; retain the original
    MVP plan for details that have not been changed.
12. **At the end of each task, report:** files changed, behavior
    implemented, commands actually run, test results, known limitations,
    and the next recommended step.

### Recommended workflow for each milestone

1.  Inspect the relevant files and current state.
2.  Summarize the planned changes and any consequential assumptions.
3.  Implement the smallest coherent change set.
4.  Run type checks, lint, tests, schema validation, or builds that are
    available and relevant.
5.  Inspect the diff for accidental changes and secrets.
6.  Report results honestly.
7.  Stop and wait for review before starting the next milestone.

------------------------------------------------------------------------

## 2. Product Overview

Chalo is a simplified ride-hailing web application. A customer selects a
pickup location, destination, and vehicle type. The system calculates a
fare, creates a simulated payment hold, and notifies eligible nearby
drivers. The first driver to successfully accept the ride is assigned to
it. Customer and driver then use a shared live ride experience. When the
customer confirms arrival, the ride completes, the simulated payment is
captured, and the driver's available balance increases.

### MVP success criterion

The MVP is successful when a reviewer can demonstrate this complete
flow:

1.  A customer registers and logs in.
2.  A driver registers, logs in, selects a vehicle type, chooses a
    location, and goes online.
3.  The customer selects pickup and destination, selects a vehicle type,
    and sees distance and fare.
4.  The customer confirms the ride request.
5.  The system records a simulated payment hold and publishes the
    request to eligible drivers.
6.  Matching starts within 2 km and expands to 4 km after 30 seconds if
    nobody accepts.
7.  One driver accepts successfully; competing accept attempts fail
    safely.
8.  Customer and driver receive real-time status updates and see the
    counterpart's location on the ride page.
9.  The customer confirms arrival.
10. The ride becomes completed, payment becomes captured, and the
    driver's balance is credited exactly once.
11. Once the driver's available balance is at least \$10, the driver can
    request a withdrawal. The requested amount is deducted atomically
    and a `PENDING` withdrawal record is created.

A concise, reliable demonstration of this flow is more valuable than
many incomplete screens.

------------------------------------------------------------------------

## 3. Confirmed Product Decisions

  -----------------------------------------------------------------------
  Area                                Decision
  ----------------------------------- -----------------------------------
  Purpose                             Full-stack interview task

  Delivery target                     One-day MVP

  Customer/driver roles               Separate role selected during
                                      registration

  Account switching                   Not required for MVP

  Frontend                            Next.js

  Styling                             Tailwind CSS primarily; use
                                      additional CSS only when needed

  Backend                             Node.js + Express

  Real-time                           Socket.IO

  Database                            PostgreSQL

  ORM                                 Prisma; follow the installed
                                      version's conventions

  Authentication                      JWT and bcrypt

  Maps                                Leaflet + OpenStreetMap

  Location selection                  Support both map selection and
                                      location search

  Driver location                     Manually selected on the map; no
                                      continuous GPS tracking required

  Distance                            Straight-line distance using the
                                      Haversine formula

  Vehicle types                       Bike and car

  Matching radius                     2 km initially; expand to 4 km
                                      after 30 seconds

  Acceptance race                     First successful atomic database
                                      update wins

  Matching timers                     In-memory timer is acceptable for
                                      MVP; it is lost on server restart

  Payments                            Internal/mock payment service; no
                                      real money movement

  Currency                            USD (\$)

  Driver earnings                     Credit the driver's available
                                      balance after successful ride
                                      completion

  Minimum withdrawal                  \$10

  Withdrawal action                   Create a withdrawal request in the
                                      database

  Withdrawal deduction                Deduct the requested amount
                                      immediately and create a `PENDING`
                                      request in the same database
                                      transaction

  Withdrawal history UI               Not required in initial release

  UI direction                        Polished, modern ride-hailing
                                      interface inspired by Uber or
                                      Pathao

  Workflow                            Architecture guidance, IDE-agent
                                      implementation, then review after
                                      each milestone
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. Technology Stack and Boundaries

### Frontend

-   Next.js
-   Tailwind CSS as the primary styling system
-   Leaflet for interactive maps
-   OpenStreetMap tiles
-   Socket.IO client for real-time events
-   A suitable routing approach already supported by the chosen Next.js
    structure

Do not assume App Router or Pages Router without inspecting the
repository. If starting from scratch, prefer a consistent current
Next.js structure and document the choice.

### Backend

-   Node.js
-   Express
-   Socket.IO
-   Prisma
-   PostgreSQL
-   JWT authentication
-   argon password hashing

Keep REST API responsibilities and Socket.IO event responsibilities
clear. Use the authenticated user identity from the server-side auth
context, not an ID supplied by the client, for ownership checks.

### MVP exclusions

Do not implement these unless the project owner explicitly changes
scope:

-   Real Stripe payments or payment capture
-   Stripe Connect or real driver payouts
-   Redis GEO
-   BullMQ or durable delayed jobs
-   Continuous background GPS tracking
-   Road-routing APIs
-   Ratings and ride history
-   Full cancellation and refund workflows
-   Admin dashboard or withdrawal approval UI
-   Production mobile application

These are potential later enhancements, not requirements for the first
demonstrable MVP.

------------------------------------------------------------------------

## 5. Roles and Permissions

### Customer

Can: - Register and log in as a customer. - View and update permitted
profile fields. - Choose pickup and destination. - Choose a vehicle
type. - Request a fare estimate. - Create a ride request. - View their
own active ride and ride details. - Receive ride status and driver
updates. - Confirm arrival to complete their own accepted ride.

Cannot: - Accept rides as a driver. - Change another user's ride. -
Complete a ride owned by another customer. - Read another user's private
data or payment details. - Request driver withdrawals.

### Driver

Can: - Register and log in as a driver. - Select a vehicle type during
registration. - Set their location manually. - Toggle online/offline
availability. - Receive matching requests when online, with a compatible
vehicle type, and within the current radius. - Accept an available
ride. - View their own active ride and counterpart's permitted ride
information. - View their available balance. - Request a withdrawal when
eligible.

Cannot: - Accept a ride if it has already been accepted by another
driver. - Accept rides for an incompatible vehicle type. - Accept rides
while offline. - Complete a ride on behalf of the customer. - Credit
their own balance manually through an API. - Withdraw more than their
available balance. - Access another driver's balance or withdrawals.

### Role enforcement

Enforce permissions on the backend for every protected REST endpoint and
sensitive Socket.IO action. Hiding a button in the frontend is not
authorization.

------------------------------------------------------------------------

## 6. Core User Journeys

### 6.1 Registration and login

1.  User selects `CUSTOMER` or `DRIVER`.
2.  Registration validates name, email, password, and role-specific
    fields.
3.  Driver registration requires a supported vehicle type: `BIKE` or
    `CAR`.
4.  Password is hashed with bcrypt before storage.
5.  Email uniqueness is enforced by the database and handled cleanly in
    the API.
6.  Login verifies the password hash and returns/sets the agreed JWT
    authentication mechanism.
7.  Protected routes and socket connections identify the authenticated
    user.

The exact token transport (Authorization header versus secure cookie)
should be checked against existing project decisions. If starting from
scratch, choose one secure, consistent approach and document it. Do not
store plaintext passwords or secrets.

### 6.2 Driver availability

1.  A driver selects a map location manually.
2.  The frontend sends latitude and longitude to the backend.
3.  The backend validates coordinate ranges and updates only the
    authenticated driver's record.
4.  The driver can toggle online/offline.
5.  Only eligible online drivers receive new ride offers.
6.  A driver must not be able to become eligible without a valid
    location.

### 6.3 Ride estimation

1.  Customer selects pickup and destination using the map and/or
    location search.
2.  The application obtains coordinate pairs for both points.
3.  Backend calculates straight-line distance using Haversine.
4.  Backend calculates fare using the selected vehicle type's configured
    rate.
5.  Frontend displays pickup, destination, distance, vehicle type, and
    estimated fare.
6.  The server recalculates/validates the estimate when creating the
    ride; never trust a client-submitted fare as authoritative.

### 6.4 Request and match a ride

1.  Customer confirms the ride.
2.  Backend validates customer, coordinates, vehicle type, and absence
    of a conflicting active ride according to the implemented rule.
3.  Within a database transaction, create the ride and the associated
    payment record with `HELD` status.
4.  Publish the request to online drivers of the same vehicle type
    within 2 km of pickup.
5.  Start the 30-second in-memory timer.
6.  If no driver has accepted, expand matching to 4 km and notify
    eligible drivers not already notified as appropriate.
7.  If nobody accepts by the end of the 4 km round, change the ride to
    `NO_DRIVER_FOUND` and change the payment to `REFUNDED`.
8.  Ensure timeout and acceptance cannot overwrite each other's
    successful state transition.

### 6.5 Accept a ride

1.  An eligible driver receives the offer.
2.  Driver submits an accept request.
3.  Backend verifies role, online status, vehicle type, radius
    eligibility, and ride state.
4.  Use an atomic conditional database update or transaction so the ride
    can be accepted only if it remains `REQUESTED`.
5.  Only the successful driver becomes assigned.
6.  Notify the customer and broadcast that the ride is taken to other
    drivers.
7.  Competing acceptance requests fail with a controlled conflict
    response.
8.  Stop or invalidate matching timers after acceptance.

Do not implement acceptance as an unprotected read-then-write sequence.
Two drivers may click at nearly the same time.

### 6.6 Live ride and completion

1.  Customer and assigned driver join authorized ride-specific real-time
    rooms.
2.  Both see pickup, destination, and the counterpart's latest known
    location.
3.  MVP location can be manually selected or simulated; continuous GPS
    streaming is not required.
4.  ETA is an approximation based on straight-line distance and a
    configured average speed, not road routing.
5.  Only the ride's owning customer can confirm arrival.
6.  Completion, payment capture, and driver balance credit must be
    protected against duplicate requests.
7.  Persist `COMPLETED`, payment `CAPTURED`, and the driver credit
    atomically where possible.
8.  Emit completion events only after successful database commit.

### 6.7 Driver withdrawal

1.  Driver requests a withdrawal amount.
2.  Backend verifies the authenticated user is a driver.
3.  Amount must be a valid positive monetary value and at least \$10.
4.  Available balance must cover the requested amount.
5.  In a single database transaction, safely reserve/deduct the amount
    and create a `PENDING` withdrawal.
6.  If any operation fails, the transaction must roll back.
7.  Concurrent withdrawal requests must not overspend the balance.
8.  The MVP does not transfer real money or provide an admin approval
    workflow.

**Interpretation:** \$10 is the minimum amount per withdrawal request,
and the driver must have sufficient available balance for the amount
requested. If the product owner intended a different threshold rule, ask
before changing it.

------------------------------------------------------------------------

## 7. Ride State Machine

### Ride statuses

-   `REQUESTED`: Ride created; matching is in progress.
-   `ACCEPTED`: One driver has accepted the ride.
-   `COMPLETED`: Customer confirmed arrival; payment captured and driver
    credited.
-   `NO_DRIVER_FOUND`: No eligible driver accepted within the matching
    window.

### Allowed transitions

``` text
REQUESTED ──> ACCEPTED ──> COMPLETED
    │
    └───────> NO_DRIVER_FOUND
```

Do not add `CANCELLED` to the required MVP state machine unless
approved. Cancellation was classified as a later feature in the original
plan.

### Transition invariants

-   Only `REQUESTED` rides can be accepted.
-   Exactly one driver can win an acceptance race.
-   Only the assigned driver is associated with an accepted ride.
-   Only `ACCEPTED` rides can be completed.
-   Only the owning customer can confirm completion.
-   A ride cannot be completed twice for financial effect.
-   `NO_DRIVER_FOUND` is terminal for the MVP.
-   Payment state and ride state must not be updated inconsistently.
-   A matching timeout must not mark an already accepted ride as
    `NO_DRIVER_FOUND`.

------------------------------------------------------------------------

## 8. Fare and Distance

### Distance

Use the Haversine formula to calculate great-circle distance between two
latitude/longitude coordinate pairs. Return distance in kilometers.

The backend is authoritative for fare calculations. Validate all
coordinates:

-   Latitude: `-90` through `90`
-   Longitude: `-180` through `180`

Reject missing, non-finite, or invalid coordinate values.

### Fare formula

``` text
fare = max(minimum_fare, base_fare + per_km_rate × distance_km)
```

Store per-vehicle rates in configuration or a clear centralized module,
not duplicated across components.

The initial plan gives bike and car different configurable rates but
does **not** specify final dollar amounts. Do not invent rates as
confirmed product requirements. For a working demo, propose sensible
placeholder rates in one configuration file, label them as demo
defaults, and report that they need owner approval.

### Known limitation

Straight-line distance is not road distance. Fare and ETA are
approximations and must be described as such in the README and, where
relevant, the UI.

------------------------------------------------------------------------

## 9. Driver Matching

### Eligibility

A driver is eligible when all conditions are true:

-   Role is `DRIVER`.
-   Driver is online.
-   Driver has a valid location.
-   Driver's vehicle type matches the ride.
-   Driver is within the active matching radius of the pickup.
-   Driver is not already committed to a conflicting active ride,
    according to the implemented rule.

### Matching rounds

-   Round 1: search within 2 km.
-   Wait 30 seconds if no driver accepts.
-   Round 2: expand to 4 km and notify newly eligible drivers.
-   If no one accepts by the end of the second round, set
    `NO_DRIVER_FOUND` and refund/release the mock payment hold.

Use configuration for radii and timeout so values are not scattered
through code.

### Timer limitation

MVP uses in-memory `setTimeout`. Server restart can lose the timer. This
is accepted for the interview task and must be documented. Avoid
starting multiple competing timers for the same ride. Recheck persisted
ride status before performing timeout transitions.

------------------------------------------------------------------------

## 10. Payment and Driver Balance Rules

### Payment statuses

-   `HELD`: Mock payment hold created with the ride request.
-   `CAPTURED`: Ride completed successfully.
-   `REFUNDED`: No driver found; hold released in the mock system.

No external payment provider is integrated in the MVP. These are
internal state records, not real financial transactions.

### Completion transaction

The successful ride completion should atomically: 1. Conditionally
transition the ride from `ACCEPTED` to `COMPLETED`. 2. Transition the
associated payment from `HELD` to `CAPTURED`. 3. Credit the assigned
driver's available balance exactly once. 4. Store completion timestamps.

Use a database transaction and conditional state checks to prevent
duplicate credits. If the transaction fails, all its database changes
should roll back.

### Money handling

-   Use Prisma `Decimal`/PostgreSQL `DECIMAL` or `NUMERIC` for fare,
    payment amount, and balance.
-   Never use binary floating-point values as the authoritative
    representation of money.
-   Define consistent currency semantics: all monetary amounts in the
    MVP are USD.
-   Validate amount precision and rounding consistently.
-   A balance is a simplified MVP accounting mechanism, not a full
    double-entry ledger.

------------------------------------------------------------------------

## 11. Withdrawal Rules

### Withdrawal statuses

-   `PENDING`
-   `COMPLETED`
-   `REJECTED`

Only `PENDING` creation is required in the MVP. Completion/rejection
statuses may exist in the schema for future extensibility, but no admin
processing flow is required.

### Required behavior

-   Minimum request amount: `$10.00`.
-   Driver must have enough available balance for the requested amount.
-   Deduct/reserve amount immediately at request time.
-   Create a `PENDING` withdrawal in the same database transaction.
-   Prevent negative balances and concurrent overspending.
-   Do not allow customers to create withdrawals.
-   Do not trust a client-provided driver ID; derive the driver from
    authentication.
-   No actual payout is made.

A request for `$10` from a `$25` balance leaves `$15` available and
creates a `$10 PENDING` withdrawal.

If withdrawals can later be rejected, the future rejection workflow must
decide how reserved funds are returned. That workflow is outside the
current MVP and must not be improvised.

------------------------------------------------------------------------

## 12. Data Model Requirements

The exact Prisma syntax depends on the installed Prisma version. Inspect
the project and follow that version's supported configuration.

### 12.1 User

Suggested fields:

-   `id`
-   `name`
-   `email` (unique)
-   `passwordHash`
-   `role`: `CUSTOMER` or `DRIVER`
-   `vehicleType`: nullable; `BIKE` or `CAR`
-   `isOnline`: default false
-   `lat`: nullable
-   `lng`: nullable
-   `balance`: exact monetary type, default zero
-   `createdAt`
-   `updatedAt`

Relations: - Customer rides - Driver rides - Driver withdrawals

### 12.2 Ride

Suggested fields:

-   `id`
-   `customerId`
-   `driverId`: nullable until acceptance
-   pickup latitude and longitude
-   destination latitude and longitude
-   `vehicleType`
-   `distanceKm`
-   `fare`
-   `status`
-   `currentRadiusKm`
-   `createdAt`
-   `acceptedAt`: nullable
-   `completedAt`: nullable
-   `updatedAt`

Relations: - One customer - Optional assigned driver - One payment

### 12.3 Payment

Suggested fields:

-   `id`
-   `rideId` (unique for one payment per ride)
-   `amount`
-   `status`
-   `createdAt`
-   `updatedAt`

### 12.4 Withdrawal

Suggested fields:

-   `id`
-   `driverId`
-   `amount`
-   `status`, default `PENDING`
-   `createdAt`
-   `updatedAt`

### Schema considerations

-   Use enums for roles, vehicle types, ride status, payment status, and
    withdrawal status.
-   Use exact numeric types for money.
-   Use sensible coordinate precision.
-   Add indexes for commonly queried ride status, customer/driver
    relations, driver availability, and withdrawals.
-   Ensure unique email and unique payment-per-ride constraints.
-   Add database constraints where supported and useful; application
    validation alone does not replace concurrency-safe writes.
-   Decide and document deletion behavior. Avoid cascading deletion that
    accidentally removes financial history.
-   Use consistent UTC timestamps.
-   Do not add fields or tables that do not support an agreed
    requirement without documenting why.

------------------------------------------------------------------------

## 13. REST API Contract

Base path: `/api`. Register and login are public; other endpoints
require authentication. Enforce roles in middleware and ownership in
service/controller logic.

  ------------------------------------------------------------------------------
  Method            Endpoint                 Purpose           Access
  ----------------- ------------------------ ----------------- -----------------
  `POST`            `/auth/register`         Register a        Public
                                             customer or       
                                             driver            

  `POST`            `/auth/login`            Authenticate and  Public
                                             issue JWT         

  `GET`             `/auth/me`               Current user      Authenticated
                                             profile           

  `PATCH`           `/drivers/status`        Set driver        Driver
                                             online/offline    

  `PATCH`           `/drivers/location`      Update driver     Driver
                                             location          

  `GET`             `/drivers/balance`       Get own available Driver
                                             balance           

  `POST`            `/rides/estimate`        Calculate         Customer
                                             distance and fare 

  `POST`            `/rides`                 Create ride, hold Customer
                                             mock payment,     
                                             start matching    

  `GET`             `/rides/active`          Get own active    Customer/Driver
                                             ride              

  `GET`             `/rides/:id`             Get authorized    Ride participant
                                             ride details      

  `POST`            `/rides/:id/accept`      Atomically accept Eligible driver
                                             a ride            

  `POST`            `/rides/:id/complete`    Customer confirms Owning customer
                                             arrival           

  `POST`            `/drivers/withdrawals`   Request a         Driver
                                             withdrawal        
  ------------------------------------------------------------------------------

The initial source plan used `POST /payments/intent` and a Stripe
webhook for a later Stripe phase. Those endpoints are **not part of the
mock-payment MVP**. Do not implement them as fake Stripe endpoints.

### API behavior requirements

-   Validate request bodies and route parameters.
-   Use consistent error responses and appropriate HTTP status codes.
-   Distinguish authentication failures, permission failures, validation
    failures, and state conflicts.
-   Never accept authoritative fare, role, balance, or driver ownership
    from untrusted client input.
-   Do not leak password hashes, JWT secrets, or private user
    information.
-   Ensure retries are safe for financial state changes.
-   Use transactions and conditional updates for race-sensitive
    operations.

------------------------------------------------------------------------

## 14. Socket.IO Event Contract

Events should be authenticated and scoped to authorized users or ride
rooms.

  -----------------------------------------------------------------------
  Event                   Direction               Purpose
  ----------------------- ----------------------- -----------------------
  `driver:location`       Client → Server         Update/send driver's
                                                  location when permitted

  `ride:new`              Server → Eligible       New matching request
                          drivers                 

  `ride:taken`            Server → Other notified Hide request because
                          drivers                 another driver accepted

  `ride:accepted`         Server → Customer       Driver accepted, with
                                                  safe driver details

  `ride:no-driver`        Server → Customer       Matching exhausted

  `ride:location`         Server → Ride           Latest counterpart
                          participants            location and
                                                  approximate ETA

  `ride:completed`        Server → Ride           Ride finished and
                          participants            payment state updated

  `ride:cancelled`        Reserved for future use Not required for MVP
  -----------------------------------------------------------------------

### Real-time security

-   Authenticate socket connections.
-   Verify room membership server-side.
-   Do not let a client join any ride room by arbitrary ride ID.
-   Validate coordinates and payloads.
-   Never trust socket payloads to establish a user's role or ride
    ownership.
-   Emit sensitive ride details only to eligible recipients.
-   Persist important state in PostgreSQL; Socket.IO messages are
    notifications, not the source of truth.

------------------------------------------------------------------------

## 15. Frontend Experience and UI Requirements

The interface should feel like a polished ride-hailing product, inspired
by Uber/Pathao, while remaining achievable within the one-day deadline.

### Customer screens

-   Landing/home experience
-   Register/login
-   Ride request screen with interactive map
-   Pickup and destination search/selection
-   Vehicle selector
-   Fare estimate summary
-   Ride request/matching state
-   Active ride page with driver information, map, and status
-   Completion state

### Driver screens

-   Register/login with vehicle selection
-   Driver availability control
-   Map/location selector
-   Incoming ride request card or panel
-   Active ride page
-   Available balance
-   Withdrawal amount form and request feedback

### UI standards

-   Responsive layout for desktop and mobile.
-   Clear loading, empty, error, success, and disabled states.
-   Accessible labels and keyboard-usable controls.
-   Keep primary ride actions visually clear.
-   Do not rely on color alone to communicate status.
-   Keep map controls and ride summaries usable on smaller screens.
-   Use Tailwind CSS for most styling; add custom CSS only where
    justified.
-   Do not spend the MVP budget on decorative animation before the
    complete ride lifecycle works.

### Map and location search

The requirements call for both map selection and location search.
OpenStreetMap tiles provide map rendering, but they do not automatically
provide a geocoding/search API. Inspect available services and terms
before choosing a geocoder. Do not assume that the map tile provider
also handles place search. If a geocoding service is used, keep its
integration behind a small utility and document rate limits/attribution.

------------------------------------------------------------------------

## 16. Security and Data Integrity Checklist

-   [ ] Hash passwords with bcrypt.
-   [ ] Validate registration input and normalize email.
-   [ ] Enforce unique email at database level.
-   [ ] Authenticate REST requests and socket connections.
-   [ ] Enforce role and ownership on the server.
-   [ ] Validate coordinate ranges.
-   [ ] Recalculate fare on the server.
-   [ ] Do not trust client-supplied balance or payment status.
-   [ ] Use conditional atomic ride acceptance.
-   [ ] Prevent timeout from overwriting an accepted ride.
-   [ ] Make completion idempotent against duplicate financial effects.
-   [ ] Update ride, payment, and driver balance transactionally.
-   [ ] Make withdrawal deduction and withdrawal record creation
    transactional.
-   [ ] Protect against concurrent withdrawals and negative balances.
-   [ ] Use environment variables for secrets and database connection.
-   [ ] Provide `.env.example` with placeholders only.
-   [ ] Avoid exposing internal errors and secrets to clients.
-   [ ] Scope Socket.IO rooms and event payloads.
-   [ ] Do not log passwords, tokens, or sensitive data.
-   [ ] Document mock payments and other MVP limitations.

------------------------------------------------------------------------

## 17. Error and Edge-Case Expectations

At minimum, handle the following:

1.  Duplicate registration email.
2.  Invalid login credentials.
3.  Customer attempts a driver-only operation.
4.  Driver attempts to accept while offline.
5.  Driver has no valid location.
6.  Vehicle type does not match.
7.  Ride has already been accepted.
8.  Two drivers accept simultaneously.
9.  Matching timeout fires after a driver accepts.
10. No driver accepts within the full matching window.
11. Customer tries to complete a ride that is not theirs.
12. Completion is submitted twice.
13. Payment is not in `HELD` status at completion.
14. Driver has insufficient withdrawal balance.
15. Withdrawal amount is below \$10, zero, negative, or invalid.
16. Two withdrawal requests race against the same balance.
17. Database transaction fails partway through a financial operation.
18. Socket client attempts to subscribe to another user's ride.
19. Invalid coordinates or fare input are submitted.
20. Server restarts while an in-memory matching timer is active.

Do not try to build elaborate recovery systems for every case in the
one-day MVP. Ensure the core state transitions remain safe and document
accepted limitations.

------------------------------------------------------------------------

## 18. Suggested Repository Structure

This is a suggested structure, not a mandate to restructure an existing
repository.

``` text
chalo/
├── client/                     # Next.js frontend
│   ├── app/                    # If using App Router
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── map/
│   │   ├── rides/
│   │   └── driver/
│   ├── lib/
│   └── public/
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── drivers/
│   │   │   ├── rides/
│   │   │   ├── payments/
│   │   │   └── withdrawals/
│   │   ├── realtime/
│   │   ├── services/
│   │   ├── app.*
│   │   └── server.*
│   └── .env.example
├── README.md
└── CHALO_PROJECT_GUIDE.md
```

Use the existing naming conventions and module layout if already
established. Do not create empty abstraction layers just to match this
tree.

------------------------------------------------------------------------

## 19. One-Day Implementation Roadmap

Order is designed to reduce risk and get the complete happy path working
early.

### Milestone 1 --- Repository inspection and foundation

-   Inspect workspace and current framework versions.
-   Establish or confirm client/server structure.
-   Configure environment variables.
-   Define Prisma models, enums, relations, and indexes.
-   Validate schema and prepare migrations.
-   Document database setup.

**Exit criteria:** Schema validates; setup steps are clear; no
unverified migration claims.

### Milestone 2 --- Authentication and role access

-   Customer/driver registration.
-   Login and JWT authentication.
-   bcrypt password hashing.
-   Role middleware and `/auth/me`.
-   Driver vehicle selection.
-   Basic protected frontend navigation.

**Exit criteria:** Both roles can register/login and protected APIs
enforce access.

### Milestone 3 --- Driver availability and maps

-   Driver online/offline status.
-   Manual map location selection.
-   Location persistence and validation.
-   Customer pickup/destination selection.
-   Vehicle selector and fare estimate.

**Exit criteria:** Driver locations persist; backend returns a valid
estimate.

### Milestone 4 --- Ride request and mock payment

-   Server-side fare calculation.
-   Create ride and `HELD` payment transactionally.
-   Active ride retrieval.
-   Initial matching query.

**Exit criteria:** Customer can create a valid ride request with a
consistent payment record.

### Milestone 5 --- Radius matching and race-safe acceptance

-   2 km first round.
-   30-second expansion to 4 km.
-   No-driver terminal transition and mock refund.
-   Atomic accept.
-   Matching timer invalidation/rechecks.

**Exit criteria:** Correct driver receives the offer, and competing
acceptance attempts cannot assign two drivers.

### Milestone 6 --- Real-time ride and completion

-   Authenticated Socket.IO setup.
-   Authorized user/ride rooms.
-   Accepted, taken, location, no-driver, and completed events.
-   Active ride map for both parties.
-   Customer-only completion.
-   Transactional capture and one-time balance credit.

**Exit criteria:** One complete ride lifecycle works end to end.

### Milestone 7 --- Withdrawals

-   Driver balance endpoint/UI.
-   Withdrawal amount form.
-   Minimum \$10 validation.
-   Transactional balance deduction + `PENDING` request creation.
-   Concurrency/insufficient-balance checks.

**Exit criteria:** Valid withdrawals are recorded once and cannot
overspend the balance.

### Milestone 8 --- UI polish, smoke tests, and handoff

-   Responsive visual refinement.
-   Loading/error/empty states.
-   Seed/demo setup if time allows.
-   Test the full happy path and critical edge cases.
-   README, known limitations, and demo steps.

**Exit criteria:** A reviewer can run and demonstrate the core flow with
honest setup instructions.

If time becomes critical, preserve milestones 1--6 first; withdrawals
are an agreed feature but must not be implemented by weakening
ride/payment correctness. Report any scope trade-off rather than
pretending the feature is complete.

------------------------------------------------------------------------

## 20. Testing Strategy

The first objective is a reliable manual happy-path test. Add automated
tests for critical invariants if time permits.

### Core manual test

1.  Register a driver with a vehicle type.
2.  Set the driver location and go online.
3.  Register/login as a customer.
4.  Select pickup and destination.
5.  Confirm the estimated fare.
6.  Create a ride and verify payment status is `HELD`.
7.  Confirm eligible driver receives `ride:new`.
8.  Accept ride and confirm it becomes `ACCEPTED`.
9.  Confirm customer sees driver details.
10. Confirm competing accept requests fail.
11. Complete as the owning customer.
12. Verify ride is `COMPLETED`.
13. Verify payment is `CAPTURED`.
14. Verify driver balance increases once.
15. Request a withdrawal of at least \$10.
16. Verify balance decreases by the requested amount and a `PENDING`
    withdrawal exists.
17. Attempt another withdrawal beyond available balance and verify it
    fails without partial changes.

### High-value automated tests

-   Haversine distance and fare formula.
-   Ride acceptance race.
-   Timeout versus acceptance race.
-   No-driver transition and payment refund.
-   Duplicate completion does not double-credit.
-   Withdrawal transaction and insufficient balance.
-   Concurrent withdrawal requests cannot overspend.
-   Authorization and ride ownership.

Do not claim race safety based only on a sequential manual test. Use
conditional database writes/transactions and, if time permits, a
concurrent test.

------------------------------------------------------------------------

## 21. Known MVP Limitations

These limitations are accepted unless the project owner changes scope:

-   In-memory timers are lost when the server restarts.
-   Distance is straight-line, not road-based.
-   ETA is an approximation based on straight-line distance and assumed
    average speed.
-   Driver location is manually selected or simulated, not continuously
    tracked.
-   Browser location is not a reliable substitute for a production
    driver's mobile app.
-   Payments are simulated; no money is actually held or transferred.
-   Driver balance is a simplified database balance, not a complete
    financial ledger.
-   Withdrawal requests are recorded as pending; no real payout or admin
    workflow exists.
-   Cancellation and refund rules beyond the no-driver case are
    deferred.
-   Map tile/geocoding service availability and terms must be verified
    for the selected implementation.

Include these limitations in the README and be ready to explain them
during the interview.

------------------------------------------------------------------------

## 22. Environment and Run Instructions

The actual commands depend on the inspected repository, package manager,
Prisma version, and deployment setup. The LLM must verify the scripts
before documenting them as executable.

Use an `.env.example` with placeholders, for example:

``` dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=5000
CLIENT_ORIGIN="http://localhost:3000"
```

These are illustrative placeholders. Do not use them as real
credentials.

For local setup, the final README should cover: 1. Required Node.js
version. 2. Installing dependencies in each application. 3.
Creating/configuring PostgreSQL. 4. Copying `.env.example` to the
appropriate local environment file. 5. Generating Prisma Client using
the installed version's command. 6. Applying migrations only after the
database is configured. 7. Starting backend and frontend. 8. Running
available lint/type-check/test/build commands.

If the repository uses Prisma 7 or another version with different
configuration requirements, follow that version's documentation and
existing project configuration rather than blindly copying generic
commands.

------------------------------------------------------------------------

## 23. Interview Explanation Guide

The developer should be able to explain these decisions in plain
English:

-   **Why PostgreSQL + Prisma?** Relational data and transactions suit
    rides, payments, users, and withdrawals.
-   **Why server-side fare calculation?** Client input is untrusted and
    could be manipulated.
-   **Why atomic ride acceptance?** Two drivers can accept at nearly the
    same time; only one should win.
-   **Why database transactions for completion?** Ride completion,
    payment capture, and driver credit must not diverge.
-   **Why transaction-protected withdrawals?** Balance deduction and
    request creation must succeed or fail together.
-   **Why Socket.IO?** The app needs low-latency ride offers and ride
    status/location updates.
-   **Why Haversine?** It provides an approximate great-circle distance
    from coordinates without a paid routing API.
-   **Why mock payments?** This is a one-day interview MVP; the goal is
    to demonstrate the payment lifecycle without handling real money.
-   **What are the limitations?** Timers are in-memory, distance/ETA are
    approximate, GPS is manual/simulated, and payments/payouts are not
    real.

Do not claim the application is production-ready. Describe it as an MVP
that demonstrates key full-stack and data-integrity concepts.

------------------------------------------------------------------------

## 24. Definition of Done

The MVP is ready for interview demonstration when:

-   [ ] A fresh setup can be completed using the README.
-   [ ] Database schema and migrations are valid for the configured
    database.
-   [ ] Customer and driver can register and log in.
-   [ ] Role/ownership authorization is enforced by the backend.
-   [ ] Driver can set location and availability.
-   [ ] Customer can select pickup/destination and obtain a fare
    estimate.
-   [ ] Ride request creates a `REQUESTED` ride and `HELD` payment.
-   [ ] Matching uses 2 km then 4 km after 30 seconds.
-   [ ] No-driver outcome updates ride and mock payment consistently.
-   [ ] Atomic acceptance ensures one assigned driver.
-   [ ] Socket.IO updates reach only authorized participants.
-   [ ] Customer can complete their accepted ride.
-   [ ] Completion captures mock payment and credits driver exactly
    once.
-   [ ] Driver can request a withdrawal of at least \$10 when balance
    permits.
-   [ ] Withdrawal deduction and record creation are atomic.
-   [ ] Critical validation and error states are handled.
-   [ ] Known limitations are documented.
-   [ ] Commands and test outcomes in the README/report reflect actual
    execution.

------------------------------------------------------------------------

## 25. Required LLM Handoff Report

At the end of any milestone, provide this report:

``` text
Milestone:
Status: COMPLETE / PARTIAL / BLOCKED

Repository inspected:
- Frameworks and versions:
- Package manager:
- Existing architecture:

Files created/modified:
- ...

Implemented:
- ...

Not implemented:
- ...

Database/API changes:
- ...

Commands actually run:
- ...

Checks and results:
- Schema validation:
- Tests:
- Lint/typecheck:
- Build:
- Migration/database status:

Known issues and risks:
- ...

Assumptions made:
- ...

Manual verification steps:
1. ...
2. ...

Recommended next milestone:
- ...
```

A milestone is not complete if its exit criteria have not been met.
Clearly report partial work and blockers.

------------------------------------------------------------------------

## 26. Source of Truth and Unresolved Details

This guide consolidates the original Chalo MVP plan and later explicit
project-owner decisions.

### Decisions that are confirmed

-   Interview task and one-day target.
-   Next.js frontend (latest decision supersedes original Vite choice).
-   Tailwind-first styling.
-   Customer and driver registration roles.
-   Map selection and location search.
-   Manual driver location.
-   Haversine distance.
-   2 km → 4 km matching with a 30-second delay.
-   Atomic first-wins driver acceptance.
-   Socket.IO.
-   Mock payments.
-   USD currency.
-   Driver earnings after completion.
-   Minimum \$10 withdrawal.
-   Immediate balance deduction and `PENDING` withdrawal record in one
    transaction.
-   No withdrawal history UI in MVP.

### Details not specified and requiring sensible documented defaults or clarification

-   Exact base fare, per-kilometer rate, and minimum fare for each
    vehicle.
-   Exact ETA average speed.
-   Geocoding/search provider for location search.
-   JWT storage/transport if not already decided in the repository.
-   Whether the project already exists and its current state.
-   Whether a customer/driver may have multiple concurrent active rides;
    enforce a clear simple rule and document it.
-   Withdrawal rejection/refund behavior (outside MVP).
-   Exact visual branding, colors, and typography.

Do not represent unspecified values as owner-approved requirements. For
demo defaults, centralize them and label them clearly.

------------------------------------------------------------------------

**End of guide.** Read this document before making changes. Inspect the
actual repository, implement one milestone at a time, validate the
result, report honestly, and wait for review.
