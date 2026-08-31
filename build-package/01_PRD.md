# 01 Product Requirements Document — Skyline Rush

Reference: Subway Surfers — see [[00_REFERENCE_ANALYSIS]]. Everything in this
document is a **Proposed** design decision for the new, original product
unless explicitly cited otherwise.

## 1. Vision

Skyline Rush is a 3-lane endless-runner iOS/iPadOS game set in Vantage City,
a near-future metropolis where gig-economy rooftop couriers ("Runners") race
across skylines on grav-boards, evading the automated Skyline Authority
enforcement drone fleet after a delivery gets flagged. It preserves the
low-friction, one-gesture-set core loop that makes this genre durable while
fixing the reference's clearest weaknesses: opaque reward odds, no
enforced child-privacy boundary, and no social competition layer.

## 2. Problem

Casual mobile players want a game they can pick up for 30–90 seconds,
understand instantly, and return to daily without a content plateau — but the
genre's incumbents monetize with opaque randomized rewards and treat child
privacy as a policy statement rather than an enforced boundary, which creates
real regulatory and trust risk (see [[00_REFERENCE_ANALYSIS]] weaknesses).

## 3. Personas / jobs-to-be-done

- **Tween/teen casual player (core segment, age 9–15).** "When I have a few
  free minutes, I want a quick, satisfying run that makes me feel skilled and
  gives me something new to unlock, without confusing paywalls."
- **Adult nostalgia/casual player (secondary, 18–40).** "I want a low-stakes
  game I can play one-handed during a commute or a break, with a fair
  economy I understand."
- **Parent of a young player (influencer persona, not primary user).** "I
  want confidence that this app won't harvest my kid's data or push
  manipulative purchases at them."
- **Competitive score-chaser (retention segment).** "I want to prove I'm
  faster than my friends, not just grind a solo high score."

## 4. Value proposition

The endless-runner genre's addictive core loop, delivered with a
transparent economy (published Supply Drop odds), an enforced age-aware
privacy boundary instead of a policy promise, and lightweight async social
competition (friend leaderboards, ghost replays) that the reference does not
document.

## 5. Differentiators vs. the reference pattern

1. **Transparent-odds Supply Drop** replaces an opaque mystery box — every
   drop shows its probability table before opening. See [[11_MONETIZATION_AND_BILLING]].
2. **Enforced, not just declared, child-privacy boundary** — age-bucketing
   gates ad SDK behavior and data collection server-side, not just by policy
   text. See [[08_SAFETY_PRIVACY_COMPLIANCE]].
3. **Async social layer** — friend leaderboards and per-district ghost
   replays, absent from the documented reference feature set.
4. **Capped revive-cost escalation** with a guaranteed free daily path via
   rewarded ad, to reduce failure-moment monetization pressure.
5. **Original setting and cast** — rooftop couriers vs. drone enforcement in
   a fictional city, not a subway/graffiti/police-and-dog theme.

## 6. Goals

- G1: Ship an MVP with a complete, replayable core loop and a fair,
  understandable economy.
- G2: Hit D1/D7/D30 retention benchmarks competitive with the genre through
  daily/weekly content cadence, not through pressure mechanics.
- G3: Pass App Store review, including IAP/loot-box disclosure and
  children's-privacy requirements, on first submission.
- G4: Establish a live-ops pipeline (District Rotation, Season Pass) that a
  small content team can operate without client releases for most content.

## 7. Non-goals

- NG1: No user-generated content, chat, or messaging between players (removes
  a major moderation/child-safety surface).
- NG2: No PvP real-time multiplayer in MVP (async leaderboards/ghosts only).
- NG3: No web or Android build in MVP — iOS/iPadOS only (platforms may
  expand post-MVP; see [[14_IMPLEMENTATION_ROADMAP]]).
- NG4: No real-money gambling mechanics; Supply Drops never pay out real-
  world value and always disclose odds.
- NG5: No behavioral/targeted advertising or third-party data sharing for
  accounts in the under-13 (and, for ads specifically, under-16) age bucket.
- NG6: No Apple Kids Category submission in MVP (keeps the general-audience
  9+-style rating path; Kids Category has stricter, separate requirements
  out of scope for v1).

