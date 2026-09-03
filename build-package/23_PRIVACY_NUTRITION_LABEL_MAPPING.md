# 23 Privacy Nutrition Label Mapping — Skyline Rush

Deliverables **AC-P3-12** (privacy nutrition label mapping) and **AC-P3-13**
(Supply Drop odds sourcing verification).

This document is the authoritative answer key for the App Store Connect
**App Privacy** questionnaire. It maps the internal data inventory in
[[08_SAFETY_PRIVACY_COMPLIANCE]] one-to-one onto Apple's privacy label
taxonomy, and proves the mapping is complete in **both** directions: nothing in
the internal inventory is unmapped, and no Apple category is left unanswered.

Where this document and marketing copy disagree, this document wins.
[[22_APP_STORE_LISTING]] §10 defers to it explicitly.

---

## 1. Source of truth

The internal inventory is the table under **"Data inventory"** in
[[08_SAFETY_PRIVACY_COMPLIANCE]] — eight rows — plus four data elements
defined elsewhere in that same document that are equally in scope for the
label:

| # | Element | Where it is defined in `08_SAFETY_PRIVACY_COMPLIANCE.md` |
|---|---|---|
| 1 | `guest_device_id` | §"Data inventory", row 1 |
| 2 | `apple_user_id` | §"Data inventory", row 2 |
| 3 | `age_bucket` | §"Data inventory", row 3 |
| 4 | Run telemetry (meters, crash cause, timestamps) | §"Data inventory", row 4 |
| 5 | Purchase / receipt data | §"Data inventory", row 5 |
| 6 | Crash logs / diagnostics | §"Data inventory", row 6 |
| 7 | Push token | §"Data inventory", row 7 |
| 8 | Friend links | §"Data inventory", row 8 |
| 9 | `display_name` (server-generated, e.g. "Runner#4821") | §"Moderation / abuse controls" |
| 10 | `ConsentRecord.ad_personalization_allowed`, `ConsentRecord.policy_version` | §"SDK-level enforcement"; §"Consent" |
| 11 | Device advertising identifier (IDFA) accessed by the ad-mediation SDK | §"SDK-level enforcement" (bullet 1, by exclusion: "no device advertising identifier access" for `under_13` / `13_15`) |
| 12 | Opaque device/session identifier passed to third-party processors | §"Third-party processors" |

Rows 9–12 are included because Apple's questionnaire asks about *all* data the
app or its SDKs collect, not only what an internal inventory table enumerates.
Omitting them would produce an under-declared label, which is itself a
Guideline 5.1.1 problem.

---

## 2. Apple's three disclosure buckets

Apple's questionnaire assigns every collected data type to one or more of:

- **Data Used to Track You** — linked to third-party data for targeted
  advertising or advertising measurement, or shared with a data broker.
- **Data Linked to You** — tied to the user's identity (account, device
  identity used as an account, or any identifier that resolves to a person).
- **Data Not Linked to You** — collected but not tied to identity, with
  de-identification applied at collection and not reversible.

A data type may appear in more than one bucket if different collection paths
treat it differently. Skyline Rush has exactly one such case: the advertising
identifier (row 11), which is age-bucket conditional — see §5.

---

## 3. The mapping table

**Legend for "Collected?":** Yes = declared in the label. No = the category is
answered "we do not collect this" in App Store Connect. Conditional = declared,
but gated by age bucket and/or an OS permission.

