# 21 Risks & Open Questions — Skyline Rush

## Product risks

- **Genre saturation.** Endless runners are a mature, crowded category;
  Skyline Rush's differentiation (transparent odds, enforced privacy,
  social layer) is a trust/fairness story more than a mechanical novelty.
  Mitigation: lean on soft-launch KPI validation (§11, [[01_PRD]]) before
  wide-release marketing spend.
- **Reception risk on control feel.** The reference's own Metacritic
  criticism cites control responsiveness [[00_REFERENCE_ANALYSIS]];
  NFR-001's 80ms input-latency budget must be validated against real
  device testing early (Phase 1 exit criteria), not assumed from spec.

## Technical risks

- **Unity IL2CPP build performance on older supported iPhones** could miss
  the 60fps target (NFR-001) under peak District obstacle density —
  mitigation: performance testing gates each Phase per
  [[14_IMPLEMENTATION_ROADMAP]], with a documented minimum supported
  device tier decided before Phase 3.
- **Remote content bundle abuse surface.** A compromised or buggy content
  bundle published via the LiveOps pipeline (FR-011) could ship an
  unwinnable segment sequence. Mitigation: the offline path-validity
  checker in [[07_AI_OR_AUTOMATION_PIPELINE]] is a hard publish gate, not
  advisory.
- **App Store Guideline 4.7 (mini-apps/remote content) risk.** Apple
  restricts what remote-served content can change without review (no
  executable code, no changing core app functionality). District content
  bundles are asset-only (art/audio/segment-data, no code) by design to
  stay within this boundary — **open question:** confirm current Guideline
  4.7 wording against developer.apple.com before Phase 4 implementation,
  since this was not re-verified in this research pass (see [[SOURCES]] S7).

## Compliance risks

- **Third-party SDK behavior drift.** The single highest-signal risk in
  this package, directly modeled on the reference's alleged incident
  [[00_REFERENCE_ANALYSIS]], [[08_SAFETY_PRIVACY_COMPLIANCE]]: an ad/
  analytics SDK could silently start collecting more than its contracted
  scope after a version bump. Mitigation: the quarterly SDK network-call
  audit is a hard gate on shipping any SDK update, not a periodic
  best-effort check.
- **Regulatory landscape for loot-box-style mechanics** varies by market
  (e.g., stricter rules in Belgium, disclosure mandates elsewhere) and
  changes over time; Supply Drop's transparent-odds design is a strong
  baseline but market-specific legal review is still required before
  entering any given market — not resolved by this package alone.
- **Age-verification API availability.** The age-bucket gate in
  [[08_SAFETY_PRIVACY_COMPLIANCE]]/[[09_AUTH_AND_PERMISSIONS]] assumes a
  simple self-reported birth-year flow; **open question:** whether to
  integrate a platform-level age-signal API (if/when Apple offers one) as
  an additional signal, given this was not re-verified against current
  Apple developer documentation in this research pass.

## Content risks

- **Originality boundary drift over time.** As District content and
  characters are authored, there is ongoing risk of unconsciously
  converging on the reference's specific visual identity (subway/graffiti
  motifs, its character silhouettes). Mitigation: [[17_DESIGN_SYSTEM]]'s
  "rooftop dusk" identity is a deliberate divergence; a design review
  checklist item should confirm no new asset resembles the reference's
  documented mascots/setting before each District ships.
- **Branded collaboration content (P2)** carries its own licensing/legal
  review requirement per partnership — not scoped or pre-approved by this
  package.

## Operational risks

- **Live-ops cadence sustainability.** District Rotation and Season Pass
  (P1) require an ongoing content-authoring cadence (~4-week cycle,
  mirroring the reference's documented World Tour cadence
  [[00_REFERENCE_ANALYSIS]]) — this is a standing operational commitment,
  not a one-time build; team sizing for sustained content production is an
  open decision.
- **Ad-mediation vendor dependency.** Rewarded-ad availability directly
  affects the free Redeploy path's fairness promise; a prolonged ad-fill
  outage degrades the free-continue experience for all players, not just a
  minor inconvenience. Mitigation: circuit-breaker fallback
  ([[04_SYSTEM_ARCHITECTURE]]) plus monitoring, but the underlying vendor
  dependency itself is not eliminated by this design.

## Cost risks

- Backend infrastructure cost scales with DAU and event-driven traffic
  spikes (District launches); no cost model/budget ceiling has been set in
  this package — **open decision** for the business to define before
  Phase 4.
- CDN egress cost for content bundles scales with install base and
  District content size; asset-size budgets per District should be set
  before Phase 1 art production begins.

## Open decisions (not yet resolved by this package)

1. Whether the Skyline Pass ships as a non-renewing per-Season purchase or
   an auto-renewing subscription (affects billing/webhook handling in
   [[11_MONETIZATION_AND_BILLING]]).
2. Target soft-launch market(s) and therefore which localization and
   region-specific compliance requirements (e.g., specific loot-box
   disclosure laws) apply first.
3. Minimum supported iOS version and device tier (affects NFR-001
   performance validation and Unity build settings).
4. Whether to pursue any platform-level age-signal API integration beyond
   self-reported birth year, pending the Apple documentation re-verification
   noted above.
5. Team sizing/cadence commitment for the live-ops content pipeline
   (Phase 4 onward) — a business decision outside this package's scope.
