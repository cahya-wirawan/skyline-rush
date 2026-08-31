# Skyline Rush

**Skyline Rush** is an original iOS/iPadOS 3-lane endless runner, designed
as a spiritual sibling to *Subway Surfers* but deliberately differentiated
in its product decisions (see below). This repository currently holds
**no source code** — only a complete, build-ready product design package.

## Status

There is nothing to build, lint, or test yet. This repo is either:

- (a) extending or correcting the design docs in `build-package/`, or
- (b) scaffolding the actual client/backend repos the docs describe, as a
  new implementation effort.

`build-package/package_manifest.json` confirms `"starter_code_included": false`.

## Where to start

`build-package/README.md` is the index for the full design package; every
doc cross-links via `[[NN_DOC_NAME]]` references. Read in this order:

1. [`00_REFERENCE_ANALYSIS.md`](build-package/00_REFERENCE_ANALYSIS.md) and
   [`01_PRD.md`](build-package/01_PRD.md) — vision, scope, and the
   originality boundary vs. the reference game.
2. [`16_REPO_STRUCTURE.md`](build-package/16_REPO_STRUCTURE.md) — target
   repo/module layout.
3. [`14_IMPLEMENTATION_ROADMAP.md`](build-package/14_IMPLEMENTATION_ROADMAP.md)
   — phase 0–5 plan with exit criteria.
4. For the Phase 1 vertical slice:
   [`02_UX_SCREEN_SPEC.md`](build-package/02_UX_SCREEN_SPEC.md),
   [`03_USER_FLOWS.md`](build-package/03_USER_FLOWS.md),
   [`05_DATA_MODEL.md`](build-package/05_DATA_MODEL.md), and
   [`06_API_SPEC.md`](build-package/06_API_SPEC.md) together.

Full guidance for working in this repo — including binding constraints,
target architecture, and key product decisions that must not be
regressed — lives in [`CLAUDE.md`](CLAUDE.md).

## Target architecture (not yet built)

Three separate repositories, per `16_REPO_STRUCTURE.md`:

- **`skyline-rush-client/`** — Unity (C#), IL2CPP, iOS/iPadOS.
- **`skyline-rush-backend/`** — NestJS (TypeScript), PostgreSQL, Redis,
  ClickHouse; one deployable service per domain (gateway, profile-auth,
  economy, leaderboard, liveops, billing, notification, run-integrity).
- **`skyline-rush-contracts/`** — OpenAPI spec + shared JSON schemas,
  generated into both client and backend to prevent drift.

## Key product decisions

Deliberate differentiators from the reference game — don't propose designs
that regress these:

- Supply Drop odds are always disclosed pre-open, identical for earned and
  purchased opens (no opaque loot boxes).
- Age-bucket gating of ad SDK behavior and data collection is enforced
  server-side, not just declared in policy.
- Revive/"Redeploy" cost is capped (max 40 Cores/run) with a guaranteed
  free daily rewarded-ad path.
- No chat, UGC, or PvP in MVP — intentional scope removal for
  child-safety/moderation reasons.
- No generative AI feature anywhere in the product.

Several decisions are still explicitly open — see
`build-package/21_RISKS_AND_OPEN_QUESTIONS.md` and the manifest's
`open_decisions` (billing model for Skyline Pass, soft-launch market(s),
minimum supported iOS version/device tier, and platform age-signal API).

## Validating the design package

```bash
python3 /Users/cahya/.claude/skills/product-blueprint/scripts/validate_package.py \
  /Users/cahya/Work/MachineLearning/skyline-rush/build-package
```
