# 15 Product Backlog — Skyline Rush

Organized by epic, priority P0/P1/P2. P0 items are scoped to be directly
actionable by an engineer or coding agent without further product
clarification — each references the FR/screen/API it implements.

## Epic: Core Run Loop

- **P0** Implement 3-lane input handling (swipe left/right/jump/slide) with
  120ms input buffering. Implements FR-001, [[02_UX_SCREEN_SPEC]] S03.
- **P0** Implement collision detection against the procedural segment
  library with the guaranteed-survivable-path invariant. Implements
  [[07_AI_OR_AUTOMATION_PIPELINE]] use case 1.
- **P0** Implement power-up state machine (Magnet, Shield, Boost, Chip
  Multiplier) per stacking rules in FR-004.
- **P0** Implement `POST /v1/runs` client call + local outbox entry on run
  end. Implements [[06_API_SPEC]], [[10_OFFLINE_SYNC_AND_STORAGE]].
- **P1** Author and validate the second starter-District segment library
  batch (200–400 segments) with the offline path-validity checker.

## Epic: Economy

- **P0** Implement `LedgerEntry`/`EconomyBalance` schema and idempotent
  grant logic server-side. Implements [[05_DATA_MODEL]].
- **P0** Implement Redeploy cost escalation (10→20→40 cap) and the
  `POST /v1/runs/{run_id}/redeploy` endpoint. Implements FR-002.
- **P0** Implement Supply Drop odds-table publish + `POST
  /v1/supply-drops/open` deterministic resolution against the pinned table
  version. Implements FR-006.
- **P1** Implement Skyline Pass XP accrual and tier-reward claim flow.
  Implements FR-012.

## Epic: Onboarding & Identity

- **P0** Implement S00A Age Gate screen and local-first bucket computation.
  Implements FR-009.
- **P0** Implement `POST /v1/auth/guest` and `POST /v1/auth/apple` with
  guest-to-linked merge logic (never overwrite existing guest progress).
  Implements FR-008, [[03_USER_FLOWS]] §4.
- **P0** Implement JWT issuance + refresh-token rotation with reuse
  detection. Implements [[09_AUTH_AND_PERMISSIONS]].

## Epic: Purchases & Ads

- **P0** Integrate StoreKit 2 client-side purchase sheet + server receipt
  validation via App Store Server API. Implements FR-010.
- **P0** Implement App Store Server Notifications V2 webhook with signature
  verification and refund/revoke ledger reversal. Implements
  [[11_MONETIZATION_AND_BILLING]].
- **P0** Implement S04A Parental Gate (interactive challenge + audio
  alternative) and server-side enforcement on purchase/privacy endpoints.
  Implements [[08_SAFETY_PRIVACY_COMPLIANCE]], [[09_AUTH_AND_PERMISSIONS]].
- **P0** Integrate ad mediation SDK behind the age-bucket restriction
  wrapper (no personalization for under-16 buckets, initialized only after
  age bucket is known).
- **P1** Implement Remove-Interstitials non-consumable + Restore Purchases
  flow.

## Epic: Social & Competition

- **P0** Implement Redis-backed per-District leaderboard with cursor
  pagination. Implements FR-007.
- **P0** Implement friend-code and Game Center friend linking (no device
  contacts access). Implements [[05_DATA_MODEL]] `FriendLink`.
- **P1** Implement Ghost replay recording/playback. Implements FR-013.

## Epic: Content & Live-Ops

- **P0** Implement Daily Contract generation/refresh (server cron, 3
  Contracts every 24h). Implements FR-005.
- **P1** Build the internal LiveOps admin tool with audited publish actions
  for District content, Contract definitions, Supply Drop tables, and DDA
  weight tables. Implements [[09_AUTH_AND_PERMISSIONS]] admin boundaries.
- **P1** Implement content-bundle CDN publish/rollback pipeline with
  checksum verification client-side. Implements FR-011,
  [[04_SYSTEM_ARCHITECTURE]].
- **P1** Implement Weekly Heist multi-day event structure.

## Epic: Privacy & Trust

- **P0** Implement `ConsentRecord` and the SDK-initialization gate that
  reads it before any third-party SDK call. Implements
  [[08_SAFETY_PRIVACY_COMPLIANCE]].
- **P0** Implement `/v1/privacy/export` and `/v1/privacy/delete` with
  parental-gate enforcement for under-13 accounts. Implements FR-014.
- **P0** Implement Run-Integrity plausibility checks and leaderboard
  exclusion (not deletion) for flagged runs. Implements
  [[04_SYSTEM_ARCHITECTURE]].
- **P1** Stand up the quarterly SDK network-call audit process.

## Epic: Observability

- **P0** Instrument the core event set from [[12_ANALYTICS_AND_OBSERVABILITY]]
  with consent-gating applied at the event-emission layer.
- **P0** Stand up the Economy/Billing/Reliability dashboards and the P0
  alert thresholds (balance-reconciliation, receipt-validation failure
  rate, Supply Drop payout drift).

## Epic: Accessibility & Platform Expansion (P2)

- **P2** Colorblind-safe obstacle recoloring toggle.
- **P2** Reduced-motion mode.
- **P2** iPadOS layout refinements beyond baseline Universal support.
- **P2** Android client against the shared backend.
