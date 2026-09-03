#!/usr/bin/env node
/**
 * check-perfstats.js — verifies the Phase 3 performance instrumentation layer.
 *
 * game.js cannot be imported in Node (it touches document/canvas/AudioContext
 * at module scope), so this harness extracts the self-contained PerfStats block
 * from the source and evaluates just that block against a stubbed `window` and
 * `performance`. That means the object under test is the SAME source text that
 * ships in the browser — not a copy that can silently drift.
 *
 * What it proves:
 *   - the ring buffer wraps at PERF_FRAME_SAMPLES and keeps the newest samples
 *   - avgMs / p95Ms / maxMs are computed correctly against known inputs
 *   - inputLatencyMs is a rolling p95 of markInput()->commitInput() deltas
 *   - recordFrame() performs zero heap allocation on the hot path
 *
 * What it CANNOT prove: real frame times. Those depend on GPU, display refresh
 * and thermal state, and must be measured on device. See PERF_REPORT.md.
 *
 * Zero dependencies. Usage: node check-perfstats.js   (npm run check:perf)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME_JS = path.join(__dirname, 'game.js');

const START = 'const PERF_FRAME_SAMPLES';
const END = 'window.PerfStats = PerfStats;';

function extractPerfStatsSource() {
  const src = fs.readFileSync(GAME_JS, 'utf8');
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    console.error(`FATAL: could not locate the PerfStats block in ${GAME_JS}`);
    console.error(`  looked for start marker: ${START}`);
    console.error(`  looked for end marker:   ${END}`);
    process.exit(2);
  }
  return src.slice(a, b + END.length);
}

/* ---------------- test harness ---------------- */

let failures = 0;
let checks = 0;

function ok(cond, label, detail) {
  checks++;
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function near(a, b, tol, label) {
  ok(Math.abs(a - b) <= tol, label, `got ${a}, expected ~${b} (tol ${tol})`);
}

/* ---------------- run ---------------- */

function main() {
  const source = extractPerfStatsSource();

  // Deterministic clock so input-latency samples are exactly known.
  let clock = 0;
  const sandbox = {
    window: {},
    performance: { now: () => clock },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'game.js#PerfStats' });

  const P = sandbox.window.PerfStats;
  ok(!!P, 'PerfStats block extracted from game.js and evaluated');
  ok(typeof P.recordFrame === 'function', 'recordFrame() exists');
  ok(typeof P.markInput === 'function' && typeof P.commitInput === 'function',
    'markInput()/commitInput() exist');

  // `const` inside a vm script does not attach to the context object, so read
  // the capacity off the buffer the block actually allocated.
  const CAP = P._frames.length;
  ok(CAP === 300, `frame ring buffer capacity is 300 (got ${CAP})`);

  // --- frame stats over a known distribution -----------------------------
  P.reset();
  // 95 samples of 10ms then 5 of 100ms => avg 14.5, p95 = 10, max = 100.
  for (let i = 0; i < 95; i++) P.recordFrame(10);
  for (let i = 0; i < 5; i++) P.recordFrame(100);
  ok(P.sampleCount === 100, `sampleCount is 100 (got ${P.sampleCount})`);
  near(P.avgMs, 14.5, 1e-9, 'avgMs over a known distribution');
  near(P.p95Ms, 10, 1e-9, 'p95Ms (nearest-rank) over a known distribution');
  near(P.maxMs, 100, 1e-9, 'maxMs over a known distribution');
  ok(P.frameTimes.length === 100, 'frameTimes snapshot length tracks sampleCount');

  // --- ring buffer wrap keeps the newest window ---------------------------
  P.reset();
  for (let i = 0; i < CAP + 50; i++) P.recordFrame(i < CAP ? 1 : 2);
  ok(P.sampleCount === CAP, `sampleCount saturates at ${CAP} (got ${P.sampleCount})`);
  const twos = P.frameTimes.filter((v) => v === 2).length;
  ok(twos === 50, `ring buffer retains the 50 newest samples (got ${twos})`);

  // --- implausible deltas are rejected, not averaged in -------------------
  P.reset();
  P.recordFrame(16);
  P.recordFrame(5000);   // tab restore / debugger stall
  P.recordFrame(-3);     // clock went backwards
  ok(P.sampleCount === 1, `out-of-range frame deltas are discarded (got ${P.sampleCount} sample(s))`);

  // --- input latency: rolling p95 ----------------------------------------
  // 94 fast samples (2 ms) + 6 slow ones (40 ms): with nearest-rank p95 over
  // n=100 the answer is the 95th smallest, i.e. 40.
  P.reset();
  const emit = (ms) => { P.markInput(); clock += ms; P.commitInput(); clock += 1000; };
  for (let i = 0; i < 94; i++) emit(2);
  for (let i = 0; i < 6; i++) emit(40);
  ok(P.inputSampleCount === 100, `inputSampleCount is 100 (got ${P.inputSampleCount})`);
  near(P.inputLatencyMs, 40, 1e-9, 'inputLatencyMs is the rolling p95 of commit deltas');
  near(P._percentile(P._inputs, P._inputCount, 0.5), 2, 1e-9,
    'input-latency median reflects the fast-path samples');

  // A commit with no preceding mark must not record a bogus sample.
  P.commitInput();
  ok(P.inputSampleCount === 100, 'unmatched commitInput() is ignored');

  // --- allocation-free hot path ------------------------------------------
  // recordFrame() writes into a pre-allocated Float64Array. Measure heapUsed
  // growth across a large burst; anything allocating per call would show up.
  P.reset();
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 500000; i++) P.recordFrame(16.6);
  const after = process.memoryUsage().heapUsed;
  const grownKb = Math.max(0, (after - before) / 1024);
  ok(grownKb < 512,
    `recordFrame() x500000 allocates < 512 KB of heap (grew ${grownKb.toFixed(1)} KB)`);

  // --- snapshot() shape ---------------------------------------------------
  const snap = P.snapshot();
  ok(snap && typeof snap.avgMs === 'number' && typeof snap.p95Ms === 'number' &&
     typeof snap.inputLatencyMs === 'number' && snap.budgets.frameMs === 16.6 &&
     snap.budgets.inputMs === 80,
    'snapshot() reports avg/p95/input latency plus the 16.6ms / 80ms budgets');

  console.log('');
  if (failures > 0) {
    console.error(`${failures} of ${checks} PerfStats checks FAILED.`);
    process.exit(1);
  }
  console.log(`OK — ${checks} PerfStats instrumentation checks passed.`);
  process.exit(0);
}

console.log('');
console.log('PerfStats instrumentation verification (source-extracted from game.js)');
main();