| # | Internal data element (source section in `08_`) | Apple category | Bucket | Purpose | Collected? | Notes |
|---|---|---|---|---|---|---|
| 1 | `guest_device_id` (§Data inventory r1) | **Identifiers** (Device ID) | Data Linked to You | App Functionality | **Yes** | For a guest this *is* the account identity, so it cannot honestly be declared "Not Linked". Not linked to a real name or email (§Data inventory r1). Retention: life of account + 30-day post-deletion grace. |
| 2 | `apple_user_id` (§Data inventory r2) | **Identifiers** (User ID) | Data Linked to You | App Functionality | **Yes** | Apple's opaque per-app relay ID only. Never the relayed email, "even when Apple offers to relay one" (§PII minimization). Optional — guests never produce this row. |
| 3 | `age_bucket` — `under_13` / `13_15` / `16_plus` (§Data inventory r3) | **Other Data** | Data Linked to You | App Functionality (compliance gating) | **Yes** | Apple has no "Age" type; Other Data is the correct catch-all. Not *Sensitive Info* — Apple scopes that to racial/ethnic origin, sexual orientation, disability, religious belief, biometrics and union membership; age band is none of these. **The raw birth year is never collected**: it stays device-local and only the derived three-value bucket transmits (§PII minimization). |
| 4 | Run telemetry — meters, crash cause, timestamps (§Data inventory r4) | **Usage Data** (Product Interaction) | Data Linked to You | App Functionality; Analytics | **Yes** | Linked because runs attach to the player row that drives leaderboards and Contracts. Row-level data retained 180 days, then rolled up to aggregate only (§Data inventory r4). "Crash cause" here means an in-game collision reason, **not** a software crash — that is row 6. |
| 5 | Purchase / receipt data (§Data inventory r5) | **Purchases** (Purchase History) | Data Linked to You | App Functionality | **Yes** | SKU + transaction + validated receipt, needed to grant entitlements server-side (FR-010). Retained 7 years for tax/audit. Encrypted at rest, Billing-service-scoped access. |
| 6 | Crash logs / diagnostics (§Data inventory r6) | **Diagnostics** (Crash Data, Performance Data) | Data **Not** Linked to You | App Functionality | **Yes** | Opt-out available (§Data inventory r6). Scrubbed of free-text/user-generated fields — of which the game has none (NG1). ⚠️ See §6 confirmation item C-1: "Not Linked" is only defensible if crash reports are keyed to an ephemeral session ID rather than `guest_device_id`/`apple_user_id`. |
| 7 | Push token (§Data inventory r7) | **Identifiers** (Device ID) | Data Linked to You | App Functionality | **Conditional** | Only for players who enable notifications. Purged after 90 days unused or on revocation. Purpose is re-engagement messaging (FR-011/P1 scope), never ad targeting. |
| 8 | Friend links (§Data inventory r8) | **Other Data** | Data Linked to You | App Functionality | **Conditional** | Only for players who add a friend. Mapped to Other Data, **not** to Apple's *Contacts* category: Contacts means the device address book, and friend links are "never derived from device contacts (FR-007)" (§Data inventory r8). Source is Game Center or a shareable friend code. |
| 9 | `display_name`, e.g. "Runner#4821" (§Moderation / abuse controls) | **Identifiers** (User ID) | Data Linked to You | App Functionality | **Yes** | Server-generated and not player-editable in MVP, so no user-supplied content enters it. Publicly visible on leaderboards, hence declared. If editable display names ship (P2+), this row and [[08_SAFETY_PRIVACY_COMPLIANCE]] must both be revised before release. |
| 10 | `ConsentRecord.ad_personalization_allowed`, `.policy_version` (§SDK-level enforcement; §Consent) | **Other Data** | Data Linked to You | App Functionality | **Yes** | The signed server-side flag that gates SDK behaviour, plus the policy version stamped at consent time. Declared because it is stored per-player; it exists to *restrict* processing, not to enable it. |
| 11 | Device advertising identifier (IDFA) (§SDK-level enforcement, bullet 1) | **Identifiers** (Device ID) | **Data Used to Track You** *and* Data Linked to You | Third-Party Advertising | **Conditional — `16_plus` only, and only with ATT permission granted** | This is the **only** entry in the "Data Used to Track You" bucket. Access is blocked entirely for `under_13` and `13_15`: those buckets get "no device advertising identifier access, no cross-app tracking, contextual (non-behavioral) ads only" (§SDK-level enforcement). See §5. |
| 12 | Opaque device/session identifier sent to third-party processors (§Third-party processors) | **Identifiers** (Device ID) | Data Linked to You | App Functionality; Analytics | **Yes** | Ad mediation, crash reporting, cloud infrastructure, analytics warehouse. "[N]one receives raw PII … at most an opaque device/session identifier scoped to its restricted-mode contract" (§Third-party processors). Each vendor requires a signed DPA covering children's data before integration. |

