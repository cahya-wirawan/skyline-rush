# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and AI coding assistants when working with code in this repository.

## What this repository is

This repository contains the complete implementation of **Phase 0 (Foundations)**, **Phase 1 (Core Loop / Vertical Slice)**, and **Options A, B, and C (Full Meta UI, Production Cloud Infrastructure, and Procedural Visuals/Audio)** for **Skyline Rush**, an original iOS/iPadOS 3-lane endless runner set in Vantage City (deliberately differentiated from reference runners such as *Subway Surfers*), along with the complete design blueprint under `build-package/`.

The repository is structured into three decoupled sub-projects per `build-package/16_REPO_STRUCTURE.md`:

- **`skyline-rush-contracts/`**: OpenAPI 3.0 specification (`openapi.yaml`, 25 paths) and JSON schemas (`schemas/supply-drop-table.schema.json`, `schemas/content-pack.schema.json`) serving as the single source of truth for all network contracts.
- **`skyline-rush-backend/`**: Node.js / TypeScript microservices monorepo (`gateway`, `profile-auth`, `economy`, `run-integrity`, `leaderboard`, `liveops`, `billing`, `privacy`), PostgreSQL 16 migrations and connection pooling, production Docker Compose (`docker-compose.prod.yml`), Kubernetes manifests (`k8s/`), and Jest acceptance test suite (37 passing tests).
- **`skyline-rush-client/`**: Unity 2022.3 LTS C# project architecture (`Assets/Scripts/Run/`, `ProceduralGen/`, `Storage/`, `Networking/`, `Ads/`, `Meta/`), package manifests, Assembly Definitions (`.asmdef`), simulation test runner, and a complete playable Web Runner in `web/` (Canvas2D + dynamic Web Audio synthesizer).

---

## Build, Test, and Run Commands

### 1. Contracts (`skyline-rush-contracts/`)
```bash
cd skyline-rush-contracts
npm install
npm test            # Validates OpenAPI 3.0 spec (25 paths) and all JSON schemas
```

### 2. Backend (`skyline-rush-backend/`)
```bash
cd skyline-rush-backend
npm install
npm run build       # TypeScript compilation (tsc) with path aliases (@libs/*)
npm test            # Runs full acceptance test suite (37 tests, single file: tests/acceptance.spec.ts)
npx jest -t "AC-05" # Run a subset of tests by name/description pattern (all 37 live in one describe block)
npm run migrate     # Runs PostgreSQL migrations against DATABASE_URL or POSTGRES_URL

# Start API Gateway & Playable Web Server Locally (Port 3000):
npx ts-node -r tsconfig-paths/register apps/gateway/main.ts

# Production Docker Compose Deployment:
docker compose -f docker-compose.prod.yml up -d

# Kubernetes Deployment:
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/migration-job.yaml
kubectl apply -f k8s/
```

### 3. Client (`skyline-rush-client/`)
```bash
cd skyline-rush-client
npm install
npm test            # Runs client simulation suite (Core loop, PCG invariant, Outbox, Age gating)
```

---

## Non-Negotiable Architectural Boundaries

When modifying or extending this codebase, the following binding constraints must not be violated:

1. **Server Authority over Economy**:
   - The client never grants currency, unlocks roster items, or awards entitlements on its own.
   - Every balance mutation round-trips through `EconomyService` and records append-only rows in `ledger_entry` with a materialized `economy_balance`.
   - Roster item unlocks must be atomic and utilize row-level locking (`SELECT ... FOR UPDATE`).
2. **Server-Side Age-Gating & Cryptographic Parental Gate**:
   - Age bucketing (`under_13`, `13_15`, `16_plus`) is derived server-side.
   - For `under_13` and `13_15` accounts, ad personalization and third-party tracking must remain strictly disabled at both API and client wrapper levels.
   - Parental gate verification requires a server-issued challenge token (`/v1/auth/parental-gate/challenge`) and yields a signed 5-minute JWT `parental_gate_token` mandatory for minor purchases and GDPR data deletion/export. Challenge solutions must never be leaked in API responses.
3. **Strict Idempotency**:
   - Every mutating request (`POST /v1/runs`, `/runs/redeploy`, `/contracts/:id/claim`, `/supply-drops/open`, `/purchases/receipt`) requires an `Idempotency-Key` header (UUID).
   - Duplicate submissions must return the original successful response without double-granting currency or rewards.
   - Contract claiming must execute an atomic conditional SQL update: `WHERE player_id = $1 AND contract_id = $2 AND claimed_at IS NULL RETURNING *`.
4. **Offline Capability & Non-Destructive Reconciliation**:
   - The run loop is 100% playable offline.
   - Offline mutations queue in an append-only FIFO outbox (bounded at 500 entries) with monotonic sequence numbers.
   - Terminal 4xx client errors (400, 402, 403, 404) are routed to dead-letter storage to prevent FIFO queue deadlock.
   - Insufficient balance during Core redeploy must prevent revival and display exact shortfall.
5. **Run Integrity Anti-Cheat**:
   - Speed must not exceed physical plausibility ($v \le 35\text{ m/s}$).
   - Chip collection density must not exceed $2.5\text{ chips/m}$.
   - Positive `duration_seconds` is required; implausible runs are flagged as `excluded` and forfeit rewards.
6. **Transparent Odds & Fairness**:
   - Supply Drop odds are pre-disclosed and identical for earned and purchased opens.
   - Monte Carlo empirical testing verifies drop frequencies match published tables within $\pm 1.0\%$.
7. **Procedural Track Generation Invariant**:
   - The procedural generator algorithmically proves at least one legal collision-free path through each segment via BFS lookahead.
   - Mandatory breathing room segments must immediately follow any maximum difficulty segment.
   - Visual props (billboards, sky-bridges) must coordinate with obstacle segments to eliminate hitbox clipping.
8. **Cloud-Native Hardening & Observability**:
   - Containers run as non-root (UID 1000) with all capabilities dropped.
   - Liveness probe (`/health/live`) checks process health; readiness probe (`/health/ready`) validates database connectivity with a 2-second cache.
   - Prometheus metrics (`/metrics`) must guard route path cardinality by mapping unrouted endpoints to `"unmatched"`.

---

## Navigating the Design Package

`build-package/README.md` indexes the 22 design documents:
- `00_REFERENCE_ANALYSIS.md` & `01_PRD.md`: Core vision, personas, scope, and originality boundaries.
- `02_UX_SCREEN_SPEC.md` & `03_USER_FLOWS.md`: Screen wireframes and user interaction flows.
- `05_DATA_MODEL.md` & `06_API_SPEC.md`: Schema models and endpoint specifications.
- `08_SAFETY_PRIVACY_COMPLIANCE.md` & `09_AUTH_AND_PERMISSIONS.md`: COPPA/GDPR compliance checklist.
- `10_OFFLINE_SYNC_AND_STORAGE.md`: SQLite and outbox synchronization protocol.
- `14_IMPLEMENTATION_ROADMAP.md` & `20_ACCEPTANCE_CRITERIA.md`: Phase definitions and acceptance criteria.
- `report-01.md`: Unified Gauntlet audit report and multi-provider verification scorecard (PASS, Final Score: 0.978).
