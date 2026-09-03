# Skyline Rush — Client Performance Report (Phase 3)

**Scope:** AC-P3-5, AC-P3-6, AC-P3-7.
**Subject:** `skyline-rush-client/web/game.js` (Canvas2D Web Runner).
**Date of measurement:** 2026-09-03.
**Budgets under test:** 16.6 ms average frame time (60 fps) and 80 ms input latency.

---

## 0. Honest summary — read this first

| Question | Answer |
| --- | --- |
| Is the instrumentation implemented and verified? | **Yes.** 18 automated checks, `npm run check:perf`. |
| Was the optimization pass done? | **Yes.** 4 per-frame gradient constructions eliminated. |
| Were real frame times measured on hardware? | **No.** See §5. |
| Were real input latencies measured on hardware? | **No.** See §5. |
| Does this document claim a 60 fps pass? | **No.** No such claim is made anywhere below. |

The frame-time and input-latency **numbers themselves are not measurable in this
environment and are deferred to on-device testing.** What *is* established here
is (a) that the measurement apparatus exists, is always-on, is allocation-free,
and computes its statistics correctly; and (b) a static, countable reduction in
per-frame work. Anything stronger than that would be fabricated.

---

## 1. What was added

### 1.1 Frame-time instrumentation (AC-P3-5)

`window.PerfStats` in `game.js`, updated once per `requestAnimationFrame` tick
from `gameLoop()`:

| Field | Meaning |
| --- | --- |
| `sampleCount` | Number of valid samples currently held (0–300). |
| `avgMs` | Mean frame delta over the buffer. |
| `p95Ms` | Nearest-rank 95th percentile frame delta. |
| `maxMs` | Worst frame delta in the buffer. |
| `inputLatencyMs` | Rolling p95 of input-receipt → state-commit latency, **accepted inputs only**. |
| `inputSampleCount` | Number of accepted input samples held (0–120). |
| `rejectedLatencyMs` | Rolling p95 for inputs the runner refused (RF-11). Separate bucket. |
| `rejectedInputCount` | Number of rejected input samples held (0–120). |
| `frameTimes` | Snapshot copy of the raw samples (allocates **on read only**). |
| `snapshot()` | Plain object with all of the above plus the two budgets. |

Storage is a pre-allocated `Float64Array(300)` ring buffer — ~5 s of history at
60 fps. The per-frame cost is one subtraction, one bounds test, one store and
two integer increments. Nothing on the hot path allocates, so the instrumentation
cannot itself induce the GC pauses it is meant to detect. Percentiles reuse a
single pre-allocated scratch buffer.

Frame deltas outside `[0, 1000] ms` are discarded rather than averaged in, so a
backgrounded tab or a debugger pause does not poison the statistics.

### 1.2 Input-latency instrumentation (AC-P3-6)

`PerfStats.markInput()` is called at input **receipt**, and
`PerfStats.commitInput(accepted)` fires inside the runner method that acts on
it, immediately after the state assignment.

**RF-11 — what changed and what the number now means.** This instrumentation
originally covered *lane changes only*, and only the *successful* ones:
`commitInput()` sat inside the `if (next >= -1 && next <= 1)` guard, so a swipe
at the outer lane was timed and then silently discarded, and `jump()` / `slide()`
were never instrumented at all. The reported p95 was therefore a
lane-change-success figure being presented as an input-latency figure. Now:

- every movement entry point calls `markInput()`, including jump and slide;
- `commitInput(true)` records accepted inputs into `inputLatencyMs`;
- `commitInput(false)` records **refused** inputs (lane change at the boundary,
  jump while airborne, slide while already sliding) into the separate
  `rejectedLatencyMs` bucket rather than dropping them.

The two buckets are kept apart deliberately: "how fast did the runner respond"
and "how fast did we decide to do nothing" are different questions, and mixing
them would flatter the headline number.

| Input path | Location in `game.js` | Marked |
| --- | --- | --- |
| Keyboard (`ArrowLeft`/`A`, `ArrowRight`/`D`) | `keydown` handler | yes |
| Keyboard (`ArrowUp`/`W`/`Space` → jump) | `keydown` handler | yes (RF-11) |
| Keyboard (`ArrowDown`/`S` → slide) | `keydown` handler | yes (RF-11) |
| On-screen touch buttons (`ctrlLeft` / `ctrlRight`) | `onclick` handlers | yes |
| On-screen touch buttons (`ctrlJump` / `ctrlSlide`) | `onclick` handlers | yes (RF-11) |
| Horizontal swipe | `touchend` handler | yes |
| Vertical swipe (jump / slide) | `touchend` handler | yes (RF-11) |

**Confirmed as required by AC-P3-6:** the path from handler entry to
`targetLane` commit is fully synchronous today — `changeLane()` performs a
bounds check and a single field assignment with no `await`, timer, or queue in
between. The recorded sample therefore measures *handler-entry through
state-commit*.

