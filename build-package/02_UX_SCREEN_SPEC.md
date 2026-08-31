# 02 UX Screen Spec — Skyline Rush

All screens below are **Proposed** (original UX for this product). Evidence
class is noted per screen relative to the genre pattern documented in
[[00_REFERENCE_ANALYSIS]].

Conventions: every screen defines Loading / Empty / Error / Offline states
explicitly, even when "N/A" — a screen that cannot legitimately reach a state
says so rather than omitting it.

---

## S01 — Splash / Boot

**Purpose:** Load core assets, resolve session (guest ID or linked Apple ID),
fetch remote config.
**Mode/role:** All players.
**Evidence class:** Strongly inferred pattern (standard mobile game boot).
**Entry points:** App launch.
**Exit points:** S02 (returning player) or S00A Age Gate (first launch only).

### Visible elements
- Logo, loading progress indicator, current app version (small, corner).

### Primary actions
- None (auto-advances).

### Validation
- N/A.

### States
- **Loading:** progress bar tied to asset + remote-config fetch.
- **Empty:** N/A.
- **Error:** no network and no cached remote config on first-ever launch →
  S01E Connectivity Required screen with Retry.
- **Offline:** if a prior session exists locally, boot proceeds offline into
  S02 with a non-blocking "offline" badge; economy-affecting actions queue
  (see [[10_OFFLINE_SYNC_AND_STORAGE]]).
- **Permission denied:** N/A.

### Accessibility
- Progress announced via VoiceOver at load milestones, not continuously.

### Analytics
- `app_boot_started`, `app_boot_completed{duration_ms, cold_start:boolean}`.

---

## S00A — Age Gate (first launch only)

**Purpose:** Establish the player's age bucket before any data collection,
ad SDK initialization, or purchase capability is enabled. See
[[08_SAFETY_PRIVACY_COMPLIANCE]] for the policy this screen enforces.
**Mode/role:** New device/account only; shown once per install unless reset.
**Evidence class:** Proposed — the reference does not document an equivalent
screen; this is a deliberate differentiator, not a reconstruction.
**Entry points:** S01 (first launch).
**Exit points:** S02 Main Hub.

