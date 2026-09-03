# Skyline Rush — Build Package

An original iOS/iPadOS 3-lane endless runner inspired by the implementable
gameplay pattern of Subway Surfers (SYBO Games), with an original setting,
cast, systems naming, and a set of deliberate fairness/privacy
differentiators. Research basis, evidence classification, and originality
boundaries are in [[00_REFERENCE_ANALYSIS]]; see [[SOURCES]] for the full
citation list (research date 2026-08-31).

## Product summary

Vantage City, near-future. Gig-economy rooftop couriers ("Runners") race
grav-boards across the skyline, dodging the automated Skyline Authority
drone fleet after a delivery gets flagged. Same low-friction one-gesture-set
core loop as the genre standard (swipe left/right/jump/slide, collect
currency, unlock characters and boards, chase a rotating best-distance
leaderboard) — see [[01_PRD]] for the full vision, personas, and scope.

## Chosen stack

- **Client**: Unity (C#), IL2CPP build, iOS/iPadOS Universal.
- **Backend**: Node.js/TypeScript (NestJS), one deployable service per
  domain (Profile/Auth, Economy, Leaderboard, LiveOps, Billing,
  Notification, Run-Integrity).
- **Data**: PostgreSQL (system of record), Redis (leaderboard/session/rate
  limits), ClickHouse (analytics events).
- **Delivery**: S3 + CloudFront for content bundles; StoreKit 2 + App Store
  Server API for purchases; APNs for push; Sign in with Apple + Game Center
  for optional identity/social.

Full rationale in [[04_SYSTEM_ARCHITECTURE]]; entities in
[[05_DATA_MODEL]]; endpoints in [[06_API_SPEC]].

## Package contents

| Doc | Covers |
|---|---|
| [[00_REFERENCE_ANALYSIS]] | Subway Surfers research, evidence table, strengths/weaknesses, originality boundary |
| [[01_PRD]] | Vision, personas, MVP/P1/P2 scope, FR-001…FR-014, KPIs |
| [[02_UX_SCREEN_SPEC]] | Every screen: elements, states, accessibility, analytics |
| [[03_USER_FLOWS]] | Mermaid flows: onboarding, core loop, purchase, offline, deletion, live-ops publish |
| [[04_SYSTEM_ARCHITECTURE]] | Client/backend modules, deployment, failure handling, scalability |
| [[05_DATA_MODEL]] | Entities, SQL sketch, retention, migrations |
| [[06_API_SPEC]] | REST endpoints, auth, idempotency, pagination, webhooks |
| [[07_AI_OR_AUTOMATION_PIPELINE]] | No generative AI; procedural content + DDA automation documented instead |
| [[08_SAFETY_PRIVACY_COMPLIANCE]] | Data inventory, SDK-enforcement design, platform/regulatory checklist |
| [[09_AUTH_AND_PERMISSIONS]] | Guest/Apple auth, roles, permission matrix, parental gates |
| [[10_OFFLINE_SYNC_AND_STORAGE]] | Offline-first run loop, outbox sync, conflict reconciliation |
| [[11_MONETIZATION_AND_BILLING]] | SKUs, purchase flow, refunds, ad policy, paywall principles |
| [[12_ANALYTICS_AND_OBSERVABILITY]] | Events, dashboards, alerts, data-never-to-log |
| [[13_TEST_PLAN]] | Unit through regression, billing, AI-safety-equivalent DDA validation |
| [[14_IMPLEMENTATION_ROADMAP]] | Phase 0–5 with exit criteria, no invented dates |
| [[15_PRODUCT_BACKLOG]] | Epics, P0-actionable backlog items |
| [[16_REPO_STRUCTURE]] | Client/backend/contracts repo layout and boundaries |
| [[17_DESIGN_SYSTEM]] | Original visual identity, tokens, accessibility |
| [[18_RELEASE_CHECKLIST]] | Metadata through support readiness |
| [[19_PROMPT_LIBRARY]] | Marked not applicable — no LLM surface exists |
| [[20_ACCEPTANCE_CRITERIA]] | Given/When/Then per P0 requirement |
| [[21_RISKS_AND_OPEN_QUESTIONS]] | Product/technical/compliance/content/ops/cost risks, open decisions |
| [[22_APP_STORE_LISTING]] | App Store listing copy: name, subtitle, promo text, description, keywords, what's-new, review notes |
| [[23_PRIVACY_NUTRITION_LABEL_MAPPING]] | Every collected data type mapped to an App Privacy nutrition-label answer, traced to the code that collects it; includes the Supply Drop odds server-sourcing verification |
| [[24_RELEASE_CHECKLIST_STATUS]] | Line-by-line status audit of [[18_RELEASE_CHECKLIST]]: done / blocked / not-applicable with evidence |
| [[25_ACCESSIBILITY_STATE_AUDIT]] | WCAG 2.1 SC 1.4.1 audit of every status indicator in the Web Runner, plus explicitly deferred NFR-006 items |
| [[SOURCES]] | Full citation list with access dates and evidence classes |

Documents `22`–`25` are Phase 3 (release-readiness) additions. Three of them are
**status/audit documents** rather than design specs: they record what is
verifiable today and what is explicitly deferred, and each carries its own
"known weaknesses" section. Two automated checks back them —
`skyline-rush-client`'s `check:contrast` / `check:a11y` / `check:perf` scripts
and `skyline-rush-backend`'s `validate:observability` — and both are wired into
those packages' `npm test`.

## Major design decisions

1. **Original setting and cast** — rooftop courier vs. drone enforcement in
   a fictional city, not subway/graffiti/police-and-dog, to keep clear
   distance from the reference's protected identity.
2. **Transparent-odds Supply Drop** replacing an opaque mystery box, with
   the identical odds table for earned and purchased opens.
3. **Enforced, not just declared, child-privacy boundary** — age-bucket
   gating is checked server-side on every purchase/privacy endpoint, and a
   quarterly SDK network-call audit catches scope creep — a direct response
   to the class-action finding documented against the reference in
   [[00_REFERENCE_ANALYSIS]] and [[SOURCES]] (S6).
4. **Capped Redeploy cost** (max 40 Cores/run) plus a guaranteed free daily
   rewarded-ad path, to reduce failure-moment monetization pressure.
5. **Async social layer** (friends leaderboard, ghost replays) as a
   differentiator not documented in the reference's feature set.
6. **No chat, UGC, or PvP in MVP** — removes the largest moderation/child-
   safety surface outright rather than building tooling to manage it.
7. **No generative AI feature** — automation is limited to deterministic
   procedural content generation and a reviewed, bounded dynamic-difficulty
   weight-tuning loop; see [[07_AI_OR_AUTOMATION_PIPELINE]].

## Assumptions / open questions

See [[21_RISKS_AND_OPEN_QUESTIONS]] for the full list. Headline items:
Skyline Pass billing model (non-renewing vs. subscription) undecided;
soft-launch market(s) undecided (drives localization/regulatory scope);
minimum supported iOS version/device tier undecided; current App Store
Guideline 4.7 wording and any Apple platform age-signal API should be
re-verified against developer.apple.com before Phase 4 implementation, since
these Apple-platform specifics were not re-fetched in this research pass
(see [[SOURCES]] S7).

## How to start implementation

1. Read [[01_PRD]] and [[00_REFERENCE_ANALYSIS]] first for scope and intent.
2. Scaffold repos per [[16_REPO_STRUCTURE]]; stand up Phase 0 per
   [[14_IMPLEMENTATION_ROADMAP]].
3. Build the vertical slice (Phase 1) against [[02_UX_SCREEN_SPEC]],
   [[03_USER_FLOWS]], [[05_DATA_MODEL]], and [[06_API_SPEC]] together — they
   are designed to be consistent with each other and with
   [[20_ACCEPTANCE_CRITERIA]].
4. Treat [[08_SAFETY_PRIVACY_COMPLIANCE]] and [[09_AUTH_AND_PERMISSIONS]] as
   binding constraints on Phase 1/2 implementation, not a later add-on —
   the age-bucket gate must exist before any SDK is initialized.
5. Validate this package itself with `scripts/validate_package.py` from the
   product-blueprint skill before treating any phase as done.

## Validation

Run from the skill directory:
```bash
python3 /Users/cahya/.claude/skills/product-blueprint/scripts/validate_package.py \
  /Users/cahya/Work/MachineLearning/skyline-rush/build-package
```
