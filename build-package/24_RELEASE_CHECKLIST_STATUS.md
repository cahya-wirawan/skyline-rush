# 24 Release Checklist Status — Skyline Rush

Companion status document for [[18_RELEASE_CHECKLIST]]. Every one of the 34
checkbox items in that checklist is reproduced below, classified as
`Executable-now` or `Deferred`, with real, executed evidence or an honest
one-line deferral reason.

**Audit date:** 2026-09-03
**Auditor scope:** Phase 3, AC-P3-14 / AC-P3-15 / AC-P3-16

---

## Scope and honesty notes (read first)

1. **Concurrent Phase 3 change-set.** Several Phase 3 workstreams —
   accessibility contrast/label scripts, performance instrumentation, and
   observability metrics/alerts/dashboards — are being implemented by a
   parallel agent **within this same change-set**. Where a checklist item
   depends on them, the item is marked `Executable-now` and references the
   artifact path that this change-set produces:
   - `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/check-contrast.js`
   - `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/check-a11y-labels.js`
   - `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/PERF_REPORT.md`
   - `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/observability/alerting-rules.yml`
   - `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/observability/dashboards/*.json`

   Status of those paths, re-checked with `ls` at the time of the latest
   revision of this document: **all five have now landed on disk.**
   `check-contrast.js` and `check-a11y-labels.js` were executed for this audit
   and their real output is cited in the Accessibility section below.
   `PERF_REPORT.md`, `observability/alerting-rules.yml` and the four
   `observability/dashboards/*.json` files (`economy-health.json`,
   `live-ops.json`, `purchase-funnel.json`, `reliability.json`) also exist, and
   `node skyline-rush-backend/observability/validate-rules.js` runs green as
   part of `cd skyline-rush-backend && npm test`.

   **Correction:** an earlier revision of this note said `PERF_REPORT.md`,
   `alerting-rules.yml` and `dashboards/*.json` "did not yet exist on disk"
   and were therefore stated as deliverables rather than verified artifacts.
   That was true when first written and is no longer true; it is corrected
   rather than deleted so the change in status is visible.

2. **`Executable-now` means the verification is runnable in this
   environment — it does not mean the item passed.** Several executed checks
   returned failing or partial results. Those are recorded verbatim rather
   than being reclassified as `Deferred`. Items with a negative result are
   flagged **RESULT: NOT SATISFIED** or **RESULT: PARTIAL** in the evidence
   column and re-listed in the Open Findings section.

3. **The shipping playable in this repository is the Canvas2D Web Runner**
   (`skyline-rush-client/web/`). The Unity iOS project is architecture-only
   (`Assets/Scripts/**/*.cs`, `.asmdef`) with no built binary, no signing
   identity, and no device. Every item whose verification requires a compiled
   iOS binary, an Apple sandbox, or App Store Connect is therefore `Deferred`.

### Deferral reason categories

| Code | Category |
|---|---|
| **D1** | No App Store Connect account / no App Store submission environment exists here |
| **D2** | No physical iOS device, device farm, or Apple sandbox environment available |
| **D3** | No legal counsel / external compliance sign-off available |
| **D4** | No on-call / paging system (PagerDuty or equivalent) provisioned |
| **D5** | No provisioned production database or live cloud infrastructure |
| **D6** | No support organization / live-ops staffing exists |

---

## Metadata

| Item | Status | Evidence / Reason |
|---|---|---|
| App name, subtitle, and description finalized; no reference to "Subway Surfers" or any third-party IP anywhere in listing copy or keywords. | Executable-now | **RESULT: PARTIAL.** Ran `grep -rni "subway" --exclude-dir=node_modules skyline-rush-client skyline-rush-backend skyline-rush-contracts` → **0 hits**; no third-party IP string exists in any shipping source tree. `grep -rn "Subway Surfers" --exclude-dir=node_modules --exclude-dir=.git .` → 9 files, **all design/analysis documents** (`build-package/00_REFERENCE_ANALYSIS.md`, `build-package/SOURCES.md`, `build-package/package_manifest.json:3`, `build-package/README.md`, `build-package/01_PRD.md`, `build-package/07_AI_OR_AUTOMATION_PIPELINE.md`, `build-package/18_RELEASE_CHECKLIST.md:6`, `README.md:5`, `CLAUDE.md:7`) — none of which is listing copy. Partial because **no listing-copy artifact exists in this repo to finalize**; the clean-source half is verified, the "finalized" half is not. |
| Screenshots and preview video reflect the shipping build, not a pre-release mockup. | Deferred | **D1** — No App Store Connect account exists in this environment, and no screenshot/preview asset is checked into the repo. |
| Age rating questionnaire completed accurately (target: general audience rating, not Kids Category). | Deferred | **D1** — The age-rating questionnaire is an App Store Connect submission form; no such account exists here. |
| Category set to Games/Action (or current App Store taxonomy equivalent at submission time). | Deferred | **D1** — App Store Connect listing field; not settable from this environment. |
| Supported languages listed match what actually ships (English only at MVP per [[01_PRD]] §14). | Executable-now | **RESULT: SATISFIED.** `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/index.html:2` declares `<html lang="en">`. `grep -rniE "i18n\|localization\|locale" --exclude-dir=node_modules skyline-rush-client skyline-rush-backend` → **0 hits**: no localization framework, no string tables, no locale negotiation anywhere. The build genuinely ships English only, matching the PRD claim. |

