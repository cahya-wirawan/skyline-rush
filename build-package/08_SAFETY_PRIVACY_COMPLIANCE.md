# 08 Safety, Privacy & Compliance — Skyline Rush

This document is the direct response to the single clearest research finding
in [[00_REFERENCE_ANALYSIS]]: SYBO's stated child-privacy policy claims no
PII collection from children and no targeted ads under 16, yet a class
action alleges third-party ad/analytics SDKs extracted persistent
identifiers from children regardless of that stated policy [S6]. The lesson
applied throughout this document: **a privacy policy is not a control — it
must be enforced at the SDK-initialization and server-authorization layer,
not asserted in a document.**

## Data inventory

| Data | Category | Collected from | Retention | Notes |
|---|---|---|---|---|
| `guest_device_id` | Device identifier | All players | Life of account + 30 days post-deletion (grace, then purged) | Not linked to real name/email for guests |
| `apple_user_id` | Opaque platform identifier | Players who link Sign in with Apple | Life of account | Apple's opaque, per-app relay ID — not an email address |
| `age_bucket` | Derived, coarse age signal | All players (from birth-year entry, see [[02_UX_SCREEN_SPEC]] S00A) | Life of account | Raw birth year never leaves device; only the bucket syncs |
| Run telemetry (meters, crash cause, timestamps) | Gameplay data | All players | Row-level: 180 days, then rolled up to aggregate stats only (see [[05_DATA_MODEL]]) | Aggregated data retained indefinitely for balancing |
| Purchase/receipt data | Financial | Purchasing players | 7 years (tax/financial record requirement) | Encrypted at rest; access restricted to Billing service |
| Crash logs / diagnostics | Technical | All players (opt-out available) | 90 days | Scrubbed of any free-text/user-generated fields (none exist in-game) |
| Push token | Device identifier | Players who enable notifications | Until revoked/stale (90 days unused → purged) | |
| Friend links | Social graph (game-internal only) | Players who add friends | Life of account | Never derived from device contacts (FR-007) |

No email address, real name, phone number, precise location, photos, or
device contacts are collected at any point in the MVP. There is no chat or
user-generated content surface (NG1 in [[01_PRD]]), which removes the
largest child-safety risk category outright rather than requiring
moderation tooling to manage it.

## PII minimization by design

- Guests are fully playable with zero PII. Linking Sign in with Apple adds
  only an opaque platform ID — never an email, even when Apple offers to
  relay one.
- The age gate collects birth **year** only (not full birthdate), and only
  the derived three-value bucket (`under_13` / `13_15` / `16_plus`) is
  transmitted server-side; the raw year stays device-local (see
  [[05_DATA_MODEL]]).

## SDK-level enforcement (the control the reference's incident lacked)

- Every third-party SDK (ad mediation, crash reporting, analytics) is
  initialized **after** the age bucket is known, and initialized in a
  restricted mode for `under_13` and (for ad personalization specifically)
  `13_15` accounts: no device advertising identifier access, no cross-app
  tracking, contextual (non-behavioral) ads only.
- This restriction is enforced server-side via a signed configuration flag
  returned at session start (`ConsentRecord.ad_personalization_allowed` in
  [[05_DATA_MODEL]]) that the client SDK wrapper reads before making any
  SDK call — the client cannot silently upgrade its own permission level.
- A recurring automated audit (quarterly, or on every SDK version bump) logs
  every outbound network call the ad/analytics SDKs actually make in a
  sandboxed test build, diffed against the declared data-collection
  contract, specifically to catch the failure mode alleged against the
  reference (an SDK collecting more than its integration contract permits).
  A material mismatch blocks the SDK version from shipping.
- Vendor selection for ad mediation and crash reporting requires a signed
  Data Processing Agreement covering children's-data handling before
  integration.

## Consent

- No parental consent flow is needed to *play* (no PII is collected from
  a presumed-child device pre-consent).