### 3.1 Categories answered "Not Collected"

These are declared negatively in App Store Connect. Each is backed by an
explicit statement in [[08_SAFETY_PRIVACY_COMPLIANCE]] or [[01_PRD]], not by
assumption.

| Apple category | Collected? | Evidence |
|---|---|---|
| **Contact Info** (name, email, phone, address, other user contact info) | **No** | "No email address, real name, phone number … are collected at any point in the MVP" (§Data inventory, closing paragraph). Sign in with Apple deliberately does not take the relayed email (§PII minimization). |
| **Health & Fitness** | **No** | No health, fitness, or motion-derived data of any kind exists in the product. Not present in the inventory. |
| **Financial Info** (payment info, credit info, financial account info) | **No** | Apple/StoreKit 2 holds the payment instrument; the app stores only SKU + validated receipt, which is Apple's **Purchases** category, not Financial Info. Confirmed by [[08_SAFETY_PRIVACY_COMPLIANCE]] §Data export/deletion: export contains "purchase history (SKU/date, **not** full payment instrument data — Apple retains that)". The inventory's internal label "Financial" for row 5 is an internal category name, **not** Apple's *Financial Info* type — see §4.2. |
| **Location** (precise or coarse) | **No** | "no … precise location" (§Data inventory, closing paragraph); no coarse-location feature exists either — Districts are content selections, not geographies. ⚠️ See §6 confirmation item C-2 (transient IP handling). |
| **Sensitive Info** | **No** | No racial/ethnic, sexual-orientation, disability, religious, biometric, or union data. `age_bucket` is Other Data, not Sensitive Info (see row 3). |
| **Contacts** (device address book) | **No** | Friend links are "[n]ever derived from device contacts (FR-007)" (§Data inventory r8); "no device-contact-based friend discovery" (§Moderation / abuse controls). The app never requests the Contacts permission. |
| **User Content** (emails/messages, photos, video, audio, gameplay content, customer support, other) | **No** | "There is no chat or user-generated content surface (NG1 in [[01_PRD]])" (§Data inventory, closing paragraph); "no chat, no free-text fields, no user-uploaded media" (§Moderation / abuse controls). `display_name` is server-generated, so it is an Identifier, not User Content. |
| **Browsing History** | **No** | The app has no browser or web-content surface. External links (support, privacy policy) open in the system browser behind a parental gate for minor buckets (§Consent); the app never observes what happens there. |
| **Search History** | **No** | The app has no search feature on any screen ([[02_UX_SCREEN_SPEC]] screen inventory). |

---

## 4. Reconciliation

The mapping is complete only if it holds in both directions. Both are checked
explicitly below.

### 4.1 Direction A — every internal element appears in the Apple mapping

*Is there anything in the `08_SAFETY_PRIVACY_COMPLIANCE` inventory that has no
Apple category assigned?*

| Internal element | Mapped? | Apple category |
|---|---|---|
| `guest_device_id` | ✅ | Identifiers |
| `apple_user_id` | ✅ | Identifiers |
| `age_bucket` | ✅ | Other Data |
| Run telemetry | ✅ | Usage Data |
| Purchase/receipt data | ✅ | Purchases |
| Crash logs / diagnostics | ✅ | Diagnostics |
| Push token | ✅ | Identifiers |
| Friend links | ✅ | Other Data |
| `display_name` | ✅ | Identifiers |
| `ConsentRecord` fields | ✅ | Other Data |
| Advertising identifier (IDFA) | ✅ | Identifiers (tracking bucket, `16_plus` only) |
| Third-party opaque device/session ID | ✅ | Identifiers |
| Raw birth year | ✅ (as **not collected**) | — never leaves the device (§PII minimization); explicitly excluded from the label rather than silently dropped |

