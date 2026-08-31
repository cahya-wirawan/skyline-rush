# 10 Offline, Sync & Storage — Skyline Rush

## Offline capabilities

The core run loop (S03) is fully playable offline, matching the reference's
inferred offline-first design for its central mechanic (see
[[00_REFERENCE_ANALYSIS]]). Browsing owned Roster items, viewing cached
Contracts/leaderboard, and adjusting local settings all work offline.
Anything requiring server authority — purchases, unlock-via-currency where
the balance isn't yet confirmed server-side, ad-fill checks, friend
add/leaderboard refresh — is clearly labeled "requires connection" rather
than silently failing (see per-screen Offline states in
[[02_UX_SCREEN_SPEC]]).

## Cache

- **Content bundles** (District assets, audio, current Contract/Season
  definitions): cached to device storage with a version tag; a new version
  is fetched opportunistically on Hub load when online, and the last-known-
  good version is always retained until the new one is fully verified
  (checksum match) — a corrupt or partial download never replaces a working
  cached bundle.
- **Economy/profile snapshot**: last-synced balances, ownership, and
  Contract progress are cached locally so the Hub renders immediately on
  cold start even before the network round-trip completes (see S02 Loading
  state).

## Sync: the outbox

Every mutating action performed while offline (or while a request is
in-flight and might fail) is appended to a local, append-only **outbox**
queue with:
- a client-generated `idempotency_key`,
- the target endpoint and payload,
- a monotonic local sequence number (to preserve ordering, since a Redeploy
  spend must apply before the Run Summary reward grant it depends on).

On connectivity (foreground, network-state change, or periodic background
check), the outbox flushes **in sequence order**, one in-flight request at a
time per player, using each entry's `idempotency_key`. A successfully
acknowledged entry is removed; a `409 IDEMPOTENCY_CONFLICT` (meaning the
server already has a different result for that key — should not normally
happen since keys are client-generated per-action) is logged and surfaced
to Trust & Safety tooling rather than silently retried forever.

## Conflict resolution

Because the server is the sole source of truth for economy balances and
ownership (see [[05_DATA_MODEL]]), "conflict resolution" in practice means
**reconciliation, not merging**: the client's optimistic local totals (shown
immediately in S10 Run Summary with a "sync pending" badge) are replaced by
the server's authoritative totals once the outbox entry is acknowledged. The
one design guarantee: the server-reconciled total is never *lower* than what
was already granted and shown to the player without an explicit, visible
explanation (e.g., a Run-Integrity exclusion is shown as "this run's score
wasn't counted — here's why," never a silent downward balance correction).

If two devices for the same linked account submit runs while both were
offline, both runs are accepted (they don't conflict — each is an
independent Run row); only leaderboard "best" and Season Pass XP totals
require ordering, and those are computed idempotently from the full set of
accepted runs, so submission order across devices doesn't produce a
different final total.

## Media downloads

District content bundles (models, textures, audio) download over Wi-Fi by
default with an explicit user-controlled setting to allow cellular
downloads above a size threshold; a bundle mid-download does not block
gameplay in the currently-active District.

## Storage limits

- Local SQLite store: bounded (outbox capped at 500 pending entries; beyond
  that, oldest non-economy-critical entries such as stale analytics batches
  are dropped first, never a pending currency-affecting entry).
  If the cap is reached on economy-critical entries specifically, further
  offline play continues but the client surfaces a persistent "please
  reconnect to save your progress" banner rather than silently discarding
  entries.
- Content bundle cache: capped per device available storage; least-recently-
  used non-active-District bundles are evicted first, re-fetched on demand.

## Entitlement grace

If the Billing service is briefly unreachable when a player who already
owns an item (e.g., "remove interstitials") launches the app, the client
trusts its last-synced entitlement cache for up to 72 hours before
re-requiring a server confirmation — so a transient backend issue never
mid-session revokes something the player already paid for. Beyond 72 hours
offline, entitlement-gated content (e.g., ad suppression) reverts to the
safe default (ads shown) until reconnection, rather than silently staying
unlocked indefinitely without server confirmation.
