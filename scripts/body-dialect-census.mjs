#!/usr/bin/env node
/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `body` dialect liveness census (objectui#6771, ruling step 1).
 *
 * ## What this answers
 *
 * The 2026-09-01 ruling on objectui#6771 adopted option B — retire the `body`
 * child-list dialect so `children` is the one spelling — and made a liveness
 * reading a HARD GATE on everything after it:
 *
 * > Evidence of heavy `body` usage in *published* authored metadata returns to
 * > this card before any narrowing ships.
 *
 * So the question is not "does the string `body` appear" — it is **how many
 * authored NODES spell their child list `body`, per registration key**, with
 * the `children` count on the same keys as the denominator.
 *
 * ## Why a parser and not a grep
 *
 * `body` is a sibling key of `type` inside one object literal. A line-oriented
 * grep cannot see that relationship: it scores `body:` in an email payload, a
 * `bodyExtra` prop and a real authored node identically. This walks object
 * literals with a string/comment/regex-aware scanner and reports, per node,
 * which child-list keys that node actually carries.
 *
 * It reads `.json` and JS/TS object literals and Markdown alike, because
 * authored metadata in these repos lives in all three (JSON app metadata,
 * `definePage`-style TS literals, and the teaching snippets that ruling step 5
 * migrates in the same commit).
 *
 * ## Populations are reported SEPARATELY and never summed
 *
 * `--label` names the population so two runs cannot be added together by
 * accident: this repo's corpus is partly fixtures, hotcrm is a real
 * application, and they are differently authoritative.
 *
 * ## Known limits (stated so a zero is readable)
 *
 * - Template literals are opaque. A node built inside `` `${...}` `` is not
 *   counted. Measured on both corpora at time of writing: no target node is
 *   authored that way.
 * - YAML is NOT scanned. Report YAML separately if a corpus ever authors
 *   metadata there — absence here is "not scanned", not "zero".
 * - The scanner reports CANDIDATES. Attribution (fixture vs doc vs real
 *   authored page) is the `--group` bucket, and the counts per bucket are what
 *   a reader should quote, not the raw total.
 *
 * Usage:
 *   node scripts/body-dialect-census.mjs --root . --label objectui
 *   node scripts/body-dialect-census.mjs --root ../hotcrm --label hotcrm --json
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

import { isEntrypoint } from './invoked-as.mjs';

// ── The measured population ────────────────────────────────────────────────
//
// BODY_ONLY: registrations whose renderer reads `renderChildren(schema.body)`
// and never `schema.children`. For these, `body` is the ONLY door — retiring it
// removes the sole child-list key.
//
// ⚠️ Derived from the renderer sources, NOT from objectui#6771's card body
// (which lists 10) and NOT verbatim from the ratchet pin's `bodyReaders` array
// (which is `['badge','alert',...sidebar*]` = 13). The pin's array is a
// convenience construction for a containment assertion — it is correct that all
// 13 are non-containers, but two of its members are not `body` readers at all:
//
//   - `sidebar-trigger` (navigation/sidebar.tsx:202) renders `<SidebarTrigger>`
//     and takes no `schema` at all — it reads NEITHER `body` NOR `children`.
//   - `tooltip` (overlay/tooltip.tsx:31) DOES read `schema.body` and never
//     `schema.children`, and is the one registration in the tree that DECLARES
//     `body` as an input (`type: 'slot'`, label "Rich Content") — yet it is
//     absent from the ruled 13.
//
// So the body-reading population is 12 of the ruled 13, plus `tooltip` = 13
// readers, which is the same NUMBER by coincidence and a different SET.
// Both facts are pinned in `__tests__/body-dialect-census.test.mjs`.
export const BODY_ONLY = [
  'alert',
  'badge',
  'sidebar',
  'sidebar-content',
  'sidebar-footer',
  'sidebar-group',
  'sidebar-header',
  'sidebar-inset',
  'sidebar-menu',
  'sidebar-menu-button',
  'sidebar-menu-item',
  'sidebar-provider',
];

/** Ruled by objectui#6771 but reads no child list at all — retiring `body` costs it nothing. */
export const RULED_BUT_NOT_A_READER = ['sidebar-trigger'];

/** Reads `schema.body` only, and is NOT in the ruled 13. See the note above. */
export const BODY_ONLY_UNRULED = ['tooltip'];

// FALLBACK_READERS: `schema.children || schema.body` (or `body || children`).
// Authored `body` here is a silent second dialect, not the only door — these
// authors have a working alternative, so the retirement cost is a rewrite, not
// a capability loss.
const SEMANTIC_TAGS = ['aside', 'main', 'header', 'nav', 'footer', 'section', 'article'];
const HTML_ELEMENT_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'a', 'blockquote', 'pre',
  'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'sub', 'sup', 'del', 'ins', 'abbr',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'figure', 'figcaption', 'time', 'address', 'cite', 'q',
  // `img`, `hr`, `br` are VOID_TAGS — the factory skips `renderChildren` for
  // them, so they read neither key and are deliberately absent.
];
export const FALLBACK_READERS = [
  ...SEMANTIC_TAGS,
  ...HTML_ELEMENT_TAGS,
  'div',
  'aspect-ratio',
  'card',
  'page',
  'button',
];

