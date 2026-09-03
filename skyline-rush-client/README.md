# Skyline Rush Client

Unity (C#) client project architecture and playable web runner for Skyline Rush (iOS/iPadOS).

## Structure & Modules

- `Assets/Scripts/Run/`: 3-lane state machine (`LaneStateMachine.cs`), 150ms input buffer (`InputBuffer.cs`), jump & slide controller with parabolic arc and fast-fall (`JumpSlideController.cs`), power-up state machine (`PowerUpStateMachine.cs`), continuous coordinate obstacle collision detection (`ObstacleCollisionHandler.cs`), and session coordinator (`RunSession.cs`).
- `Assets/Scripts/ProceduralGen/`: Seeded deterministic procedural track generator (`ProceduralTrackGenerator.cs`) with BFS lookahead survivability proof (`SurvivablePathValidator.cs`) and breathing room enforcement.
- `Assets/Scripts/Storage/`: Persistent file-backed storage (`SQLiteStorageLayer.cs`), Keychain wrapper (`KeychainWrapper.cs`), and bounded 500-entry FIFO queue (`OutboxQueue.cs`).
- `Assets/Scripts/Networking/`: REST API client (`ApiClient.cs`), network DTOs, and outbox syncer (`OutboxSyncer.cs`) with non-retryable 4xx dead-lettering and non-destructive balance reconciliation.
- `Assets/Scripts/Ads/` & `Analytics/`: Server-enforced age-bucket gating (`AdMediationWrapper.cs`) and telemetry suppression for minor accounts (`AnalyticsManager.cs`).
- `Assets/Scripts/Meta/`: Hub view controller, Run HUD, Redeploy modal (10 -> 20 -> 40 Cores escalation, 1 free ad revive), and Run Summary.
- `Assets/Scripts/Views/`: Unity `MonoBehaviour` views (`RunnerView.cs`, `TrackSegmentView.cs`, `HubViewController.cs`, `AudioCueManager.cs`).
- `web/`: Full playable HTML5 Canvas & WebGL runner (`index.html`, `style.css`, `game.js`) simulating the 3-lane Vantage City rooftop gameplay and live-connected to the backend REST API Gateway (`/v1/*`).
- `simulation-runner/`: Automated simulation runner (`run-simulation.js`) validating Acceptance Criteria AC-13, AC-14, AC-15, and AC-16.

## Running Tests

Run the client simulation suite:
```bash
npm test
```

## Running the Playable Web Client

The web client can be played directly by launching the backend Gateway (which hosts the static client on port 3000):
```bash
cd ../skyline-rush-backend
npx ts-node -r tsconfig-paths/register apps/gateway/main.ts
```
Then visit **http://localhost:3000** in your browser.
