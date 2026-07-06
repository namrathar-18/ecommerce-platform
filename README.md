# ShopMesh — Multi-Vendor E-Commerce Platform

Full-stack multi-vendor marketplace with atomic order management, built for a DB-heavy capstone.
**Stack:** React + Vite + Redux Toolkit + Three.js + Recharts · Node/Express (layered) · MySQL 8 (InnoDB) · Prisma · JWT.

**Highlights**
- 🛍️ **80 real products** imported from the DummyJSON products API at seed time — real names,
  descriptions, multi-photo galleries (CDN images), INR pricing, 7 categories split across 2 vendors
- 💳 **MeshPay** — Razorpay-style test payment gateway (UPI / Card / NetBanking tabs, processing →
  success/decline states). Declines: card `4000 0000 0000 0002` or UPI `fail@upi` — a decline cancels
  the order server-side and releases reserved stock
- 🧊 Animated **Three.js** hero (torus knot + particle field, orbiting colored lights)
- 📊 Admin dashboard with live **Recharts** charts (top products, revenue MoM via `LAG()`,
  vendor leaderboard via `RANK()`, CLV segmentation pie)
- 🔒 Atomic checkout with `SELECT … FOR UPDATE` — stress-tested: 8 concurrent buyers,
  1 unit in stock, exactly 1 success ([backend/tests/stress-concurrency.ts](backend/tests/stress-concurrency.ts))
- 📖 Swagger UI at `http://localhost:4000/docs`

> **Note:** MySQL is exposed on host port **3307** (3306 was taken by a local MySQL install).
> `.env.example` and docker-compose are already aligned.

## Architecture pack (design docs)
See [`docs/`](docs/) and [`db/`](db/): ER diagram, full DDL, the 5 hardest SQL queries, API list,
build plan, and viva prep. Start with [docs/05-viva-prep.md](docs/05-viva-prep.md) before an evaluation.

---

## Quick start — Docker (easiest)
Requires Docker Desktop.
```bash
docker compose up --build
```
This boots MySQL + Redis + the API (which auto-pushes the schema and seeds demo data).
API → http://localhost:4000/health

Then run the frontend locally:
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## Quick start — local (no Docker for the app)
1. Start MySQL 8 (Docker is fine): `docker compose up mysql -d`
2. Backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npx prisma generate
   npx prisma db push      # create tables from prisma/schema.prisma
   npm run seed            # demo users, products, one delivered order
   npm run dev             # http://localhost:4000
   ```
3. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev             # http://localhost:5173 (proxies /api -> :4000)
   ```

## Demo logins (password: `Password123`)
| Role | Email |
|------|-------|
| Admin | `admin@shop.dev` |
| Vendor | `ravi@shop.dev`, `meera@shop.dev` |
| Customer | `asha@shop.dev` |

## Try the end-to-end flow
1. Log in as **asha** (customer) → add products to cart → **Checkout & Pay**.
2. See the order under **Orders** (status `confirmed`).
3. Log in as **ravi** (vendor) → **Vendor** dashboard → advance the sub-order to *shipped* → *delivered*.
   A payout row is created on payment; delivery makes it settle-able.
4. Log in as **admin** → **Admin** dashboard → analytics (top products, revenue MoM %, leaderboard, CLV).

## The core differentiator — atomic checkout
`backend/src/modules/orders/order.service.ts` does the checkout in one interactive transaction:
locks inventory rows with `SELECT ... FOR UPDATE` (ordered by product_id to avoid deadlocks),
verifies stock, splits `order_items` by vendor, reserves stock, and creates a pending payment —
rolling back entirely on any failure. Payment success converts the reservation into a real decrement
and generates commission-aware `vendor_payouts`.

## Tests
```bash
cd backend && npm test      # integration test: cart -> checkout -> pay
```

## Weekly payout job
```bash
cd backend && npx tsx src/jobs/payoutBatch.job.ts
```
