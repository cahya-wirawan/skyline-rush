# 13 Test Plan — Skyline Rush

## Unit tests

- Client: lane-change/jump/slide state machine, power-up stacking rules
  (FR-004), input-buffering window, procedural segment selector's
  guaranteed-survivable-path invariant ([[07_AI_OR_AUTOMATION_PIPELINE]]).
- Backend: ledger arithmetic (never negative, idempotency-key uniqueness),
  Redeploy cost escalation/cap logic (FR-002), Supply Drop resolution
  against a fixed odds table (statistical distribution test over N draws),
  receipt-validation response parsing, JWT issuance/refresh-rotation logic.

## Integration tests

- `POST /v1/runs` → reward grant → `GET /v1/economy/balance` reflects the
  grant exactly once even under duplicate idempotency-key retries.
- Purchase flow: sandbox StoreKit receipt → `POST /v1/purchases/receipt` →
  entitlement granted exactly once; replayed `transaction_id` is rejected
  as a duplicate, not re-granted.
- Outbox flush ordering: simulate offline Redeploy spend followed by Run
  Summary reward grant, verify server applies them in submitted order.
- Age-bucket gating: purchase and privacy-export endpoints reject an
  `under_13` request lacking a valid parental-gate token, at the API layer,
  independent of client UI.
- App Store Server Notifications webhook: signature verification rejects
  an unsigned/malformed payload; a valid `REFUND` notification produces the
  expected `refund_reversal` ledger entry.

## End-to-end (E2E)

- Full first-run flow: install → S00A Age Gate → S02 Hub → S03 Run → crash
  → S09 Redeploy (ad path) → S10 Summary → back to Hub, on a real device
  farm covering the minimum supported iOS version and current major
  version.
- Full purchase flow on TestFlight/sandbox: Shop → (parental gate if
  applicable) → StoreKit sheet → entitlement reflected in Roster/Settings.
- Cross-device restore: guest progress on device A → link Sign in with
  Apple → same account on device B → progress present.
- District Rotation publish (staging): operator publishes a new bundle →
  client fetches and renders it without an app update; rollback reverts
  cleanly.

## UI tests

- Snapshot/visual-regression tests per screen in [[02_UX_SCREEN_SPEC]] for
  Loading/Empty/Error/Offline states specifically (these states are the
  most commonly under-tested in practice).
- VoiceOver navigation order verified on Hub, Shop, Settings, and the
  parental gate's audio-alternative path.

## Accessibility

- Automated contrast-ratio checks (WCAG-AA-equivalent) on all non-gameplay
  UI, per NFR-006.
- Manual VoiceOver pass on every menu/shop/settings screen each release;
  manual switch-control pass on primary navigation.

## Security

- Static analysis / dependency scanning (see [[04_SYSTEM_ARCHITECTURE]]
  security baseline) in CI on every backend PR.
- Penetration-test-style abuse cases: replaying a captured JWT after
  expiry, tampering with a run-result payload to claim implausible
  meters/second (must be rejected/flagged by the Run-Integrity Service),
  attempting to reuse a `platform_transaction_id` across two accounts.
- Webhook signature-forgery attempts against `/v1/webhooks/apple`.

## Performance

- Client: sustained 60fps budget on iPhone 12-class hardware under peak
  District obstacle density (NFR-001); cold-start time to first playable
  run.
- Backend: load test the Leaderboard and Economy services at simulated
  District-launch traffic (event-start spike profile from
  [[04_SYSTEM_ARCHITECTURE]] scalability section).

## Network / offline

- Airplane-mode run: play a full run, crash, Redeploy via Cores (not ad),
  reconnect, verify outbox flushes and balances reconcile exactly (see
  [[10_OFFLINE_SYNC_AND_STORAGE]]).
- Flaky-network simulation (packet loss, high latency) on the purchase flow
  specifically, verifying no double-charge and no double-grant.
- Content bundle corruption/interrupted-download recovery falls back to
  last-known-good bundle.

## Billing

- Full sandbox coverage of every SKU in [[11_MONETIZATION_AND_BILLING]]:
  purchase, restore, refund (via sandbox test tools), and the
  Remove-Interstitials non-consumable's persistence across reinstall (via
  Restore Purchases).

## AI safety / evals

N/A for generative AI (none exists — see
[[07_AI_OR_AUTOMATION_PIPELINE]]). The equivalent safety check here is the
**DDA weight-table validator**: every proposed weekly weight change is
tested against its hard bounds in CI-style validation before it is even
eligible for human review, and a synthetic "adversarial" test verifies the
validator actually rejects an out-of-bounds proposal (not just that it
accepts a valid one).

## Regression

- Full regression suite (unit + integration + core E2E flows) runs on every
  release-candidate build; District content publishes run a lighter
  content-only regression pass (segment-path-validity checker from
  [[07_AI_OR_AUTOMATION_PIPELINE]], asset integrity, no client-code
  regression risk since content bundles carry no executable code).
