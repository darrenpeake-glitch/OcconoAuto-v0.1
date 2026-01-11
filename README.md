# OcconoAuto v0.1

OcconoAuto is a Next.js + Postgres workflow board for tracking auto service jobs through approval, repair, and delivery.

## Requirements
- Node.js 18+
- Postgres 14+

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start Postgres** (choose one)

   **Local Postgres**
   ```bash
   createdb occonoauto
   ```

   **Docker**
   ```bash
   docker run --name occonoauto-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=occonoauto -p 5432:5432 -d postgres:15
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   ```

4. **Run migrations + seed**

   ```bash
   npx prisma migrate dev
   npm run seed
   ```

5. **Run the dev server**

   ```bash
   npm run dev
   ```

## Seeded accounts

| Role | Email | Password |
| --- | --- | --- |
| Owner | owner@occonoauto.test | password |
| Advisor | advisor@occonoauto.test | password |
| Tech | tech@occonoauto.test | password |

## App routes

- `/board` - Advisor/owner workflow board
- `/jobs/[id]` - Job detail page with workflow actions
- `/tech` - Technician work queue
- `/approve/[jobId]?t=TOKEN` - Customer approval link

## Notes

- State transitions are enforced on the server; back transitions require a reason.
- Approval links are secured with a one-time token hash.
