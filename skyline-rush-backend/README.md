# Skyline Rush Backend

NestJS/TypeScript microservices monorepo for Skyline Rush.

## Architecture

- **`apps/gateway`**: API Gateway, TLS reverse proxy, per-endpoint rate limiting with periodic memory cleanup, Prometheus metrics scrape endpoint (`/metrics`), shallow/deep health checks (`/health/live`, `/health/ready` with 2s anti-DoS cache), CORS headers, and static hosting for the playable web client.
- **`apps/profile-auth`**: Zero-PII guest identity, Sign in with Apple auth with first-time progress merge, token refresh, and server-signed parental gate challenge generation (`/v1/auth/parental-gate/challenge`) and verification (`/v1/auth/parental-gate/verify`).
- **`apps/economy`**: Append-only ledger (`ledger_entry`), materialized balances (`economy_balance`), atomic row-locked unlocks (`unlockItemAtomic`), idempotent contract claims (`WHERE claimed_at IS NULL`), Supply Drop odds resolution (`standard-v7`), Redeploy cost escalation ($10 \rightarrow 20 \rightarrow 40$ Cores cap, 1 free ad revive), and Daily Contracts progression.
- **`apps/run-integrity`**: Velocity limit verification ($v \le 35\text{ m/s}$), chip density checks ($\le 2.5\text{ chips/m}$), duration requirements, and anti-cheat integrity flagging (`ok` | `flagged` | `excluded`).
- **`apps/leaderboard`**: Redis ZSET leaderboard logic, self-rank extraction, batched player queries, and strict exclusion of runs where `integrity_flag != 'ok'`.
- **`apps/liveops`**: Remote content pack versioning and feature flags.
- **`apps/billing`**: StoreKit 2 receipt validation covering all 7 catalog SKUs, duplicate grant prevention, and App Store Server Notifications V2 webhook.
- **`apps/privacy`**: GDPR Article 15 data export and Article 17 profile deletion with signed parental gate tokens for minors.
- **`libs/db`**: PostgreSQL 16 schema and migrations (`libs/db/migrations/001_initial_schema.sql`), migration runner (`libs/db/migrate.ts`), PostgreSQL connection pool (`libs/db/postgres-db.ts`), and in-memory test database (`libs/db/in-memory-db.ts`).
- **`libs/auth`**: JWT signing/verification, age-bucket claims, and cryptographically signed parental gate challenge tokens.
- **`libs/shared-types`**: TypeScript interfaces and DTOs matching the OpenAPI specification.

---

## Local Development

To run the backend gateway server locally (with tsconfig path resolution):
```bash
npm install
npx ts-node -r tsconfig-paths/register apps/gateway/main.ts
```
The server will start on port `3000` (or `PORT` env var). Navigating to `http://localhost:3000` loads the playable web game.

---

## Production Deployment

### 1. Docker Compose Production
Runs PostgreSQL 16 (persistent volume, healthcheck), Redis 7 (password authentication, AOF enabled), Backend Gateway (non-root `node` user, bundles the playable web client from `../skyline-rush-client/web`), and Nginx reverse proxy with SSL termination on port 443. **Verified end-to-end** — real Postgres-backed guest auth, `/health/ready`, `/metrics`, and the playable web client all confirmed working through this exact stack.

Create `skyline-rush-backend/.env` first (gitignored — never commit it) with real secrets, e.g.:
```bash
cat > .env <<EOF
POSTGRES_USER=skylinerush_prod
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=skylinerush_prod_db
REDIS_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
REFRESH_SECRET=$(openssl rand -hex 32)
PARENTAL_GATE_SECRET=$(openssl rand -hex 32)
EOF
```
Then, from `skyline-rush-backend/` (the gateway image's build context is the repository root, so this must be run from here, not the repo root itself):
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
The stack is reachable at `https://localhost` (self-signed cert — expect a browser warning) and `http://localhost` (same app, no TLS; the port-80 Nginx block does not currently redirect to HTTPS — see `build-package/24_RELEASE_CHECKLIST_STATUS.md`'s TLS row for the fix needed before a real deployment). Schema migrations apply automatically on first Postgres start via `docker-entrypoint-initdb.d`.

### 2. Kubernetes Production (`k8s/`)
Deploy to a Kubernetes cluster using the 10-manifest suite:
```bash
# 1. Run database migrations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/migration-job.yaml

# 2. Deploy infrastructure and services
kubectl apply -f k8s/
```
Features:
- `backend-deployment.yaml`: 3 replicas with zero-downtime rolling updates, non-root security context (UID 1000), dropped Linux capabilities, `/health/live` and `/health/ready` probes.
- `hpa.yaml`: HorizontalPodAutoscaler scaling pods from 3 to 20 replicas based on 70% CPU / 80% RAM.
- `postgres-statefulset.yaml` & `redis-deployment.yaml`: Stateful persistence with PVCs and password authentication.
- `ingress.yaml`: Ingress controller with TLS certificate termination and rate-limiting.

---

## Database Migrations

To apply PostgreSQL migrations manually when running against an external database:
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
Verifies 55 tests across two files: `tests/acceptance.spec.ts` covers Acceptance Criteria AC-01 through AC-12, AC-17, AC-18, Options A & B, and Phase 3 observability; `tests/ledger-balance-invariant.spec.ts` proves the ledger/`economy_balance` invariant holds for every `IDatabase` implementation, including a Postgres-path test that's conditionally skipped when `DATABASE_URL`/`POSTGRES_URL` isn't set.
