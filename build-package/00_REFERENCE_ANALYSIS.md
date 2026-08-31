# 00 Reference Analysis

Product: Skyline Rush (original, this package)
Reference: Subway Surfers (SYBO Games)
Research date: 2026-08-31 — see [[SOURCES]] for full source list and access dates.

## Reference overview

Subway Surfers is a 2012 3-lane endless runner originally by Kiloo and SYBO
Games (Copenhagen, Denmark), now published solely by SYBO Games. The player
controls a graffiti artist caught spraying a subway station, then swipes to
dodge oncoming trains, poles, and barriers while a station inspector and dog
give chase. It is one of the most-downloaded mobile games of all time (first
Google Play title to reach 1B downloads, March 2018; 2.7B by December 2019).
As of the research date, SYBO has announced/shipped a sequel-scale evolution,
"Subway Surfers City" (~February 2026), which this analysis notes but does not
treat as the primary reference — the classic endless-runner pattern the user
named ("Subway Surfers") is the enduring, widely documented product analyzed
below. **Version/date note:** where this document describes the classic game,
it reflects the App Store listing and community documentation as of
2026-08-31; live-ops content (seasonal collaborations, specific districts) was
current only at that date and will have rotated since.

## Target platforms

**Verified** — iOS, iPadOS, macOS (via App Store), Android, HarmonyOS NEXT,
Amazon Fire tablets; historically Windows Phone (discontinued); web build on
Poki.com. [S2]

## Target users

**Strongly inferred** from age rating and content — broad, family-skewing
casual mobile audience; App Store age rating 9+ [S1] indicates a general
audience rather than an Apple Kids Category product. Session-driven, short
play-session design and cosmetic-collection meta suggest a core segment of
children and tweens alongside a long-tail casual adult audience — consistent
with widely reported "sludge content" / short-form social video usage as
passive background footage. [S2]

## Business model

**Verified** — free-to-download, in-app purchases, "optional ad viewing" for
revival/reward items [S2]. Confirmed IAP price list from the live App Store
listing [S1]:

| SKU | Price |
|---|---|
| 7,500 Coins | $0.99 |
| 12,500 Coins | $0.99 |
| 45,000 Coins | $4.99 |
| 65,000 Coins | $4.99 |
| 25 Keys | $4.99 |
| 40 Keys | $4.99 |
| Key Pack 1 | $4.99 |
| Double Coins | $4.99 |
| Starter Pack | $0.99 |

App Privacy declarations show data collection for purchases, location, user
content, identifiers, usage data, and diagnostics, used for cross-app
tracking, third-party advertising, analytics, and app functionality. [S1]

## Onboarding

**Strongly inferred** — no forced tutorial gate is documented; the genre
standard (and community screenshots) show an immediate first run with
on-screen swipe prompts overlaid during play rather than a modal tutorial,
because the core loop (swipe to dodge) is simple enough to teach in-context.

## Main navigation

**Strongly inferred** from genre convention and fan-wiki screenshots: a hub
screen with Play (primary), Shop, Characters/Boards, Missions/Challenges,
Leaderboard, and Settings, radiating from a single "run" button; no deep
navigation stack — the game is optimized for one-tap-to-play.

## Screen inventory (reference)

**Strongly inferred**, genre-standard for this class of endless runner:
Splash/loading, Main hub, Run/gameplay, Pause, Game-over/score summary,
Shop (currency + characters/boards), Mystery Box opening, Daily
Challenge/Season Hunt board, Leaderboard, Character/board detail + equip,
Settings, IAP purchase sheet.

## Feature inventory

| Feature | Class | Evidence |
|---|---|---|
| 3-lane swipe-based endless running (left/right/jump/roll) | Verified | [S2] |
| Coin collection + soft currency economy | Verified | [S1] IAP list |
| Key premium-ish currency, purchasable and earnable | Verified | [S1] IAP list |
| Revive after a crash, cost in Keys, cost escalates per use in a run | Strongly inferred | [S5] |
| Rewarded video ads grant free Keys/Coins/doubled rewards | Strongly inferred | [S5] |
| Mystery Box: randomized reward (coins/keys/tokens/power-ups/boards) | Strongly inferred | [S5] |
| Power-ups: coin magnet, score/coin multiplier, shield/bouncy shield, boost | Verified (named on App Store listing for the newer client) | [S1] |
| Hoverboard: single-use "revive from one hit" board item | Strongly inferred | [S5], genre convention |
| 18+ unlockable playable characters, each with a distinct look | Verified | [S2] |
| World Tour: rotating themed city/location roughly every 3–4 weeks | Verified | [S2] |
| Daily Challenges | Verified | [S2] |
| Season Hunt (recurring collection-based event) | Verified | [S2] |
| Score = distance-based with combo/coin bonuses | Strongly inferred | genre convention, not separately confirmed |
| Branded collaborations (e.g., Among Us) as limited content | Verified | [S1] "What's New" |
| Apple Arcade spin-off variant (2022) | Verified | [S2] |
| Animated series tie-in (2018) | Verified | [S2] |
| No documented direct social/friends leaderboard or async ghost-race | Strongly inferred (absence) | not found in any source consulted |
| Chat, messaging, or user-generated content sharing | Strongly inferred (absence) | not found in any source consulted; App Privacy lists "user content" collected but no in-game social/chat surface is documented |

## Free/premium boundaries