## 8. Scope: MVP / P1 / P2

### MVP (v1.0)
- Core 3-lane endless run: swipe left/right/jump/roll, one starter District.
- Soft currency (Chips) + semi-premium currency (Cores), single Runner and
  Grav-Board unlocked at start plus 3 unlockable Runners.
- Power-ups: Magnet, Shield, Boost, Chip Multiplier.
- Revive ("Redeploy") with capped escalating Core cost + 1 free rewarded-ad
  redeploy per run.
- Daily Contracts (3 rotating daily objectives).
- Transparent-odds Supply Drop (earned via play; optional purchased variant).
- Guest play (device-anonymous) + optional Sign in with Apple for cloud save.
- Global + friends leaderboard (best distance, per District).
- Core IAP: Chips packs, Cores packs, Starter Pack, remove-interstitials.
- Rewarded video ads (revive, bonus Chips, double Supply Drop).
- Settings: audio, notifications, account/data deletion, age-bucket display.
- App Store submission-ready: privacy nutrition label, IAP odds disclosure,
  parental gate before any purchase or external link.

### P1
- District Rotation live-ops pipeline (2nd/3rd themed District via remote
  content, no client update required for content-only changes).
- Weekly Heist (multi-day collection event).
- Skyline Pass (season pass, free + premium track) tied to District Rotation
  cadence (~4 weeks).
- Friend ghost replays on leaderboard segments.
- Additional Runners/Boards, cosmetic trail effects.
- Push notification re-engagement (event start/end, streak reminders).

### P2
- iPadOS-optimized layout refinements beyond baseline Universal support.
- Android build (shared backend, new client).
- Limited-time branded collaboration content slots (originally-created,
  non-infringing partner content, not reusing any third-party IP without
  license).
- Additional social: clan/crew leaderboards.
- Accessibility: colorblind-safe obstacle recoloring option, reduced-motion
  mode.

### Explicit non-goals recap
See section 7. Any request to add chat, UGC, PvP, or gambling-style payouts
is out of scope without a new PRD revision.

## 9. Functional requirements

Priority P0 items must be implementable by an engineer/agent without further
product clarification.

- **FR-001** (P0) — Core run loop. Actor: Player. The player swipes to
  change lanes, jump, or slide; collisions with obstacles end the run unless
  a Shield or Board charge absorbs the hit. Score = meters traveled + Chip
  value collected. Acceptance: AC-001.
- **FR-002** (P0) — Redeploy (revive). Actor: Player. On crash, the player is
  offered: (a) watch a rewarded ad for one free Redeploy per run, or (b)
  spend Cores at an escalating cost (10 → 20 → 40, capped at 40) to resume
  from the crash point. Acceptance: AC-002.
- **FR-003** (P0) — Currency economy. Actor: Player. Chips (soft) are earned
  by collecting in-run pickups and completing Contracts; Cores (semi-
  premium) are earned in small amounts from Contracts/Heists/first daily ad
  and purchasable via IAP. Neither currency expires. Acceptance: AC-003.
- **FR-004** (P0) — Power-ups. Actor: Player. Magnet (pulls Chips within
  radius for N seconds), Shield (absorbs one hit), Boost (temporary speed +
  score multiplier), Chip Multiplier (2x Chip value for N seconds) spawn in-
  run and stack per their own rules (Shield does not stack; timers refresh).
  Acceptance: AC-004.
- **FR-005** (P0) — Daily Contracts. Actor: Player. Three Contracts refresh
  every 24h server time; completing a Contract grants Chips/Cores and
  Contract-track progress. Acceptance: AC-005.
- **FR-006** (P0) — Supply Drop. Actor: Player. Before opening, the exact
  probability table for every possible reward tier is shown. Drops are
  earned via Contracts/score milestones; a purchasable Drop uses the same
  disclosed odds. Acceptance: AC-006.
- **FR-007** (P0) — Leaderboard. Actor: Player. Global and friends best-
  distance leaderboards per District, updated after each run; friends list
  is sourced from Game Center or a shareable friend code, never from device
  contacts. Acceptance: AC-007.
