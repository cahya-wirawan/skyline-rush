#!/usr/bin/env node
/**
 * check-contrast.js — WCAG 2.1 contrast audit for Skyline Rush UI chrome.
 *
 * Scope: MENU / HUD / PANEL chrome only. Gameplay-canvas pixels (the runner,
 * obstacles, skyline, particles drawn into <canvas> by game.js) are explicitly
 * OUT of scope — WCAG 1.4.3 exempts incidental / decorative imagery and
 * gameplay rendering is not text.
 *
 * Zero dependencies. Reads skyline-rush-client/web/style.css, parses the
 * :root custom properties, alpha-composites translucent panel backgrounds over
 * the opaque page background, and asserts:
 *   - normal text        >= 4.5:1  (WCAG 2.1 AA, 1.4.3)
 *   - large text         >= 3.0:1  (>=24px, or >=18.66px bold)
 *   - UI component/edge  >= 3.0:1  (WCAG 2.1 AA, 1.4.11)
 *
 * Exit code 0 = all checked pairings pass. Non-zero = at least one failure,
 * with a full table printed.
 *
 * Usage: node check-contrast.js        (or: npm run check:contrast)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, 'style.css');

/* ------------------------------------------------------------------ */
/* WCAG math                                                           */
/* ------------------------------------------------------------------ */

/** Parse #rgb / #rrggbb / rgba(r,g,b,a) / rgb(r,g,b) into {r,g,b,a}. */
function parseColor(raw) {
  const s = String(raw).trim();

  const hex = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1
    };
  }

  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4])
    };
  }

  throw new Error(`Unsupported color literal: "${raw}"`);
}

/** Source-over alpha composite of `fg` onto an opaque `bg`. */
function composite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1
  };
}

/** WCAG 2.1 relative luminance (sRGB). */
function relativeLuminance(c) {
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2.1 contrast ratio. Both colors must already be opaque. */
function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ */
/* Self-test of the formula against published WCAG reference values     */
/* ------------------------------------------------------------------ */

function selfTest() {
  const cases = [
    ['#000000', '#ffffff', 21.0],
    ['#ffffff', '#ffffff', 1.0],
    // The canonical AA boundary grey documented by W3C: 4.54:1 on white.
    ['#767676', '#ffffff', 4.54]
  ];
  for (const [fg, bg, expected] of cases) {
    const got = contrastRatio(parseColor(fg), parseColor(bg));
    if (Math.abs(got - expected) > 0.01) {
      console.error(
        `FATAL: contrast formula self-test failed for ${fg} on ${bg}: ` +
        `expected ~${expected}, got ${got.toFixed(2)}`
      );
      process.exit(2);
    }
  }
}

/* ------------------------------------------------------------------ */
/* :root custom property extraction                                    */
/* ------------------------------------------------------------------ */

function readRootVars(css) {
  const block = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!block) {
    console.error(`FATAL: no :root { } block found in ${CSS_PATH}`);
    process.exit(2);
  }
  const vars = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

/**
 * Collect `/* ... *\/` comments that sit immediately above the :root block or
 * on the line above a custom property. A pairing may be waived only when an
 * EXEMPT: marker names the token.
 */
function readExemptions(css) {
  const exempt = new Map();
  const re = /\/\*([^*]|\*(?!\/))*\*\//g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const body = m[0];
    const tag = body.match(/EXEMPT:\s*(--[a-z0-9-]+)\s*(?:\/\s*(--[a-z0-9-]+))?\s*[-—:]\s*([\s\S]*?)\*\//i);
    if (tag) {
      const key = tag[2] ? `${tag[1]}|${tag[2]}` : tag[1];
      exempt.set(key, tag[3].replace(/\s+/g, ' ').trim());
    }
  }
  return exempt;
}

/* ------------------------------------------------------------------ */
/* Rule index — so every pairing's evidence anchor is machine-verified  */
/* ------------------------------------------------------------------ */
/*
 * RF-02(c): the previous version of this file listed "evidence anchor"
 * selectors that were simply wrong — `.hud-label` cited as --cyan when it is
 * --muted, `.btn.primary` / `.btn.danger` which are not selectors in this
 * stylesheet at all, and several (`.danger-label`, `.lock-warning`,
 * `.status-ok`, `.screen-panel`) that exist nowhere in it. A table of
 * unverifiable anchors is worse than no table, because it reads as evidence.
 *
 * So anchors are now CHECKED, not asserted. Every pairing names a selector
 * that must exist in style.css, plus the declaration fragments that must
 * appear inside that selector's rule body. A stale anchor is a hard failure
 * exactly like a failing ratio.
 */

/** Map every selector in the stylesheet to its declaration body. */
function readRuleIndex(css) {
  const index = new Map();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    // Strip comments and at-rule preludes from the selector list.
    const selList = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!selList || selList.startsWith('@')) continue;
    const body = m[2];
    for (const sel of selList.split(',')) {
      const key = sel.trim().replace(/\s+/g, ' ');
      if (!key) continue;
      index.set(key, (index.get(key) || '') + ';' + body);
    }
  }
  return index;
}

