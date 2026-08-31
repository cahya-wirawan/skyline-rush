# 14 Implementation Roadmap — Skyline Rush

Phased by deliverable and exit criteria, not calendar dates (per
engineering guidelines — no estimates are invented here).

## Phase 0 — Foundations

**Deliverables:** repo scaffolding ([[16_REPO_STRUCTURE]]), CI/CD pipelines
for client and backend, Docker Compose dev environment, PostgreSQL schema
migration tooling in place, base NestJS services skeleton (Gateway, Profile,
Economy — empty but deployed), Unity project with the Run module's input/
collision/lane system (no art, greybox obstacles), sandbox StoreKit
configured.

**Dependencies:** none.

**Exit criteria:** a greybox build runs a full offline lane-swipe loop on
device; backend services deploy to `dev` and pass a health check; CI runs
lint + unit tests on every PR.

## Phase 1 — Core loop, vertical slice

**Deliverables:** FR-001–FR-004 (run loop, Redeploy, currency economy,
power-ups) end-to-end against real backend services; S00A Age Gate, S02 Hub,
S03 Run, S09 Redeploy, S10 Summary fully implemented per
[[02_UX_SCREEN_SPEC]]; one complete starter District with production-quality
art; guest auth (FR-008); offline outbox ([[10_OFFLINE_SYNC_AND_STORAGE]]).

**Dependencies:** Phase 0.

**Exit criteria:** an internal playtest build is fully playable start-to-
finish with real economy persistence, offline-capable, on TestFlight
internal testing; Run-Integrity Service rejects a hand-crafted implausible
run in a test.

## Phase 2 — Economy, contracts, monetization MVP

**Deliverables:** FR-005–FR-007, FR-010 (Contracts, Supply Drop, Leaderboard,
Purchases); S04 Shop, S04A Parental Gate, S05 Roster, S06 Contracts, S07
Leaderboard, S08 Settings; StoreKit 2 purchase flow with server-side receipt
validation and App Store Server Notifications webhook; rewarded/interstitial
ad integration under the age-bucket SDK restrictions
([[08_SAFETY_PRIVACY_COMPLIANCE]]); FR-009 age bucketing and FR-014 data
export/delete.

**Dependencies:** Phase 1.

**Exit criteria:** a closed beta build passes the full [[13_TEST_PLAN]]
billing and privacy test suites; App Store privacy nutrition label and
IAP/loot-box odds disclosure drafted and internally reviewed; sandbox
purchase/refund/restore all verified.

## Phase 3 — Polish, submission, launch

**Deliverables:** accessibility pass (NFR-006, [[17_DESIGN_SYSTEM]]),
performance tuning to NFR-001 targets, full analytics/observability
dashboards and alerts live ([[12_ANALYTICS_AND_OBSERVABILITY]]), App Store
listing assets, [[18_RELEASE_CHECKLIST]] fully executed, soft launch in a
limited market to validate KPIs from [[01_PRD]] §11 before wide release.

**Dependencies:** Phase 2.

**Exit criteria:** App Store review passed on first or second submission;
soft-launch KPI dashboard live; crash-free session rate ≥ 99.5% sustained
for 7 days pre-launch.

## Phase 4 (P1) — Live-ops pipeline

**Deliverables:** FR-011 District Rotation (remote content publish/rollback
without a binary release), FR-012 Skyline Pass, FR-013 Ghost replay, Weekly
Heist, LiveOps admin tool with audit logging.

**Dependencies:** Phase 3 (live, stable production backend).

**Exit criteria:** a second District ships to 100% of players via the
remote pipeline with zero app-binary update, staged rollout and rollback
both exercised at least once in production.

## Phase 5 (P2) — Platform expansion

**Deliverables:** iPadOS-specific layout refinements, Android client
(shared backend), colorblind-safe/reduced-motion accessibility modes,
clan/crew leaderboards, evaluated branded-collaboration content slots.

**Dependencies:** Phase 4 live-ops pipeline proven stable (Android reuses
the same backend and content pipeline).

**Exit criteria:** decided per business priority at the time; no fixed exit
criteria defined yet — see [[21_RISKS_AND_OPEN_QUESTIONS]].