- **FR-008** (P0) — Guest and linked accounts. Actor: Player. The game is
  playable immediately as a device-anonymous guest; Sign in with Apple
  links progress for cloud save/cross-device restore without collecting
  email or name. Acceptance: AC-008.
- **FR-009** (P0) — Age bucketing. Actor: Player/Guardian. On first launch, a
  neutral, non-accusatory age gate (no birthdate collection from a
  presumed-child device; see [[08_SAFETY_PRIVACY_COMPLIANCE]]) sets an age
  bucket that server-side gates ad personalization and data collection.
  Acceptance: AC-009.
- **FR-010** (P0) — Purchases. Actor: Player. All IAP uses StoreKit 2;
  server validates every receipt before granting entitlements; a parental
  gate (non-trivial interactive challenge) precedes the platform purchase
  sheet for under-13-bucketed accounts. Acceptance: AC-010.
- **FR-011** (P1) — District Rotation. Actor: LiveOps operator. New
  Districts (obstacle sets, art skins, music) ship via signed remote content
  bundles without an App Store binary update, gated by App Store Review
  Guideline 4.7 constraints (see [[21_RISKS_AND_OPEN_QUESTIONS]]).
  Acceptance: AC-011.
- **FR-012** (P1) — Skyline Pass. Actor: Player. A season-scoped free +
  premium reward track that advances via a Pass XP stat earned from runs
  and Contracts. Acceptance: AC-012.
- **FR-013** (P1) — Ghost replay. Actor: Player. The player can watch a
  compact input-replay of a friend's or the leaderboard leader's best run on
  a given District. Acceptance: AC-013.
- **FR-014** (P0) — Data export/delete. Actor: Player/Guardian. Any account
  can request full data export and permanent deletion from Settings; guests
  can wipe local+cloud-linked data by device ID. Acceptance: AC-014.

## 10. Non-functional requirements

- **NFR-001 Performance**: sustain 60 fps on iPhone 12 and newer under
  normal District content; input-to-lane-change latency under 80ms.
- **NFR-002 Availability**: backend services (economy, leaderboard) target
  99.9% monthly availability; the core run loop must remain playable fully
  offline with local queuing of run results.
- **NFR-003 Scalability**: leaderboard and economy services scale
  horizontally; Redis-backed leaderboard writes batched to tolerate launch-
  day and event-start traffic spikes.
- **NFR-004 Security**: see [[08_SAFETY_PRIVACY_COMPLIANCE]] and
  engineering baseline in [[04_SYSTEM_ARCHITECTURE]].
- **NFR-005 Localization**: MVP ships in English; UI strings and District
  content are externalized for translation from day one (no hard-coded
  user-facing strings in client code).
- **NFR-006 Accessibility**: minimum WCAG-AA-equivalent color contrast on
  all UI (not necessarily gameplay art); full VoiceOver labeling for all
  menu/shop/settings screens (gameplay itself is not screen-reader
  operable, consistent with genre norms, but every non-gameplay screen is).

## 11. Success metrics (KPIs)

- D1 retention ≥ genre benchmark band (target set post-soft-launch; track
  cohorted by acquisition source).
- D7 / D30 retention, average session length, sessions/day.
- Contract completion rate (daily engagement health signal).
- Supply Drop open rate vs. purchase rate (economy health, not a pressure
  metric — tracked alongside player-reported fairness sentiment).
- IAP conversion rate and ARPDAU, tracked separately for age-bucketed
  cohorts (never optimized specifically toward the under-18 bucket).
- Crash-free session rate ≥ 99.5%.
- App Store rating and review-sentiment for "fairness"/"pay to win" language.

## 12. Accessibility

Covered in NFR-006; full detail in [[17_DESIGN_SYSTEM]] and per-screen states
in [[02_UX_SCREEN_SPEC]].

## 13. Security

Baseline defined in [[04_SYSTEM_ARCHITECTURE]] and [[08_SAFETY_PRIVACY_COMPLIANCE]].

## 14. Localization

English at MVP; architecture supports adding locales without client logic
changes (string tables + server-driven District copy). Target P1 locales to
be decided based on soft-launch market — see [[21_RISKS_AND_OPEN_QUESTIONS]].