## Platform review

| Item | Status | Evidence / Reason |
|---|---|---|
| IAP odds disclosure present in-app for the Supply Drop mechanic before the App Store review team requests it (Guideline 3.1.1). | Executable-now | **RESULT: SATISFIED.** In-app disclosure UI: `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/index.html:411-412` — `<p class="drop-disclaimer">Pre-disclosed immutable odds table (standard-v7). No hidden probabilities.</p>` followed by `<div id="oddsTableList" class="odds-list">`; populated at `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/game.js:3200` (`const oddsList = document.getElementById('oddsTableList');`). Server source of truth: `GET /v1/supply-drops/tables/:table_id` at `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/apps/gateway/gateway.app.ts:391`. Covered by executed tests `it('discloses transparent odds before open action')` (`tests/acceptance.spec.ts:524`) and `it('earned and purchased drops resolve against identical table version')` (`tests/acceptance.spec.ts:534`) — both passing in the 48/48 run. |
| "Restore Purchases" present and functional for the non-consumable SKU. | Deferred | **D2** — No StoreKit sandbox or iOS device to exercise a restore. **Gap flagged:** `grep -rni "restore" --include=*.ts skyline-rush-backend/apps` → 0 hits, and `grep -n "restore" skyline-rush-contracts/openapi.yaml` → 0 hits. **No restore endpoint or flow exists yet in either the contract or the backend** — this is a build gap, not only an environment gap. |
| No purchase flow reachable without a clearly stated price before the platform sheet. | Executable-now | **RESULT: SATISFIED.** Every store card in `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/index.html` carries a `card-price` element rendered before any purchase action: lines 137 (`$0.99`), 144 (`$4.99`), 157 (`$0.99`), 164 (`$1.99`), 170 (`$4.99`), 177 (`$9.99`), 183 (`$19.99`). Seven SKU cards, seven prices — no priceless purchase entry point. |
| Demo/test account and any needed reviewer notes prepared (e.g., how to reach the parental gate, how to trigger a Supply Drop) for App Review. | Deferred | **D1** — Reviewer notes are submitted through App Store Connect; no such account or submission draft exists here. |
| Sign in with Apple correctly offered wherever any other third-party login would be (confirmed as N/A rather than assumed). | Executable-now | **RESULT: SATISFIED — N/A confirmed, not assumed.** Enumerated every auth route in `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/apps/gateway/gateway.app.ts`: `POST /v1/auth/guest` (line 262), `POST /v1/auth/apple` (line 275), `POST /v1/auth/refresh` (line 288), `GET /v1/auth/parental-gate/challenge` (line 302), `POST /v1/auth/parental-gate/verify` (line 308). **No third-party login other than Apple exists**, so the Guideline 4.8 obligation is genuinely inapplicable. Sign in with Apple is nonetheless implemented and tested: `it('merges guest progress when linking Sign in with Apple for the first time')` (`tests/acceptance.spec.ts:42`). |

## Privacy