/* ------------------------------------------------------------------ */
/* The pairings actually used for UI chrome in style.css               */
/* ------------------------------------------------------------------ */
/*
 * useClass:
 *   'normal'     -> 4.5:1  (body copy, labels, values, small captions)
 *   'large'      -> 3.0:1  (>=24px, or >=18.66px bold display type)
 *   'ui'         -> 3.0:1  (WCAG 1.4.11: boundaries of INTERACTIVE controls
 *                           and focus indicators)
 *   'decorative' -> reported, not gated. SC 1.4.11 scopes to "user interface
 *                   components" and to graphics needed to understand content;
 *                   a hairline between two stat rows is neither. These rows
 *                   are printed with their real ratio and their justification
 *                   so the exclusion is visible rather than silent.
 */
const PAIRINGS = [
  // --- Body / base surface -------------------------------------------------
  { fg: '--text',   bg: '--bg', use: 'normal', anchor: 'body', requires: ['color: var(--text)'] },
  { fg: '--cyan',   bg: '--bg', use: 'normal', anchor: '.brand-kicker', requires: ['color: var(--cyan)'] },
  { fg: '--cyan',   bg: '--bg', use: 'normal', anchor: '.hud-val', requires: ['color: var(--cyan)'] },
  { fg: '--cyan',   bg: '--bg', use: 'normal', anchor: '.touch-btn', requires: ['color: var(--cyan)'] },
  { fg: '--muted',  bg: '--bg', use: 'normal', anchor: '.subtitle', requires: ['color: var(--muted)'] },
  { fg: '--muted',  bg: '--bg', use: 'normal', anchor: '.hud-label', requires: ['color: var(--muted)'] },
  { fg: '--muted',  bg: '--bg', use: 'normal', anchor: '.btn-ghost', requires: ['color: var(--muted)'] },
  { fg: '--muted',  bg: '--bg', use: 'normal', anchor: '.controls-hint', requires: ['color: var(--muted)'] },
  { fg: '--gold',   bg: '--bg', use: 'normal', anchor: '.currency-chips', requires: ['color: var(--gold)'] },
  { fg: '--gold',   bg: '--bg', use: 'normal', anchor: '.chips-stat .hud-val', requires: ['color: var(--gold)'] },

  // --- Opaque panel / modal surface ---------------------------------------
  { fg: '--cyan',    bg: '--panel-solid', use: 'normal', anchor: '.settings-title', requires: ['color: var(--cyan)'] },
  { fg: '--cyan',    bg: '--panel-solid', use: 'normal', anchor: '.challenge-math', requires: ['color: var(--cyan)'] },
  { fg: '--muted',   bg: '--panel-solid', use: 'normal', anchor: '.tab-btn', requires: ['color: var(--muted)'] },
  { fg: '--muted',   bg: '--panel-solid', use: 'normal', anchor: '.challenge-label', requires: ['color: var(--muted)'] },
  { fg: '--muted',   bg: '--panel-solid', use: 'normal', anchor: '.privacy-desc', requires: ['color: var(--muted)'] },
  { fg: '--gold',    bg: '--panel-solid', use: 'normal', anchor: '.drop-result', requires: ['color: var(--gold)'] },
  { fg: '--magenta', bg: '--panel-solid', use: 'normal', anchor: '.error-msg', requires: ['color: var(--magenta)'] },
  { fg: '--magenta', bg: '--panel-solid', use: 'normal', anchor: '.btn-danger', requires: ['color: var(--magenta)'] },
  { fg: '--magenta', bg: '--panel-solid', use: 'normal', anchor: '.alert-header h2', requires: ['color: var(--magenta)'] },
  { fg: '--amber',   bg: '--panel-solid', use: 'normal', anchor: '.pin-key-clear', requires: ['color: var(--amber)'] },

  // --- Translucent panel (composited over --bg) ---------------------------
  { fg: '--muted', bg: '--panel', use: 'normal', anchor: '.stat-label', requires: ['color: var(--muted)'] },
  { fg: '--muted', bg: '--panel', use: 'normal', anchor: '.loading-msg', requires: ['color: var(--muted)'] },
  { fg: '--gold',  bg: '--panel', use: 'normal', anchor: '.stat-val.highlight', requires: ['color: var(--gold)'] },
  { fg: '--cyan',  bg: '--panel', use: 'normal', anchor: '.lb-meters', requires: ['color: var(--cyan)'] },
  { fg: '--muted', bg: '--panel', use: 'normal', anchor: '.lb-rank', requires: ['color: var(--muted)'] },

  // --- Inset rows / cards (--panel-2 over --panel over --bg) --------------
  { fg: '--cyan',  bg: '--panel-2', use: 'normal', anchor: '.odds-row span:last-child', requires: ['color: var(--cyan)'] },
  // Dark ink on the cyan gradients (.badge-equipped, .btn-primary). Worst case
  // is the darkest stop, --cyan-deep, so both stops are audited.
  { fg: '#04101a', bg: '--cyan',      use: 'normal', anchor: '.badge-equipped',
    requires: ['color: #04101a', 'var(--cyan)'] },
  { fg: '#04101a', bg: '--cyan',      use: 'normal', anchor: '.btn-primary',
    requires: ['color: #04101a', 'var(--cyan)'] },
  { fg: '#04101a', bg: '--cyan-deep', use: 'normal', anchor: '.btn-primary',
    requires: ['color: #04101a', 'var(--cyan-deep)'] },
  { fg: '--muted', bg: '--panel-2', use: 'normal', anchor: '.card-desc', requires: ['color: var(--muted)'] },
  { fg: '--muted', bg: '--panel-2', use: 'normal', anchor: '.roster-stats', requires: ['color: var(--muted)'] },
  { fg: '--muted', bg: '--panel-2', use: 'normal', anchor: '.badge-locked', requires: ['color: var(--muted)'] },
  { fg: '--gold',  bg: '--panel-2', use: 'normal', anchor: '.lb-rank.gold', requires: ['color: var(--gold)'] },
  { fg: '--green', bg: '--panel-2', use: 'normal', anchor: '.badge-ok', requires: ['color: var(--green)'] },

  // --- White text on the accent gradient (RF-02b) --------------------------
  // .btn-label / .btn-subtext inherit `color:#fff` from .btn-accent, so the
  // worst case is white over each gradient stop. Both are normal text:
  // .btn-label is 1rem/900 (16px bold -> below the 18.66px large-text floor)
  // and .btn-subtext is 0.78rem, so 4.5:1 applies to every stop.
  { fg: '#ffffff', bg: '--accent-1', use: 'normal', anchor: '.btn-accent',
    requires: ['color: #fff', 'var(--accent-1)'] },
  { fg: '#ffffff', bg: '--accent-2', use: 'normal', anchor: '.btn-accent',
    requires: ['color: #fff', 'var(--accent-2)'] },
  { fg: '#ffffff', bg: '--accent-3', use: 'normal', anchor: '.btn-accent',
    requires: ['color: #fff', 'var(--accent-3)'] },
  { fg: '#ffffff', bg: '--accent-1', use: 'normal', anchor: '.badge-popular',
    requires: ['color: #fff', 'var(--accent-1)'] },
  { fg: '#ffffff', bg: '--accent-2', use: 'normal', anchor: '.badge-popular',
    requires: ['color: #fff', 'var(--accent-2)'] },

  // --- Interactive control boundaries (WCAG 1.4.11, >= 3:1) ---------------
  // RF-02a: these were the concretely broken ones. .btn-ghost is transparent
  // with muted text, so its border was its only boundary at 1.20:1;
  // .btn-secondary sat at 1.53:1. Both now use --line-control.
  { fg: '--line-control', bg: '--bg',    use: 'ui', anchor: '.btn-ghost',         requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--panel', use: 'ui', anchor: '.btn-secondary',     requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--bg',    use: 'ui', anchor: '.icon-btn',          requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--bg',    use: 'ui', anchor: '.icon-btn-settings', requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--panel-solid', use: 'ui', anchor: '.icon-close',  requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--panel-solid', use: 'ui', anchor: '.pin-key',     requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--panel-solid', use: 'ui', anchor: '.age-option-btn', requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--panel',  use: 'ui', anchor: '.shop-card',        requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--line-control', bg: '--panel',  use: 'ui', anchor: '.roster-card',      requires: ['border: 1px solid var(--line-control)'] },
  { fg: '--cyan', bg: '--bg',        use: 'ui', anchor: '.btn:focus-visible', requires: ['outline: 2px solid var(--cyan)'] },
  { fg: '--cyan', bg: '--panel-2',   use: 'ui', anchor: '.lb-you-chip',       requires: ['border: 1px solid var(--cyan)'] },
  { fg: '--cyan', bg: '--panel-2',   use: 'ui', anchor: '.contract-card',     requires: ['border-left: 3px solid var(--cyan)'] },

  // --- Decorative dividers / card edges (reported, not gated) -------------
  // These carry no state and identify no control: removing them entirely would
  // not change what any control is or does, which is the SC 1.4.11 test. They
  // stay listed so their real ratios are on the record.
  { fg: '--line', bg: '--bg', use: 'decorative', anchor: '.hud-stat', requires: ['border: 1px solid var(--line)'],
    why: 'HUD stat chip edge; the chip is a readout, not a control' },
  { fg: '--line', bg: '--panel', use: 'decorative', anchor: '.summary-stats', requires: ['border: 1px solid var(--line)'],
    why: 'static summary table frame' },
  { fg: '--line', bg: '--panel', use: 'decorative', anchor: '.lb-row', requires: ['border: 1px solid var(--line)'],
    why: 'leaderboard row separator; rows are not interactive' },
  { fg: '--line', bg: '--panel', use: 'decorative', anchor: '.odds-list', requires: ['border: 1px solid var(--line)'],
    why: 'disclosed-odds table frame' },
  { fg: '--line', bg: '--panel-2', use: 'decorative', anchor: '.contract-card', requires: ['border: 1px solid var(--line)'],
    why: 'card edge; the card also carries a 3px --cyan left rule, audited above' },
  { fg: '--line', bg: '--panel', use: 'decorative', anchor: '.settings-section', requires: ['border: 1px solid var(--line)'],
    why: 'settings group frame' },
  { fg: '--line-strong', bg: '--panel-solid', use: 'decorative', anchor: '.controls-hint kbd', requires: ['border: 1px solid var(--line-strong)'],
    why: 'typographic key-cap outline around already-legible --muted text' },
  { fg: '--line-strong', bg: '--panel-2', use: 'decorative', anchor: '.badge-locked', requires: ['border: 1px solid var(--line-strong)'],
    why: 'status pill outline; the state is carried by its text label (SC 1.4.1)' }
];

