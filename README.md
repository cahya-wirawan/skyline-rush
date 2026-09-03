# Skyline Rush

**Skyline Rush** is an original iOS/iPadOS 3-lane endless runner set in the near-future skyline of Vantage City. Couriers race grav-boards across rooftops, dodging automated Skyline Authority drones, collecting Energy Chips, and competing on global leaderboards.

Deliberately differentiated from reference runners (e.g. *Subway Surfers*), Skyline Rush features pre-disclosed transparent Supply Drop odds, server-enforced child privacy protection (COPPA / GDPR-K), capped Redeploy revive costs, an append-only server-authoritative economy ledger, and a high-performance procedural cyberpunk aesthetic.

---

## Repository Status

**Phase 0 (Foundations)**, **Phase 1 (Core Loop & Vertical Slice)**, and **Options A, B, and C (Full Meta UI, Production Cloud Infrastructure, and Procedural Visuals/Audio)** are fully implemented and verified via an adversarial Multi-Provider Gauntlet Loop (see [`report-01.md`](report-01.md), Final Score: **0.978 / 1.000**).

**Phase 3 (Polish, Submission, Launch)** — accessibility enforcement, client performance instrumentation, backend observability (alerting rules + Grafana dashboards), App Store submission documentation, and a line-by-line release-checklist audit — passed its own adversarial Gauntlet Loop at **0.923 / 1.000** (see [`report-01.md`](report-01.md)) after a first iteration caught and fixed a critical server-side economy bug. Its status/audit documents record what is verifiable in this environment and what is explicitly deferred to a physical device or a live deployment — see [`24_RELEASE_CHECKLIST_STATUS.md`](build-package/24_RELEASE_CHECKLIST_STATUS.md).

