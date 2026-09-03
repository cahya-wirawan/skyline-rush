#!/usr/bin/env node
/**
 * validate-rules.js — structural validation of the Phase 3 observability
 * artifacts (AC-P3-9, AC-P3-10).
 *
 * Checks:
 *   1. alerting-rules.yml parses and contains EXACTLY 5 `alert:` entries, each
 *      with alert / expr / for / labels / annotations{summary,description} —
 *      and each of those must carry a NON-EMPTY value, not merely be present.
 *   2. Every rule `expr` is delimiter-balanced, carries no nonsense operator
 *      runs, and references at least one real metric identifier — the same
 *      standard the dashboard path already applied.
 *   3. All 4 Grafana dashboards parse as JSON and have title + panels[], and
 *      every panel target carries a PromQL `expr`.
 *   4. Every metric name referenced by a rule or a dashboard target either
 *      resolves to a name grep-able in the gateway's /metrics handler
 *      (apps/gateway/gateway.app.ts + libs/metrics/index.ts), or is explicitly
 *      declared a placeholder — inside a PLACEHOLDER comment block for rules,
 *      and via "skylineMetricStatus": "placeholder" on the target for
 *      dashboards. An undeclared unknown metric is a hard failure: that is how
 *      a fabricated metric gets caught.
 *
 * RF-03 — escape hatches closed in this revision, all of them found by
 * mutation-testing the previous version:
 *   a. Field presence was checked with `Set.has`, so `expr: ""`, `summary: ""`
 *      and friends passed. Values are now unquoted, block-scalar-joined, and
 *      required to be non-empty after trimming.
 *   b. A rule expression referencing no metric at all (`vector(0) > 1`) passed,
 *      because only *unknown* names were checked, never *absent* ones.
 *   c. Syntactically broken PromQL (`sum(rate(x[5m)) >>> ((`) passed, because
 *      nothing looked at the expression's shape.
 *   d. The placeholder-harvesting regex scanned the ENTIRE header comment, so a
 *      fabricated metric added under the "IMPLEMENTED" heading was accepted as
 *      a declared placeholder — exactly defeating check 4. Harvesting is now
 *      scoped to the comment block that begins at a PLACEHOLDER marker and ends
 *      at the first blank comment line or the first non-comment line.
 *   e. The js-yaml cross-check silently SKIPped when js-yaml was not resolvable,
 *      leaving the weaker hand-rolled reader as the only gate. js-yaml is now a
 *      declared backend devDependency and resolved through normal `require`
 *      (with the sibling contracts package as a fallback path). If it is still
 *      unavailable the script prints a loud WARN explaining that the hand-rolled
 *      reader — now strict enough to stand alone per (a)-(c) — is carrying the
 *      validation on its own, rather than a bare SKIP.
 *
 * Usage: node observability/validate-rules.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RULES = path.join(__dirname, 'alerting-rules.yml');
const DASH_DIR = path.join(__dirname, 'dashboards');
const EXPECTED_DASHBOARDS = [
  'economy-health.json',
  'purchase-funnel.json',
  'live-ops.json',
  'reliability.json'
];
const EXPECTED_ALERT_COUNT = 5;
// Fields whose VALUE must be a non-empty scalar. `annotations` is excluded
// because it is a nested map — its contents are checked via REQUIRED_ANNOTATIONS.
const REQUIRED_RULE_FIELDS = ['alert', 'expr', 'for', 'labels', 'annotations'];
const NON_EMPTY_RULE_FIELDS = ['alert', 'expr', 'for', 'labels'];
const REQUIRED_ANNOTATIONS = ['summary', 'description'];

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

/* ------------------------------------------------------------------ */
/* Minimal Prometheus rule-file reader                                 */
/* ------------------------------------------------------------------ */