| Item | Status | Evidence / Reason |
|---|---|---|
| App Privacy "nutrition label" in App Store Connect matches the data inventory in [[08_SAFETY_PRIVACY_COMPLIANCE]] exactly. | Deferred | **D1** — The nutrition label lives only in App Store Connect; no account exists to declare against or diff. |
| Privacy policy published and linked from Settings and the App Store listing; policy text matches actual SDK behavior, verified against the quarterly SDK network-call audit. | Executable-now | **RESULT: NOT SATISFIED.** Ran `grep -niE "support\|contact\|faq\|help@\|mailto" skyline-rush-client/web/index.html` and a `policy` scan over the same file → **0 hits for any privacy-policy link or URL**. The Settings modal (`index.html:257-311`) contains GDPR export/delete controls but **no link to a published privacy policy**. No policy document exists anywhere in the repo. The quarterly SDK network-call audit half is additionally unverifiable (no SDK bundle, no network capture). |
| Age-bucket SDK-restriction gate verified on a fresh install (no ad personalization call fires before S00A completes). | Executable-now | **RESULT: SATISFIED.** Client wrapper hard-gates before any SDK init: `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/Assets/Scripts/Ads/AdMediationWrapper.cs:9` (`AgeBucket` starts `null`), `:14` (`InitializeWithServerConsent(string ageBucket, bool serverAdPersonalizationAllowed)` — personalization cannot be enabled before the server call returns), `:19-20` (`// Under 13 and 13-15 must NEVER receive personalized ads regardless of local setting`), `:35` (`if (AgeBucket == "under_13" \|\| AgeBucket == "13_15") return false;`). Server side: `it('sets age_bucket and enforces ad-personalization restrictions for under_13')` (`tests/acceptance.spec.ts:92`) and `it('derives age bucket correctly from birth year')` (`:107`). Executed client simulation `[4/4] AC-16` passed: "Age-bucket ad restriction and consent filtering verified." |
| Data export and deletion endpoints tested end-to-end from the Settings UI, including the parental-gate path. | Executable-now | **RESULT: PARTIAL.** Backend layer fully executed and green: `it('exports complete structured copy of player profile, balances, ownership, and ledger')` (`tests/acceptance.spec.ts:840`), `it('deletes player data and wipes profile')` (`:851`), `it('supports /v1/privacy/data-export and /v1/privacy/delete-account aliases')` (`:991`), plus the parental-gate path `it('verifies parental gate math challenge and issues signed 5-minute token (CRIT-04, CRIT-A1, RED-201)')` (`:764`). Routes at `gateway.app.ts:463, 471, 479, 487`, all rate-limited at 10/min under the `privacy` bucket. UI wiring exists (`index.html:307-311`; `game.js:197-201` `exportData()` → `POST /v1/privacy/data-export`, `:204-208` `deleteAccount()` → `POST /v1/privacy/delete-account`, both routed through the parental gate at `:3139` / `:3161`). Partial because **no browser-driven end-to-end harness exists** — the Settings-UI-to-server path is verified by inspection, not by an executed UI test. |
| COPPA/child-privacy legal review completed for the target launch market(s). | Deferred | **D3** — No legal counsel available in this environment; the checklist itself states engineering guidance is not a substitute for counsel sign-off. |

## Billing

| Item | Status | Evidence / Reason |
|---|---|---|
| All SKUs configured in App Store Connect exactly matching [[11_MONETIZATION_AND_BILLING]]; sandbox-tested purchase, restore, and refund for each. | Deferred | **D1** — No App Store Connect account exists to configure SKUs against, and no sandbox tester identity. |
| App Store Server Notifications V2 webhook verified live against the production endpoint with signature verification enabled. | Deferred | **D2** — No Apple sandbox/production notification source and no public endpoint to receive against. **Gap flagged:** the endpoint exists (`POST /v1/webhooks/apple`, `gateway.app.ts:504`; contract at `skyline-rush-contracts/openapi.yaml:1349-1351`) but **signature verification is not implemented** — `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/apps/billing/billing.service.ts` (`handleAppleWebhook`) base64-decodes the payload with no JWS/x5c chain validation, and says so in a `DEFERRED / OUT OF SCOPE` comment at the top of the method. This is a build gap in addition to the environment gap. Since the RF-01 fix, an undecodable payload is *rejected* (400) instead of falling through to a synthesized refund, and `SkylineAppStoreWebhookMalformedPayloadRate` is honestly annotated as detecting malformed payloads only — not verified spoofing. |
| Duplicate-transaction protection (`platform_transaction_id` uniqueness) verified under a replay test. | Executable-now | **RESULT: SATISFIED.** Executed replay test `it('prevents duplicate grant when same transaction_id is submitted twice')` (`/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/tests/acceptance.spec.ts:718`) — **passing** in the 48/48 run (reported as `✓ prevents duplicate grant when same transaction_id is submitted twice (2 ms)`). Reinforced by header-level enforcement: `POST /v1/purchases/receipt` carries `requireIdempotencyKey` at `gateway.app.ts:454`. |

## Security

