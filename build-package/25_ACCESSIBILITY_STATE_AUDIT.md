# 25 — Accessibility State Audit (Non-Colour Status Indicators)

**Phase 3 / AC-P3-4.** Scope: WCAG 2.1 SC **1.4.1 Use of Color** — *"Color is
not used as the only visual means of conveying information, indicating an
action, prompting a response, or distinguishing a visual element."*

**Subject under audit:** the playable Web Runner in `skyline-rush-client/web/`
(`index.html`, `game.js`, `style.css`). This is the client that exists and can
be inspected today. The Unity client under `skyline-rush-client/Assets/` is an
architecture skeleton; its equivalent audit is deferred (§4).

> **Doc numbering note.** AC-P3-4 originally specified `22_`. That number was
> claimed by `22_APP_STORE_LISTING.md` (AC-P3-11), and `23_`/`24_` by AC-P3-12
> and AC-P3-14, so per AC-P3-11's collision instruction this document was
> renumbered to `25_`. No content was dropped in the renumber.

---

## 1. Method

Every status indicator reachable in the web client was traced to the code that
renders it, and classified by whether the state survives **greyscale** — i.e.
whether a user who cannot distinguish the colour still receives the information.

* `PASS` — the state is carried by text and/or an icon/shape, colour is
  supplementary.
* `FIXED` — the state *was* colour-only; a text or icon carrier was added in
  this change-set.

Related automated checks in the same change-set (both wired into
`cd skyline-rush-client && npm test`):

| Check | Covers | Result |
| --- | --- | --- |
| `npm run check:contrast` (`web/check-contrast.js`) | SC 1.4.3 / 1.4.11 contrast for UI chrome | 59 pairings, 51 pass, 8 decorative (reported, not gated), 0 fail |
| `npm run check:a11y` (`web/check-a11y-labels.js`) | SC 4.1.2 / 2.4.6 accessible names | 64 controls, 0 violations |

**On the 8 "decorative" pairings — what that number means.** The script does not
gate every pairing it prints. Eight of the 59 are hairline dividers drawn with
`--line` / `--line-strong` on **non-interactive** surfaces: the HUD stat-chip
edge, the summary-stats frame, the leaderboard row separator, the odds-table
frame, the contract-card edge, the settings-group frame, the `kbd` key-cap
outline, and the `.badge-locked` status-pill outline. SC 1.4.11 scopes to
*user-interface components* — things you operate — so a frame around a readout
is outside its scope; each of the eight prints its real measured ratio (1.20 to
1.61) followed by an individual one-line justification naming the surface, so
the exemption is visible and arguable rather than hidden. Every **interactive**
control boundary was moved onto `--line-control` and is gated at the full 3:1.
An earlier draft of this table reported "36 pairings, 36 pass, 0 exempt", which
was the pre-hardening run: it both undercounted the audited surface and implied
nothing was exempted. The gated count that matters is **51 pass / 0 fail**.

Neither of those covers SC 1.4.1 — that is what this document is for, and it was
done by reading the code, not by a tool.

---

## 2. Audit table

