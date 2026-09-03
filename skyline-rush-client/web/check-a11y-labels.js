#!/usr/bin/env node
/**
 * check-a11y-labels.js — accessible-name audit for the Skyline Rush web client.
 *
 * Zero dependencies, no DOM library. Scans:
 *   - index.html  (static markup)
 *   - game.js     (HTML emitted from template literals: roster cards, contract
 *                  rows, leaderboard rows, supply-drop odds rows, shop rows)
 *
 * Flags every <button>, <input> and <a> that has no accessible name, per the
 * HTML-AAM name-computation order actually reachable by static analysis:
 *   1. aria-labelledby
 *   2. aria-label
 *   3. <label for="id">        (form controls)
 *   4. visible inner text      (subtrees marked aria-hidden="true" removed)
 *   5. title
 * `placeholder` is deliberately NOT accepted as an accessible name for text
 * inputs — it disappears on input and is announced inconsistently.
 *
 * It additionally flags names that exist but cannot identify the control:
 *   - GENERIC : the whole name is a context-free verb ("BUY", "OK", "CLAIM")
 *   - DUPLICATE : two controls in the same file share one static name
 * Both are real WCAG 2.4.6 / 4.1.2 problems for screen-reader users navigating
 * by element list, so they exit non-zero too.
 *
 * Names containing an unresolved `${...}` interpolation are treated as dynamic
 * and are exempt from the DUPLICATE check (they differ at runtime per item).
 *
 * Exit code 0 = no violations. Non-zero = violations printed.
 *
 * Usage: node check-a11y-labels.js      (or: npm run check:a11y)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TARGETS = [
  { file: path.join(__dirname, 'index.html'), label: 'index.html' },
  { file: path.join(__dirname, 'game.js'), label: 'game.js (template literals)' }
];

/** Whole accessible names that carry no information on their own. */
const GENERIC_NAMES = new Set([
  'buy', 'buy now', 'acquire', 'get', 'go', 'ok', 'okay', 'yes', 'no',
  'submit', 'send', 'click', 'click here', 'here', 'more', 'learn more',
  'read more', 'open', 'close', 'next', 'back', 'continue', 'done',
  'select', 'choose', 'equip', 'unlock', 'claim', 'claimed', 'equipped',
  'in progress', 'apply', 'confirm', 'cancel', 'edit', 'delete', 'remove',
  'add', 'view', 'details', 'info', 'action', 'button', 'link'
]);

const VOID_INPUT_TYPES_EXEMPT = new Set(['hidden']);

/* ------------------------------------------------------------------ */
/* Tiny tag scanner                                                    */
/* ------------------------------------------------------------------ */

/** Parse an attribute string into a lowercase-keyed map. */
function parseAttrs(attrText) {
  const attrs = {};
  const re = /([a-zA-Z_:@\-.][a-zA-Z0-9_:@\-.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(attrText)) !== null) {
    const v = m[3] !== undefined ? m[3] : m[4];
    attrs[m[1].toLowerCase()] = v;
  }
  // Boolean attributes (disabled, required, ...)
  const bre = /(^|\s)([a-zA-Z\-]+)(?=\s|$)/g;
  let b;
  while ((b = bre.exec(attrText)) !== null) {
    const k = b[2].toLowerCase();
    if (!(k in attrs)) attrs[k] = '';
  }
  return attrs;
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}

/**
 * Find every occurrence of `<tag ...>` in src. For container tags, also return
 * the raw inner HTML by scanning to the matching close tag (depth-aware).
 */
function findElements(src, tag, container) {
  const out = [];
  const open = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
  let m;
  while ((m = open.exec(src)) !== null) {
    const attrs = parseAttrs(m[1] || '');
    const start = m.index;
    let inner = '';
    if (container) {
      const closeRe = new RegExp(`<${tag}(\\s[^>]*)?>|</${tag}\\s*>`, 'gi');
      closeRe.lastIndex = open.lastIndex;
      let depth = 1;
      let c;
      let end = -1;
      while ((c = closeRe.exec(src)) !== null) {
        if (c[0][1] === '/') {
          depth--;
          if (depth === 0) { end = c.index; break; }
        } else {
          depth++;
        }
      }
      inner = end === -1 ? '' : src.slice(open.lastIndex, end);
    }
    out.push({ tag, attrs, inner, index: start, line: lineOf(src, start), raw: m[0] });
  }
  return out;
}

