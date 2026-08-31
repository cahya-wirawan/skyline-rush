# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This repository currently contains **no source code** — only a complete
"build-ready" product design package under `build-package/` for **Skyline
Rush**, an original iOS/iPadOS 3-lane endless runner (inspired by, but
deliberately differentiated from, Subway Surfers). It was produced by the
`product-blueprint` skill. `build-package/package_manifest.json` confirms
`"starter_code_included": false` — there is no client or backend project
scaffolded yet.

Do not assume any build/lint/test commands exist. There is nothing to run
in this repo today; the work here is either (a) extending/correcting the
design docs, or (b) scaffolding the actual client/backend repos described
below as a new implementation effort.

## Navigating the design package

`build-package/README.md` is the index — every doc cross-links via
`[[NN_DOC_NAME]]` references (these are relative filename links, not a wiki).
Read in this order when starting implementation work:

1. `01_PRD.md` and `00_REFERENCE_ANALYSIS.md` — vision, scope, and the
   originality boundary vs. the reference game (why specific design choices
   exist, e.g. transparent Supply Drop odds instead of opaque loot boxes).
2. `16_REPO_STRUCTURE.md` — target repo/module layout (see below).
3. `14_IMPLEMENTATION_ROADMAP.md` — phase 0–5 plan with exit criteria.
4. For the Phase 1 vertical slice: `02_UX_SCREEN_SPEC.md`,
   `03_USER_FLOWS.md`, `05_DATA_MODEL.md`, and `06_API_SPEC.md` together —
   these are designed to be mutually consistent and consistent with
   `20_ACCEPTANCE_CRITERIA.md`.

Treat `08_SAFETY_PRIVACY_COMPLIANCE.md` and `09_AUTH_AND_PERMISSIONS.md` as
binding constraints from Phase 1 onward, not later add-ons — per the docs,
the server-side age-bucket gate must exist **before** any third-party SDK
(ads, analytics) is initialized.

Validate the package itself (not application code) with the skill's
validator:
```bash
python3 /Users/cahya/.claude/skills/product-blueprint/scripts/validate_package.py \
  /Users/cahya/Work/MachineLearning/skyline-rush/build-package
```

## Target architecture (from the design docs, not yet built)

When implementation begins, the docs specify **three separate repositories**
(`16_REPO_STRUCTURE.md`), not a single monorepo:

- **`skyline-rush-client/`** — Unity (C#), IL2CPP, iOS/iPadOS. Key module
  boundary: the `Run/` (gameplay) module has no network dependency during a
  run; `Meta/` (Hub/Shop/Roster/Contracts/Leaderboard/Settings) is separate
  addressable content. Local state lives in SQLite + Keychain, synced via an
  append-only, idempotency-keyed outbox queue (see `10_OFFLINE_SYNC_AND_STORAGE.md`).
- **`skyline-rush-backend/`** — NestJS (TypeScript), one deployable service
  per domain: `gateway` (sole external surface), `profile-auth`, `economy`,
  `leaderboard`, `liveops`, `billing`, `notification`, `run-integrity`.
  PostgreSQL is system of record; Redis owns only ephemeral/derived state
  (leaderboard ZSETs, sessions, rate limits) and is never a durability
  boundary; ClickHouse holds analytics events, decoupled from operational
  Postgres.
- **`skyline-rush-contracts/`** — OpenAPI spec (source of `06_API_SPEC.md`)
  + shared JSON schemas (e.g. the Supply Drop odds table). Both the client
  networking layer and the backend's `libs/shared-types` are meant to be
  generated from this in CI to prevent drift.

Non-negotiable boundary called out repeatedly across the docs: **the client
never grants currency or entitlements on its own** — every economy-affecting
path round-trips through the backend's Economy service, and Billing is the
sole writer of purchase-backed entitlements (via internal call, never
client-trusted). Content (`Assets/Content/Districts/<id>/`) is versioned and
published independently of app binaries through the LiveOps service + CDN.

## Key product decisions that constrain design work

These are called out in `01_PRD.md` and `build-package/README.md` as
deliberate differentiators from the reference game — don't propose designs
that regress them:

- Supply Drop odds are always disclosed pre-open, identical for earned and
  purchased opens (no opaque loot boxes).
- Age-bucket gating of ad SDK behavior and data collection is enforced
  **server-side**, not just declared in policy.
- Revive/"Redeploy" cost is capped (max 40 Cores/run) with a guaranteed free
  daily rewarded-ad path.
- No chat, UGC, or PvP in MVP (`01_PRD.md` NG1/NG2) — this is intentional
  scope removal for child-safety/moderation reasons, not a gap to fill in.
- No generative AI feature anywhere in the product — automation is limited
  to deterministic procedural content generation and a bounded,
  human-reviewed dynamic-difficulty tuning loop (`07_AI_OR_AUTOMATION_PIPELINE.md`).

Several product decisions are still explicitly open (`21_RISKS_AND_OPEN_QUESTIONS.md`
and the manifest's `open_decisions`): Skyline Pass billing model
(non-renewing vs. subscription), soft-launch market(s), minimum supported
iOS version/device tier, and whether to add a platform age-signal API beyond
self-reported birth year. Flag these rather than silently picking one when
they matter to a task.