**Limitation stated plainly:** this is **not** end-to-end
photon-to-finger latency. It excludes OS/browser event dispatch before the
handler runs and excludes the wait for the next painted frame after commit. The
80 ms NFR budget is an end-to-end budget; the metric here is a lower bound on it
and will always look better than reality. Closing that gap requires on-device
capture (§5).

### 1.3 Gradient caching (AC-P3-7)

Four gradients whose control points are pure functions of canvas `W`/`H` and the
fixed camera constants were hoisted out of `render()` into a new
`rebuildCachedGradients()`, called only from `resizeCanvas()`:

| Gradient | Previously built | Now built | Depends only on |
| --- | --- | --- | --- |
| Vignette (`vg`) | every frame | on resize | `W`, `H` |
| Horizon haze (`haze`) | every frame | on resize | `H` (via `HZ = H * CAM.horizon`) |
| Ground (`groundGrad`) | every frame | on resize | `H`, `HZ` |
| Rooftop track (`trackGrad`) | every frame | on resize | `H`, `project(zFar)` — itself a function of `W`/`H`/`CAM` |

`RenderFX.scanPattern` was **already** rebuilt only in `resizeCanvas()` —
confirmed, left unchanged.

Gradients that genuinely cannot be cached now carry an inline comment saying so.
The largest is the sky:

```js
function drawSky(HZ, t, hueShift) {
  // PERF: not cacheable — every stop depends on hueShift, which is derived from
  // track.distance and therefore changes on every frame of a run.
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HZ);
```

The remaining per-frame gradients are per-entity (chips, drones, power-ups,
courier, billboards) — their control points follow projected screen positions
that change every frame, so they are not cacheable either.

**Constraint honoured:** this was a surgical change. `render()` keeps its
structure and call order; no function was extracted, split, or made pure. The
only structural edit was moving the *initial* `resizeCanvas()` invocation below
the `const CAM` declaration, because `rebuildCachedGradients()` calls
`project()`, which reads `CAM` — calling it earlier would have hit the `const`
temporal dead zone. That move is annotated in the source.

---

## 2. Optimization result — static analysis (measured by counting, not timing)

Method: enumerate every `createLinearGradient` / `createRadialGradient` call
site in the pre-change file (`git show HEAD:skyline-rush-client/web/game.js`)
and the post-change file, and attribute each to its enclosing function.

```
$ git show HEAD:skyline-rush-client/web/game.js > /tmp/game.before.js
$ grep -c "createLinearGradient\|createRadialGradient" /tmp/game.before.js
21
$ grep -c "createLinearGradient\|createRadialGradient" skyline-rush-client/web/game.js
21
```

The **total** call-site count is unchanged at 21 — the four cached gradients were
relocated, not deleted. What changed is how often each site executes:

| | Before | After |
| --- | --- | --- |
| Unconditional gradient constructions per `render()` call | **4** | **0** |
| Same, per second at 60 fps | **240** | **0** |
| Gradient constructions per resize event | 1 (scanline pattern) | 5 (pattern + 4 gradients) |

Each eliminated construction also removes its `addColorStop` calls: 2 stops for
the vignette, 3 for the haze, 3 for the ground, 3 for the track — **11
`addColorStop` calls per frame, 660 per second at 60 fps**, likewise eliminated.

**This is a static count, not a timing measurement.** It says exactly how much
work was removed; it does not say how many milliseconds that work cost, because
`CanvasGradient` construction cost is implementation- and GPU-dependent and
cannot be determined without running on the target hardware.

---

## 3. Instrumentation verification — actually executed

The statistics code is verified by `skyline-rush-client/web/check-perfstats.js`,
which extracts the `PerfStats` block **from `game.js` itself** (so the tested
source cannot drift from the shipped source) and evaluates it in a Node `vm`
context against a stubbed `window` and a deterministic `performance.now()`.

```
$ cd skyline-rush-client && npm run check:perf

PerfStats instrumentation verification (source-extracted from game.js)
  PASS  PerfStats block extracted from game.js and evaluated
  PASS  recordFrame() exists
  PASS  markInput()/commitInput() exist
  PASS  frame ring buffer capacity is 300 (got 300)
  PASS  sampleCount is 100 (got 100)
  PASS  avgMs over a known distribution
  PASS  p95Ms (nearest-rank) over a known distribution
  PASS  maxMs over a known distribution
  PASS  frameTimes snapshot length tracks sampleCount
  PASS  sampleCount saturates at 300 (got 300)
  PASS  ring buffer retains the 50 newest samples (got 50)
  PASS  out-of-range frame deltas are discarded (got 1 sample(s))
  PASS  inputSampleCount is 100 (got 100)
  PASS  inputLatencyMs is the rolling p95 of commit deltas
  PASS  input-latency median reflects the fast-path samples
  PASS  unmatched commitInput() is ignored
  PASS  recordFrame() x500000 allocates < 512 KB of heap (grew 68.1 KB)
  PASS  snapshot() reports avg/p95/input latency plus the 16.6ms / 80ms budgets

OK — 18 PerfStats instrumentation checks passed.
```

