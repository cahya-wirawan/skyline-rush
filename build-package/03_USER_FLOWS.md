# 03 User Flows — Skyline Rush

All flows are Proposed original UX. Screen IDs reference [[02_UX_SCREEN_SPEC]].

## 1. First run (onboarding)

```mermaid
flowchart TD
    A[App install & launch] --> B[S01 Splash]
    B --> C{First launch?}
    C -- yes --> D[S00A Age Gate]
    D --> E[Bucket computed locally + queued to server]
    C -- no --> F[S02 Main Hub]
    E --> F
    F --> G[Contextual swipe-to-play prompt overlays first S03 run]
    G --> H[S03 Run]
```

No modal tutorial blocks play — the first run itself teaches the controls via
low-obstacle-density onboarding content in the starter District (a Proposed
design choice consistent with the reference's documented low-friction
onboarding pattern).

## 2. Primary happy path (a single run)

```mermaid
flowchart TD
    A[S02 Main Hub] --> B[Tap RUN]
    B --> C[S03 Run]
    C --> D{Crash?}
    D -- no, player quits via pause --> E[S03A Pause -> Quit]
    D -- yes --> F[S09 Redeploy Offer]
    F -- redeploy used --> C
    F -- declined/unavailable --> G[S10 Run Summary]
    E --> G
    G --> H{Run again?}
    H -- yes --> C
    H -- no --> A
```

## 3. Creation/edit-equivalent path: Roster equip & unlock

```mermaid
flowchart TD
    A[S02 Main Hub] --> B[S05 Roster]
    B --> C{Item owned?}
    C -- yes --> D[Equip]
    D --> A
    C -- no --> E{Unlock method}
    E -- Chips/Cores balance sufficient --> F[Spend currency, unlock, equip]
    E -- insufficient balance --> G[S04 Shop]
    G --> H[Purchase currency or bundle]
    H --> F
    F --> A
```

## 4. Auth: guest to linked account

```mermaid
flowchart TD
    A[First launch] --> B[Device-anonymous guest session created automatically]
    B --> C[Full gameplay + local progress]
    C --> D{Player opts to link, from S08 Settings}
    D -- Sign in with Apple --> E[Apple auth sheet]
    E --> F[Server links Apple opaque user ID to existing guest profile]
    F --> G[Cloud save enabled; guest data preserved, not overwritten]
    D -- declines --> C
```

Failure/recovery: if linking fails mid-flow (network drop, Apple auth
cancel), the guest profile is untouched and no partial link state is
persisted — see [[09_AUTH_AND_PERMISSIONS]].

## 5. Purchase flow (with parental gate)

```mermaid
flowchart TD
    A[S04 Shop] --> B[Tap a SKU]
    B --> C{Age bucket = under 13?}
    C -- yes --> D[S04A Parental Gate]
    D -- pass --> E[StoreKit purchase sheet]
    D -- fail/cancel --> A
    C -- no --> E
    E -- user completes purchase --> F[Receipt sent to backend]
    F --> G[Server validates receipt via App Store Server API]
    G -- valid --> H[Entitlement granted, balances updated]
    G -- invalid/duplicate --> I[Purchase rejected, no entitlement, user notified]
    E -- user cancels --> A
```

## 6. Offline play and recovery

```mermaid
flowchart TD
    A[S03 Run, no connectivity] --> B[Run completes fully client-side]
    B --> C[Result queued in local outbox with idempotency key]
    C --> D[S10 Run Summary shows optimistic totals + sync-pending badge]
    D --> E{Connectivity restored?}
    E -- yes --> F[Outbox flushed in order to backend]
    F --> G[Server reconciles; any discrepancy silently corrected, never reduces below the optimistic local grant without an explanation banner]
    E -- no, next app launch still offline --> H[Outbox persists, retried on each launch/foreground]
```

Full detail on the outbox mechanism and conflict resolution in
[[10_OFFLINE_SYNC_AND_STORAGE]].

## 7. Error path: ad fill failure during Redeploy

```mermaid
flowchart TD
    A[S09 Redeploy Offer] --> B[Background ad-fill check]
    B -- ad available --> C[Watch-ad option enabled]
    B -- no fill / SDK error --> D[Watch-ad option shown disabled, reason stated]
    C --> E{Player watches?}
    E -- completes --> F[Redeploy granted]
    E -- skips/closes early --> G[No redeploy granted, no partial charge]
    D --> H[Core-spend option remains available if balance sufficient]
```

## 8. Data deletion / export

```mermaid
flowchart TD
    A[S08 Settings] --> B{Under-13 bucket?}
    B -- yes --> C[S04A Parental Gate]
    B -- no --> D[Confirm intent, double-confirmation dialog]
    C -- pass --> D
    D --> E[Request submitted to backend with account/device ID]
    E --> F[Export: signed download link emailed if account linked, or shown in-app for guest device pairing]
    E --> G[Delete: account + PII scheduled for erasure per retention policy]
    G --> H[Confirmation shown; local data wiped immediately regardless of server completion]
```

Retention/erasure timelines defined in [[08_SAFETY_PRIVACY_COMPLIANCE]].

## 9. Admin/live-ops: District Rotation publish (operator-facing, P1)

```mermaid
flowchart TD
    A[LiveOps operator authors District content bundle] --> B[Content validated in staging: asset integrity, obstacle-pattern safety checks]
    B --> C[Signed bundle uploaded to CDN behind a version tag]
    C --> D[Remote config flips active District for a cohort or 100% of players]
    D --> E[Clients fetch new bundle on next Hub load; falls back to last-known-good bundle on fetch failure]
    E --> F[Rollback: remote config reverts version tag, no client update required]
```
