# Skyline Rush Backend

NestJS/TypeScript microservices monorepo for Skyline Rush.

## Architecture

- **`apps/gateway`**: API Gateway, TLS reverse proxy, per-endpoint rate limiting with periodic memory cleanup, error envelope formatting, CORS headers, and static hosting for the playable web client.
- **`apps/profile-auth`**: Zero-PII guest identity, Sign in with Apple auth with first-time progress merge, token refresh, and parental gate challenge verification (`POST /v1/auth/parental-gate/verify`).
- **`apps/economy`**: Append-only ledger (`ledger_entry`), materialized balances (`economy_balance`), Supply Drop odds resolution (`standard-v7`), Redeploy cost escalation (10 -> 20 -> 40 Cores cap, 1 free ad revive), and Daily Contracts progression.
- **`apps/run-integrity`**: Velocity limit verification ($v \le 35\text{ m/s}$), chip density checks ($\le 2.5\text{ chips/m}$), duration requirements, and anti-cheat integrity flagging (`ok` | `flagged` | `excluded`).
- **`apps/leaderboard`**: Redis ZSET leaderboard logic, self-rank extraction, batched player queries, and strict exclusion of runs where `integrity_flag != 'ok'`.
- **`apps/liveops`**: Remote content pack versioning and feature flags.
- **`apps/billing`**: StoreKit 2 receipt validation, duplicate grant prevention, and App Store Server Notifications V2 webhook.
- **`apps/privacy`**: GDPR Article 15 data export and Article 17 profile deletion with signed parental gate tokens for minors.
- **`libs/db`**: PostgreSQL 16 schema and migrations (`libs/db/migrations/001_initial_schema.sql`), migration runner (`libs/db/migrate.ts`), PostgreSQL connection pool (`libs/db/postgres-db.ts`), and in-memory test database (`libs/db/in-memory-db.ts`).
- **`libs/auth`**: JWT signing/verification, age-bucket claims, and parental gate math challenges.
- **`libs/shared-types`**: TypeScript interfaces and DTOs matching the OpenAPI specification.

---

## Running the API Gateway & Playable Client

To run the backend gateway server (with tsconfig path resolution):
```bash
npm install
npx ts-node -r tsconfig-paths/register apps/gateway/main.ts
```
The server will start on port `3000` (or `PORT` env var). Navigating to `http://localhost:3000` loads the playable web game.

---

## Database Migrations

To apply PostgreSQL migrations when running with PostgreSQL:
```bash
DATABASE_URL="postgres://user:pass@localhost:5432/skyline_rush" npm run migrate
```
If no `DATABASE_URL` or `POSTGRES_URL` is set, the services run automatically with an in-memory database engine for rapid testing.

---

## Acceptance Tests

Run the full acceptance test suite:
```bash
npm test
```
Verifies 31 tests covering Acceptance Criteria AC-01 through AC-12, AC-17, and AC-18.
