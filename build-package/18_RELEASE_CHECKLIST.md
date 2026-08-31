# 18 Release Checklist — Skyline Rush

## Metadata

- [ ] App name, subtitle, and description finalized; no reference to
  "Subway Surfers" or any third-party IP anywhere in listing copy or
  keywords.
- [ ] Screenshots and preview video reflect the shipping build, not a
  pre-release mockup.
- [ ] Age rating questionnaire completed accurately (target: general
  audience rating, not Kids Category — see [[08_SAFETY_PRIVACY_COMPLIANCE]]).
- [ ] Category set to Games/Action (or current App Store taxonomy
  equivalent at submission time).
- [ ] Supported languages listed match what actually ships (English only
  at MVP per [[01_PRD]] §14).

## Platform review

- [ ] IAP odds disclosure present in-app for the Supply Drop mechanic
  before the App Store review team requests it (Guideline 3.1.1) — see
  [[11_MONETIZATION_AND_BILLING]] principle 3.
- [ ] "Restore Purchases" present and functional for the non-consumable
  SKU.
- [ ] No purchase flow reachable without a clearly stated price before the
  platform sheet.
- [ ] Demo/test account and any needed reviewer notes prepared (e.g., how
  to reach the parental gate, how to trigger a Supply Drop) for App Review.
- [ ] Sign in with Apple correctly offered wherever any other third-party
  login would be (N/A here — no other login exists, but confirmed as N/A
  rather than assumed).

## Privacy

- [ ] App Privacy "nutrition label" in App Store Connect matches the data
  inventory in [[08_SAFETY_PRIVACY_COMPLIANCE]] exactly — no under- or
  over-declaration.
- [ ] Privacy policy published and linked from Settings and the App Store
  listing; policy text matches actual SDK behavior, verified against the
  quarterly SDK network-call audit, not assumed.
- [ ] Age-bucket SDK-restriction gate verified on a fresh install (no ad
  personalization call fires before S00A completes).
- [ ] Data export and deletion endpoints tested end-to-end from the
  Settings UI, including the parental-gate path.
- [ ] COPPA/child-privacy legal review completed for the target launch
  market(s) — product/compliance engineering guidance in this package is
  not a substitute for counsel sign-off.

## Billing

- [ ] All SKUs configured in App Store Connect exactly matching
  [[11_MONETIZATION_AND_BILLING]]; sandbox-tested purchase, restore, and
  refund for each.
- [ ] App Store Server Notifications V2 webhook verified live against the
  production endpoint with signature verification enabled.
- [ ] Duplicate-transaction protection (`platform_transaction_id`
  uniqueness) verified under a replay test.

## Security

- [ ] Dependency scan clean (or exceptions documented and accepted) on
  both client and backend per [[04_SYSTEM_ARCHITECTURE]] security
  baseline.
- [ ] Secrets confirmed absent from source control and client binary
  (StoreKit shared secret, APNs keys, DB credentials).
- [ ] TLS enforced with no plaintext fallback on all backend endpoints.
- [ ] Rate limits and idempotency-key enforcement verified under load
  test.

## Accessibility

- [ ] VoiceOver pass completed on every non-gameplay screen.
- [ ] Contrast-ratio automated check passing on all UI tokens per
  [[17_DESIGN_SYSTEM]].
- [ ] Dynamic Type verified on menus/settings/disclosures.

## QA

- [ ] Full [[13_TEST_PLAN]] suite green on the release-candidate build.
- [ ] Device-farm pass across minimum supported iOS version through
  current major version, iPhone and iPad form factors.
- [ ] Soft-launch KPI dashboard confirmed reporting correctly before wide
  release (see [[01_PRD]] §11, [[12_ANALYTICS_AND_OBSERVABILITY]]).

## Operations

- [ ] On-call rotation and alert routing (from
  [[12_ANALYTICS_AND_OBSERVABILITY]]) confirmed live and tested with a
  synthetic alert.
- [ ] Rollback plan verified for both the app binary (App Store phased
  release / expedited pull if critical) and content bundles (CDN version
  pointer revert, exercised at least once pre-launch).
- [ ] Database backup/restore drill completed within the last quarter
  (see [[04_SYSTEM_ARCHITECTURE]] backup/recovery).

## Support

- [ ] In-app support/contact path present and tested (Settings → support
  link, behind the parental gate for under-13 accounts).
- [ ] Support team briefed on the data export/deletion request process and
  expected turnaround.
- [ ] Known-issues list and player-facing FAQ prepared for launch-day
  triage.
