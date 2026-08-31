# 20 Acceptance Criteria — Skyline Rush

Given/When/Then criteria for each P0 functional requirement in [[01_PRD]].

## AC-001 — Core run loop (FR-001)

- **Given** a player is in an active run, **when** they swipe left or right
  toward an adjacent open lane, **then** the Runner moves to that lane
  within the input-buffer window and no collision is registered for
  obstacles that were only in the vacated lane.
- **Given** a player is mid-air from a jump, **when** they swipe down,
  **then** the character begins a slide immediately on landing rather than
  queuing a second jump.
- **Given** a Runner collides with an obstacle and no Shield/Board charge is
  active, **then** the run ends and control passes to S09 Redeploy Offer.

## AC-002 — Redeploy (FR-002)

- **Given** a run has ended in a crash and no prior Redeploy was used this
  run, **when** the player chooses "Watch ad" and completes it, **then**
  the run resumes from the crash point at zero Core cost.
- **Given** a player has already redeployed once via Cores this run,
  **when** they redeploy again, **then** the displayed cost is exactly
  double the prior cost, capped at 40 Cores regardless of further attempts.
- **Given** a player's Core balance is below the displayed cost, **then**
  the Core-spend option is visibly disabled with the shortfall amount
  shown, not hidden.

## AC-003 — Currency economy (FR-003)

- **Given** a player collects Chips during a run, **when** the run ends,
  **then** the exact collected amount is reflected in `run_ended` rewards
  and, once synced, in `GET /v1/economy/balance`.
- **Given** any ledger-affecting request is retried with the same
  `Idempotency-Key`, **then** the balance change is applied exactly once,
  not once per retry.

## AC-004 — Power-ups (FR-004)

- **Given** a Shield is already active, **when** the player collects
  another Shield, **then** no second Shield stacks (duration does not
  extend beyond the single active instance's remaining time, per the
  documented non-stacking rule).
- **Given** a Chip Multiplier is active, **when** the player collects
  Chips, **then** the credited amount is exactly the base value times the
  active multiplier, with no rounding loss below the true integer value.

## AC-005 — Daily Contracts (FR-005)

- **Given** a player completes all three active Contracts, **when** the
  server-side 24h refresh boundary passes, **then** three new Contracts are
  issued and the prior three are no longer completable retroactively for
  reward.
- **Given** a Contract's objective is met mid-run, **then** the player can
  claim its reward from S06 without needing to end the run first.

## AC-006 — Supply Drop (FR-006)

- **Given** a player is about to open any Supply Drop, **then** the exact
  probability table for that drop's `table_id`/`table_version` is rendered
  before the open action is enabled.
- **Given** two Supply Drops use the same `table_id`, one earned and one
  purchased, **then** both resolve against the identical probability
  distribution — no purchased-only "better" hidden table exists.

## AC-007 — Leaderboard (FR-007)

- **Given** a player submits a new personal-best run for a District,
  **when** they next view S07 Leaderboard for that District, **then** their
  rank reflects the new best within one sync cycle.
- **Given** a player has zero friends added, **when** they view the
  Friends tab, **then** an explicit invite prompt is shown, never a blank
  list with no explanation.

## AC-008 — Guest and linked accounts (FR-008)

- **Given** a fresh install with no prior link, **when** the app completes
  boot, **then** a playable guest session exists with zero PII collected.
- **Given** a guest links Sign in with Apple for the first time, **then**
  all pre-existing guest progress (currency, ownership, run history) is
  preserved under the newly linked profile, never discarded.

## AC-009 — Age bucketing (FR-009)

- **Given** a fresh install, **when** the player reaches S02 Main Hub for
  the first time, **then** S00A Age Gate has already been completed and an
  `age_bucket` is set both locally and (once connected) server-side.
- **Given** an account is bucketed `under_13`, **then** no ad-personalization
  SDK call is observed for that session in the network-call audit.

## AC-010 — Purchases (FR-010)

- **Given** an account bucketed `under_13` attempts any purchase, **when**
  the parental gate has not been passed within the required freshness
  window, **then** the server rejects `POST /v1/purchases/receipt` even if
  the client attempted to skip the gate UI.
- **Given** a valid receipt is submitted twice (duplicate
  `platform_transaction_id`), **then** the entitlement is granted exactly
  once and the second submission returns a duplicate/idempotent result, not
  a second grant.

## AC-014 — Data export/delete (FR-014)

- **Given** a linked player requests data export from Settings, **then**
  they receive a complete structured copy of their profile, ownership,
  ledger history, and purchase history within the documented turnaround.
- **Given** a player requests account deletion, **when** the request is
  confirmed (post parental-gate if applicable), **then** local data is
  wiped immediately on-device regardless of backend completion timing, and
  PII is removed server-side within the retention policy window in
  [[08_SAFETY_PRIVACY_COMPLIANCE]].

## AC — Offline integrity (cross-cutting, [[10_OFFLINE_SYNC_AND_STORAGE]])

- **Given** a player completes a Redeploy-via-Cores and a full run while
  fully offline, **when** connectivity returns, **then** both outbox
  entries apply in their original order and the resulting server balance
  matches what the optimistic local UI already showed, or the player is
  shown an explicit explanation if it does not.

## AC — Supply Drop fairness (cross-cutting, [[12_ANALYTICS_AND_OBSERVABILITY]])

- **Given** 10,000 opens against a single `table_version`, **then** the
  observed payout distribution stays within 1 percentage point of the
  published table's declared probabilities, or the fairness-drift alert
  fires.