**Result: 12 of 12 collected elements mapped; 0 unmapped.** The one internal
element that is *not* collected server-side (raw birth year) is recorded above
so its absence from the label is a documented decision, not an oversight.

### 4.2 Direction B — every Apple category is accounted for

*Is there any Apple category that this document fails to answer?*

Apple's taxonomy has 14 categories. All 14 are answered:

| # | Apple category | Answer | Where |
|---|---|---|---|
| 1 | Contact Info | Not Collected | §3.1 |
| 2 | Health & Fitness | Not Collected | §3.1 |
| 3 | Financial Info | Not Collected | §3.1 |
| 4 | Location | Not Collected | §3.1 |
| 5 | Sensitive Info | Not Collected | §3.1 |
| 6 | Contacts | Not Collected | §3.1 |
| 7 | User Content | Not Collected | §3.1 |
| 8 | Browsing History | Not Collected | §3.1 |
| 9 | Search History | Not Collected | §3.1 |
| 10 | Identifiers | **Collected** — Linked to You (rows 1, 2, 7, 9, 12); Used to Track You for `16_plus` only (row 11) | §3 |
| 11 | Purchases | **Collected** — Linked to You (row 5) | §3 |
| 12 | Usage Data | **Collected** — Linked to You (row 4) | §3 |
| 13 | Diagnostics | **Collected** — Not Linked to You (row 6) | §3 |
| 14 | Other Data | **Collected** — Linked to You (rows 3, 8, 10) | §3 |

**Result: 14 of 14 Apple categories answered; 0 unanswered.** 5 collected,
9 declared Not Collected.

### 4.3 Two naming collisions worth calling out

Both directions reconcile, but two internal labels do **not** mean what the
identically-named Apple type means. Mapping them naively would produce a wrong
label:

1. **Row 5's internal category is "Financial"** — but Apple's *Financial Info*
   type means payment instruments and financial accounts. Skyline Rush stores
   SKU and receipt only, so it maps to **Purchases**, and *Financial Info* is
   answered **Not Collected**.
2. **Row 8's internal category is "Social graph"** — but Apple's *Contacts*
   type means the device address book. Friend links never touch it, so they map
   to **Other Data**, and *Contacts* is answered **Not Collected**.

A third near-miss: row 4's "crash cause" is an in-game collision reason (Usage
Data), while row 6's "crash logs" are software crash reports (Diagnostics).
They are different rows with different buckets and must not be merged.

---

## 5. Age-bucket behaviour: "Data Used to Track You" is empty for minors

This is the product's central privacy claim and the label must reflect it
precisely.

**Statement.** For accounts in the `under_13` and `13_15` buckets, the
"Data Used to Track You" bucket is **empty — zero data types**. No data type
collected from a minor-bucketed account is linked to third-party data for
targeted advertising or advertising measurement, and none is shared with a data
broker. The only entry in that bucket anywhere in the product is the device
advertising identifier (row 11), and minor-bucketed accounts never reach it.

**Citations.** [[08_SAFETY_PRIVACY_COMPLIANCE]] §"SDK-level enforcement":

> "Every third-party SDK (ad mediation, crash reporting, analytics) is
> initialized **after** the age bucket is known, and initialized in a
> restricted mode for `under_13` and (for ad personalization specifically)
> `13_15` accounts: no device advertising identifier access, no cross-app
> tracking, contextual (non-behavioral) ads only."

> "This restriction is enforced server-side via a signed configuration flag
> returned at session start (`ConsentRecord.ad_personalization_allowed` …)
> that the client SDK wrapper reads before making any SDK call — the client
> cannot silently upgrade its own permission level."

Reinforced by [[01_PRD]] NG5: "No behavioral/targeted advertising or
third-party data sharing for accounts in the under-13 (and, for ads
specifically, under-16) age bucket." And by
[[08_SAFETY_PRIVACY_COMPLIANCE]] §"Platform/regulatory checklist" (COPPA):
"ads restricted to non-behavioral for that bucket."

