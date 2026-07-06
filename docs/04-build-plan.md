# Phased Build Plan (single-semester timeline)

Estimates assume a solo student working part-time (~12–15 hrs/week). Total ≈ 14 weeks.
Priority order for stretch goals is at the bottom.

## Phase 0 — Foundation (Week 1)
- Repo, `docker-compose` (MySQL 8 + Redis), `.env`, ESLint/Prettier, GitHub Actions skeleton.
- Run `db/schema.sql`; wire Prisma (`prisma db pull` or migrate); seed script.
- **Exit criteria:** `docker compose up` boots app + DB, `/health` returns 200, CI runs lint on push.

## Phase 1 — Auth + core schema (Weeks 2–3)
- users/vendors/addresses tables live. bcrypt (cost 12), JWT access+refresh, hashed revocable
  refresh tokens, role middleware, Zod validation, rate limiting on `/auth`.
- **Exit criteria:** register/login/refresh/logout pass integration tests; RBAC blocks cross-role access.

## Phase 2 — Products, cart, orders (Weeks 4–7)  ← **the differentiator**
- Product CRUD (vendor-scoped) + images (Multer). Categories tree. Inventory.
- Search/filter/sort with cursor pagination; MySQL FULLTEXT search.
- Cart CRUD. **Atomic checkout transaction** with `SELECT … FOR UPDATE`, multi-vendor split.
- **Exit criteria:** concurrent-checkout stress test proves no overselling; order spans ≥2 vendors correctly.

## Phase 3 — Payments + vendor dashboard (Weeks 8–9)
- Razorpay/Stripe test mode; webhook with signature verification + idempotency on `transaction_ref`.
- Reservation → commit/release on payment success/failure. Vendor sub-order management (independent status).
- **Exit criteria:** integration test for the order→payment→fulfillment flow (deliverable requirement).

## Phase 4 — Analytics + recommendations (Weeks 10–11)
- Admin analytics (top products, revenue-by-category w/ `LAG`, vendor leaderboard, CLV).
- Recommendation co-occurrence query; commission/payout weekly cron job.
- **Exit criteria:** all 4 raw analytics queries return correct numbers against seed data; payout job settles.

## Phase 5 — Polish & deploy (Weeks 12–14)
- Swagger/OpenAPI complete; frontend polish; Docker prod build; CI runs full test suite.
- ER diagram export, README, viva prep. Load-test the checkout path.
- **Exit criteria:** one-command deploy; docs render; demo script rehearsed.

## Stretch goals — priority order (only if time remains)
1. **WebSockets (Socket.io)** for live order status — highest demo impact, low risk.
2. **Elasticsearch** vs MySQL FULLTEXT comparison — strong DB-depth talking point.
3. Redis cart/session caching (if not already done in Phase 2).
4. Multi-currency/language.
5. GraphQL layer / A/B recommender framework — resume optics, lowest priority.
