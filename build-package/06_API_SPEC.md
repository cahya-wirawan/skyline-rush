# 06 API Specification — Skyline Rush

REST over HTTPS, JSON bodies, base path `/v1`. All endpoints require a Bearer
JWT (guest or Apple-linked session) issued by the Profile & Auth Service
except `POST /v1/auth/guest` and `POST /v1/auth/apple`.

## Versioning

Path-based (`/v1/...`). Breaking changes ship as `/v2/...` with the prior
version supported for a documented deprecation window (minimum 90 days after
a new client version using `/v2` reaches majority adoption).

## Auth

- `Authorization: Bearer <jwt>` header on every authenticated call.
- Access tokens are short-lived (15 min); a refresh token (stored in device
  Keychain) exchanges for a new access token via `POST /v1/auth/refresh`.
- Full flow detail in [[09_AUTH_AND_PERMISSIONS]].

## Idempotency

Every mutating endpoint that grants currency, records a run, or applies a
purchase requires an `Idempotency-Key` header (client-generated UUID). A
repeated request with the same key and same authenticated player returns the
original result (200) rather than re-applying the mutation.

## Pagination

Cursor-based: `?cursor=<opaque>&limit=<n, default 25, max 100>`. Responses
include `next_cursor` (null when exhausted).

## Rate limits

Per-account: 60 requests/minute general, 10/minute on purchase-adjacent
endpoints. Per-IP: 300 requests/minute at the Gateway. Exceeding a limit
returns `429` with `Retry-After`.

