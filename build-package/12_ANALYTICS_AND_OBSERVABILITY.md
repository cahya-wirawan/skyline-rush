# 12 Analytics & Observability — Skyline Rush

## Product events (privacy-preserving)

All product analytics events carry `player_id` (an internal opaque ID) but
never raw PII, and are subject to the same `analytics_allowed`
`ConsentRecord` gating as ad personalization (see
[[08_SAFETY_PRIVACY_COMPLIANCE]]) — an account with analytics disabled
still generates operational events (crash logs, error rates) needed to run
the service, but is excluded from product/behavioral analytics aggregation.

Core event set (see per-screen `Analytics` sections in
[[02_UX_SCREEN_SPEC]] for the full list):

- Funnel: `app_boot_completed`, `age_bucket_set`, `hub_viewed`,
  `run_started`, `run_crashed`, `run_ended`, `run_summary_viewed`.
- Monetization: `shop_viewed`, `purchase_initiated`, `purchase_completed`,
  `purchase_failed`, `redeploy_offered`, `redeploy_used`,
  `supply_drop_opened`.
- Retention/engagement: `contract_completed`, `leaderboard_viewed`,
  `friend_added`, `roster_item_equipped`.
- Trust/safety: `parental_gate_shown`, `parental_gate_passed/failed`,
  `data_export_requested`, `account_deletion_requested`.

Event volume and cardinality budgets are reviewed before adding any new
event to avoid unbounded ClickHouse growth from high-frequency gameplay
events (e.g., per-frame data is never sent — only run-level and
milestone-level events).

## Operational metrics

- API Gateway: request rate, p50/p95/p99 latency, error rate per endpoint.
- Economy Service: ledger write throughput, balance-reconciliation error
  rate (should be ~0 — any non-zero rate pages on-call, see Alerts below).
- Leaderboard Service: Redis write latency, snapshot-to-PostgreSQL lag.
- Billing Service: receipt-validation success rate, App Store Server API
  latency, unresolved-retry-queue depth.
- LiveOps Service: content bundle publish success/failure, CDN cache hit
  rate, active rollout percentage per feature flag.
- DDA batch job (see [[07_AI_OR_AUTOMATION_PIPELINE]]): job duration,
  proposed-vs-approved weight-change rate, out-of-bounds-proposal rate.

## Logs / traces

- Structured JSON logs from every backend service, correlated by a
  request-scoped trace ID propagated from the Gateway through all
  downstream service calls (OpenTelemetry-compatible tracing).
- Client crash/exception logs (Unity) captured via a crash-reporting SDK
  under the SDK-restriction rules in [[08_SAFETY_PRIVACY_COMPLIANCE]] —
  stack traces only, no user-entered free text exists to leak since there
  is no free-text input surface in-game.

## Dashboards

- Economy health: Chips/Cores inflow vs. outflow by source, Supply Drop
  actual-payout distribution vs. published odds (a live check that the
  disclosed table matches reality — any drift is a P0 incident, since it
  would make the fairness disclosure false).
- Purchase funnel: shop view → initiate → complete, by SKU and by age
  bucket (aggregate only, to confirm no purchase pressure is
  disproportionately converting younger cohorts — a fairness/compliance
  signal, not a growth-optimization target for that cohort).
- Live-ops: active District rollout status, Season Pass tier-completion
  distribution.
- Reliability: crash-free session rate, API error-rate by service,
  outbox-flush success rate (from aggregated, non-identifying client
  telemetry).

## Alerts

- Balance-reconciliation error rate > 0 sustained over 5 minutes → page.
- Receipt-validation failure rate > 2% over 15 minutes → page (financial
  impact).
- Supply Drop actual payout distribution drifts > 1 percentage point from
  the published table over a rolling 10,000-open window → page (fairness/
  compliance impact, ties to [[11_MONETIZATION_AND_BILLING]] principle 3).
- Crash-free session rate < 99% over a rolling 1-hour window on a fresh
  release → page + auto-flag for rollback consideration.
- App Store Server Notification webhook signature-verification failure
  rate > 0 → page (possible spoofing attempt or Apple-side change needing
  investigation).
- Parental-gate pass rate anomalies (e.g., near-100% pass rate suggesting
  the challenge is too easy, or a sudden spike in attempts suggesting
  probing) → weekly review, not paged.

## Data never to log

Raw birth year/date, full StoreKit receipt payloads in plaintext logs
(reference by ID only, payload stays in the encrypted store), device
advertising identifiers for `under_13`/`13_15` buckets (never collected in
the first place, so never logged), refresh tokens, and any field a
`ConsentRecord` marks as `analytics_allowed: false` for that player.
