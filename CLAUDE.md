# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and AI coding assistants when working with code in this repository.

## What this repository is

This repository contains the complete implementation of **Phase 0 (Foundations)** and **Phase 1 (Core Loop / Vertical Slice)** for **Skyline Rush**, an original iOS/iPadOS 3-lane endless runner set in Vantage City (deliberately differentiated from reference runners such as *Subway Surfers*), along with the complete design blueprint under `build-package/`.

The repository is structured into three decoupled sub-projects per `build-package/16_REPO_STRUCTURE.md`:

- **`skyline-rush-contracts/`**: OpenAPI 3.0 specification (`openapi.yaml`) and JSON schemas (`schemas/supply-drop-table.schema.json`, `schemas/content-pack.schema.json`) serving as the single source of truth for all network contracts.
- **`skyline-rush-backend/`**: Node.js / TypeScript microservices monorepo (`gateway`, `profile-auth`, `economy`, `run-integrity`, `leaderboard`, `liveops`, `billing`, `privacy`), PostgreSQL 16 migrations and connection pooling, and Jest acceptance test suite.
- **`skyline-rush-client/`**: Unity 2022.3 LTS C# project architecture (`Assets/Scripts/Run/`, `ProceduralGen/`, `Storage/`, `Networking/`, `Ads/`, `Meta/`), package manifests, Assembly Definitions (`.asmdef`), simulation test runner, and a playable Web Runner in `web/`.

---

## Build, Test, and Run Commands

### 1. Contracts (`skyline-rush-contracts/`)
```bash
cd skyline-rush-contracts
npm install
npm test            # Validates OpenAPI 3.0 spec (24 paths) and all JSON schemas
```

### 2. Backend (`skyline-rush-backend/`)
```bash
cd skyline-rush-backend
npm install
npm run build       # TypeScript compilation (tsc) with path aliases (@libs/*)
npm test            # Runs full acceptance test suite (31 tests in tests/acceptance.spec.ts)
npm run migrate     # Runs PostgreSQL migrations against DATABASE_URL or POSTGRES_URL

# Start API Gateway & Playable Web Server (Port 3000):
npx ts-node -r tsconfig-paths/register apps/gateway/main.ts
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
2. **Server-Side Age-Gating Before Third-Party SDKs**:
   - Age bucketing (`under_13`, `13_15`, `16_plus`) is derived server-side.
   - For `under_13` and `13_15` accounts, ad personalization and third-party tracking must remain strictly disabled at both API and client wrapper levels.
   - Parental gate verification (`POST /v1/auth/parental-gate/verify`) is mandatory for minor purchases and GDPR data deletion/export.
3. **Strict Idempotency**:
   - Every mutating request (`POST /v1/runs`, `/runs/redeploy`, `/contracts/:id/claim`, `/supply-drops/open`, `/purchases/receipt`) requires an `Idempotency-Key` header (UUID).
   - Duplicate submissions must return the original successful response without double-granting currency or rewards.
4. **Offline Capability & Non-Destructive Reconciliation**:
   - The run loop is 100% playable offline.
   - Offline mutations queue in an append-only FIFO outbox (bounded at 500 entries) with monotonic sequence numbers.
   - Terminal 4xx client errors (400, 402, 403, 404) are routed to dead-letter storage to prevent FIFO queue deadlock.
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

---

## Navigating the Design Package

`build-package/README.md` indexes the 22 design documents:
- `00_REFERENCE_ANALYSIS.md` & `01_PRD.md`: Core vision, personas, scope, and originality boundaries.
- `02_UX_SCREEN_SPEC.md` & `03_USER_FLOWS.md`: Screen wireframes and user interaction flows.
- `05_DATA_MODEL.md` & `06_API_SPEC.md`: Schema models and endpoint specifications.
- `08_SAFETY_PRIVACY_COMPLIANCE.md` & `09_AUTH_AND_PERMISSIONS.md`: COPPA/GDPR compliance checklist.
- `10_OFFLINE_SYNC_AND_STORAGE.md`: SQLite and outbox synchronization protocol.
- `14_IMPLEMENTATION_ROADMAP.md` & `20_ACCEPTANCE_CRITERIA.md`: Phase definitions and acceptance criteria.
- `report-01.md`: Gauntlet loop audit report and multi-provider verification scorecard.