## Error format

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Not enough Cores for this Redeploy.",
    "details": { "required": 20, "available": 12 }
  }
}
```

Codes are stable, machine-checkable strings (e.g. `VALIDATION_ERROR`,
`INSUFFICIENT_BALANCE`, `IDEMPOTENCY_CONFLICT`, `RECEIPT_INVALID`,
`RATE_LIMITED`, `NOT_FOUND`, `AGE_GATE_REQUIRED`).

---

## Endpoints

### `POST /v1/auth/guest`
Creates or resumes a guest session from a device-generated identifier.

Request:
```json
{ "guest_device_id": "b3f1...uuid", "age_bucket": "13_15" }
```
Response `200`:
```json
{ "player_id": "6c2a...uuid", "access_token": "...", "refresh_token": "..." }
```

### `POST /v1/auth/apple`
Links or resumes via Sign in with Apple.

Request: `{ "identity_token": "<apple JWT>", "guest_device_id": "b3f1...uuid" }`
Response `200`: same shape as `/auth/guest`; merges guest progress into the
Apple-linked profile if this is a first link (see [[03_USER_FLOWS]] §4).

### `POST /v1/auth/refresh`
Request: `{ "refresh_token": "..." }` → Response `200`: `{ "access_token": "..." }`.

### `GET /v1/profile`
Response `200`:
```json
{
  "player_id": "6c2a...uuid",
  "display_name": "Runner#4821",
  "age_bucket": "13_15",
  "equipped": { "runner_id": "vex", "board_id": "ion-glide" }
}
```

### `POST /v1/runs`
Submits a completed run. Idempotency-Key required.

Request:
```json
{
  "district_id": "neo-marina",
  "runner_id": "vex",
  "board_id": "ion-glide",
  "meters": 4820,
  "chips_collected": 612,
  "crashed_cause": "drone_collision",
  "client_submitted_at": "2026-08-31T10:15:02Z"
}
```
Response `201`:
```json
{
  "run_id": "9a1c...uuid",
  "integrity_flag": "ok",
  "rewards": { "chips_granted": 612, "cores_granted": 0, "pass_xp_granted": 48 },
  "new_district_best": false
}
```
Errors: `400 VALIDATION_ERROR` (implausible values), `409
IDEMPOTENCY_CONFLICT` (key reused with a different body).

### `POST /v1/runs/{run_id}/redeploy`
Idempotency-Key required.

Request: `{ "method": "cores" }` or `{ "method": "ad", "ad_receipt": "..." }`
Response `200`: `{ "cores_spent": 20, "cores_remaining": 55 }`
Errors: `402 INSUFFICIENT_BALANCE`, `409` if the run already ended server-side.

### `GET /v1/economy/balance`
Response `200`: `{ "chips": 15234, "cores": 55 }`

### `GET /v1/economy/ledger?cursor=&limit=`
Response `200`: `{ "items": [ { "entry_id": "...", "currency": "chips",
"delta": 612, "reason": "run_pickup", "created_at": "..." } ], "next_cursor": null }`

### `POST /v1/contracts/{contract_id}/claim`
Idempotency-Key required. Response `200`: `{ "reward": { "chips": 200 },
"contract_id": "daily_2026_08_31_a" }`. Errors: `409` if not yet completed.

### `GET /v1/contracts/active`
Response `200`: `{ "daily": [ {...3 items...} ], "weekly_heist": {...or null} }`

### `GET /v1/supply-drops/tables/{table_id}`
Publicly readable odds table (no odds are ever hidden behind an open action).
Response `200`:
```json
{
  "table_id": "standard-v7",
  "version": 7,
  "entries": [
    { "reward": "chips_small", "probability": 0.55 },
    { "reward": "cores_small", "probability": 0.25 },
    { "reward": "cosmetic_trail_rare", "probability": 0.05 },
    { "reward": "board_epic", "probability": 0.02 },
    { "reward": "chips_medium", "probability": 0.13 }
  ]
}
```

### `POST /v1/supply-drops/open`
Idempotency-Key required. Request: `{ "acquired_via": "earned" }` (or
`"purchased"`, which requires a prior validated `Purchase` of the matching
SKU). Response `200`: `{ "open_id": "...", "table_id": "standard-v7",
"table_version": 7, "result": { "reward": "cores_small", "amount": 15 } }`

### `GET /v1/roster`
Response `200`: `{ "runners": [ {"id":"vex","owned":true,"equipped":true} ],
"boards": [ {"id":"ion-glide","owned":true,"equipped":true} ] }`

### `POST /v1/roster/equip`
Request: `{ "item_type": "runner", "item_id": "vex" }` → `200 { "ok": true }`

### `POST /v1/roster/unlock`
Idempotency-Key required. Request: `{ "item_type": "board", "item_id":
"quantum-drift", "method": "cores" }` → `200` with updated balance, or
`402 INSUFFICIENT_BALANCE`.

### `GET /v1/leaderboard?scope=global|friends&district_id=&cursor=&limit=`
Response `200`:
```json
{
  "items": [ { "rank": 1, "player_id": "...", "display_name": "Runner#12", "meters": 9880 } ],
  "self_rank": { "rank": 4821, "meters": 4820 },
  "next_cursor": "opaque-cursor-2"
}
```

### `POST /v1/friends/add`
Request: `{ "method": "friend_code", "code": "SKY-7Q2X" }` → `201` or `404
NOT_FOUND`.

### `POST /v1/purchases/receipt`
Idempotency-Key required. Request: `{ "sku": "cores_pack_medium",
"transaction_id": "1000000123456789", "signed_transaction": "<StoreKit 2 JWS>" }`
Response `200` after server-side App Store Server API validation:
```json
{ "status": "granted", "entitlement": { "cores": 500 } }
```
Errors: `422 RECEIPT_INVALID`, `409 IDEMPOTENCY_CONFLICT` if
`transaction_id` was already granted (hard duplicate-grant protection).

### `POST /v1/privacy/export` and `POST /v1/privacy/delete`
Both require the parental-gate flag `parental_gate_passed: true` in the
request body for `under_13`-bucketed accounts (server re-validates this
server-side, not merely client-asserted). Response `202 Accepted` with a
tracking ID; export delivers a signed, expiring download link via the
notification channel appropriate to the account.

## Webhooks

`POST` (inbound, from Apple) — App Store Server Notifications V2 received at
a dedicated, signature-verified endpoint (`/v1/webhooks/apple`), used to
process refunds, revocations, and subscription-state changes for the (P1)
Skyline Pass if it ships as a renewing product; every notification is
verified against Apple's signed payload before any entitlement change.
