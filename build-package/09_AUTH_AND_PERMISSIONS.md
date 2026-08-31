# 09 Auth & Permissions — Skyline Rush

## Auth strategy

- **Default: device-anonymous guest.** On first launch the client generates
  a local UUID (`guest_device_id`), sent to `POST /v1/auth/guest` (see
  [[06_API_SPEC]]) to receive a `player_id` and JWT pair. No credential is
  ever asked of the player to start playing.
- **Optional upgrade: Sign in with Apple.** Adds cloud save/cross-device
  restore by linking Apple's opaque per-app relay user ID to the existing
  guest profile. No email or real name is requested even when Apple offers
  to share one (the app does not request the `email`/`fullName` scopes at
  all — only the base identity token needed to obtain the opaque user ID).
- **No email/password system.** Deliberately omitted to minimize PII
  surface and credential-management burden, consistent with the reference's
  apparent lack of a documented account system (see
  [[00_REFERENCE_ANALYSIS]]).
- **Game Center** is used optionally for the friends-leaderboard social
  graph (FR-007), not as a login system.

## Roles

| Role | Applies to | Capabilities |
|---|---|---|
| Guest player | Any unlinked install | Full gameplay, local-only progress persistence |
| Linked player | Guest who added Sign in with Apple | Full gameplay + cloud save/restore across devices |
| Age-bucket: under_13 | Any account | As above, minus unrestricted ad personalization; purchases and age-bucket changes require the parental gate |
| Age-bucket: 13_15 | Any account | As above; no ad personalization; standard purchase flow (parental gate not required by product policy, though platform-level Ask to Buy may still apply per the device owner's settings) |
| Age-bucket: 16_plus | Any account | Full experience, standard ad personalization consent flow |
| LiveOps operator | Internal staff | Author/stage/publish District content, Contracts, Season Pass tables, Supply Drop tables — via an internal admin tool, never via the player-facing API |
| Support/Trust & Safety staff | Internal staff | Read player support tickets, action data export/delete requests, review Run-Integrity flags — no direct database write access outside the admin tool's audited actions |

There is no in-game "admin" or "parent" role exposed to players; parental
oversight is implemented via the parental gate (a challenge, not an
account role) and standard OS-level controls (Screen Time, Ask to Buy),
consistent with the reference's apparent lack of an in-app parent dashboard
(see [[00_REFERENCE_ANALYSIS]]).

## Permission matrix

| Action | Guest | Linked, 16+ | Linked, 13–15 | Linked, under 13 | LiveOps operator |
|---|---|---|---|---|---|
| Play core loop | ✅ | ✅ | ✅ | ✅ | — |
| View leaderboard | ✅ | ✅ | ✅ | ✅ | — |
| Add friend | ✅ | ✅ | ✅ | ✅ | — |
| Make a purchase | ✅ (device owner's Apple ID) | ✅ | ✅ | ✅, parental gate required | — |
| Change age bucket | ✅ (no prior consent to protect) | ✅ | ✅ | Parental gate required | — |
| Receive personalized ads | ✅ default until bucket set | ✅ with consent | ❌ (policy: no ad personalization under 16) | ❌ | — |
| Export/delete own data | ✅ | ✅ | ✅ | Parental gate required | — |
| Publish District content | ❌ | ❌ | ❌ | ❌ | ✅ |
| Adjust DDA weight tables | ❌ | ❌ | ❌ | ❌ | ✅ (with review, see [[07_AI_OR_AUTOMATION_PIPELINE]]) |
| View another player's PII | ❌ | ❌ | ❌ | ❌ | ❌ (Trust & Safety sees only ticket-scoped data via audited tooling) |

## Sessions / tokens

- Access token: JWT, 15-minute expiry, contains `player_id` and
  `age_bucket` claims (never raw birth year), signed by the Profile & Auth
  Service.
- Refresh token: opaque, long-lived, stored in device Keychain (not
  UserDefaults/plist), rotated on each use (refresh-token rotation with
  reuse detection — a reused old refresh token revokes the whole token
  family and forces re-auth, guarding against token theft).
- Server holds no session-affinity requirement; any Gateway instance can
  validate the JWT statelessly.

## Token storage

- Client: Keychain for the refresh token, in-memory only for the access
  token (never persisted to disk).
- Server: refresh-token hashes (not raw tokens) stored in PostgreSQL,
  keyed by player_id and device_id, to support "sign out this device"
  without needing the raw token to compare.

## SSO / passwordless

Sign in with Apple is the only SSO provider (Apple platform-native, no
Google/Facebook login, minimizing the number of third-party identity
processors on a product with child users). Fully passwordless — there is no
password anywhere in this system.

## Admin boundaries

The internal LiveOps admin tool is a separate authenticated surface (SSO via
the company's own identity provider, not player auth), network-restricted,
and every publish/adjust action is written to an append-only audit log
(actor, timestamp, before/after diff) — required specifically because this
tool can change Supply Drop odds and DDA weights, both of which must be
auditable against what a player actually experienced (see
[[05_DATA_MODEL]] `SupplyDropOpen.table_version` pinning).

## Parental gates

Defined fully in [[02_UX_SCREEN_SPEC]] S04A and enforced both client-side
(UX) and server-side (`/v1/purchases/receipt` and `/v1/privacy/*` reject a
`under_13`-bucketed request lacking a valid, recently-passed parental-gate
token) — the server never trusts a client-only assertion that the gate was
passed, closing the exact class of gap implicated in the reference's
child-privacy litigation (see [[08_SAFETY_PRIVACY_COMPLIANCE]]).