/** Strip YAML block-scalar indicators and surrounding quotes from a scalar. */
function normalizeScalar(v) {
  const t = v.trim();
  if (/^[|>][-+]?\d*$/.test(t)) return '';          // block scalar header
  const q = /^"([\s\S]*)"$/.exec(t) || /^'([\s\S]*)'$/.exec(t);
  return (q ? q[1] : t).trim();
}

/**
 * Walks the `- alert:` list items, collecting each rule's top-level fields and
 * annotation entries WITH THEIR VALUES (block scalars joined onto one line).
 * Sufficient for a Prometheus rule file; not a general YAML parser and not
 * presented as one — which is why the js-yaml cross-check below exists.
 */
function readRules(text) {
  const raw = text.split('\n');
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i];
    if (/^\s*#/.test(l)) continue;
    if (l.trim() === '') continue;
    lines.push({ n: i + 1, text: l });
  }

  const rules = [];
  let current = null;
  let ruleIndent = -1;
  let field = null;
  let inAnnotations = false;
  let annotationIndent = -1;
  let annKey = null;

  const indentOf = (s) => s.length - s.replace(/^\s+/, '').length;
  const closeRule = () => {
    if (current) rules.push(current);
    current = null;
    field = null;
    annKey = null;
    inAnnotations = false;
    annotationIndent = -1;
  };

  for (const { n, text: l } of lines) {
    const indent = indentOf(l);
    const body = l.trim();

    const startsRule = /^-\s+alert:\s*(\S.*)$/.exec(body);
    if (startsRule) {
      closeRule();
      const name = normalizeScalar(startsRule[1]);
      current = { line: n, name, fields: new Map([['alert', name]]), annotations: new Map() };
      ruleIndent = indent + 2;   // "- " prefix
      field = 'alert';
      continue;
    }
    if (!current) continue;

    // Leaving the rule list entirely (dedent past the item body).
    if (indent < ruleIndent && !/^-\s/.test(body)) {
      closeRule();
      continue;
    }

    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*([\s\S]*)$/.exec(body);

    if (kv && indent === ruleIndent) {
      field = kv[1];
      current.fields.set(field, normalizeScalar(kv[2]));
      inAnnotations = field === 'annotations';
      annotationIndent = -1;
      annKey = null;
      continue;
    }

    if (indent > ruleIndent) {
      if (inAnnotations) {
        if (kv) {
          if (annotationIndent === -1) annotationIndent = indent;
          if (indent === annotationIndent) {
            annKey = kv[1];
            current.annotations.set(annKey, normalizeScalar(kv[2]));
            continue;
          }
        }
        // Continuation line of the current annotation's block scalar.
        if (annKey) {
          current.annotations.set(annKey, `${current.annotations.get(annKey)} ${body}`.trim());
        }
        continue;
      }
      // Continuation of a top-level block scalar, or a nested labels entry.
      if (field) current.fields.set(field, `${current.fields.get(field)} ${body}`.trim());
      continue;
    }
  }
  closeRule();
  return rules;
}

/* ------------------------------------------------------------------ */
/* PromQL shape checks                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cheap structural sanity for a PromQL expression. Not a parser — it catches
 * the class of breakage a hand-edited rule file actually produces: unbalanced
 * delimiters and mashed operator runs. Returns an error string, or null.
 */
function promqlShapeError(expr) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  let quote = null;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { stack.push(c); continue; }
    if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== pairs[c]) return `unbalanced "${c}" at offset ${i}`;
    }
  }
  if (quote) return 'unterminated string literal';
  if (stack.length) return `${stack.length} unclosed "${stack.join('')}"`;
  if (/[<>=!~+\-*/]{3,}/.test(expr)) return 'nonsensical operator run (3+ consecutive operator characters)';
  if (/(^|[^<>=!])[<>]\s*[<>]/.test(expr)) return 'doubled comparison operator';
  return null;
}

/* ------------------------------------------------------------------ */
/* Metric-name inventory                                               */
/* ------------------------------------------------------------------ */