/** How each background token is resolved into an opaque color. */
const BG_STACK = {
  '--bg': ['--bg'],
  '--panel-solid': ['--panel-solid'],
  '--panel': ['--bg', '--panel'],
  '--panel-2': ['--bg', '--panel', '--panel-2'],
  '--accent-1': ['--accent-1'],
  '--accent-2': ['--accent-2'],
  '--accent-3': ['--accent-3'],
  '--cyan': ['--cyan'],
  '--cyan-deep': ['--cyan-deep']
};

function resolveBackground(token, vars) {
  const stack = BG_STACK[token];
  if (!stack) throw new Error(`No compositing stack defined for ${token}`);
  let acc = null;
  for (const layer of stack) {
    const c = parseColor(vars[layer]);
    acc = acc === null ? composite(c, { r: 0, g: 0, b: 0, a: 1 }) : composite(c, acc);
  }
  return acc;
}

const THRESHOLD = { normal: 4.5, large: 3.0, ui: 3.0, decorative: 0 };

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  selfTest();

  if (!fs.existsSync(CSS_PATH)) {
    console.error(`FATAL: ${CSS_PATH} not found`);
    process.exit(2);
  }
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const vars = readRootVars(css);
  const exemptions = readExemptions(css);
  const ruleIndex = readRuleIndex(css);

  const required = ['--bg', '--panel', '--panel-solid', '--panel-2', '--text', '--muted',
    '--cyan', '--magenta', '--gold', '--violet', '--green', '--amber',
    '--line', '--line-strong', '--line-control', '--accent-1', '--accent-2', '--accent-3',
    '--cyan-deep'];
  const missing = required.filter((v) => !(v in vars));
  if (missing.length) {
    console.error(`FATAL: :root is missing required custom properties: ${missing.join(', ')}`);
    process.exit(2);
  }

  const rows = [];
  let failures = 0;
  let exemptCount = 0;
  let decorativeCount = 0;
  const anchorErrors = [];

  // Normalize a declaration fragment for substring matching (collapse spaces).
  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  for (const p of PAIRINGS) {
    // ---- evidence-anchor verification (RF-02c) ----------------------------
    const body = ruleIndex.get(p.anchor);
    if (body === undefined) {
      anchorErrors.push(`selector "${p.anchor}" does not exist in style.css`);
    } else {
      const flat = norm(body);
      for (const frag of p.requires) {
        if (!flat.includes(norm(frag))) {
          anchorErrors.push(`"${p.anchor}" does not declare \`${frag}\``);
        }
      }
    }

    const fgLiteral = p.fg.startsWith('#') || p.fg.startsWith('rgb');
    const fgSource = fgLiteral ? p.fg : vars[p.fg];
    const fgColor = parseColor(fgSource);
    const bgColor = resolveBackground(p.bg, vars);
    // A translucent foreground (e.g. a 1px border tint) composites over its
    // own backdrop before the ratio is taken.
    const fgOpaque = fgColor.a === 1 ? fgColor : composite(fgColor, bgColor);
    const ratio = contrastRatio(fgOpaque, bgColor);
    const need = THRESHOLD[p.use];

    const waiver = exemptions.get(`${p.fg}|${p.bg}`) || exemptions.get(p.fg);
    let status;
    if (p.use === 'decorative') {
      status = 'DECOR';
      decorativeCount++;
    } else if (ratio >= need) {
      status = 'PASS';
    } else if (waiver) {
      status = 'EXEMPT';
      exemptCount++;
    } else {
      status = 'FAIL';
      failures++;
    }

    rows.push({
      fg: p.fg,
      fgHex: fgSource,
      bg: p.bg,
      use: p.use,
      need: p.use === 'decorative' ? 'n/a' : need.toFixed(1),
      ratio: ratio.toFixed(2),
      status,
      where: p.anchor,
      waiver: waiver || p.why || ''
    });
  }

  if (anchorErrors.length) {
    console.error('');
    console.error('FATAL: stale evidence anchors — the pairing table no longer matches style.css:');
    for (const e of anchorErrors) console.error(`  - ${e}`);
    console.error('');
    console.error('Fix the anchor (or the CSS), do not delete the check.');
    process.exit(2);
  }

  // ---- table -------------------------------------------------------------
  const col = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log('');
  console.log('WCAG 2.1 AA contrast audit — Skyline Rush UI chrome (menus/HUD/panels)');
  console.log(`Source: ${CSS_PATH}`);
  console.log('Gameplay-canvas rendering is out of scope (not text; WCAG 1.4.3 incidental).');
  console.log('');
  console.log(
    col('FOREGROUND', 12) + col('HEX', 10) + col('BACKGROUND', 15) +
    col('USE', 8) + col('NEED', 6) + col('RATIO', 8) + col('RESULT', 8) + 'WHERE'
  );
  console.log('-'.repeat(120));
  for (const r of rows) {
    console.log(
      col(r.fg, 12) + col(r.fgHex, 10) + col(r.bg, 15) +
      col(r.use, 8) + col(r.need, 6) + col(r.ratio, 8) + col(r.status, 8) + r.where
    );
    if (r.status === 'EXEMPT') console.log(`  ^ exempt: ${r.waiver}`);
    if (r.status === 'DECOR') console.log(`  ^ decorative, outside SC 1.4.11: ${r.waiver}`);
  }
  console.log('-'.repeat(120));
  console.log(
    `${rows.length} pairings checked · ` +
    `${rows.length - failures - exemptCount - decorativeCount} pass · ` +
    `${exemptCount} exempt · ${decorativeCount} decorative (reported, not gated) · ` +
    `${failures} fail`
  );
  console.log(`All ${PAIRINGS.length} evidence anchors verified against style.css.`);

  if (failures > 0) {
    console.error('');
    console.error('FAILING PAIRINGS:');
    for (const r of rows.filter((x) => x.status === 'FAIL')) {
      console.error(
        `  ${r.fg} (${r.fgHex}) on ${r.bg}: ${r.ratio}:1 — needs ${r.need}:1 for ${r.use} (${r.where})`
      );
    }
    console.error('');
    console.error('Fix by adjusting the :root custom property in style.css, or add a comment');
    console.error('above :root of the form:  /* EXEMPT: --token - reason */');
    process.exit(1);
  }

  console.log('OK — all UI-chrome contrast pairings meet WCAG 2.1 AA.');
  process.exit(0);
}

main();