The allocation check is the load-bearing one for AC-P3-5's "no new allocations
per frame" requirement: 500,000 `recordFrame()` calls grew the V8 heap by
**68.1 KB** — noise from the harness, not ~500,000 objects. A per-call
allocation would have produced tens of megabytes.

---

## 4. Results against budget

| Metric | Budget | Measured value | Status |
| --- | --- | --- | --- |
| Average frame time | ≤ 16.6 ms | — | **Not measurable in this environment; deferred to on-device testing.** |
| p95 frame time | ≤ 16.6 ms | — | **Not measurable in this environment; deferred to on-device testing.** |
| Max frame time | — | — | **Not measurable in this environment; deferred to on-device testing.** |
| Input latency (p95, receipt → lane commit) | ≤ 80 ms | — | **Not measurable in this environment; deferred to on-device testing.** |
| Per-frame cacheable gradient constructions | 0 | **0** (was 4) | **Met — statically verified, §2.** |
| Per-frame instrumentation allocations | 0 | **0** (68.1 KB / 500k calls) | **Met — executed, §3.** |

No frame-time or latency figure is asserted. Filling the blanks in this table is
the on-device task in §5, and it should be done before this row set is cited as
evidence for NFR performance sign-off.

---

## 5. Why the runtime numbers are absent, and how to obtain them

### Why absent

Two independent blockers, both stated rather than worked around:

1. **No target hardware.** There is no iPhone/iPad, no device farm, and no GPU
   profiler in this environment. Frame time on a Canvas2D runner is dominated by
   GPU rasterization and display refresh; a number produced anywhere else would
   not predict device behaviour.
2. **Browser automation was not used.** A Chrome instance was reachable in this
   session, but driving it requires an explicit user browser-selection
   confirmation step that this agent context cannot perform. Rather than bypass
   that, the AC's documented static-analysis fallback (§2) was used, plus the
   executed instrumentation verification (§3). The gateway *was* confirmed to be
   serving the instrumented client — `curl http://localhost:3000/game.js | grep
   -c PerfStats` returned 11 — so the browser-side path is ready; only the
   scripted drive was not performed.

### How to obtain them (10 minutes, once a device or an approved browser session is available)

**Desktop browser:**

```
cd skyline-rush-backend
npx ts-node -r tsconfig-paths/register apps/gateway/main.ts &
open http://localhost:3000
```

Start a run, play ~10 s, then in DevTools:

```js
copy(JSON.stringify(window.PerfStats.snapshot(), null, 2))
```

**On device (iOS Safari):** serve the same URL over the LAN, attach Safari Web
Inspector from a Mac, and run the same expression.

**In the Unity build:** the equivalent instrumentation must be ported to the
Unity run loop; the Web Runner's numbers characterize the Canvas2D prototype,
not the shipping Unity client. Do not carry a Web Runner figure into a Unity
performance claim.

Fill in §4 with what comes back — including if it is over budget.

---

## 6. Files touched

| File | Change |
| --- | --- |
| `skyline-rush-client/web/game.js` | `PerfStats` block; `recordFrame` in `gameLoop()`; `markInput`/`commitInput`; `RenderFX.grad` cache; `rebuildCachedGradients()`; cached-gradient consumption in `render()`; deferred initial `resizeCanvas()`; non-cacheable-gradient comments. |
| `skyline-rush-client/web/check-perfstats.js` | New. 18-check verification harness. |
| `skyline-rush-client/package.json` | New `check:perf` script, folded into `test`. |
| `skyline-rush-client/PERF_REPORT.md` | This document. |

## 7. Known weaknesses

- **The headline numbers are missing.** §4 has four blanks. That is the honest
  state, not an oversight.
- **Input latency is a lower bound**, not end-to-end latency (§1.2).
- **The Web Runner is not the shipping client.** Everything here characterizes
  the Canvas2D prototype. Unity has a different render pipeline and its own
  budget.
- **Gradient caching is not runtime-validated.** The four cached gradients are
  argued to be resolution-invariant from their control-point expressions, and
  correctness was checked by reading the code — but no rendered-output diff was
  taken before and after, because that also needs a browser. A visual
  regression check on resize should be part of the on-device pass.
- **`rebuildCachedGradients()` depends on module init order.** It calls
  `project()`, so the first `resizeCanvas()` must run after `const CAM`. This is
  commented in the source, but a future reorder of the module could reintroduce
  a temporal-dead-zone crash at load. There is no test guarding that ordering.