**Strongly inferred** — full endless-run gameplay is free and unlimited;
monetization gates sit around currency (buy Coins/Keys directly), convenience
(skip the revive-cost escalation), and cosmetics (character/board unlocks,
some gated behind Keys earned slowly or bought). No subscription tier is
documented in the current IAP list [S1]; "Double Coins" is a permanent
multiplier purchase, not a subscription.

## Account/auth

**Strongly inferred** — session/progress appears tied to platform identity
(Game Center on iOS / Google Play Games on Android) for cloud save and
cross-device continuity, common for this genre; no evidence of an
email/password account system was found in the sources consulted.

## Payments

**Verified** — Apple In-App Purchase via StoreKit is the payment path on iOS
(implied by App Store IAP listing) [S1]. No third-party payment surface is
documented.

## Offline behavior

**Strongly inferred** — core running gameplay is designed to work fully
offline (common for this genre, and consistent with an ad-supported model
that must gracefully degrade when no ad fill is available); purchases,
leaderboard sync, and ad delivery require connectivity.

## Notifications

**Strongly inferred** — push notifications for re-engagement (new World Tour
city, event start/end, energy-free daily bonus reminders) are standard in
this genre; not separately confirmed by an official source in this pass.

## Sharing/export

**Strongly inferred (absence)** — no evidence of score-sharing, replay export,
or social sharing surface was found in the sources consulted.

## Integrations

**Verified** — branded IP collaborations appear as limited-time in-game
content (e.g., Among Us characters) [S1]. No documented third-party account
linking beyond platform services (Game Center / Google Play Games, inferred).

## AI features

**Strongly inferred (absence)** — no generative AI, chatbot, or AI-driven
content-creation feature is documented for Subway Surfers in any source
consulted. The game's "intelligence" is procedural obstacle generation and
(plausibly) server-tuned difficulty, not user-facing AI.

## Privacy/safety

**Verified, with a documented gap** — SYBO's stated privacy policy claims no
PII collection from children, no targeted advertising to under-16 users, and
local-only data storage for under-13 players, framed as COPPA compliance.
[S6] However, a class-action complaint alleges third-party advertising/
analytics SDKs embedded in the game (naming several ad-tech vendors)
collected persistent identifiers and cross-app behavioral data from children
regardless of the stated policy. [S6] This is treated as a **Verified**
finding about what was *alleged and reported*, not a verified finding that
the underlying conduct occurred — but it is strong evidence that a written
child-privacy policy is not sufficient without technical/SDK-level
enforcement, and directly informs [[08_SAFETY_PRIVACY_COMPLIANCE]] for
Skyline Rush.

## Admin/parent/professional functions

**Strongly inferred (absence)** — no parental-control or parent-dashboard
surface is documented in any source consulted; industry norm for a non-Kids-
Category, 9+-rated app is to rely on OS-level parental controls (Screen Time,
Ask to Buy) rather than an in-app parent mode.

## Strengths (of the reference)

- Extremely low-friction core loop: one gesture set, instant restart, no
  mandatory tutorial gate.
- Long-tail content cadence (monthly World Tour) sustains a 14-year live
  service.
- Broad platform reach (iOS/Android/web/tablet) maximizes audience.
- Strong brand recognition and IP collaborations extend reach without
  requiring the core game to change.

## Weaknesses / opportunities

- **Child-privacy enforcement gap** (the alleged SDK behavior above) is the
  clearest opportunity: Skyline Rush should treat under-13/under-16 data
  handling as an enforced platform boundary, not a policy statement. See
  [[08_SAFETY_PRIVACY_COMPLIANCE]].
- **Opaque randomized rewards** (Mystery Box) draw regulatory scrutiny in
  several jurisdictions (loot-box disclosure laws, Belgium/China-style
  restrictions). Opportunity: ship a transparent-odds "Supply Drop" with a
  published probability table, addressed as a differentiator in
  [[01_PRD]] and [[11_MONETIZATION_AND_BILLING]].
- **No documented social competition** (no friends leaderboard/ghost race
  found in research). Opportunity: add lightweight async social features
  without introducing chat/UGC risk — friend leaderboards and ghost replays,
  see [[01_PRD]] differentiators.
- **Escalating pay-to-continue cost** inside a single run can read as
  aggressive monetization pressure at a failure moment. Opportunity: cap the
  escalation and always offer a free rewarded-ad path, addressed in
  [[11_MONETIZATION_AND_BILLING]].
- Metacritic reception (71/100) cites monotonous environments and control
  responsiveness as recurring critic complaints [S2] — opportunity to invest
  in per-district visual variety and tighter input latency from the start.

## Originality boundaries for Skyline Rush

Every theme, character name, currency name, and system name below this
heading is a **Proposed** design decision for the new product, not a claim
about Subway Surfers — see the evidence-class definitions in [[SOURCES]] and
`references/research-method.md`. Skyline Rush is an original product. It
preserves the *implementable pattern*
(3-lane swipe-based endless running; soft + semi-premium currency pair; a
revive-for-currency mechanic; rotating themed content seasons; daily/weekly
challenge structures; character and vehicle-equivalent collection) but does
**not** reuse Subway Surfers' names, characters (Jake, Tricky, Fresh, the
Inspector, the dog), setting (subway/graffiti), art direction, mascot design,
audio, or specific district/city names. See [[01_PRD]] for the original
theme (rooftop courier vs. drone enforcement in the fictional Vantage City)
and original systems naming (Chips/Cores, Grav-Board, Supply Drop, District
Rotation, Skyline Pass).
