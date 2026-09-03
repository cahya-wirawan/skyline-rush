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
- `web/`: Full playable HTML5 Canvas & Web Audio runner (`index.html`, `style.css`, `game.js`) simulating the 3-lane Vantage City rooftop gameplay and live-connected to the backend REST API Gateway (`/v1/*`).
- `simulation-runner/`: Automated simulation runner (`run-simulation.js`) validating Acceptance Criteria AC-13, AC-14, AC-15, and AC-16.

---

## Playable Web Client Features (`web/`)

- **Phase 2 Meta UI Screens**:
  - **S04 Shop**: Cores crates (50, 120, 260, 600, 1400 Cores), Supply Drops, and Daily Specials (`starter_pack`, `remove_interstitials`).
  - **S04A Parental Gate**: Accessible numeric PIN pad and server-signed arithmetic challenge verification required for minor purchases and GDPR actions.
  - **S05 Roster & Customization**: Courier (Vex, Kael, Aria) and Grav-Board (Ion Glide, Pulse Ray, Vortex Breaker) selection carousel with atomic Cores unlocks.
  - **S06 Contracts**: Dedicated daily and weekly courier missions screen with real-time objective tracking and idempotent reward claiming.
  - **S08 Settings & GDPR**: SFX/Music volume sliders, Friend Code sharing/addition, GDPR Article 15 JSON Data Export, and GDPR Article 17 Account Deletion.
  - **S09 Redeploy Revive Modal**: Free daily ad revive or Cores revive ($10 \rightarrow 20 \rightarrow 40$ escalation) with balance shortfall protection.
- **Procedural Track Visuals**:
  - Volumetric animated neon billboards on track flanks ("NEO MARINA", "ION DRINK", "VANTAGE TECH") with scanline sweeps.
  - Overhead sky-bridges bridging across the three lanes every 140 meters with glowing energy conduits and aviation warning beacons.
  - Parallax skyline hover-traffic (moving air-cars with headlights and taillights).
  - Rooftop industrial props (spinning ventilation fans, AC cooling units).
- **Interactive Particle Systems**:
  - Ground friction sparks emitted during slide maneuvers.
  - Trailing dual-thruster plasma plume particles (cyan normal, magenta in Boost).
  - Energy Chip pickup sparkles and floating upward "+1" / "+5" animated text.
  - Collision debris shockwave rings and fragment dispersal on obstacle impact or boost demolition.
- **Dynamic Web Audio Synthesizer**:
  - Procedural 4-bar driving synth bassline loop in E minor with tempo dynamically accelerating from 125 to 165 BPM based on forward velocity.
  - 16th-note high-pass arpeggiator layer fading in dynamically during Boost mode.
  - Near-miss Doppler frequency whoosh sound effect when passing close to obstacles without collision.
  - Master `BiquadFilterNode` low-pass filter (DSP) smoothly sweeping cutoff down to 380 Hz when opening modals/pausing, and returning to 20,000 Hz upon resumption.

---

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