**Why the enforcement point matters for the label.** The gate is a
*server-issued signed flag*, not a client-side preference. This is the direct
lesson recorded at the top of [[08_SAFETY_PRIVACY_COMPLIANCE]]:

> "a privacy policy is not a control — it must be enforced at the
> SDK-initialization and server-authorization layer, not asserted in a
> document."

A label that claimed no tracking of minors while the gate lived in client code
would be exactly the failure mode alleged against the reference product in
[[00_REFERENCE_ANALYSIS]] §"Privacy/safety". The quarterly SDK network-call
audit described in §"SDK-level enforcement" — sandboxed build, every outbound
call logged and diffed against the declared collection contract, material
mismatch blocks the SDK version from shipping — is what keeps this label
statement true over time rather than only at submission.

**How this is declared in App Store Connect.** Apple's questionnaire is
per-app, not per-cohort, so the app declares that the advertising identifier
*is* used for tracking (because it is, for `16_plus` accounts with ATT
permission granted). The minors carve-out cannot be expressed in the label
form itself. It must therefore be stated in the privacy policy and in App
Review notes, and the App Tracking Transparency prompt must **never be
presented** to a minor-bucketed account — presenting it would be both a false
choice and a contradiction of the server flag.

⚠️ Consequence: if the ad-mediation integration for `16_plus` is descoped
before submission, row 11 disappears, the "Data Used to Track You" bucket
becomes empty for *all* users, and the label must be re-answered. Do not ship
a tracking declaration the build cannot exercise.

---

## 6. Engineering confirmation items before submission

These are the two places where the label asserts something the design
documents do not yet state explicitly. Both must be confirmed against the
build, not assumed.

- **C-1 — Diagnostics bucket.** Row 6 is declared *Not Linked to You*. That
  holds only if crash reports carry an ephemeral session identifier and never
  `guest_device_id`, `apple_user_id`, or `display_name`. Verify in the crash
  SDK's initialization wrapper. If the report payload does carry a stable
  player identifier, row 6 moves to **Data Linked to You** and this document
  must be updated before submission.
- **C-2 — Location.** *Location* is declared Not Collected. Server request logs
  necessarily observe a client IP for TLS termination and rate limiting.
  Confirm that IP is not retained, geolocated, or stored on any player row; if
  any coarse geo is derived and persisted, **Location / Coarse Location** must
  be declared.

---

## 7. Supply Drop Odds Sourcing Verification (AC-P3-13)

**Question under test:** is the client's Supply Drop odds table genuinely
sourced from `GET /v1/supply-drops/tables/standard-v7`, with **no hardcoded
client-side duplicate** that could drift away from the server's real
probabilities?

This matters to this document specifically because
[[08_SAFETY_PRIVACY_COMPLIANCE]] §"Child safety" commits that "Supply Drop odds
are always disclosed before an open action", and [[17_DESIGN_SYSTEM]]
Principle 4 requires the odds be presented plainly. A stale hardcoded copy in
the client would turn both commitments into a misstatement — and, since the
same disclosure is what carries Guideline 3.1.1, into an App Review problem.

### 7.1 Verification method

Every claim below was produced by reading the actual files, not inferred.

```bash
cd /Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web

# Locate every odds-related symbol in the client
grep -n "getSupplyDropTable\|oddsTableList\|e.probability\|supply-drops/tables\|standard-v7" game.js
grep -n "oddsTableList\|drop-disclaimer\|standard-v7" index.html

# Hunt for hardcoded percentage literals in the markup
grep -nE "[0-9]+(\.[0-9]+)?%" index.html

# Hunt for hardcoded probability literals anywhere in the client
cd /Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client
grep -rniE "0\.55|0\.25|55%|25%|13%|probability" --include="*.cs" --include="*.js" --include="*.html" . | grep -v node_modules
```

**File versions audited** (both files were being edited concurrently by
parallel Phase 3 accessibility work, so the checksums pin exactly what was
read):