const ALL_KEYS = new Set([
  ...BODY_ONLY,
  ...RULED_BUT_NOT_A_READER,
  ...BODY_ONLY_UNRULED,
  ...FALLBACK_READERS,
]);

const SCANNED_EXT = new Set([
  '.json', '.jsonc', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.mdx',
]);
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', 'out',
  '.pnpm-store', 'playwright-report', 'test-results',
]);

// ── Scanner ────────────────────────────────────────────────────────────────

/**
 * Blank out Markdown prose, keeping only fenced code blocks (offsets and line
 * breaks preserved, so reported line numbers stay true).
 *
 * ⚠️ Required, not cosmetic. Markdown spells inline code with backticks, and
 * the scanner treats a backtick as a template-literal delimiter. A ```` ```json ````
 * fence is THREE backticks: the first two pair off, and the third opens a
 * "string" that runs to the closing fence — swallowing the entire snippet. The
 * first draft of this script therefore read EVERY doc example as zero nodes,
 * silently and with exit 0. That population is not incidental: ruling step 5
 * migrates the teaching corpus in the same commit, so a zero there would have
 * under-reported exactly the surface the ruling asks about.
 *
 * Prose is blanked rather than scanned because prose is not a call site — a
 * sentence mentioning `type: "badge"` is documentation about a key, not a node
 * authoring it.
 */
