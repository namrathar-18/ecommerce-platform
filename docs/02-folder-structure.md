# Folder Structure

Layered backend (controller → service → repository), feature-grouped frontend.

## Backend (`/backend`)
```
backend/
├── src/
│   ├── config/            # env loading, db pool, redis client, swagger def
│   │   ├── env.ts
│   │   ├── prisma.ts
│   │   └── redis.ts
│   ├── modules/           # one folder per bounded context
│   │   ├── auth/
│   │   │   ├── auth.controller.ts   # HTTP: parse req, call service, shape res
│   │   │   ├── auth.service.ts      # business logic, token issue/rotate
│   │   │   ├── auth.repository.ts   # DB access (Prisma / raw SQL)
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schema.ts       # Zod request/response schemas
│   │   │   └── auth.test.ts
│   │   ├── products/
│   │   ├── cart/
│   │   ├── orders/        # <-- houses the atomic checkout transaction
│   │   ├── payments/      # webhook handler + idempotency
│   │   ├── vendors/
│   │   ├── admin/         # analytics endpoints
│   │   └── recommendations/
│   ├── middleware/
│   │   ├── authenticate.ts    # verify access JWT
│   │   ├── authorize.ts       # role-based guard (customer|vendor|admin)
│   │   ├── validate.ts        # Zod validation wrapper
│   │   ├── rateLimit.ts       # redis-backed limiter for /auth
│   │   └── errorHandler.ts    # central error -> HTTP mapping
│   ├── shared/
│   │   ├── errors.ts          # AppError, NotFound, Conflict, ...
│   │   ├── logger.ts
│   │   └── pagination.ts      # cursor helpers
│   ├── jobs/
│   │   └── payoutBatch.job.ts # weekly commission settlement (node-cron)
│   ├── app.ts             # express app, helmet, cors, routes mount
│   └── server.ts          # http listen + graceful shutdown
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── db/
│   ├── schema.sql
│   └── hard-queries.sql
├── tests/
│   └── order-payment.integration.test.ts
├── Dockerfile
├── .env.example
└── package.json
```

## Frontend (`/frontend`)
```
frontend/
├── src/
│   ├── app/               # store setup, router, providers
│   │   ├── store.ts       # Redux Toolkit
│   │   └── router.tsx
│   ├── features/          # feature slices mirror backend modules
│   │   ├── auth/          # slice, hooks, LoginPage, RegisterPage
│   │   ├── products/      # ProductList, ProductDetail, filters
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── orders/
│   │   ├── vendor/        # vendor dashboard
│   │   └── admin/         # analytics dashboard
│   ├── components/        # shared UI (Button, Table, Pagination...)
│   ├── lib/
│   │   ├── api.ts         # axios instance + refresh-token interceptor
│   │   └── queryKeys.ts
│   └── main.tsx
├── Dockerfile
└── package.json
```

## Root
```
ecommerce-platform/
├── backend/
├── frontend/
├── docker-compose.yml     # app + mysql:8 + redis:7
├── .github/workflows/ci.yml
└── README.md
```

**Why layered:** controllers stay thin (HTTP only), services hold logic and own transactions,
repositories isolate SQL. This makes the checkout transaction unit-testable without HTTP and lets you
swap Prisma for raw SQL in the 5 hot queries without touching controllers.
