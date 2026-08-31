# 17 Design System — Skyline Rush

Original visual identity. Deliberately avoids the reference's protected
trade dress (subway/graffiti motifs, its specific character silhouettes,
its color language) — Skyline Rush's identity is a near-future rooftop
skyline at dusk: neon signage, glass and steel, warm sunset gradients
against cool structural shadow.

## Principles

1. **Readable at speed.** Every gameplay-critical element (obstacle,
   power-up, lane boundary) must be distinguishable in under 200ms of
   screen time — silhouette and color both carry meaning, never color
   alone (also an accessibility requirement, see below).
2. **Warm meta, cool run.** Hub/Shop/menus use a warm, inviting palette to
   feel rewarding and calm; the in-run HUD uses a cooler, higher-contrast
   palette so it never competes visually with obstacle readability.
3. **No dark patterns in layout.** Purchase buttons are never sized,
   colored, or positioned to be mistaken for a "continue for free" action;
   declines/back actions are always equally prominent to accepts.
4. **Honest odds, presented plainly.** The Supply Drop odds table
   (FR-006) uses the same typographic weight as any other informational
   UI — never de-emphasized relative to the "open" button.

## Tokens

| Token | Value | Usage |
|---|---|---|
| `color.bg.hub` | `#1B1330` deep dusk violet | Hub/menu background |
| `color.bg.run-hud` | `#0B1B2B` cool near-black blue | In-run HUD overlay |
| `color.accent.primary` | `#FF6B4A` sunset coral | Primary CTAs (RUN, buy confirm) |
| `color.accent.secondary` | `#3AD6C4` skyline teal | Secondary actions, links |
| `color.currency.chips` | `#FFC94D` warm gold | Chips balance/icons |
| `color.currency.cores` | `#8E7CFF` violet crystal | Cores balance/icons |
| `color.state.success` | `#3ECF8E` | Completed contracts, unlocks |
| `color.state.error` | `#FF5A5F` | Errors, insufficient balance |
| `color.state.offline` | `#8A8FA3` neutral slate | Offline badges, disabled states |
| `radius.sm` / `md` / `lg` | 6 / 12 / 20px | Buttons/cards/sheets |
| `space.xs..xl` | 4 / 8 / 16 / 24 / 32px | Layout spacing scale |
| `motion.fast` / `standard` / `slow` | 120ms / 220ms / 400ms, ease-out | Micro-interactions / screen transitions / celebratory reveals |

## Typography

- Display/headline face: a geometric sans (e.g. a licensed or system-safe
  equivalent to Poppins/Inter Display) for HUD numerals and hub headlines —
  chosen for large-size legibility at a glance.
- Body/UI face: a humanist sans (system default, e.g. SF Pro on iOS, to
  minimize font-licensing surface and guarantee Dynamic Type support) for
  all menu, settings, and disclosure text (including the Supply Drop odds
  table, which must remain legible at accessibility text sizes).
- Minimum body text size 15pt equivalent; HUD numerals scale independently
  for run-time legibility, unaffected by Dynamic Type (a documented,
  deliberate exception, since altering in-run HUD scale live could affect
  obstacle-reaction timing).

## Spacing

8px base grid (`space.xs`=4 is the only sub-grid exception, reserved for
icon-to-label gaps). All touch targets ≥ 44×44pt per Apple HIG minimum.

## Components

- **Buttons**: primary (filled, `accent.primary`), secondary (outline,
  `accent.secondary`), destructive (filled, `state.error`, used only for
  "Delete my account" and similar). Disabled state uses reduced opacity +
  an explicit reason string nearby, never opacity alone (see
  [[02_UX_SCREEN_SPEC]] Shop buy-button offline state).
- **Currency chip**: icon + numeral, consistent across Hub/Shop/Run HUD,
  color-coded per the currency tokens above.
- **Odds table**: a simple two-column list (reward, probability as both a
  percentage and, where feasible, a plain-language frequency, e.g. "about 1
  in 50") — never a chart alone, so a screen-reader user gets the same
  information as a sighted user.
- **Contract card**: objective text, progress bar with numeric label,
  reward preview, countdown as both a ring and a text timestamp.
- **Toast/badge**: "sync pending" and "offline" indicators use the
  `state.offline` token and an icon (not color alone) so they remain
  distinguishable under any color-vision condition.

## Interactions

- Swipe gestures in-run have a generous deadzone tuned against NFR-001's
  80ms input-latency budget; menu navigation uses standard tap/scroll, no
  swipe-gesture overload between meta and gameplay contexts.
- Every destructive or purchase-adjacent action requires a distinct
  confirming tap — never a single accidental tap can spend currency or
  real money.

## Motion

- `motion.fast` for button/toggle feedback, `motion.standard` for screen
  transitions, `motion.slow` reserved for celebratory reveals (Supply Drop
  open, new-best-distance) — capped in frequency so celebration animations
  never block returning to play for more than ~1.5s, and are always
  skippable with a tap.
- A reduced-motion setting (P2, see [[01_PRD]] scope) disables non-
  essential celebratory animation entirely rather than merely shortening it.

## Accessibility

- Minimum 4.5:1 contrast ratio (WCAG AA equivalent) for all body text; 3:1
  for large text/icons, verified per token pairing above.
- Full VoiceOver labeling on every non-gameplay screen (see per-screen
  Accessibility notes in [[02_UX_SCREEN_SPEC]]); Dynamic Type support
  throughout menus/settings/disclosures.
- Color is never the sole signal for locked/unlocked, error, or
  online/offline states — always paired with an icon or text label.