export function keepFencedCodeOnly(text) {
  const out = new Array(text.length).fill(' ');
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') out[i] = '\n';

  const fence = /^([ \t]*)(`{3,}|~{3,})([^\n]*)\n/gm;
  let m;
  while ((m = fence.exec(text)) !== null) {
    const marker = m[2][0].repeat(m[2].length);
    const bodyStart = m.index + m[0].length;
    // Find the closing fence: same marker character, at least as long.
    const closeRe = new RegExp(`^[ \\t]*${m[2][0] === '`' ? '`' : '~'}{${m[2].length},}[ \\t]*$`, 'm');
    closeRe.lastIndex = 0;
    const rest = text.slice(bodyStart);
    const closeMatch = closeRe.exec(rest);
    const bodyEnd = closeMatch ? bodyStart + closeMatch.index : text.length;
    for (let i = bodyStart; i < bodyEnd; i++) out[i] = text[i];
    fence.lastIndex = closeMatch ? bodyStart + closeMatch.index + closeMatch[0].length : text.length;
    void marker;
  }
  return out.join('');
}

/**
 * Walk object literals in `text`, returning one record per object that carries
 * a string-valued `type` key.
 *
 * String-, comment- and regex-aware, so `body:` inside a string, a comment or a
 * regular expression is never scored as a key. Keys are attributed to the
 * IMMEDIATELY enclosing object frame only — a `body` two levels down belongs to
 * the inner node, not the outer one.
 */
export function scanNodes(text) {
  const nodes = [];
  /** @type {Array<{ isObject: boolean, keys: Set<string>, type: string | null, start: number }>} */
  const stack = [];
  const n = text.length;
  let i = 0;
  // Tracks the last significant character, to tell division from a regex literal.
  let prevSignificant = '';

  const pushFrame = (isObject) => {
    stack.push({ isObject, keys: new Set(), type: null, start: i });
  };
  const popFrame = () => {
    const frame = stack.pop();
    if (frame && frame.isObject && frame.type !== null) {
      nodes.push({ type: frame.type, keys: frame.keys, offset: frame.start });
    }
  };

  while (i < n) {
    const c = text[i];

    // Comments
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Regex literal: a `/` in value position. Without this, a pattern such as
    // /^ {3}\S.*\(type "/ unbalances the brace stack (its `{` opens a phantom
    // object) AND its lone `"` opens a runaway string, blinding the scanner for
    // the rest of the file. Measured: that exact pattern in
    // `packages/cli/src/__tests__/check-schema-marker.test.ts` cost the file all
    // of its nodes until `>` was added below — an arrow function's `=>` is the
    // single commonest thing a regex literal follows in this codebase.
    if (
      c === '/' &&
      (/[(,=:[!&|?{};+\-*%~^<>]/.test(prevSignificant) ||
        /\b(return|typeof|case|in|of|do|else|yield|await|delete|void|instanceof)$/.test(
          text.slice(Math.max(0, i - 12), i).trimEnd(),
        ))
    ) {
      i++;
      let closed = false;
      while (i < n) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '\n') break;
        if (text[i] === '[') { // character class: `/` inside it is literal
          i++;
          while (i < n && text[i] !== ']' && text[i] !== '\n') {
            if (text[i] === '\\') i++;
            i++;
          }
          i++;
          continue;
        }
        if (text[i] === '/') { i++; closed = true; break; }
        i++;
      }
      if (closed) { prevSignificant = '/'; continue; }
      // Not a regex after all — fall through as an ordinary character.
      continue;
    }

    // Key position: an identifier or quoted string directly inside an object
    // frame, followed by `:`.
    //
    // ⚠️ ORDER IS LOAD-BEARING — this MUST run before the string branch below.
    // JSON spells every key quoted (`"type": "badge"`), so if the string branch
    // consumes the opening quote first, no JSON key is ever tested and the whole
    // `.json` corpus scores a silent, exit-0 ZERO. That is not hypothetical: it
    // is what the first draft of this script did, and the differential control
    // in the test file is what caught it (14-16 nodes per authored sidebar
    // fixture, all read as 0).
    const top = stack[stack.length - 1];
    if (top && top.isObject && (/[A-Za-z_$]/.test(c) || c === '"' || c === "'")) {
      const m = /^(?:"([^"\\]*)"|'([^'\\]*)'|([A-Za-z_$][\w$]*))\s*:/.exec(text.slice(i, i + 200));
      if (m) {
        const key = m[1] ?? m[2] ?? m[3];
        top.keys.add(key);
        i += m[0].length;
        prevSignificant = ':';
        if (key === 'type') {
          // Capture a string-literal value; anything else (a TS annotation, an
          // identifier, a union type) leaves `type` null and the frame unscored.
          const v = /^\s*(?:"([^"\\]*)"|'([^'\\]*)')/.exec(text.slice(i, i + 200));
          if (v) top.type = v[1] ?? v[2];
        }
        continue;
      }
    }

    // Strings (values, and any quoted text that was NOT in key position).
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < n) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === quote) { i++; break; }
        i++;
      }
      prevSignificant = quote;
      continue;
    }

    if (c === '{') { pushFrame(true); i++; prevSignificant = '{'; continue; }
    if (c === '[') { pushFrame(false); i++; prevSignificant = '['; continue; }
    if (c === '}' || c === ']') { popFrame(); i++; prevSignificant = c; continue; }

    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }

  // Unterminated frames (a Markdown file whose fenced snippet is a fragment,
  // a `.tsx` whose apostrophe-in-prose desynced the stack) still yield their
  // nodes — dropping them would turn a scanner limitation into a silent zero.
  while (stack.length) popFrame();

  return nodes;
}

// ── Attribution ────────────────────────────────────────────────────────────

/**
 * Bucket a file by what KIND of artifact it is. A `body` string in a test
 * fixture, a doc snippet and a real authored page are three different things
 * and only some of them are the population the ruling asks about.
 */