| Item | Status | Evidence / Reason |
|---|---|---|
| Dependency scan clean (or exceptions documented and accepted) on both client and backend. | Executable-now | **RESULT: NOT SATISFIED — 9 backend vulnerabilities, undocumented.** Executed `npm audit` in all three sub-projects.<br>• **`skyline-rush-contracts`: 0 vulnerabilities** (`{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}`, 8 deps).<br>• **`skyline-rush-backend`: 9 vulnerabilities (7 moderate, 2 high)** — HIGH `@nestjs/platform-express` (`<=11.1.14 \|\| 12.0.0-alpha.0 - 12.0.0-alpha.7`, direct), HIGH `multer` (`<=2.1.1`, transitive); MODERATE `@nestjs/common` (direct), `@nestjs/core` (`<=11.1.17`, direct, GHSA-36xv-jgw5-4q75 CVSS 6.1 injection), `express@4.22.2` (direct), `body-parser` (`<=1.20.6`), `file-type` (`13.0.0 - 21.3.1`), `qs` (`2.2.5 - 6.15.3`), `uuid` (`<11.1.1`, direct, GHSA-w5hq-g745-h8pq). npm reports fixes require `--force` / semver-major bumps (`@nestjs/core@12.0.1`, `uuid@14.0.2`). **No exceptions file exists in the repo**, so these are neither clean nor documented-and-accepted.<br>• **`skyline-rush-client`: scan could not run.** `npm audit` failed with `npm error code ENOLOCK` / "This command requires an existing lockfile" — there is no `package-lock.json` and no `node_modules`. Mitigating fact: `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/package.json` declares **zero dependencies and zero devDependencies** (only a `test` script invoking `node simulation-runner/run-simulation.js`), so the true third-party surface of the client package is empty — but this is established by reading the manifest, **not** by a scanner run. |
| Secrets confirmed absent from source control and client binary (StoreKit shared secret, APNs keys, DB credentials). | Executable-now | **RESULT: NOT SATISFIED — 3 findings.** The targeted literal-secret grep over `skyline-rush-backend/apps`, `skyline-rush-backend/libs`, and `skyline-rush-client/web` (pattern `(api[_-]?key\|secret\|password\|passwd\|token)["']?\s*[:=]\s*['"][A-Za-z0-9_-]{12,}` across `*.ts,*.js,*.yml,*.yaml,*.json`) returned **exit 1 / no matches** — no inline literal secret in application source. However three real exposures were found by adjacent checks:<br>**(1) A private key is committed to git.** `git ls-files` lists `skyline-rush-backend/nginx/certs/server.key` (blob `b3940f0d`), whose first line is `-----BEGIN PRIVATE KEY-----`. `openssl x509` on the paired `server.crt` shows `subject=CN=api.skylinerush.game`, `issuer=CN=api.skylinerush.game` (self-signed, valid 2026-09-03 → 2027-09-03) — a dev cert, but a live private key in version control regardless.<br>**(2) Hardcoded production fallback credentials in `docker-compose.prod.yml`.** `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/docker-compose.prod.yml:10` (`POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-skylinerush_prod_secret_vault_2026}`), `:37` and `:43` (`${REDIS_PASSWORD:-redis_prod_secret_vault_2026}`), `:65` (`POSTGRES_URL` embedding the same password fallback), `:66` (`REDIS_URL`), `:67` (`JWT_SECRET: ${JWT_SECRET:-prod_super_secure_vault_jwt_key_2026}`), `:68` (`REFRESH_SECRET` fallback), `:69` (`PARENTAL_GATE_SECRET` fallback). A deploy with an unset env silently uses a committed, publicly-known secret.<br>**(3) Dev fallback signing secrets in application code.** `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/libs/auth/index.ts:4-6`: `JWT_SECRET = process.env.JWT_SECRET \|\| 'dev_super_secret_jwt_key_2026'`, `REFRESH_SECRET = ... \|\| 'dev_super_secret_refresh_key_2026'`, `PARENTAL_GATE_SECRET = ... \|\| 'dev_parental_gate_secret_2026'`. There is no fail-fast guard rejecting the fallback in production. Also `libs/db/migrate.ts:9` falls back to `postgresql://postgres:postgres@localhost:5432/skyline_rush`.<br>**Clean by contrast:** `.env` is gitignored (`git check-ignore -v .env` → `.gitignore:97`), and `skyline-rush-backend/k8s/secrets.yaml` (tracked) contains only `${VAR}` placeholders (lines 11-18), never literals. No StoreKit shared secret or APNs `.p8` key is tracked anywhere. |
| TLS enforced with no plaintext fallback on all backend endpoints. | Executable-now | **RESULT: PARTIAL — enforced on Kubernetes, plaintext fallback open in Docker Compose.**<br>**Kubernetes path SATISFIED:** `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/k8s/ingress.yaml:11` sets `nginx.ingress.kubernetes.io/ssl-redirect: "true"`, `:10` `cert-manager.io/cluster-issuer: "letsencrypt-prod"`, `:16-19` a `tls:` block for `api.skylinerush.game` / `secretName: skyline-rush-tls-cert`. Plaintext is redirected at the ingress.<br>**Docker Compose path NOT SATISFIED:** `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/nginx/nginx.conf:51-111` defines a **port-80 `server` block that proxies straight to `backend_gateway`** (`listen 80;` at `:52`, `location /` proxy at `:64-74`, `location /v1/` at `:77-87`, `location /v1/purchases/` at `:90-98`) with **no `return 301 https://...` redirect**, so every API endpoint is reachable in cleartext. That block also **omits HSTS** — `Strict-Transport-Security` appears only in the 443 block at `nginx.conf:126` (`max-age=31536000; includeSubDomains`, `always`). `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/docker-compose.prod.yml:91-92` publishes both `"80:80"` and `"443:443"`, exposing the plaintext listener. The 443 block is otherwise sound: `ssl_protocols TLSv1.2 TLSv1.3` (`:121`), `ssl_ciphers HIGH:!aNULL:!MD5` (`:122`), `ssl_prefer_server_ciphers on` (`:123`), forced `X-Forwarded-Proto https` (`:141`, `:152`, `:164`), plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, and CSP at `:127-131`. **Fix required:** replace the port-80 block body with an unconditional HTTPS redirect. |
| Rate limits and idempotency-key enforcement verified under load test. | Executable-now | **RESULT: PARTIAL — enforcement verified, load test not run.** *Idempotency:* `requireIdempotencyKey` middleware at `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/apps/gateway/gateway.app.ts:248-259` returns `400 VALIDATION_ERROR` / `"Missing required Idempotency-Key header"` when absent, and is mounted on every mutating route: `POST /v1/runs` (`:323`), `POST /v1/runs/redeploy` (`:336`), `POST /v1/runs/:run_id/redeploy` (`:347`), `POST /v1/contracts/:contract_id/claim` (`:382`), `POST /v1/supply-drops/open` (`:398`), `POST /v1/roster/unlock` (`:423`), `POST /v1/purchases/receipt` (`:454`). Replay semantics executed and green: `it('returns 200 with original reward on repeated claim with same Idempotency-Key (CRIT-11)')` (`tests/acceptance.spec.ts:489`), `it('returns identical rewards on retrying supply drop open with same Idempotency-Key (CRIT-09)')` (`:557`), `it('prevents duplicate grant when same transaction_id is submitted twice')` (`:718`); service-layer caches at `apps/economy/economy.service.ts:15` / `:17` (declarations), `:191-195` and `:275` (supply-drop open), `:310-313` and `:338` (contract claim). *Rate limiting:* sliding-window limiter at `gateway.app.ts:191-215` returning `429 RATE_LIMITED` (`:203-206`), with an `unref()`ed cleanup interval (`:178-189`) so it cannot leak; buckets applied at 60/min general, 30/min parental-gate (`:302`, `:308`), **10/min purchases** (`:454`) and 10/min privacy (`:463-487`). Edge tier: `nginx.conf:43-44` (`api_general` 60r/m, `api_purchase` 10r/m) applied at `:78`, `:91`, `:146`, `:158`; `k8s/ingress.yaml:13-14` (`limit-rps: "60"`, `limit-burst-multiplier: "2"`). Partial because **no load generator (k6/artillery/vegeta) is installed or configured in this environment**, so the "under load test" qualifier is unmet; the limiter is also **in-process `Map`-based, not Redis-backed**, so it will not hold correctly across the 3-20 replicas configured in `k8s/hpa.yaml:13-14`. |