### Visible elements
- Neutral prompt: a birth-year picker (no month/day — minimizes PII
  granularity) framed non-accusatorily ("This helps us show you the right
  experience.").

### Primary actions
- Submit birth year → compute age bucket (Under 13 / 13–15 / 16+) →
  initialize SDKs accordingly → proceed.

### Validation
- Any implausible year (e.g., future year) is rejected inline; there is no
  way to "guess down" via retry — the bucket, once set, requires a parental-
  gated change in Settings (see FR-009).

### States
- **Loading:** N/A (local-only until submit).
- **Empty:** N/A.
- **Error:** submit fails to reach the server (bucket cached locally, synced
  on next connectivity — server is source of truth for ad-SDK gating once
  reachable).
- **Offline:** fully functional offline; bucket applied locally immediately,
  reconciled server-side later.
- **Permission denied:** N/A.

### Accessibility
- Full VoiceOver labeling; large tap targets for the year picker.

### Analytics
- No individually-identifying analytics event fires for the raw birth year;
  only the resulting bucket is logged: `age_bucket_set{bucket}`.

---

## S02 — Main Hub

**Purpose:** Central navigation and status at a glance.
**Mode/role:** All players.
**Evidence class:** Strongly inferred (genre-standard hub-and-spoke pattern).
**Entry points:** S01, back-navigation from any sub-screen.
**Exit points:** S03 Run, S04 Shop, S05 Roster, S06 Contracts, S07
Leaderboard, S08 Settings.

### Visible elements
- Player level/Pass tier, Chips balance, Cores balance, equipped Runner +
  Board preview, large "RUN" button, Contract progress ticker, event/District
  banner, notification badge on Shop/Contracts when relevant.

### Primary actions
- Tap RUN → S03. Tap balances → S04. Tap avatar → S05. Tap ticker → S06.
  Tap trophy icon → S07. Tap gear icon → S08.

### Validation
- N/A.

### States
- **Loading:** skeleton placeholders for balances/avatar while syncing.
- **Empty:** first-ever visit shows default starter Runner/Board with a
  "new!" highlight instead of an empty state.
- **Error:** balance fetch fails → last-known cached balance shown with a
  subtle "sync pending" indicator; never blocks navigation.
- **Offline:** fully navigable; Shop entries requiring purchase show
  "requires connection" on the buy button only.
- **Permission denied:** N/A.

### Accessibility
- All balances and buttons individually labeled; RUN button reachable as
  first VoiceOver focus target.

### Analytics
- `hub_viewed`, `hub_run_tapped`.

---

## S03 — Run (core gameplay)

**Purpose:** The core endless-run loop.
**Mode/role:** All players.
**Evidence class:** Verified pattern (3-lane swipe runner) — see
[[00_REFERENCE_ANALYSIS]] feature inventory; Skyline Rush's specific
obstacles/art are Proposed.
**Entry points:** S02.
**Exit points:** S03A Pause (transient), S09 Redeploy Offer (on crash), S10
Run Summary (on run end without redeploy).

### Visible elements
- Runner + Board, lane obstacles, live score/meter counter, Chip counter,
  active power-up icons with timers, pause button.

### Primary actions
- Swipe left/right (lane change), swipe up (jump), swipe down (slide), tap
  pause.

### Validation
- Input buffering: a swipe registered up to 120ms before the prior action
  completes is queued, not dropped, to keep controls feeling responsive.

### States
- **Loading:** District asset bundle pre-fetched from S02; if not yet
  cached, a brief "preparing run" spinner blocks entry (target < 1.5s warm,
  < 4s cold).
- **Empty:** N/A.
- **Error:** a mid-run asset streaming failure falls back to a lower-detail
  obstacle set rather than crashing the run.
- **Offline:** fully playable; run result queued for server sync (see
  [[10_OFFLINE_SYNC_AND_STORAGE]]).
- **Permission denied:** N/A.

### Accessibility
- Optional high-contrast obstacle outlines and colorblind-safe palette
  toggle (P2, see [[01_PRD]] scope); gameplay itself is not screen-reader
  operable, consistent with the genre (documented as a known limitation, not
  silently omitted).

### Analytics
- `run_started{district_id, runner_id, board_id}`, `run_crashed{meters,
  cause}`, `powerup_collected{type}`, `run_ended{meters, chips_collected}`.

---

## S03A — Pause

**Purpose:** Suspend the run safely.
**Mode/role:** All players.
**Evidence class:** Strongly inferred (standard).
**Entry points:** S03.
**Exit points:** Resume (S03), Quit to Hub (S02, forfeits the in-progress
run — confirmed via a dialog).

### Visible elements
- Resume, Quit, mute toggle, current score.

### States
- **Loading/Empty:** N/A. **Error:** N/A (fully local).
- **Offline:** fully functional. **Permission denied:** N/A.

### Accessibility
- Standard modal focus trap for VoiceOver.

### Analytics
- `run_paused`, `run_quit_from_pause`.

---

## S09 — Redeploy Offer

**Purpose:** Implements FR-002 at the failure moment without being
manipulative (capped cost, always-available free path).
**Mode/role:** All players.
**Evidence class:** Strongly inferred mechanic (revive-for-currency),
Proposed presentation (capped cost + guaranteed free-ad option is a
differentiator over the reference's escalating-cost pattern — see
[[00_REFERENCE_ANALYSIS]] weaknesses).
**Entry points:** S03 on crash.
**Exit points:** S03 (resumed), S10 Run Summary (declined/unavailable).

### Visible elements
- Crash replay freeze-frame, two clearly-priced options: "Watch ad — free"
  (if the daily free redeploy is unused) and "Redeploy — N Cores" (N shown
  before commit, capped at 40 for the run), a plain "No thanks" exit.

### Primary actions
- Watch ad → S03 resumed at crash point. Spend Cores → S03 resumed. Decline
  → S10.

### Validation
- Core-spend option is disabled (not hidden) with the reason shown if the
  player's Core balance is insufficient, rather than prompting a purchase
  mid-run (purchase prompts are deferred to S10/S04 to avoid pressuring a
  failure moment).

### States
- **Loading:** ad-fill check happens in the background before S03 even ends;
  if no ad is available the "Watch ad" option shows "unavailable" rather
  than spinning indefinitely.
- **Empty:** N/A.
- **Error:** ad SDK failure → falls back silently to the Core-spend option
  only; never blocks the player from continuing to S10.
- **Offline:** ad option unavailable (shown, disabled, reason "requires
  connection"); Core-spend option works fully offline (queued).
- **Permission denied:** N/A.

### Accessibility
- Both options and their costs are read aloud distinctly by VoiceOver.

### Analytics
- `redeploy_offered{cores_cost, ad_available}`, `redeploy_used{method}`,
  `redeploy_declined`.

---

## S10 — Run Summary

**Purpose:** Close the loop: show results, rewards, and next action.
**Mode/role:** All players.
**Evidence class:** Strongly inferred (standard genre pattern).
**Entry points:** S03, S09 (declined).
**Exit points:** S02, S03 (Run Again), S06 (if a Contract completed).

### Visible elements
- Final distance, Chips earned, new best-distance indicator if applicable,
  any Contract progress ticks, Pass XP gained, Run Again button, Home
  button.

### States
- **Loading:** reward grant call to server; UI shows optimistic local totals
  immediately, reconciles silently if the server value differs.
- **Empty:** N/A.
- **Error:** reward sync failure → totals remain queued locally, retried on
  next connectivity, never lost (see [[10_OFFLINE_SYNC_AND_STORAGE]]).
- **Offline:** fully functional with local totals; a small "will sync" badge
  shown.
- **Permission denied:** N/A.

### Accessibility
- Distance and rewards announced as a single summarized VoiceOver block.

### Analytics
- `run_summary_viewed`, `run_again_tapped`, `run_summary_home_tapped`.

---

## S04 — Shop

**Purpose:** Currency, cosmetic, and Pass purchases.
**Mode/role:** All players; purchase action gated by parental gate for
under-13 bucket.
**Evidence class:** Verified pattern (App Store IAP listing) — see
[[00_REFERENCE_ANALYSIS]]; specific SKUs are Proposed. Full detail in
[[11_MONETIZATION_AND_BILLING]].
**Entry points:** S02.
**Exit points:** S02, S04A Parental Gate (if required), platform purchase
sheet.

### Visible elements
- Tabbed sections: Chips, Cores, Bundles, Cosmetics, Pass. Each SKU shows
  price, contents, and — for any Supply-Drop-containing bundle — the
  disclosed odds table inline (not behind a link).

### Primary actions
- Tap a SKU → parental gate (if applicable) → platform purchase sheet →
  receipt validated → entitlement granted.

### Validation
- Every purchasable item's price and contents must render before the buy
  button is enabled (no buy action on a still-loading price).

### States
- **Loading:** price/catalog fetch from StoreKit; skeleton cards shown.
- **Empty:** catalog fetch returns nothing (StoreKit misconfiguration) →
  explicit "Shop unavailable right now" message, never a blank tab.
- **Error:** purchase fails/is cancelled → inline non-blocking error, no
  currency deducted (server validation gates the grant).
- **Offline:** Shop is browsable (cached catalog) but all buy buttons show
  "requires connection."
- **Permission denied:** device purchase restrictions (Screen Time/Ask to
  Buy) surfaces the platform's own restriction UI; the app does not attempt
  to bypass it.

### Accessibility
- Price, contents, and odds table each individually VoiceOver-labeled.

### Analytics
- `shop_viewed{tab}`, `purchase_initiated{sku}`, `purchase_completed{sku}`,
  `purchase_failed{sku, reason}`.

---

## S04A — Parental Gate

**Purpose:** Confirm an adult is present before completing a purchase or
leaving the app (e.g., support link), for under-13-bucketed accounts.
**Mode/role:** Under-13 bucket only.
**Evidence class:** Proposed (platform/App Store best-practice pattern, not
reconstructed from the reference, which has no documented equivalent).
**Entry points:** S04, external-link taps in S08 Settings.
**Exit points:** back to origin screen (pass/fail).

### Visible elements
- A simple interactive challenge not solvable by early-reading-age children
  (e.g., drag-to-solve arithmetic), not a "tap to confirm you're an adult"
  checkbox.

### States
- **Loading/Empty:** N/A. **Error:** repeated failure just returns to the
  prior screen — no lockout, no shaming copy.
- **Offline:** fully functional (local challenge).
- **Permission denied:** N/A.

### Accessibility
- An audio-based alternative challenge is offered for VoiceOver users
  instead of the drag interaction.

### Analytics
- `parental_gate_shown{context}`, `parental_gate_passed`,
  `parental_gate_failed`.

---

## S05 — Roster (Runners & Boards)

**Purpose:** View, equip, and unlock Runners and Grav-Boards.
**Mode/role:** All players.
**Evidence class:** Verified pattern (18+ unlockable characters) — see
[[00_REFERENCE_ANALYSIS]]; specific roster is Proposed.
**Entry points:** S02.
**Exit points:** S02, S04 (if an unlock requires purchase/currency the
player lacks).

### Visible elements
- Grid of Runners/Boards with locked/unlocked state, unlock cost or
  condition, equip toggle, per-item perk description.

### States
- **Loading:** grid skeleton while ownership syncs.
- **Empty:** never empty — starter Runner/Board always present.
- **Error:** equip action fails to sync → optimistic local equip with retry;
  never silently reverts without telling the player.
- **Offline:** browsing and equipping owned items works fully offline;
  unlock-via-purchase requires connection (clearly labeled).
- **Permission denied:** N/A.

### Accessibility
- Locked/unlocked state conveyed by both icon and text label, not color
  alone.

### Analytics
- `roster_viewed`, `item_equipped{item_id, type}`, `item_unlock_attempted{
  item_id, method}`.

---

## S06 — Contracts & Events (Daily Contracts, Weekly Heist, Season Hunt)

**Purpose:** Present active time-boxed objectives.
**Mode/role:** All players.
**Evidence class:** Verified pattern (Daily Challenges, Season Hunt) — see
[[00_REFERENCE_ANALYSIS]]; presentation is Proposed.
**Entry points:** S02.
**Exit points:** S02, S03 (Run to progress a Contract).

### Visible elements
- Three Daily Contracts with countdown to refresh, active Weekly Heist
  progress bar (P1), active Skyline Pass tier track (P1).

### States
- **Loading:** cached last-known Contract list shown immediately, refreshed
  in background.
- **Empty:** should not occur (server always issues 3 Contracts); if it
  does, an explicit "new Contracts arriving soon" message is shown, never a
  blank list.
- **Error:** stale Contract list shown with a "may be out of date" badge.
- **Offline:** viewable from cache; progress made offline reconciles once
  reconnected.
- **Permission denied:** N/A.

### Accessibility
- Countdown timers exposed as text, not only a progress ring.

### Analytics
- `contracts_viewed`, `contract_completed{contract_id}`.

---

## S07 — Leaderboard

**Purpose:** Global and friends best-distance ranking per District.
**Mode/role:** All players.
**Evidence class:** Proposed differentiator (friends leaderboard not
documented in the reference; see [[00_REFERENCE_ANALYSIS]] opportunities).
**Entry points:** S02.
**Exit points:** S02, S07A Friend Add (via Game Center or friend code).

### Visible elements
- Toggle: Global / Friends, District selector, ranked list with player's own
  row pinned if off-screen.

### States
- **Loading:** skeleton rows.
- **Empty:** Friends tab with no friends yet shows an explicit invite
  prompt, not a blank list.
- **Error:** fetch failure → last cached ranking shown with "may be
  outdated" badge.
- **Offline:** last cached ranking viewable read-only.
- **Permission denied:** if Game Center access is denied at the OS level,
  Friends tab shows "Enable Game Center in Settings to see friends" rather
  than failing silently.

### Accessibility
- Rank, name, and score each individually labeled per row.

### Analytics
- `leaderboard_viewed{scope, district_id}`, `friend_added{method}`.

---

## S08 — Settings

**Purpose:** Account, privacy, notification, and audio controls.
**Mode/role:** All players; some actions (age-bucket change, data deletion
confirmation) require the parental gate for under-13 accounts.
**Evidence class:** Strongly inferred (standard) with Proposed
privacy/data-rights controls as a differentiator.
**Entry points:** S02.
**Exit points:** S02, S04A (for gated actions), external OS settings deep
link (notifications), account-linking sheet (Sign in with Apple).

### Visible elements
- Audio/haptics toggles, notification preferences, linked-account status,
  age bucket (view-only unless parental-gated change), "Export my data",
  "Delete my account", privacy policy link, support link, app version.

### States
- **Loading:** account-link status skeleton.
- **Empty:** N/A.
- **Error:** export/delete request fails to submit → explicit retry, never
  a silent failure for a data-rights action (see [[08_SAFETY_PRIVACY_COMPLIANCE]]).
- **Offline:** toggles work locally and sync later; export/delete requests
  require connection and say so.
- **Permission denied:** notification toggle reflects OS-level denial with
  a deep link to system settings rather than a broken in-app toggle.

### Accessibility
- Every control individually labeled; destructive actions (delete account)
  require an explicit typed or double-confirmation step, announced clearly.

### Analytics
- `settings_viewed`, `data_export_requested`, `account_deletion_requested`.