/** Strip aria-hidden subtrees, then all tags/entities, leaving visible text. */
function visibleText(html) {
  let s = html;
  // Remove any element subtree explicitly hidden from the a11y tree.
  s = s.replace(
    /<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?\saria-hidden\s*=\s*["']true["'][^>]*)>[\s\S]*?<\/\1\s*>/gi,
    ' '
  );
  // Self-closing / void hidden elements.
  s = s.replace(/<[a-zA-Z][^>]*\saria-hidden\s*=\s*["']true["'][^>]*\/?>/gi, ' ');
  s = s.replace(/<[^>]*>/g, ' ');
  s = s.replace(/&nbsp;|&#160;/gi, ' ');
  s = s.replace(/&[a-zA-Z#0-9]+;/g, '');
  // Drop pictographs / symbols — an emoji alone is not a reliable name.
  s = s.replace(/[←-⯿☀-➿️\u{1F000}-\u{1FAFF}]/gu, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeName(n) {
  return n.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isDynamic(n) {
  return /\$\{/.test(n);
}

/* ------------------------------------------------------------------ */
/* Accessible-name computation                                         */
/* ------------------------------------------------------------------ */

function computeName(el, labelForMap) {
  const a = el.attrs;
  if (a['aria-labelledby']) {
    return { name: `[aria-labelledby=${a['aria-labelledby']}]`, source: 'aria-labelledby' };
  }
  if (a['aria-label'] && a['aria-label'].trim()) {
    return { name: a['aria-label'].trim(), source: 'aria-label' };
  }
  if (a.id && labelForMap.has(a.id)) {
    return { name: labelForMap.get(a.id), source: 'label[for]' };
  }
  const text = visibleText(el.inner || '');
  if (text) return { name: text, source: 'inner text' };
  if (a.title && a.title.trim()) return { name: a.title.trim(), source: 'title' };
  return { name: '', source: null };
}

/* ------------------------------------------------------------------ */
/* Audit one file                                                      */
/* ------------------------------------------------------------------ */

function auditFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`FATAL: ${filePath} not found`);
    process.exit(2);
  }
  const src = fs.readFileSync(filePath, 'utf8');

  // Map <label for="x">text</label> -> text
  const labelForMap = new Map();
  for (const l of findElements(src, 'label', true)) {
    if (l.attrs.for) {
      const t = visibleText(l.inner);
      if (t) labelForMap.set(l.attrs.for, t);
    }
  }

  // RF-09: `select` and `textarea` are included so adding one later does not
  // silently escape the audit. See SCOPE_PROBES below for what this static
  // tag-based scan still cannot see.
  const elements = [
    ...findElements(src, 'button', true),
    ...findElements(src, 'a', true),
    ...findElements(src, 'select', true),
    ...findElements(src, 'textarea', true),
    ...findElements(src, 'input', false)
  ].sort((x, y) => x.index - y.index);

  const violations = [];
  const checked = [];
  const seen = new Map(); // normalized static name -> first element

  for (const el of elements) {
    const a = el.attrs;

    if (el.tag === 'input') {
      const type = (a.type || 'text').toLowerCase();
      if (VOID_INPUT_TYPES_EXEMPT.has(type)) continue;
      // value= supplies the name for submit/button/reset inputs.
      if (['submit', 'button', 'reset'].includes(type) && a.value && a.value.trim()) {
        checked.push({ el, name: a.value.trim(), source: 'value' });
        continue;
      }
    }
    if (el.tag === 'a' && !('href' in a) && !('role' in a)) {
      // A non-href anchor is not an interactive control.
      continue;
    }

    const { name, source } = computeName(el, labelForMap);
    const id = a.id ? `#${a.id}` : (a.class ? `.${a.class.split(/\s+/)[0]}` : '');
    const desc = `<${el.tag}${id ? ' ' + id : ''}>`;

    if (!name) {
      const hint = a.placeholder
        ? ` (has placeholder="${a.placeholder}" — placeholder is not an accessible name)`
        : '';
      violations.push({
        kind: 'MISSING',
        file: label,
        line: el.line,
        desc,
        detail: `no accessible name${hint}`,
        raw: el.raw.slice(0, 110)
      });
      continue;
    }

    checked.push({ el, name, source, desc });

    const norm = normalizeName(name);
    if (!isDynamic(name)) {
      if (GENERIC_NAMES.has(norm)) {
        violations.push({
          kind: 'GENERIC',
          file: label,
          line: el.line,
          desc,
          detail: `accessible name "${name}" (via ${source}) is context-free — add an aria-label naming the specific target`,
          raw: el.raw.slice(0, 110)
        });
      } else if (seen.has(norm)) {
        violations.push({
          kind: 'DUPLICATE',
          file: label,
          line: el.line,
          desc,
          detail: `accessible name "${name}" duplicates ${seen.get(norm).desc} on line ${seen.get(norm).line}`,
          raw: el.raw.slice(0, 110)
        });
      } else {
        seen.set(norm, { desc, line: el.line });
      }
    }
  }

  return { violations, checked, total: elements.length };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  let allViolations = [];
  let totalChecked = 0;

  console.log('');
  console.log('Accessible-name audit — Skyline Rush web client');

  for (const t of TARGETS) {
    const { violations, checked } = auditFile(t.file, t.label);
    totalChecked += checked.length;
    allViolations = allViolations.concat(violations);
    console.log(`  ${t.label}: ${checked.length} named control(s), ${violations.length} violation(s)`);
  }

  /* ---------------------------------------------------------------- *
   * RF-09: honest scope disclosure.
   *
   * This scanner matches literal <button>/<a>/<input>/<select>/<textarea>
   * tags in the source text. It CANNOT see ARIA-role widgets, elements made
   * focusable with [tabindex], or controls built at runtime with
   * document.createElement. Printing an unqualified "N interactive controls
   * all expose an accessible name" implied whole-app coverage it does not
   * have, so the residue is now counted and named explicitly.
   * ---------------------------------------------------------------- */
  const SCOPE_PROBES = [
    { label: 'ARIA-role widgets (role="button"/"link"/"checkbox"/"switch"/"tab")',
      re: /role\s*=\s*["'](?:button|link|checkbox|switch|tab|menuitem|option)["']/g },
    { label: 'elements made focusable with [tabindex]', re: /\btabindex\s*=/g },
    { label: 'controls constructed at runtime (document.createElement)',
      re: /document\.createElement\(\s*['"`](?:button|a|input|select|textarea)['"`]\s*\)/g }
  ];

  const residue = SCOPE_PROBES.map((p) => {
    let n = 0;
    for (const t of TARGETS) {
      if (!fs.existsSync(t.file)) continue;
      n += (fs.readFileSync(t.file, 'utf8').match(p.re) || []).length;
    }
    return { label: p.label, n };
  });

  console.log('');
  console.log('Scope of this check:');
  console.log('  COVERED     literal <button>, <a>, <input>, <select>, <textarea> tags in');
  console.log(`              ${TARGETS.map((t) => t.label).join(' and ')}.`);
  console.log('  NOT COVERED the following, which need manual review or a real DOM:');
  for (const r of residue) {
    console.log(`              - ${r.label}: ${r.n} occurrence(s) in source`);
  }
  console.log('              Known instance: game.js handleDataExport() builds an <a> via');
  console.log('              createElement to trigger the GDPR export download. It is clicked');
  console.log('              programmatically and never inserted into the document, so it is');
  console.log('              never focusable or announced and needs no accessible name.');

  console.log('');
  if (allViolations.length === 0) {
    console.log(
      `OK — ${totalChecked} control(s) matched by the static ` +
      `<button>/<a>/<input>/<select>/<textarea> scan each expose a unique, descriptive ` +
      `accessible name. Role-based and dynamically-constructed controls are outside ` +
      `this script's reach (see scope above).`
    );
    process.exit(0);
  }

  const col = (s, n) => String(s).padEnd(n).slice(0, n);
  console.error(col('KIND', 11) + col('FILE', 30) + col('LINE', 7) + col('ELEMENT', 26) + 'PROBLEM');
  console.error('-'.repeat(140));
  for (const v of allViolations) {
    console.error(col(v.kind, 11) + col(v.file, 30) + col(v.line, 7) + col(v.desc, 26) + v.detail);
    console.error(`           ${v.raw.replace(/\s+/g, ' ')}`);
  }
  console.error('-'.repeat(140));
  console.error(`${allViolations.length} accessible-name violation(s) across ${TARGETS.length} file(s).`);
  process.exit(1);
}

main();