## Accessibility

| Item | Status | Evidence / Reason |
|---|---|---|
| VoiceOver pass completed on every non-gameplay screen. | Executable-now | **RESULT: SATISFIED (web surface).** Executed the accessible-name audit produced **in this same change-set**: `node /Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/check-a11y-labels.js` → exit 0, `index.html: 58 named control(s), 0 violation(s)`, `game.js (template literals): 6 named control(s), 0 violation(s)`, `OK — 64 interactive controls all expose a unique, descriptive accessible name.` Baseline confirmed by inspection as well: `aria-label` on every interactive control in `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/index.html` — `:29` (`aria-label="Pause Game"`), `:35` (`aria-label="Speed"`), `:47-48` (`"Move Left"` / `"Move Right"`), `:51-52` (`"Jump"` / `"Slide"`), `:78` (`"Open Settings"`), with decorative glyphs correctly marked `aria-hidden="true"` (`:26`, `:30`, `:61`, `:71`, `:75`, `:79`, `:91`). **Caveat:** native iOS VoiceOver rotor/gesture testing on device remains out of reach here (see D2) — the script audits the web surface, which is the playable this repository actually ships. |
| Contrast-ratio automated check passing on all UI tokens per [[17_DESIGN_SYSTEM]]. | Executable-now | **RESULT: SATISFIED.** Executed the WCAG contrast checker produced **in this same change-set**: `node /Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/check-contrast.js` → exit 0, **`59 pairings checked · 51 pass · 0 exempt · 8 decorative (reported, not gated) · 0 fail`**, `All 59 evidence anchors verified against style.css.`, `OK — all UI-chrome contrast pairings meet WCAG 2.1 AA.`<br>**Read that as 51 gated pass, 0 fail — not 59/59.** The script deliberately reports-but-does-not-gate 8 pairings: hairline dividers using `--line` / `--line-strong` on **non-interactive** surfaces (HUD stat-chip edge, summary-stats frame, leaderboard row separator, odds-table frame, contract-card edge, settings-group frame, `kbd` key-cap outline, `.badge-locked` status-pill outline). SC 1.4.11 scopes to user-interface *components*, so a frame around a readout is out of scope; each of the 8 prints its real ratio (1.20–1.61) plus an individual one-line justification naming the surface, so the exemption is auditable rather than silent. Every **interactive** control boundary was moved to `--line-control` and is gated at the full 3:1 (lowest such: 3.73 on `--bg`). Lowest gated text ratio is `#ffffff` on `--accent-1` at 4.99 (4.5 required); highest is `--text #eef2ff` on `--bg` at 18.08.<br>**Correction:** a prior revision of this row quoted `36 pairings checked · 36 pass · 0 exempt · 0 fail`. That was the **pre-hardening** run, and it was stale in two directions — it undercounted the audited surface (36 vs 59) and it implied nothing was exempted, which is no longer true. Pure Node, no browser or device required. |
| Dynamic Type verified on menus/settings/disclosures. | Deferred | **D2** — Dynamic Type is an iOS system text-size setting; verifying it requires a physical device or simulator running the built app, neither of which is available. |

