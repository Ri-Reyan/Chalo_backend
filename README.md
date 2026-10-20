# Chalo Backend

Node.js, Express, and Prisma backend for the Chalo ride-hailing platform.

## Available Scripts

- `npm run dev`: Start backend in watch mode using `tsx`
- `npm run build`: Compile TypeScript to `dist/`
- `npm start`: Run compiled server from `dist/server.js`
- `npm run prisma:generate`: Generate Prisma Client
- `npm run prisma:validate`: Validate Prisma schema
- `npm run prisma:format`: Format Prisma schema
- `npm run prisma:migrate`: Run Prisma migrations on configured database

## Environment Setup
Copy `.env.example` to `.env` and configure `DATABASE_URL` and `DIRECT_URL`.