- A parental gate (interactive, non-trivial challenge — see
  [[02_UX_SCREEN_SPEC]] S04A) is required before: any purchase for a
  `under_13`-bucketed account, changing the stored age bucket, or following
  an external link (support/privacy-policy pages) from that account.
- `ConsentRecord.policy_version` is stamped at consent time so re-consent
  can be triggered on material policy changes.

## Moderation / abuse controls

Minimal by design: no chat, no free-text fields, no user-uploaded media, no
device-contact-based friend discovery. The only user-influenced public-
facing text is `display_name`, which is **server-generated** (e.g.
"Runner#4821") and not player-editable in MVP, removing the need for a
profanity/PII filter at launch. If free-text display names ship later
(P2+), that requires a moderation review and an update to this document
before release.

## Child safety

- Age-bucket enforcement per above.
- No Apple Kids Category submission at MVP (NG6 in [[01_PRD]]) — the app
  targets a general audience with an internal privacy posture at least as
  strict as Kids Category would require for the under-13 cohort, while
  retaining standard IAP/ads capability for older/adult players.
- Supply Drop odds are always disclosed before an open action — see
  [[11_MONETIZATION_AND_BILLING]] — addressing loot-box-disclosure-style
  regulatory expectations (e.g., Apple/Google loot box disclosure
  requirements) proactively rather than reactively.
- Redeploy cost is capped per run (FR-002) specifically to avoid designing
  a failure-moment pressure mechanic aimed at any age group, but this
  matters most for younger, less price-literate players.

## Encryption

- TLS 1.2+ for all client-backend traffic; no plaintext fallback.
- Purchase receipts and any stored payment-adjacent references encrypted at
  rest (application-layer encryption, not just disk-level) with access
  scoped to the Billing service alone.
- Database encryption at rest (managed PostgreSQL encryption) for all
  tables.

## Third-party processors

- Ad mediation network, crash-reporting vendor, cloud infrastructure
  provider, analytics warehouse operator. Each is listed in the in-app and
  web privacy policy with its specific purpose; none receives raw PII per
  the minimization design above — at most an opaque device/session
  identifier scoped to its restricted-mode contract.

## Platform/regulatory checklist

- **App Store Review Guidelines**: privacy nutrition label accurately
  reflects the data inventory above; IAP odds disclosure present in-app for
  any randomized-reward mechanic (Guideline 3.1.1); no purchase without a
  clear price shown before the platform sheet.
- **COPPA** (US): no PII collected from under-13 without verifiable
  parental consent — achieved by not collecting PII from that bucket at
  all rather than by seeking consent for collection; ads restricted to
  non-behavioral for that bucket.
- **GDPR / UK GDPR**: data export and erasure endpoints (FR-014,
  `/v1/privacy/export`, `/v1/privacy/delete`) implement Articles 15/17
  rights; lawful basis for gameplay-necessary processing is contract
  performance, for analytics is consent (opt-out available in Settings).
- **Age-appropriate design** (e.g., UK Children's Code-style expectations):
  privacy-by-default settings for any account bucketed under 18, no
  nudging dark patterns toward data sharing or purchases.
- **California/state privacy laws**: "do not sell/share" posture by design
  (no behavioral-ad data sharing for minors; no data sale for any account,
  full stop, is the simplest compliant default and is adopted here).
- **Accessibility**: see [[17_DESIGN_SYSTEM]] and NFR-006 in [[01_PRD]].
- **AI transparency**: N/A — no AI feature exists to disclose (see
  [[07_AI_OR_AUTOMATION_PIPELINE]]).

This section is product/compliance engineering guidance, not legal advice;
final launch sign-off requires review by qualified counsel per market.

## Data export / deletion

Implemented via FR-014 and the flow in [[03_USER_FLOWS]] §8. Export
delivers a structured (JSON) copy of: profile, ownership, ledger history,
run history (aggregate, per retention policy), purchase history (SKU/date,
not full payment instrument data — Apple retains that). Deletion removes
PII and account linkage within 30 days, financial/purchase records retained
in a de-identified form only as required for tax/audit purposes for the
legally mandated period.