## QA

| Item | Status | Evidence / Reason |
|---|---|---|
| Full [[13_TEST_PLAN]] suite green on the release-candidate build. | Executable-now | **RESULT: SATISFIED.** All three suites executed, all green.<br>• `cd skyline-rush-backend && npm test` → **`Test Suites: 1 passed, 1 total` / `Tests: 48 passed, 48 total` / `Time: 1.2 s`**, covering `describe('Skyline Rush Acceptance Test Suite (AC-01 through AC-12, AC-17, AC-18)')` (`tests/acceptance.spec.ts:8`) and its sub-suites AC-008 (`:18`), AC-009 (`:91`), AC-001/AC-012 (`:115`), AC-002 (`:271`), AC-003 (`:393`), AC-005 (`:443`), AC-006 (`:512`), AC-007 (`:580`), AC-010 (`:665`), AC-011 (`:816`), AC-017 (`:828`), AC-018 (`:865`), and `describe('Option A & B: Health Probes, Metrics, Roster, and Privacy Aliases')` (`:908`).<br>• `cd skyline-rush-contracts && npm test` → `✓ Parsed OpenAPI YAML successfully. Found 25 paths.` / `✓ All 22 specified endpoints present` / supply-drop and content-pack schemas validated / `All contracts and schemas successfully verified!`<br>• `cd skyline-rush-client && npm test` → `[1/4] AC-13` ✓, `[2/4] AC-14` ✓ (seed determinism + survivable-path invariant + breathing room over 100 segments), `[3/4] AC-15` ✓ (FIFO, 500-entry eviction, dead-letter deadlock prevention), `[4/4] AC-16` ✓ — `=== All Client Simulations PASSED Successfully! ===`.<br>Caveat: "release-candidate build" here means the repository HEAD; **no compiled iOS RC binary exists** to run against. |
| Device-farm pass across minimum supported iOS version through current major version, iPhone and iPad form factors. | Deferred | **D2** — No physical iOS device, simulator fleet, or device farm (Firebase Test Lab / AWS Device Farm) is available in this environment. |
| Soft-launch KPI dashboard confirmed reporting correctly before wide release. | Executable-now | Dashboard definitions and alerting rules are produced **in this same change-set** at `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/observability/dashboards/*.json` and `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/observability/alerting-rules.yml`. The metrics they consume are verifiably live today: `GET /metrics` at `gateway.app.ts:129`, with the route-cardinality guard at `:63-64` (`// RED-210: Guard against metric cardinality explosion by using "unmatched" for unrouted paths` / `const routePath = req.route?.path ? req.route.path : 'unmatched';`), and executed test `it('serves Prometheus metrics on /metrics')` (`tests/acceptance.spec.ts:935`) passing. **Caveat:** dashboard *definitions* are verifiable now; "confirmed reporting correctly" against real soft-launch traffic requires a live deployment (see D5). |