| # | Status indicator | Where it is rendered | Colour cue | Non-colour carrier | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | **Offline / mock profile** | `game.js` `loadProfile()` catch branch sets `hubPlayerName` to `Runner#4821 (Offline)` | none | Literal text `(Offline)` appended to the player name | PASS |
| 2 | **Run queued for sync** (outbox pending) | `game.js` `showSummary()` catch branch sets `summaryIntegrity` to `QUEUED FOR SYNC` | `badge-ok` class is *removed*, so the value loses its green treatment | The string itself changes from `VERIFIED (OK)` to `QUEUED FOR SYNC` | PASS |
| 3 | **Run integrity verdict** | `game.js` `showSummary()`: `VERIFIED (${res.integrity_flag.toUpperCase()})` | green `.badge-ok` only when `integrity_flag === 'ok'` | The flag value is printed inside the label, so `VERIFIED (EXCLUDED)` reads differently from `VERIFIED (OK)` | PASS |
| 4 | **Form / friend-code error** | `#addFriendStatus.error-msg` in `index.html`; text set in `game.js` `confirmAddFriend()` | `.error-msg { color: var(--magenta) }` | **FIXED** — messages now carry an `ERROR:` prefix, and the container was given `role="alert" aria-live="assertive"` so the state is announced, not just seen | FIXED |
| 5 | **Roster item — equipped** | `game.js` `renderRosterTab()` | `.roster-card.equipped` cyan border + glow | `<span class="badge-equipped">EQUIPPED</span>` text badge, **plus** a disabled button reading `EQUIPPED` | PASS |
| 6 | **Roster item — locked vs. unlocked** | `game.js` `renderRosterTab()` | Previously the *only* difference between an owned and an un-owned card was the absence of the equipped card's cyan treatment | **FIXED** — un-owned cards now render `<span class="badge-locked">🔒 LOCKED</span>` and get a `.locked` class that desaturates the avatar. The action button already read `UNLOCK (🔷 N)` vs. `EQUIP`, which was the pre-existing text carrier | FIXED |
| 7 | **Leaderboard — "this row is you"** | `game.js` `openLeaderboard()` | `.lb-row.self` cyan border, cyan-tinted background, cyan glow — **colour and glow only** | **FIXED** — the row now renders a `<span class="lb-you-chip">YOU</span>` chip next to the display name | FIXED |
| 8 | **Leaderboard — podium ranks** | `.lb-rank.gold` / `.silver` / `.bronze` in `style.css` | gold / silver / bronze text colour | The rank number `#1`, `#2`, `#3` is printed in the same element; the colour is decoration on top of an already-explicit ordinal | PASS |
| 9 | **Contract — complete / claimable** | `game.js` `renderContracts()` | Progress bar fills with a cyan→green gradient | Numeric progress text `${current} / ${target} (${pct}%)` **and** the action button text `CLAIM` | PASS |
| 10 | **Contract — already claimed** | `game.js` `renderContracts()` | disabled-button styling | Button text `CLAIMED`, plus `aria-label="Reward for … already claimed"` | PASS |
| 11 | **Contract — in progress** | `game.js` `renderContracts()` | disabled-button styling | Button text `IN PROGRESS`, plus an `aria-label` carrying the numeric progress | PASS |
| 12 | **Age tier selection** | `.age-option-btn.active` in `index.html` / `game.js` | `.active` class styling | **Strengthened** — `aria-pressed` is now set on every button and kept in sync when the selection changes, so the state is exposed to assistive tech rather than inferred from styling | PASS |
| 13 | **Roster tab selection** | `#tabRunners` / `#tabBoards` | `.tab-btn.active` styling | **Strengthened** — `role="tab"` + `aria-selected`, kept in sync in `selectRosterTab()` | PASS |
| 14 | **Audio slider values** | `#sliderSfx` / `#sliderMusic` | position of the thumb | Adjacent `#valSfx` / `#valMusic` text percentage; **strengthened** with `aria-valuenow` / `aria-valuetext` kept in sync on `input` | PASS |
| 15 | **Shop "best value" / "popular" badges** | `.card-badge` spans in `index.html` | badge background colour | The badge text itself (`BEST VALUE`, `POPULAR`, `PERMANENT`) | PASS |
| 16 | **Insufficient balance on Core redeploy** | Redeploy modal; shortfall path in `game.js` | magenta shortfall styling | The exact shortfall amount is printed as text, per the CLAUDE.md §4 requirement that redeploy display exact shortfall | PASS |

**Totals: 16 indicators audited — 12 already compliant, 4 fixed in this
change-set (rows 4, 6, 7, and the ARIA-state strengthening in 12–14).**

The three genuine SC 1.4.1 violations found were rows **4**, **6** and **7**;
row 7 (leaderboard self-row) was the clearest — it had no text carrier at all.

---

## 3. Code changes made by this audit

| File | Change |
| --- | --- |
| `skyline-rush-client/web/game.js` | `YOU` chip on the leaderboard self-row; `LOCKED` badge + `.locked` class on un-owned roster cards; `ERROR:` prefix on friend-code errors; `aria-selected` / `aria-pressed` / `aria-valuenow` kept in sync with visual state |
| `skyline-rush-client/web/index.html` | `role="alert" aria-live="assertive"` on the error container; `aria-pressed` / `role="tab"` / `aria-selected` / `aria-value*` initial values |
| `skyline-rush-client/web/style.css` | New `.badge-locked`, `.roster-card.locked .roster-avatar` (greyscale), `.lb-you-chip`, under a comment block explaining the SC 1.4.1 intent |

No gameplay logic, collision geometry, economy math, or network contract was
touched.

---

## 4. Explicitly deferred — NFR-006 items NOT verified here

`NFR-006` (`01_PRD.md` §10) requires *"minimum WCAG-AA-equivalent color contrast
on all UI (not necessarily gameplay art); full VoiceOver labeling for all
menu/shop/settings screens."* The following parts of that are **deferred, not
skipped**:

| Deferred item | Why | What would close it |
| --- | --- | --- |
| **Full on-device VoiceOver pass** | No iOS/iPadOS device and no assistive technology are available in this environment. Static `aria-label` coverage (verified: 64/64 controls named) is a **precondition** for a VoiceOver pass, not a substitute — it cannot detect focus-order problems, unannounced dynamic updates, or modal focus traps. | A manual sweep on a physical device with VoiceOver enabled, covering Hub, Shop, Roster, Contracts, Leaderboard, Supply Drops, Settings, Parental Gate, Redeploy and Summary. |
| **Dynamic Type hardware verification** | Requires a real device with the iOS text-size slider; the Web Runner uses `rem` units but nothing here proves layout survives the largest accessibility text sizes, and no reflow testing was performed. | Device sweep at the largest Dynamic Type setting, checking for clipping and overlap on every modal. |
| **Reduce Transparency** | Still **not** handled. The UI leans on translucent panels (`--panel`, `--panel-2` are both `rgba`), and there is no `prefers-reduced-transparency` media query in `style.css`. Deciding which surfaces go opaque is a design call, not a mechanical edit. | Add `@media (prefers-reduced-transparency: reduce)` overrides that swap the translucent tokens for opaque equivalents, and confirm on device. |
| **Reduce Motion** | **Now handled (RF-10)** — see the note in §4a below. Previously this row claimed no handling existed at all, which was wrong in both directions: a partial block did exist, and it covered only six selectors. | Closed for the web client; still unverified on a physical iOS device. |
| **VoiceOver behaviour of the gameplay canvas** | NFR-006 explicitly exempts gameplay from screen-reader operability ("consistent with genre norms"), so no work was done here. Recorded so the exemption is visible rather than looking like an omission. | n/a — exempt by design. |