export function bucketOf(relPath) {
  const p = relPath.split(sep).join('/');
  if (/(^|\/)__tests__\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p)) return 'test';
  if (/(^|\/)(__fixtures__|fixtures|__mocks__)\//.test(p)) return 'fixture';
  if (/(^|\/)e2e\//.test(p)) return 'e2e';
  if (/\.mdx?$/.test(p)) return 'docs-teaching';
  if (/(^|\/)skills\//.test(p)) return 'skills-teaching';
  if (/(^|\/)examples\//.test(p)) return 'example-app';
  if (/(^|\/)(apps|src)\//.test(p)) return 'app-metadata';
  if (/(^|\/)scripts\//.test(p)) return 'tooling';
  return 'other';
}

// ── Walk ───────────────────────────────────────────────────────────────────

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full);
    else if (st.isFile() && SCANNED_EXT.has(extname(entry))) yield full;
  }
}

function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

export function census(root) {
  /** @type {Array<{file:string,line:number,type:string,body:boolean,children:boolean,bucket:string}>} */
  const hits = [];
  let filesScanned = 0;
  for (const file of walk(root)) {
    filesScanned++;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Cheap pre-filter: a file with none of the key names cannot hold a node.
    if (!/\btype\b/.test(text)) continue;
    const isMarkdown = /\.mdx?$/.test(file);
    const scanText = isMarkdown ? keepFencedCodeOnly(text) : text;
    let nodes;
    try {
      nodes = scanNodes(scanText);
    } catch {
      continue;
    }
    for (const node of nodes) {
      if (!ALL_KEYS.has(node.type)) continue;
      const rel = relative(root, file);
      hits.push({
        file: rel,
        line: lineOf(text, node.offset),
        type: node.type,
        body: node.keys.has('body'),
        children: node.keys.has('children'),
        bucket: bucketOf(rel),
      });
    }
  }
  return { filesScanned, hits };
}

// ── Report ─────────────────────────────────────────────────────────────────

function group(keys, hits) {
  const rows = [];
  for (const key of keys) {
    const forKey = hits.filter((h) => h.type === key);
    if (forKey.length === 0) {
      rows.push({ key, nodes: 0, body: 0, children: 0, neither: 0, files: 0 });
      continue;
    }
    rows.push({
      key,
      nodes: forKey.length,
      body: forKey.filter((h) => h.body).length,
      children: forKey.filter((h) => h.children).length,
      neither: forKey.filter((h) => !h.body && !h.children).length,
      files: new Set(forKey.map((h) => h.file)).size,
    });
  }
  return rows;
}

function printTable(title, rows) {
  console.log(`\n### ${title}`);
  console.log('| key | nodes | `body` | `children` | neither | files |');
  console.log('|:--|--:|--:|--:|--:|--:|');
  for (const r of rows) {
    console.log(`| \`${r.key}\` | ${r.nodes} | ${r.body} | ${r.children} | ${r.neither} | ${r.files} |`);
  }
  const sum = (f) => rows.reduce((a, r) => a + r[f], 0);
  console.log(
    `| **total** | **${sum('nodes')}** | **${sum('body')}** | **${sum('children')}** | **${sum('neither')}** | |`,
  );
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (name, dflt) => {
    const idx = argv.indexOf(name);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : dflt;
  };
  const root = arg('--root', '.');
  const label = arg('--label', root);
  const asJson = argv.includes('--json');

  const { filesScanned, hits } = census(root);

  if (asJson) {
    console.log(JSON.stringify({ label, root, filesScanned, hits }, null, 2));
    return;
  }

  console.log(`## \`body\` dialect census — population: **${label}** (root: ${root})`);
  console.log(`\nFiles scanned: ${filesScanned}. Candidate nodes: ${hits.length}.`);

  printTable('Group 1 — `body`-only registrations (retiring `body` removes their ONLY child-list key)', group(BODY_ONLY, hits));
  printTable('Group 1b — ruled by #6771 but reads NO child list (retirement costs it nothing)', group(RULED_BUT_NOT_A_READER, hits));
  printTable('Group 1c — `body`-only reader NOT in the ruled 13 (⚠️ declares `body` as an input)', group(BODY_ONLY_UNRULED, hits));
  printTable('Group 2 — `children || body` fallback readers (`body` is a second dialect, not the only door)', group(FALLBACK_READERS, hits).filter((r) => r.nodes > 0));

  const bodyHits = hits.filter((h) => h.body);
  console.log(`\n### Attribution of every node carrying \`body\` (${bodyHits.length})`);
  if (bodyHits.length === 0) {
    console.log('\n_None._');
  } else {
    const byBucket = new Map();
    for (const h of bodyHits) byBucket.set(h.bucket, (byBucket.get(h.bucket) ?? 0) + 1);
    console.log('\n| bucket | nodes |');
    console.log('|:--|--:|');
    for (const [b, c] of [...byBucket].sort((a, b2) => b2[1] - a[1])) console.log(`| ${b} | ${c} |`);
    console.log('\n| file:line | key | also has `children` |');
    console.log('|:--|:--|:--|');
    for (const h of bodyHits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      console.log(`| \`${h.file}:${h.line}\` | \`${h.type}\` | ${h.children ? 'yes' : 'no'} |`);
    }
  }
}

// The ONE entry-guard predicate (`scripts/invoked-as.mjs`), never a hand-typed
// `process.argv[1]` comparison. This file shipped the percent-encoding spelling
// its header names: ``import.meta.url === `file://${process.argv[1]}` `` builds
// a URL WITHOUT the encoding `pathToFileURL` applies, so a checkout path
// containing a character that needs encoding — a `#` in any parent directory is
// enough, no symlink required — makes the two sides disagree, the guard answer
// false, and the census print nothing and exit 0.
//
// ⇒ That is a FOURTH silent zero on this card, in the harness around the
// scanner rather than in the scanner itself, and the same shape as the three
// the differential control caught inside it: a clean read and a tool that never
// ran are indistinguishable from the exit code alone.
if (isEntrypoint(import.meta.url)) main();