## Operations

| Item | Status | Evidence / Reason |
|---|---|---|
| On-call rotation and alert routing confirmed live and tested with a synthetic alert. | Deferred | **D4** — No on-call/PagerDuty system provisioned; a rotation and a synthetic-page test cannot be created or fired from this environment. The *rule-definition* half of this item **is** delivered in this same change-set at `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/observability/alerting-rules.yml`; only the live-routing and synthetic-alert half is blocked. |
| Rollback plan verified for both the app binary (App Store phased release / expedited pull) and content bundles (CDN version pointer revert, exercised at least once pre-launch). | Deferred | **D1** — Phased release and expedited pull are App Store Connect controls; no account exists. No CDN is provisioned for content-bundle pointer reverts either. Related capability that does exist: LiveOps content-pack versioning via `GET /v1/liveops/config` (`gateway.app.ts:496`), tested by `it('serves active district content packs and feature flags')` (`tests/acceptance.spec.ts:817`). |
| Database backup/restore drill completed within the last quarter. | Deferred | **D5** — No provisioned production database exists to back up or restore. **Gap flagged:** inspection of `/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-backend/k8s/postgres-statefulset.yaml` found only a `volumeClaimTemplates` block (`:55`) requesting `storage: 20Gi` (`:62`) — **no `CronJob`, no `pg_dump` sidecar, and no backup automation of any kind** anywhere under `k8s/`. Durable storage is not a backup; this is a build gap in addition to the environment gap. |

## Support

| Item | Status | Evidence / Reason |
|---|---|---|
| In-app support/contact path present and tested (Settings → support link, behind the parental gate for under-13 accounts). | Executable-now | **RESULT: NOT SATISFIED.** Ran `grep -niE "support\|contact\|faq\|help@\|mailto" skyline-rush-client/web/index.html skyline-rush-backend/apps` → **0 hits**. The Settings modal (`/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/index.html:257-311`) offers age-bucket selection and GDPR export/delete controls but **contains no support or contact entry point at all**, so there is nothing to place behind the parental gate. The gate machinery it would use is in place and tested (`index.html:200`; `game.js:2889` `openParentalGate()`, `:2920` `Api.verifyParentalGate()`, `:2923` gated-action dispatch; `tests/acceptance.spec.ts:764`, `:944`). |
| Support team briefed on the data export/deletion request process and expected turnaround. | Deferred | **D6** — No support organization exists in this environment to brief, and no turnaround SLA has been committed. |
| Known-issues list and player-facing FAQ prepared for launch-day triage. | Deferred | **D6** — No support/live-ops function exists to own or publish a launch-day FAQ; no FAQ artifact is present in the repo. |

---

## Open findings raised by the executable checks

These are the `Executable-now` items whose executed verification returned a
negative or partial result. They are release blockers or near-blockers and are
listed once here for triage convenience.