| File | MD5 | Lines |
|---|---|---|
| `skyline-rush-client/web/game.js` | `8aff4573c39dcf11c5469fb9f331d737` | 3074 |
| `skyline-rush-client/web/index.html` | `34c43ecc98a910230962c79538c81940` | 424 |

### 7.2 Evidence — client

**`/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/game.js`**

Real `grep -n` output:

```
124:  async getSupplyDropTable() {
125:    return this.request('/v1/supply-drops/tables/standard-v7');
2992:    const oddsList = document.getElementById('oddsTableList');
2995:      const table = await Api.getSupplyDropTable();
2999:          <span><b>${(e.probability * 100).toFixed(1)}%</b></span>
3003:      oddsList.innerHTML = '<div>Disclosed table standard-v7</div>';
```

- **`game.js:124-126`** — the single API accessor. One request, one path:
  `'/v1/supply-drops/tables/standard-v7'`.
- **`game.js:2988-3005`** — `openSupplyDrops()`, the only writer of the odds
  UI. Line **2995** awaits `Api.getSupplyDropTable()`; lines **2996-3001** map
  `table.entries` straight into DOM rows; line **2999** renders
  `(e.probability * 100).toFixed(1)` — a **formatter applied to the server
  value**, containing no numeric probability of its own.
- **`game.js:3003`** — the failure path. When the request fails it renders the
  literal string `Disclosed table standard-v7` and **no numbers at all**. This
  is the design detail that closes the drift hole: a fallback that guessed at
  plausible odds would be a hardcoded duplicate by another name. It shows
  nothing rather than something possibly wrong.

**`/Users/cahya/Work/MachineLearning/skyline-rush/skyline-rush-client/web/index.html`**

Real `grep -n` output:

```
411:        <p class="drop-disclaimer">Pre-disclosed immutable odds table (standard-v7). No hidden probabilities.</p>
412:        <div id="oddsTableList" class="odds-list"></div>
```

- **`index.html:412`** — `#oddsTableList` is an **empty container**. The markup
  ships zero odds rows; every row is injected at runtime from the API response.
- **`index.html:411`** — names the table id in prose only. No probability
  value appears.

Hardcoded percentage sweep of the markup — real `grep -nE "[0-9]+(\.[0-9]+)?%"`
output:

```
272:                <span id="valSfx">80%</span>
279:                <span id="valMusic">70%</span>
```

Both are **audio volume slider readouts**, not odds. There are exactly **two**
percentage literals in the entire markup and **neither** is drop-related.

The repo-wide sweep for probability literals (`0.55`, `0.25`, `55%`, `25%`,
`13%`, `probability`) across `*.cs`, `*.js`, `*.html` returned only rendering
constants inside the Canvas2D draw code — e.g. `game.js:544`
(`life: 0.55 + Math.random() * 0.3`, a particle lifetime), `game.js:1155`
(`antenna: rnd() > 0.55`, a skyline prop coin-flip), `game.js:1240-1241`
(`hsl(..., 55%, 5%)`, sky gradient stops). **No client file contains a Supply
Drop probability value.**

### 7.3 Evidence — server, and the disclosure/roll identity check

Sourcing the display from the API is only half the guarantee. The odds shown
must be the odds *actually rolled*, or the disclosure is still a fiction. Both
paths were traced to a single function:

- **`skyline-rush-backend/apps/gateway/gateway.app.ts:375-380`** — the route
  `GET /v1/supply-drops/tables/:table_id` calls
  `economyService.getSupplyDropTable(req.params.table_id)` and returns it
  verbatim. This is what the client renders.
- **`skyline-rush-backend/apps/economy/economy.service.ts:135-136`** —
  `getSupplyDropTable()` reads the table from the database.
- **`skyline-rush-backend/apps/economy/economy.service.ts:172-182`** —
  `openSupplyDrop()` calls **the same** `this.getSupplyDropTable(tableId)` at
  line 172, then accumulates `entry.probability` (line 181) against the roll
  (line 176) to select the reward.
