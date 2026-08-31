# 11 Monetization & Billing — Skyline Rush

## Business model

Free-to-download, free-to-play, with in-app purchases and rewarded/
interstitial video ads — the same overall model documented for the
reference [S1, S2] — with the fairness-oriented adjustments described
throughout this document as differentiators (see [[00_REFERENCE_ANALYSIS]]
opportunities).

## Free / premium split

The entire core loop (running, all Districts unlocked at MVP, Daily
Contracts, base leaderboard) is free and unlimited — there is no energy
system and no paywall on gameplay itself. Monetization sits around:
convenience (Redeploy via Cores instead of restarting), cosmetics/roster
expansion, and the Skyline Pass premium track (P1). This mirrors the
reference's inferred free/premium boundary [[00_REFERENCE_ANALYSIS]] while
explicitly avoiding any pay-to-win axis (no purchasable score/speed
advantage — Boost and Magnet power-ups are earned in-run only, never
purchasable directly).

## Plans / SKUs (MVP)

| SKU | Type | Contents | Reference price anchor |
|---|---|---|---|
| Chips — Small | Consumable | 7,500 Chips | $0.99 (anchored to reference's 7,500 Coins tier [S1]) |
| Chips — Medium | Consumable | 12,500 Chips | $0.99 |
| Chips — Large | Consumable | 45,000 Chips | $4.99 |
| Chips — XL | Consumable | 65,000 Chips | $4.99 |
| Cores — Small | Consumable | 25 Cores | $4.99 |
| Cores — Medium | Consumable | 40 Cores | $4.99 |
| Starter Pack | Consumable, one-time offer | Chips + Cores + a cosmetic trail | $0.99 |
| Remove Interstitials | Non-consumable | Removes end-of-run interstitial ads only (rewarded ads remain opt-in and still available, since they benefit the player) | $4.99 |
| Supply Drop (purchased) | Consumable | One Supply Drop opened against the same public odds table as an earned drop | $1.99 |
| Skyline Pass (P1) | Non-renewing subscription-equivalent per Season (~4 weeks) | Unlocks premium reward track for the active Season | $7.99/Season |

Exact prices are Proposed anchors for planning and must be finalized per
market during store-listing setup; they intentionally track the reference's
publicly observed price points [S1] rather than inventing an unfamiliar
pricing ladder.

## Purchase flow

Full flow diagram in [[03_USER_FLOWS]] §5; full request/response contract in
[[06_API_SPEC]] `POST /v1/purchases/receipt`. Summary: StoreKit 2 purchase
sheet → signed JWS transaction sent to backend → server validates via the
App Store Server API → entitlement granted only after validation succeeds →
client UI updates from the server-confirmed balance, not an optimistic
assumption (unlike Run rewards, purchase entitlements are not shown as
"granted" until server-confirmed, since real money is involved).

## Source of truth

The Billing service (backend) is the sole source of truth for entitlements.
The client never grants currency or unlocks locally from a StoreKit
callback alone — it always round-trips through receipt validation first.
This closes a common exploit class (client-side purchase spoofing) and
ensures `Purchase.platform_transaction_id` uniqueness (see
[[05_DATA_MODEL]]) is the hard boundary against double-granting.

## Restore / refunds / cancellation

- **Restore purchases**: a visible "Restore Purchases" action in S04 Shop
  re-queries StoreKit's transaction history and re-validates any
  non-consumable/entitlement-bearing transaction not already reflected
  server-side — required by App Store Review Guidelines for any
  non-consumable IAP.
- **Refunds/revocations**: handled reactively via the App Store Server
  Notifications V2 webhook (`REFUND`, `REVOKE` notification types) —
  the Billing service reverses the corresponding `LedgerEntry`
  (`reason: refund_reversal`) rather than deleting history, preserving a
  clean audit trail (see [[05_DATA_MODEL]]).
- **Cancellation**: N/A for consumables; for the (P1) Skyline Pass — if
  implemented as an auto-renewing subscription rather than a per-Season
  one-time purchase — standard subscription-management deep link is
  surfaced in Settings, and cancellation state is likewise driven by App
  Store Server Notifications, never by client assertion.

## Server validation

Every entitlement-granting purchase is validated server-side before grant,
with no exception, including sandbox/TestFlight builds (against Apple's
sandbox environment) — see [[06_API_SPEC]] error codes
(`RECEIPT_INVALID`).

## Trials

No free trial mechanic in MVP. If the Skyline Pass ships as an auto-renewing
subscription in a later phase, a trial period would be configured in App
Store Connect and its state driven the same way as cancellation, above —
tracked as an open decision in [[21_RISKS_AND_OPEN_QUESTIONS]].

## Ads

- **Rewarded video** (opt-in only, never forced): free Redeploy (first per
  run), double Supply Drop reward, bonus Chips from Daily Contracts. Always
  presented with the reward clearly stated before the player opts in, and
  the reward is granted only after the ad SDK confirms full completion.
- **Interstitial** (opt-out via the Remove Interstitials SKU): shown at
  most once per Run Summary → Hub transition, never mid-run, never more
  than once per 3-minute rolling window regardless of session length (a
  frequency cap enforced server-side via remote config, not just a client
  default).
- **No ads at all** — rewarded or interstitial — are shown before the
  player's age bucket is established (S00A must complete first), and no ad
  personalization/behavioral targeting is enabled for `under_13` or
  `13_15` buckets (see [[08_SAFETY_PRIVACY_COMPLIANCE]]).

## Paywall principles

1. Never interrupt the core loop with a paywall — the run itself is always
   free and playable.
2. Every priced action shows its exact price and contents before commit —
   no "mystery" pricing.
3. Every randomized-reward mechanic (Supply Drop) shows its odds table
   before the open action, for both earned and purchased drops, using the
   identical table (see [[06_API_SPEC]] `GET
   /v1/supply-drops/tables/{table_id}`) — this is the direct fix for the
   reference's documented opaque Mystery Box weakness
   ([[00_REFERENCE_ANALYSIS]]).
4. Redeploy cost is capped per run (see FR-002) so a single bad run can
   never escalate into an unbounded spend prompt.
5. No purchase flow is presented to an `under_13`-bucketed account without
   first passing the parental gate (see [[09_AUTH_AND_PERMISSIONS]]).
6. No dark patterns: no pre-ticked purchase add-ons, no countdown timers
   implying artificial scarcity on a purchase that isn't actually
   time-limited.
