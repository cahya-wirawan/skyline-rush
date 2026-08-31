# Sources

Research date: 2026-08-31. All sources accessed on this date unless noted. Per
the research method, dates for current product behavior are recorded exactly;
where the source describes a version/date that may be stale relative to the
live app, that is called out below.

| # | Name | URL / Artifact | Access date | What it supports |
|---|---|---|---|---|
| S1 | App Store listing — Subway Surfers | https://apps.apple.com/us/app/subway-surfers/id512939461 | 2026-08-31 | Category (Action), age rating (9+), developer (Sybo Games ApS), app size, supported languages, in-app purchase price list, ratings volume, latest version notes ("Cosmic Crossroads" world, Among Us collaboration), App Privacy "data collected" declarations (purchases, location, user content, identifiers, usage data, diagnostics; tracking + third-party advertising + analytics + app functionality). |
| S2 | Wikipedia — Subway Surfers | https://en.wikipedia.org/wiki/Subway_Surfers | 2026-08-31 | Original release date (2012-05-24), developers/publishers (Kiloo, then SYBO Games), platform list, Unity engine, core swipe-based gameplay description, freemium + optional ad-revive business model, Metacritic reception (71/100), download milestones (1B on Google Play by March 2018; 2.7B by December 2019), World Tour monthly rotation since January 2013, Daily Challenges, Season Hunts, 18+ unlockable characters, 2018 animated series, 2022 Apple Arcade spin-off, sequel ("Subway Surfers City") announced for February 2026. |
| S3 | Google Play / App Store search results — "Subway Surfers City" | https://apps.apple.com/us/app/subway-surfers-city/id6504188939 ; https://www.businesswire.com/news/home/20260115285583/en/SYBO-Announces-Subway-Surfers-City-The-Long-Awaited-Next-Chapter-to-Subway-Surfers | 2026-08-31 | Confirms a distinct sequel/evolution, "Subway Surfers City," launched circa February 2026, free-to-download with IAP, new districts/XP/exploration mechanics, Secret Stars, character/board power-ups (coin magnets, bouncy shields). Used only to flag that the franchise is mid-transition as of the research date — the classic endless-runner title (S1/S2) is treated as the primary reference for this blueprint since that is the enduring, widely-documented "Subway Surfers" gameplay pattern the user named. |
| S4 | Web search — SYBO Games / official site | https://subwaysurfers.com/ ; https://sybogames.com/ ; https://subwaysurf.fandom.com/wiki/SYBO_Games | 2026-08-31 | Studio identity (SYBO Games, Copenhagen, Denmark), confirms swipe controls (up/down/left/right), "new city every month" World Tour framing, official homepage existence. |
| S5 | Web search — revive/keys/mystery box mechanics | https://subwaysurf.fandom.com/wiki/Key ; https://subwaysurf.fandom.com/wiki/Mystery_Box ; https://theriagames.com/guide/subway-surfers-mystery-box/ ; https://subway-surfer-city.fandom.com/wiki/Revive | 2026-08-31 | Community-documented mechanics: Keys used to pay an escalating cost to revive after a crash; first daily rewarded-ad view grants free Keys; Mystery Box grants randomized Coins/Keys/Hoverboards/power-ups; Hoverboard rewards can be doubled via rewarded ad. Treated as **strongly inferred** (fan wiki / community source, not an official SYBO document) rather than verified, since it is not from SYBO or Apple directly. |
| S6 | Web search — privacy policy and litigation | https://sybogames.com/privacy-policy/ ; https://www.gamedeveloper.com/business/parents-take-i-subway-surfers-i-devs-to-court-over-alleged-misuse-of-kids-data ; https://topclassactions.com/lawsuit-settlements/lawsuit-news/subway-surfers-class-action-alleges-app-illegally-collected-childrens-data/ | 2026-08-31 | SYBO's stated privacy policy claims (no PII collection from children, no targeted ads under 16, under-13 data stored locally only, COPPA compliance claimed). Also documents a class-action lawsuit alleging third-party ad/analytics SDKs embedded in the game extracted children's persistent identifiers for commercial use despite these stated policies. Used directly to inform [[08_SAFETY_PRIVACY_COMPLIANCE]] — this is the single most load-bearing piece of research in this package: it shows a stated child-privacy policy is not sufficient without SDK-level enforcement. |
| S7 | Apple platform documentation (general knowledge, not fetched this session) | App Store Server API, StoreKit 2, Sign in with Apple, Game Center, App Store Review Guidelines | Not re-verified this session | Background for [[04_SYSTEM_ARCHITECTURE]], [[09_AUTH_AND_PERMISSIONS]], [[11_MONETIZATION_AND_BILLING]]. Flagged as an open item in [[21_RISKS_AND_OPEN_QUESTIONS]] to re-verify exact current API names/availability (e.g. any Apple "declared age range" style API) against developer.apple.com before implementation, since Apple platform APIs change independently of the reference game and were not re-fetched in this research pass. |

## Evidence class summary

- **Verified** (S1, S2, S3, S4, S6 official-policy claims): directly observable on the
  App Store listing, Wikipedia's sourced summary, SYBO's own site/policy text, and
  contemporaneous reporting on the class action.
- **Strongly inferred** (S5): fan-wiki-documented mechanics that are consistent
  with the genre and widely reported but not confirmed on an official SYBO page
  in this research pass.
- **Proposed**: everything specific to Skyline Rush's own theme, characters,
  district names, currency names, and systems — these are original design
  decisions, not claims about Subway Surfers, and are labeled as such throughout
  [[00_REFERENCE_ANALYSIS]] and [[01_PRD]].