| # | Severity | Finding | Location |
|---|---|---|---|
| F1 | High | Private key committed to source control (self-signed dev cert, but a live key in VCS). | `skyline-rush-backend/nginx/certs/server.key` |
| F2 | High | Plaintext HTTP fallback: the nginx port-80 server block proxies the full API with no HTTPS redirect and no HSTS. | `skyline-rush-backend/nginx/nginx.conf:51-111`; exposed by `docker-compose.prod.yml:91` |
| F3 | High | Hardcoded production fallback secrets baked into compose defaults (`:-prod_super_secure_vault_*`, `:-skylinerush_prod_secret_vault_2026`). | `skyline-rush-backend/docker-compose.prod.yml:10,37,43,65-69` |
| F4 | High | Dev fallback signing secrets with no production fail-fast guard. | `skyline-rush-backend/libs/auth/index.ts:4-6` |
| F5 | High | 9 backend dependency vulnerabilities (2 high, 7 moderate), no documented exception set. | `skyline-rush-backend/package.json` |
| F6 | High | Apple webhook signature verification not implemented — payload is base64-decoded without JWS/x5c validation. | `skyline-rush-backend/apps/billing/billing.service.ts:141-162` (`handleAppleWebhook`; `DEFERRED / OUT OF SCOPE` note at `:142-148`, bare base64 decode at `:156`) |
| F7 | Medium | No "Restore Purchases" endpoint or flow exists in the contract or the backend. | `skyline-rush-contracts/openapi.yaml`; `skyline-rush-backend/apps/billing/` |
| F8 | Medium | No privacy-policy link in Settings and no policy document in the repo. | `skyline-rush-client/web/index.html:257-311` |
| F9 | Medium | No in-app support/contact path exists. | `skyline-rush-client/web/index.html:257-311` |
| F10 | Medium | No database backup automation (`CronJob`/`pg_dump`) in any Kubernetes manifest. | `skyline-rush-backend/k8s/postgres-statefulset.yaml` |
| F11 | Medium | Rate limiter is in-process `Map`-based; will not hold across the 3-20 HPA replicas. | `skyline-rush-backend/apps/gateway/gateway.app.ts:175-215` vs `k8s/hpa.yaml:13-14` |
| F12 | Low | `skyline-rush-client` cannot be dependency-scanned (`ENOLOCK`, no lockfile); manifest declares zero dependencies, so the real surface is empty, but no scanner attests it. | `skyline-rush-client/package.json` |
| F13 | Low | No Docker `USER` directive — the Compose image runs as root. Kubernetes is unaffected (`runAsNonRoot: true`, `runAsUser: 1000`, `capabilities.drop: [ALL]`, `allowPrivilegeEscalation: false` at `k8s/backend-deployment.yaml:29-30,68-72`). | `skyline-rush-backend/Dockerfile` (14 lines, no `USER`) |

---

## Summary

**Total checklist items: 34** (verified by
`grep -c "^- \[ \]" build-package/18_RELEASE_CHECKLIST.md` → `34`).

| | Count |
|---|---|
| **Executable-now** | **18** |
| **Deferred** | **16** |
| **Total** | **34** |

### Per-section breakdown

| Section | Items | Executable-now | Deferred |
|---|---|---|---|
| Metadata | 5 | 2 | 3 |
| Platform review | 5 | 3 | 2 |
| Privacy | 5 | 3 | 2 |
| Billing | 3 | 1 | 2 |
| Security | 4 | 4 | 0 |
| Accessibility | 3 | 2 | 1 |
| QA | 3 | 2 | 1 |
| Operations | 3 | 0 | 3 |
| Support | 3 | 1 | 2 |
| **Total** | **34** | **18** | **16** |

### Deferral tally by reason category

| Code | Category | Count | Items |
|---|---|---|---|
| **D1** | No App Store Connect / App Store submission environment | **7** | Metadata (screenshots, age rating, category); Platform review (reviewer notes); Privacy (nutrition label); Billing (SKU configuration); Operations (rollback plan) |
| **D2** | No physical iOS device, device farm, or Apple sandbox | **4** | Platform review (Restore Purchases); Billing (ASSN V2 webhook); Accessibility (Dynamic Type); QA (device farm) |
| **D6** | No support organization / live-ops staffing | **2** | Support (team briefing); Support (known-issues/FAQ) |
| **D3** | No legal counsel / external compliance sign-off | **1** | Privacy (COPPA legal review) |
| **D4** | No on-call / paging system provisioned | **1** | Operations (on-call rotation + synthetic alert) |
| **D5** | No provisioned production database / live infrastructure | **1** | Operations (backup/restore drill) |
| | **Total** | **16** | |

### Outcome of the 18 executed verifications

| Result | Count | Items |
|---|---|---|
| **SATISFIED** | **9** | Supported languages; IAP odds disclosure; price-before-purchase; Sign in with Apple N/A; age-bucket SDK gate; duplicate-transaction replay; full test suite green; contrast check (59 pairings, 51 gated pass, 8 decorative-not-gated, 0 fail); accessible-name audit (64 controls, 0 violations) |
| **PARTIAL** | **5** | Listing-copy IP scan; data export/deletion end-to-end; TLS enforcement; rate-limit/idempotency under load; soft-launch KPI dashboard |
| **NOT SATISFIED** | **4** | Dependency scan; secrets absent from source control; privacy-policy link; in-app support path |

**Release readiness:** not ready. Of the 18 verifications runnable today, 9
passed outright, 5 passed partially, and 4 failed — producing the 13 open
findings above, 6 of them High severity. The 16 deferred items are blocked on
external environments (Apple, legal, on-call, support, live infrastructure)
rather than on code, and cannot be cleared from this repository.