function knownMetricNames() {
  const sources = [
    path.join(ROOT, 'apps', 'gateway', 'gateway.app.ts'),
    path.join(ROOT, 'libs', 'metrics', 'index.ts')
  ];
  const names = new Set();
  for (const f of sources) {
    if (!fs.existsSync(f)) {
      console.error(`FATAL: metric source not found: ${f}`);
      process.exit(2);
    }
    const src = fs.readFileSync(f, 'utf8');
    // Names appear both in "# HELP <name>" strings and as literal identifiers.
    for (const m of src.matchAll(/(?:HELP\s+|['"`])((?:http|skyline)_[a-z0-9_]+)/g)) {
      names.add(m[1]);
    }
  }
  return names;
}

/** Metric-looking identifiers inside a PromQL expression. */
function metricsInExpr(expr) {
  const found = new Set();
  for (const m of expr.matchAll(/\b((?:http|skyline)_[a-z0-9_]+)\b/g)) found.add(m[1]);
  return [...found];
}

/**
 * RF-03(d): harvest placeholder declarations ONLY from comment blocks that
 * begin at a PLACEHOLDER marker. A block ends at the first blank comment line
 * (`#` with nothing after it) or the first non-comment line. This is what stops
 * a fabricated name pasted under the "IMPLEMENTED" heading from being read as a
 * legitimate placeholder declaration.
 */
function declaredPlaceholderNames(text) {
  const lines = text.split('\n');
  const names = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*#/.test(lines[i]) || !/PLACEHOLDER/.test(lines[i])) continue;
    const block = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      if (!/^\s*#/.test(lines[j])) break;
      if (/^\s*#\s*$/.test(lines[j])) break;
      block.push(lines[j]);
    }
    for (const name of metricsInExpr(block.join('\n'))) names.add(name);
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

console.log('');
console.log('Observability artifact validation (Phase 3 / AC-P3-9, AC-P3-10)');
console.log('');

const known = knownMetricNames();
console.log(`Metric names discoverable in the /metrics handler (${known.size}):`);
console.log(`  ${[...known].sort().join('\n  ')}`);
console.log('');

/* ---- 1. alerting rules ---- */
console.log('alerting-rules.yml');
ok(fs.existsSync(RULES), 'alerting-rules.yml exists', RULES);
const rulesText = fs.readFileSync(RULES, 'utf8');

const rules = readRules(rulesText);
ok(rules.length === EXPECTED_ALERT_COUNT,
  `contains exactly ${EXPECTED_ALERT_COUNT} alert rules`,
  `found ${rules.length}: ${rules.map((r) => r.name).join(', ')}`);

// Independent cross-check on the raw text so a parser bug cannot hide a rule.
const rawAlertCount = (rulesText.match(/^\s*-\s+alert:\s*\S/gm) || []).length;
ok(rawAlertCount === EXPECTED_ALERT_COUNT,
  `raw "- alert:" line count agrees (${rawAlertCount})`);

const declaredPlaceholders = declaredPlaceholderNames(rulesText);

for (const r of rules) {
  const label = r.name || `<unnamed rule at line ${r.line}>`;

  const missing = REQUIRED_RULE_FIELDS.filter((k) => !r.fields.has(k));
  ok(missing.length === 0, `${label}: has ${REQUIRED_RULE_FIELDS.join('/')}`,
    `missing ${missing.join(', ')} (line ${r.line})`);

  // RF-03(a): presence is not enough — the value must be a non-empty scalar.
  const empty = NON_EMPTY_RULE_FIELDS.filter((k) => !String(r.fields.get(k) || '').trim());
  ok(empty.length === 0, `${label}: ${NON_EMPTY_RULE_FIELDS.join('/')} all have non-empty values`,
    `empty: ${empty.join(', ')} (line ${r.line})`);

  const missingAnn = REQUIRED_ANNOTATIONS.filter((k) => !r.annotations.has(k));
  ok(missingAnn.length === 0, `${label}: annotations include summary + description`,
    `missing ${missingAnn.join(', ')} (line ${r.line})`);

  const emptyAnn = REQUIRED_ANNOTATIONS.filter((k) => !String(r.annotations.get(k) || '').trim());
  ok(emptyAnn.length === 0, `${label}: summary + description are non-empty`,
    `empty: ${emptyAnn.join(', ')} (line ${r.line})`);

  // RF-03(b)+(c): the expression must be shaped like PromQL and must actually
  // observe something.
  const expr = String(r.fields.get('expr') || '');
  if (expr.trim()) {
    const shape = promqlShapeError(expr);
    ok(shape === null, `${label}: expr is delimiter-balanced and operator-sane`,
      `${shape} (line ${r.line})`);

    const refs = metricsInExpr(expr);
    ok(refs.length > 0, `${label}: expr references at least one metric`,
      `expr observes no http_*/skyline_* series (line ${r.line}): ${expr.slice(0, 80)}`);

    const unknown = refs.filter((n) => !known.has(n) && !declaredPlaceholders.has(n));
    ok(unknown.length === 0,
      `${label}: every metric it uses is implemented or declared PLACEHOLDER`,
      `undeclared: ${unknown.join(', ')} (line ${r.line})`);
  }
}

/* ---- 1b. js-yaml cross-check ---- */
// RF-03(e): js-yaml is a declared backend devDependency. The sibling contracts
// package is kept as a fallback resolution path for checkouts where only that
// package has been installed. If neither resolves we WARN loudly instead of
// quietly SKIPping, because the hand-rolled reader above — strict as it now is
// — is still not a YAML parser and cannot catch every malformed document.
let jsyaml = null;
try {
  jsyaml = require('js-yaml');
} catch {
  try {
    jsyaml = require(path.join(ROOT, '..', 'skyline-rush-contracts', 'node_modules', 'js-yaml'));
  } catch { /* reported below */ }
}

if (jsyaml) {
  try {
    const doc = jsyaml.load(rulesText);
    const parsed = (doc.groups || []).flatMap((g) => g.rules || []);
    ok(parsed.length === EXPECTED_ALERT_COUNT,
      `js-yaml cross-check: parses to ${EXPECTED_ALERT_COUNT} rules`,
      `js-yaml found ${parsed.length}`);

    const bad = [];
    for (const r of parsed) {
      const nm = r.alert || '<unnamed>';
      for (const k of REQUIRED_RULE_FIELDS) {
        if (r[k] === undefined || r[k] === null) bad.push(`${nm}: missing ${k}`);
      }
      for (const k of NON_EMPTY_RULE_FIELDS) {
        const v = r[k];
        if (typeof v === 'string' && !v.trim()) bad.push(`${nm}: ${k} is empty`);
        if (v && typeof v === 'object' && Object.keys(v).length === 0) bad.push(`${nm}: ${k} is empty`);
      }
      for (const k of REQUIRED_ANNOTATIONS) {
        const v = r.annotations && r.annotations[k];
        if (typeof v !== 'string' || !v.trim()) bad.push(`${nm}: annotation ${k} is missing or empty`);
      }
      if (typeof r.expr === 'string' && r.expr.trim()) {
        const shape = promqlShapeError(r.expr);
        if (shape) bad.push(`${nm}: expr ${shape}`);
        if (metricsInExpr(r.expr).length === 0) bad.push(`${nm}: expr references no metric`);
      }
    }
    ok(bad.length === 0, 'js-yaml cross-check: every rule has all required non-empty fields',
      bad.join(' | '));
  } catch (e) {
    ok(false, 'js-yaml cross-check: file is valid YAML', e.message);
  }
} else {
  console.warn('  WARN  js-yaml cross-check UNAVAILABLE — js-yaml resolved from neither');
  console.warn('        skyline-rush-backend/node_modules nor skyline-rush-contracts/node_modules.');
  console.warn('        The strict hand-rolled reader above still ran and still gates this file,');
  console.warn('        but it is not a YAML parser: a malformed document it happens to tolerate');
  console.warn('        would not be caught here. Run `npm install` in skyline-rush-backend.');
}

/* ---- 2. dashboards ---- */
console.log('');
console.log('dashboards/');
ok(fs.existsSync(DASH_DIR), 'dashboards/ directory exists');

const present = fs.existsSync(DASH_DIR) ? fs.readdirSync(DASH_DIR).filter((f) => f.endsWith('.json')).sort() : [];
ok(EXPECTED_DASHBOARDS.every((f) => present.includes(f)),
  `all 4 expected dashboards present`,
  `found: ${present.join(', ')}`);

let totalPanels = 0;
let totalTargets = 0;
let placeholderTargets = 0;

for (const file of EXPECTED_DASHBOARDS) {
  const p = path.join(DASH_DIR, file);
  if (!fs.existsSync(p)) { ok(false, `${file}: exists`); continue; }
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    ok(false, `${file}: parses as valid JSON`, e.message);
    continue;
  }
  ok(true, `${file}: parses as valid JSON`);
  ok(typeof doc.title === 'string' && doc.title.length > 0, `${file}: has a title`);
  ok(Array.isArray(doc.panels) && doc.panels.length > 0, `${file}: has a non-empty panels array`);

  const bad = [];
  for (const panel of doc.panels || []) {
    totalPanels++;
    if (!Array.isArray(panel.targets) || panel.targets.length === 0) {
      bad.push(`panel ${panel.id} "${panel.title}" has no targets`);
      continue;
    }
    for (const t of panel.targets) {
      totalTargets++;
      if (typeof t.expr !== 'string' || t.expr.trim() === '') {
        bad.push(`panel ${panel.id} target ${t.refId} has no expr`);
        continue;
      }
      const shape = promqlShapeError(t.expr);
      if (shape) {
        bad.push(`panel ${panel.id} target ${t.refId} expr ${shape}`);
        continue;
      }
      const status = t.skylineMetricStatus;
      if (status !== 'implemented' && status !== 'placeholder') {
        bad.push(`panel ${panel.id} target ${t.refId} lacks skylineMetricStatus`);
        continue;
      }
      if (status === 'placeholder') placeholderTargets++;
      const refs = metricsInExpr(t.expr);
      if (refs.length === 0) {
        bad.push(`panel ${panel.id} target ${t.refId} references no metric`);
        continue;
      }
      if (status === 'implemented') {
        const unknown = refs.filter((n) => !known.has(n));
        if (unknown.length) {
          bad.push(`panel ${panel.id} target ${t.refId} claims "implemented" but ${unknown.join(', ')} is not in the /metrics handler`);
        }
      } else {
        // A "placeholder" target must actually contain at least one metric
        // that is NOT implemented — otherwise it is mislabelled.
        if (refs.every((n) => known.has(n))) {
          bad.push(`panel ${panel.id} target ${t.refId} is marked placeholder but every metric it uses exists`);
        }
        if (!(panel.description || '').includes('PLACEHOLDER')) {
          bad.push(`panel ${panel.id} has a placeholder target but its description does not say PLACEHOLDER`);
        }
      }
    }
  }
  ok(bad.length === 0, `${file}: every panel target resolves or is a documented placeholder`,
    bad.join(' | '));
}

console.log('');
console.log(`${totalPanels} panels / ${totalTargets} targets validated ` +
  `(${totalTargets - placeholderTargets} implemented, ${placeholderTargets} documented placeholders).`);
console.log('');

if (failures > 0) {
  console.error(`${failures} of ${checks} observability checks FAILED.`);
  process.exit(1);
}
console.log(`OK — ${checks} observability checks passed.`);
process.exit(0);
