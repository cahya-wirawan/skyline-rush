# 07 AI / Automation Pipeline — Skyline Rush

## Scope decision

Skyline Rush has **no user-facing generative AI, chatbot, or LLM feature**.
This mirrors the reference: no source consulted documents any AI-driven
content-creation or conversational feature in Subway Surfers (see
[[00_REFERENCE_ANALYSIS]] "AI features" — strongly inferred absence). Adding
one would also add moderation, safety-eval, and child-safety surface area
this product deliberately avoids (see NG1 in [[01_PRD]]).

What Skyline Rush does have is **automation**: deterministic procedural
content generation (PCG) for track assembly, and a lightweight, non-
generative dynamic-difficulty tuning model. Both are documented below per
the package spec's "document the automation pipeline" requirement.
[[19_PROMPT_LIBRARY]] is marked `not_applicable` in `package_manifest.json`
because there is no prompt-driven/LLM surface to version.

## Use case 1: Procedural track assembly (client-side, deterministic)

**Purpose:** assemble an endless sequence of obstacle "segments" from an
authored tile library so runs never feel identical, without needing
hand-authored infinite content.

**Design:**
- Content designers author a finite library of segment templates per
  District (e.g. 200–400 segments), each tagged with difficulty band,
  lane-pattern, and compatible entry/exit lane states.
- At runtime, a **seeded, deterministic** weighted-random selector picks the
  next segment given the current difficulty band and the previous segment's
  exit state, so segments always chain into a physically fair sequence
  (never an unavoidable collision).
- This is **not** machine learning and **not** generative AI — it is rule-
  based procedural generation, explicitly called out here so this is never
  confused with an AI content-generation claim in App Store marketing.

**Safety/fairness checks:** every authored segment passes an offline
validator (in the content pipeline, pre-publish) confirming at least one
guaranteed-survivable lane path exists at every point; the runtime selector
additionally enforces a minimum "breathing room" segment after any
maximum-difficulty segment.

## Use case 2: Dynamic difficulty tuning (server-configured, not generative)

**Purpose:** keep the difficulty curve appropriately challenging across a
broad skill range without punishing new players or boring experts.

**Design (structured planning → deterministic checks → publication):**
1. **Input validation**: aggregate, anonymized run telemetry (meters
   survived, crash cause distribution, per-segment-difficulty crash rate)
   ingested into ClickHouse — no player-identifying data enters this
   pipeline beyond an internal cohort ID, never the player_id itself.
2. **Structured planning**: an offline batch job (run weekly, not per-
   request) computes, per District and per difficulty band, the observed
   crash-rate distribution and proposes small bounded adjustments to
   segment-selection weights (e.g. "reduce weight of segment X by up to
   10%" — changes are always capped, never a wholesale rewrite).
3. **Deterministic validators**: proposed weight changes are checked against
   hard bounds (no band's average crash rate may be pushed outside a
   configured target range) before being eligible for publish.
4. **Human review**: a LiveOps designer reviews and approves the proposed
   weight-table diff in a staging environment — this is never auto-
   published without sign-off.
5. **Publication**: approved weight tables ship as a versioned remote-config
   payload via the LiveOps & Remote Config Service (see
   [[04_SYSTEM_ARCHITECTURE]]), fetched by clients like any other content
   bundle, with the previous version retained for instant rollback.

This is a heuristic/statistical tuning loop, not a trained generative model
and not personalized per-player profiling — it adjusts shared, District-wide
segment weights, not an individual player's experience, which keeps it out
of scope for individualized-profiling privacy concerns.

## Provider abstraction

N/A — no third-party AI/LLM provider is used. If a future version considers
one (e.g., AI-assisted content authoring tools for the design team, not a
runtime player-facing feature), it must go behind a provider-agnostic
interface and receive its own PRD revision, safety review, and update to
this document and [[08_SAFETY_PRIVACY_COMPLIANCE]] before shipping.

## Cost / latency / observability

- Track assembly runs entirely on-device; zero network cost or latency.
- The weekly DDA batch job's cost is bounded by ClickHouse query volume
  (aggregated, not per-event); tracked in [[12_ANALYTICS_AND_OBSERVABILITY]]
  alongside other scheduled-job cost/latency budgets.
- Logging: DDA inputs are aggregate-only by design (see step 1); no raw
  per-player run stream leaves the Run-Integrity/Analytics boundary for
  this purpose.

## Fallback

If the weekly DDA job fails or produces an out-of-bounds proposal, the
system holds the last-approved weight table — there is no "fail open" to an
unvalidated table, and no player-visible impact from a skipped tuning cycle.