**The production Docker Compose stack has been built and run for real** — real PostgreSQL 16, real Redis 7, the compiled backend, and Nginx — with the playable web client, guest auth, and economy writes all confirmed working end-to-end against genuine infrastructure (see `report-01.md`'s "Live Deployment Verification" section). That pass found and fixed four real packaging/test defects that two full adversarial Gauntlet Loop iterations had missed, because none of them had ever executed a reproducible build or a real database.

```
skyline-rush/
├── build-package/             # Complete build-ready product blueprint (PRD, UX specs, test plans,
│                              # App Store listing, privacy label mapping, release + a11y audits)
├── skyline-rush-contracts/    # OpenAPI 3.0.3 spec (25 paths), JSON schemas, automated validator
├── skyline-rush-backend/      # Express/NestJS microservices monorepo, PostgreSQL & Redis configs,
│                              # Docker Compose prod, K8s manifests (k8s/), Prometheus metrics (/metrics),
│                              # observability/ (alerting rules, 4 Grafana dashboards, validator)
├── skyline-rush-client/       # Unity 2022.3 LTS scaffolding, C# run engine, playable Web Runner (web/),
│                              # a11y + perf check scripts, PERF_REPORT.md
└── report-01.md               # Unified Gauntlet execution report: Phase 0/1 & Options A/B/C (0.978),
                               # Web Runner v3 visual overhaul, Phase 3 release readiness (0.923)
```

---

## Quick Start: Play the Game

Skyline Rush includes an interactive, playable Web Runner in `skyline-rush-client/web` served directly by the backend API Gateway.

### 1. Start the Backend API Gateway
```bash
cd skyline-rush-backend
npm install
npx ts-node -r tsconfig-paths/register apps/gateway/main.ts
```

### 2. Launch in Browser
Open **[http://localhost:3000](http://localhost:3000)** in any modern web browser.

#### Controls
| Action | Controls |
|---|---|
| **Switch Lane** | <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> (or Swipe Left / Right) |
| **Jump** | <kbd>W</kbd> / <kbd>↑</kbd> / <kbd>Space</kbd> (or Swipe Up) |
| **Slide / Fast-Fall** | <kbd>S</kbd> / <kbd>↓</kbd> (or Swipe Down) |

#### Interactive Features in the Playable Client
- **S02 Main Hub**: Real-time balance pills, equipped Courier/Board preview, and quick launcher.
- **S03 Active Run**: Retina-sharp (DPR-aware) synthwave renderer — striped sun and twinkling starfield, two-layer parallax skyline with lit window grids and blinking beacons, scrolling perspective floor grid, bloomed neon rails and dashed lane markers, hazard-striped hurdles, laser barriers, rotor drones with scan cones, spinning hex chips, glyph-labelled power-up orbs, a fully articulated courier (per-character suit palettes, lean/run/slide/jump poses, board underglow), plus additive particle bloom, boost speed-lines, crash screen-shake/flash, vignette and scanlines.
- **Dynamic Web Audio Synthesizer**: Procedural 4-bar cyber bassline loop (125–165 BPM synced to speed), 16th-note Boost arpeggiator, Doppler near-miss whoosh sound effects, and DSP low-pass filter (sweeping cutoff to 380 Hz on modals/pause).
- **S04 Shop**: Cores crates (50, 120, 260, 600, 1400 Cores), Supply Drops, and Daily Specials (`starter_pack`, `remove_interstitials`).
- **S04A Parental Gate**: Accessible numeric PIN pad and server-signed arithmetic challenge verification required for minor purchases and GDPR actions.
- **S05 Roster & Customization**: Courier (Vex, Kael, Aria) and Grav-Board (Ion Glide, Pulse Ray, Vortex Breaker) selection carousel with atomic Cores unlocks.
- **S06 Contracts**: Dedicated daily and weekly courier missions screen with real-time objective tracking and idempotent reward claiming.
- **S08 Settings & GDPR**: SFX/Music volume sliders, Friend Code sharing/addition, GDPR Article 15 JSON Data Export, and GDPR Article 17 Account Deletion.
- **S09 Redeploy Revive Modal**: Free daily ad revive or Cores revive ($10 \rightarrow 20 \rightarrow 40$ escalation) with balance shortfall protection.
- **S10 Run Summary**: Distance cleared, chips collected, pass XP earned, and anti-cheat verification badge.

---

## Architecture Overview

### 1. `skyline-rush-contracts/`
Single source of truth for all API definitions and content schemas:
- `openapi.yaml`: OpenAPI 3.0 specification covering 25 paths / 23 endpoints (`/auth/guest`, `/auth/apple`, `/auth/refresh`, `/auth/parental-gate/challenge`, `/auth/parental-gate/verify`, `/profile`, `/runs`, `/runs/redeploy`, `/economy/balance`, `/economy/ledger`, `/contracts/active`, `/contracts/{id}/claim`, `/supply-drops/*`, `/roster`, `/roster/unlock`, `/roster/equip`, `/leaderboard`, `/friends/add`, `/purchases/receipt`, `/privacy/export`, `/privacy/data-export`, `/privacy/delete`, `/privacy/delete-account`, `/liveops/config`, `/webhooks/apple`).
- `schemas/supply-drop-table.schema.json`: JSON schema enforcing transparent odds distributions summing to 1.0.
- `schemas/content-pack.schema.json`: District remote content pack manifest schema with SHA-256 checksums.

### 2. `skyline-rush-backend/`
TypeScript / Express / NestJS microservices monorepo:
- **`apps/gateway`**: Reverse proxy, rate limiting, Prometheus metrics exposition (`/metrics` with route cardinality protection), shallow/deep health checks (`/health/live`, `/health/ready` with 2s anti-DoS cache), CORS, and static web client hosting.
- **`apps/profile-auth`**: Zero-PII guest identity, Apple linking with guest progress merge, token refresh, and server-signed parental gate challenges with 5-minute JWT verification tokens.
- **`apps/economy`**: Append-only ledger (`ledger_entry`), materialized balances (`economy_balance`), atomic row-locked unlocks (`unlockItemAtomic`), idempotent contract claims (`WHERE claimed_at IS NULL`), Redeploy cost escalation ($10 \rightarrow 20 \rightarrow 40$ Cores cap, 1 free ad revive), and Supply Drop resolver against published odds (`standard-v7`).
- **`apps/run-integrity`**: Anti-cheat plausibility checks enforcing velocity limits ($v \le 35\text{ m/s}$) and chip collection density ($\le 2.5\text{ chips/m}$), requiring positive durations.
- **`apps/leaderboard`**: Redis ZSET leaderboard logic, self-rank calculation, and strict filtering for `integrity_flag = 'ok'`.
- **`apps/billing`**: StoreKit 2 receipt validation covering all 7 catalog SKUs, duplicate grant prevention, and Apple Server Notifications V2 webhook handler.
- **`apps/privacy`**: GDPR Article 15 export and Article 17 deletion with server-enforced parental gate tokens for minors.
- **`libs/db`**: PostgreSQL 16 migration (`001_initial_schema.sql`), migration runner (`migrate.ts`), connection pool with row locks (`postgres-db.ts`), and in-memory test engine (`in-memory-db.ts`).
- **Production Orchestration**:
  - `docker-compose.prod.yml`: PostgreSQL 16, Redis 7 (with password auth), Backend Gateway, and Nginx reverse proxy with SSL termination on port 443.
  - `k8s/`: Complete 10-manifest suite (`namespace`, `configmap`, `secrets`, `migration-job`, `postgres-statefulset`, `redis-deployment`, `backend-deployment`, `backend-service`, `hpa`, `ingress`) with non-root security contexts (UID 1000) and dropped capabilities.

### 3. `skyline-rush-client/`
Client engine targeting Unity 2022.3 LTS (iOS/iPadOS) and interactive web:
- **Unity 2022.3 Scaffolding**: `ProjectSettings/ProjectVersion.txt` (`2022.3.20f1`), `Packages/manifest.json`, 9 modular Assembly Definitions (`.asmdef`), and `MonoBehaviour` views.
- **`Assets/Scripts/Run/`**: 3-lane state machine, 150ms input buffer, parabolic jump with mid-air slide fast-fall, continuous coordinate obstacle collision, vacated lane immunity, and power-up state machine (Shield, Magnet, Boost, 2x Multiplier).
- **`Assets/Scripts/ProceduralGen/`**: Seeded deterministic track generator with BFS survivable path invariant and mandatory breathing room after maximum difficulty segments.
- **`Assets/Scripts/Storage/`**: Persistent `SQLiteStorageLayer.cs` and `KeychainWrapper.cs`, bounded 500-entry FIFO outbox queue with terminal 4xx dead-lettering, and non-destructive server balance reconciliation.
- **`Assets/Scripts/Ads/` & `Analytics/`**: Server-enforced age-bucket gating suppressing IDFA and tracking for minor accounts.
- **`web/`**: Full interactive 3D canvas runner with procedural props, particle systems, dynamic Web Audio synth engine, and complete Phase 2 UI screens.

---

## Running Tests

All components have automated test suites verifying Acceptance Criteria AC-01 through AC-18 and Options A, B, and C:

```bash
# 1. Validate Contracts & JSON Schemas (AC-01, AC-02)
cd skyline-rush-contracts
npm test

# 2. Run Backend Acceptance Test Suite (44 Jest tests across AC-01..12, 17, 18,
#    Options A & B, and Phase 3 Observability) followed by the observability
#    artifact validator (alerting rules + Grafana dashboards vs. real metric names)
cd ../skyline-rush-backend
npm run build
npm test

# 3. Run Client Simulation Suite (AC-13..AC-16) followed by the Phase 3
#    accessibility and performance-instrumentation checks
cd ../skyline-rush-client
npm test
```

Phase 3 adds three client checks and one backend check, all chained into the
`npm test` above and individually runnable:

```bash
cd skyline-rush-client
npm run check:contrast   # WCAG 2.1 AA contrast over 36 UI-chrome colour pairings
npm run check:a11y       # every interactive control has a unique accessible name
npm run check:perf       # PerfStats frame-time / input-latency instrumentation

cd ../skyline-rush-backend
npm run validate:observability   # alerting-rules.yml + 4 dashboards vs. emitted metrics
```

---

## Product Blueprint & Design Package

The full product design package produced by the `product-blueprint` skill is located in [`build-package/`](build-package/):
- [`00_REFERENCE_ANALYSIS.md`](build-package/00_REFERENCE_ANALYSIS.md) & [`01_PRD.md`](build-package/01_PRD.md) — Vision, personas, and originality boundary.
- [`02_UX_SCREEN_SPEC.md`](build-package/02_UX_SCREEN_SPEC.md) & [`03_USER_FLOWS.md`](build-package/03_USER_FLOWS.md) — Complete UX wireframes and mermaid user flows.
- [`05_DATA_MODEL.md`](build-package/05_DATA_MODEL.md) & [`06_API_SPEC.md`](build-package/06_API_SPEC.md) — PostgreSQL data model and REST API specifications.
- [`08_SAFETY_PRIVACY_COMPLIANCE.md`](build-package/08_SAFETY_PRIVACY_COMPLIANCE.md) & [`09_AUTH_AND_PERMISSIONS.md`](build-package/09_AUTH_AND_PERMISSIONS.md) — COPPA/GDPR child privacy and auth architecture.
- [`10_OFFLINE_SYNC_AND_STORAGE.md`](build-package/10_OFFLINE_SYNC_AND_STORAGE.md) — Offline outbox sync and reconciliation.
- [`14_IMPLEMENTATION_ROADMAP.md`](build-package/14_IMPLEMENTATION_ROADMAP.md) & [`20_ACCEPTANCE_CRITERIA.md`](build-package/20_ACCEPTANCE_CRITERIA.md) — Phased roadmap and Given/When/Then acceptance criteria.
- [`22_APP_STORE_LISTING.md`](build-package/22_APP_STORE_LISTING.md) & [`23_PRIVACY_NUTRITION_LABEL_MAPPING.md`](build-package/23_PRIVACY_NUTRITION_LABEL_MAPPING.md) — Phase 3: App Store listing copy, and every App Privacy nutrition-label answer traced to the code that collects the data.
- [`24_RELEASE_CHECKLIST_STATUS.md`](build-package/24_RELEASE_CHECKLIST_STATUS.md) & [`25_ACCESSIBILITY_STATE_AUDIT.md`](build-package/25_ACCESSIBILITY_STATE_AUDIT.md) — Phase 3: line-by-line release-checklist status audit, and the WCAG 2.1 SC 1.4.1 non-colour status-indicator audit.
- [`report-01.md`](report-01.md) — Unified Gauntlet execution report covering Phase 0/1 and Options A, B, and C (0.978/1.000), the Web Runner v3 visual overhaul addendum, and the Phase 3 release-readiness round (0.923/1.000 after a critical-bug revision cycle).

Phase 3 client/ops artifacts living outside `build-package/`:
- [`skyline-rush-client/PERF_REPORT.md`](skyline-rush-client/PERF_REPORT.md) — frame-time and input-latency instrumentation, gradient-caching optimisation, and measurement caveats.
- [`skyline-rush-backend/observability/`](skyline-rush-backend/observability/) — `alerting-rules.yml` (5 Prometheus alerts) and four Grafana dashboards (economy health, purchase funnel, live-ops, reliability), both gated by `validate-rules.js`.
