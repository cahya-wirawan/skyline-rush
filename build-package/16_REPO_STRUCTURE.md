# 16 Repository Structure — Skyline Rush

Two repositories (client and backend) sharing a third, small contracts
package, to let the Unity project and the NestJS services release
independently — matching the decoupled deploy cadence described in
[[04_SYSTEM_ARCHITECTURE]] (content/backend ship without app releases).

```text
skyline-rush-client/                 # Unity project (C#), iOS/iPadOS
├── Assets/
│   ├── Scripts/
│   │   ├── Run/                     # lane/input/collision/power-up state machine
│   │   ├── ProceduralGen/           # segment selector, path-validity checks
│   │   ├── Meta/                    # Hub, Shop, Roster, Contracts, Leaderboard, Settings UI
│   │   ├── Networking/              # API client, JWT/refresh handling, outbox
│   │   ├── Storage/                 # SQLite local store, Keychain wrapper
│   │   ├── Billing/                 # StoreKit 2 wrapper
│   │   ├── Ads/                     # ad mediation wrapper w/ age-bucket gating
│   │   └── Analytics/               # consent-gated event emission
│   ├── Content/
│   │   ├── Districts/<district_id>/ # segment templates, art, audio (per-District addressable bundle)
│   │   └── Shared/                  # Runner/Board models, UI atlas, shared VFX
│   └── Tests/                       # EditMode + PlayMode test suites
├── Packages/                        # Unity package manifest (StoreKit, GameKit bridges, etc.)
├── fastlane/                        # TestFlight/App Store submission automation
├── ci/                              # CI pipeline definitions (lint, test, build, submit)
└── README.md

skyline-rush-backend/                # NestJS (TypeScript) monorepo, one deployable per service
├── apps/
│   ├── gateway/
│   ├── profile-auth/
│   ├── economy/
│   ├── leaderboard/
│   ├── liveops/
│   ├── billing/
│   ├── notification/
│   └── run-integrity/
├── libs/
│   ├── db/                          # PostgreSQL schema, migrations (expand/contract)
│   ├── shared-types/                # generated from skyline-rush-contracts
│   ├── auth/                        # JWT verification, age-bucket claim helpers
│   └── testing/                     # shared integration-test harness (Docker Compose fixtures)
├── admin-tool/                      # internal LiveOps/Trust & Safety web app, separate auth
├── infra/                           # IaC for containers, PostgreSQL, Redis, CDN config
├── ci/
└── README.md

skyline-rush-contracts/              # OpenAPI spec (source of [[06_API_SPEC]]) + shared enums
├── openapi.yaml
├── schemas/
│   └── supply-drop-table.schema.json
└── README.md
```

## Boundaries

- The client never contains business logic that can grant currency or
  entitlements on its own — every economy-affecting path round-trips
  through `skyline-rush-backend`, per [[04_SYSTEM_ARCHITECTURE]] storage
  ownership rules.
- `admin-tool` is a separate authenticated surface (company SSO, not player
  auth) and is deployed independently from the player-facing `gateway`.
- `skyline-rush-contracts` is the single source of truth for the API shape;
  both the client's networking layer and the backend's `libs/shared-types`
  are generated from it in CI, preventing drift from
  [[06_API_SPEC]].
- Content (`Assets/Content/Districts/<id>/`) is authored and versioned
  separately from code — a District publish (see FR-011) never requires a
  client binary rebuild, only a new content-bundle version referenced by
  `liveops`.