### 4a. Reduce Motion — current state (RF-10)

`prefers-reduced-motion: reduce` is honoured in two places, because CSS alone
cannot reach the gameplay canvas:

| Surface | Mechanism | Coverage |
| --- | --- | --- |
| DOM chrome (menus, HUD, modals, cards) | `@media (prefers-reduced-motion: reduce)` in `skyline-rush-client/web/style.css` | **Complete.** A blanket `*, *::before, *::after` rule collapses every `animation-*` and `transition-*` duration/delay, so it covers declarations added later without anyone remembering to update a hand-maintained selector list. The named looping animations (`.pulse-btn`, `.powerup-pill`, `.stage-ring`, `.hub-brand`, `.hub-bottom`, `.modal-card`, `.drop-result`) additionally get `animation: none`. |
| Canvas rendering | `REDUCED_MOTION` helper in `skyline-rush-client/web/game.js` | **Screen shake and crash flash only.** On crash, `RenderFX.shake` is scaled to `0` and `RenderFX.flash` is clamped to `0.25` (kept as a non-strobing cue rather than removed, so the crash is still legible). The preference is read live via `matchMedia`, so toggling it mid-session takes effect without a reload. |

**Still not covered:** continuous world scroll, parallax skyline drift, particle
systems and the runner's own animation are unchanged under Reduce Motion. These
are the game itself rather than incidental motion, and removing them would
remove the gameplay; a genuine treatment would need a design decision (e.g. a
reduced-parallax mode), which is out of scope for this pass and recorded here so
the gap is visible rather than implied-closed.
| **Unity client accessibility** | `skyline-rush-client/Assets/` is an architecture skeleton with no built UI to audit. | Repeat this audit against the Unity UI once it exists. |
| **Colour-blindness simulation** | No simulation tooling was run. The contrast script proves luminance ratios, which is necessary but not sufficient — it does not detect two colours that are equally luminant but indistinguishable to a deuteranope. | Run a CVD simulator over screenshots on device. |

---

## 5. Known weaknesses of this audit

- It is a **code-reading audit**, not a rendered-output audit. No screenshots
  were taken and no page was loaded in a browser, so a state that is
  theoretically labelled but visually clipped would not have been caught.
- Coverage is **enumerated by hand**. An indicator that exists but was not found
  by grepping for status classes and template branches would be missing from the
  table. The list is not machine-generated and there is no test that fails if a
  new colour-only state is added tomorrow.
- The `LOCKED` and `YOU` fixes add English strings directly in `game.js`
  template literals, which is inconsistent with **NFR-005** (no hard-coded
  user-facing strings). That is pre-existing practice throughout the Web Runner,
  but these three additions widen it slightly and should be folded into
  localization when the string table lands.


### 4b. Scope limits of the automated checks (RF-09)

`check-a11y-labels.js` is a **static text scan**, not a DOM audit. It matches
literal `<button>`, `<a>`, `<input>`, `<select>` and `<textarea>` tags in
`index.html` and in `game.js` template literals. It cannot see:

- ARIA-role widgets (`role="button"`, `role="link"`, …);
- elements made focusable with `[tabindex]`;
- controls constructed at runtime with `document.createElement`.

The script now prints this residue with occurrence counts on every run instead
of claiming whole-app coverage. One known dynamic control exists:
`handleDataExport()` in `game.js` builds an `<a>` to trigger the GDPR export
download — it is clicked programmatically and never inserted into the document,
so it is never focusable or announced and needs no accessible name.

`check-contrast.js` audits **UI chrome only** (menus, HUD, panels); gameplay
canvas pixels are out of scope per WCAG 1.4.3's incidental-imagery exemption.
Since RF-02 every pairing also carries a machine-verified evidence anchor: the
cited selector must exist in `style.css` and must actually declare the property
the pairing claims, so a stale anchor fails the build rather than reading as
evidence. Eight hairline dividers (`--line` / `--line-strong` on non-interactive
frames and separators) are reported with their real ratios but not gated, on the
grounds that SC 1.4.11 scopes to user-interface components; every **interactive**
control boundary now uses `--line-control` and clears 3:1.