- **`skyline-rush-backend/libs/db/in-memory-db.ts:42-56`** and
  **`libs/db/postgres-db.ts:37`** and
  **`libs/db/migrations/001_initial_schema.sql:157-160`** — `standard-v7` is
  seeded in exactly one place per backing store.

The disclosure endpoint and the reward roll therefore read the **same rows via
the same accessor**. There is no second table, and no code path where the
displayed probability and the rolled probability can differ.

### 7.4 Result

**No fix was required. Nothing was modified for AC-P3-13.**

The client's odds table UI is genuinely server-sourced. Specifically:

1. There is exactly **one** odds source in the client: `game.js:125`, pointing
   at `GET /v1/supply-drops/tables/standard-v7`.
2. The markup container at `index.html:412` is empty and carries no odds.
3. Rendering at `game.js:2996-3001` is pure formatting of `table.entries`; the
   only numeric literals involved are `100` and `1` (percent conversion and
   decimal places).
4. The offline/error fallback at `game.js:3003` deliberately shows **no
   numbers**, so a stale duplicate cannot exist even in the degraded path.
5. Server-side, disclosure and roll share one accessor
   (`economy.service.ts:135` and `:172`), so drift between shown and rolled
   odds is structurally impossible, not merely untested.

This satisfies the architectural boundary "Transparent Odds & Fairness" —
"Supply Drop odds are pre-disclosed and identical for earned and purchased
opens" — and the [[17_DESIGN_SYSTEM]] Principle 4 requirement that the odds
table carry the same typographic weight as any other informational UI.

### 7.5 Re-verification against a later revision of the same files

Because `game.js` and `index.html` were under concurrent edit by parallel
Phase 3 accessibility work while this audit ran, §7.1's greps were re-executed
against a **later** revision to confirm the finding is a property of the code
and not of one snapshot:

| File | MD5 at re-check | Lines |
|---|---|---|
| `skyline-rush-client/web/game.js` | `f0c37a7034be027b7b20c0a8ad42efcb` | — |
| `skyline-rush-client/web/index.html` | `1e08cc94960ed964539f73655701e3f9` | — |

Real `grep -n` output on `game.js`:

```
124:  async getSupplyDropTable() {
125:    return this.request('/v1/supply-drops/tables/standard-v7');
3136:    const oddsList = document.getElementById('oddsTableList');
3139:      const table = await Api.getSupplyDropTable();
3143:          <span><b>${(e.probability * 100).toFixed(1)}%</b></span>
3147:      oddsList.innerHTML = '<div>Disclosed table standard-v7</div>';
```

`index.html` was byte-identical in the audited region: `#oddsTableList` still
empty at line **412**, and the only two percentage literals still the audio
sliders at lines **272** and **279**.

The odds-render block moved from `game.js:2992-3003` to **`game.js:3136-3147`**
(+144 lines, from accessibility edits earlier in the file). **The API accessor
did not move — still `game.js:124-125`.** Every substantive finding in §7.4 is
unchanged: one server-sourced odds path, empty markup container, formatter-only
rendering, number-free fallback. Cite the anchors (`getSupplyDropTable`,
`#oddsTableList`) rather than the line numbers when this file drifts further.

**Standing regression guard.** Re-run the two greps in §7.1 whenever the Supply
Drop UI changes. Any numeric probability literal appearing in `game.js` or
`index.html` is a regression: it means a hardcoded duplicate has been
reintroduced and can drift from `standard-v7`.

⚠️ One residual gap worth logging, since this document must not overstate its
own coverage: the empirical ±1.0% Monte Carlo check on drop frequencies lives
in the backend acceptance suite
(`skyline-rush-backend/tests/acceptance.spec.ts:866`, which reads
`db.getSupplyDropTable('standard-v7')`). There is currently **no automated
client-side assertion** that the rendered percentages equal the API response —
the guarantee above is structural (there is nothing else for the client to
render) rather than test-enforced. Adding that assertion to the client
simulation suite would convert it from structural to verified.
