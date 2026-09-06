#!/usr/bin/env node
/**
 * Every `${…}` a `content/docs/**` json fence authors on a node must sit on a
 * channel `SchemaRenderer` actually evaluates. REPORT-ONLY: it prints a census
 * and never fails the build on its findings.
 *
 * Run:  node scripts/check-doc-expression-carriage.mjs
 *       node scripts/check-doc-expression-carriage.mjs --list       every fence, parsed or not
 *       node scripts/check-doc-expression-carriage.mjs --self-test  the controls alone
 * Exit: 0 = the census ran, whatever it found. 1 = the INSTRUMENT is broken —
 *       a derivation returned nothing, the spec artifact is missing, or a
 *       built-in control failed. Never 1 for a finding; see "Report-only" below.
 *
 * ## The hole this measures (objectui#7851)
 *
 * A json fence in these pages can author ANY key at all on a node and no gate
 * objects. Only the `type` string is judged:
 *
 *   - `check-doc-component-types` scans these pages and judges every `type`
 *     literal. Its own header states the exclusion in as many words: "NOT in
 *     scope, deliberately: whether the snippet's OTHER keys are read by the
 *     renderer the type resolves to."
 *   - `check-doc-snippet-types` covers these pages too, but type-checks `ts` /
 *     `tsx` blocks only. A json fence is never compiled against anything.
 *
 * ⇒ Between them the `type` is checked, the ts/tsx is checked, and the json
 * fence bodies are unchecked. Four cards of exactly that shape were each found
 * by a human or an agent re-reading a page, never by CI: objectui#7418
 * (`guide/expressions.md` authored `${…}` on six keys with no carriage row —
 * one of them, `badge.text`, is not a `BadgeSchema` key at all and rendered an
 * EMPTY badge), objectui#7440, objectui#7444, objectui#7838.
 *
 * ## What this answers, and the half it does NOT
 *
 * This file answers the EXPRESSION half only: *is this key evaluated?* It is
 * the cheap half, and the only one derivable from an artifact today. The wider
 * half — is this key READ BACK by the renderer the type resolves to, which is
 * what objectui#7440 and objectui#7444 are — needs the per-renderer read-point
 * contract `check-doc-component-types` names as the missing piece. ⛔ Do not
 * read a green census here as "the fences are correct"; read it as "no fence
 * authors an expression on a channel nothing evaluates".
 *
 * ## Report-only, and what would justify flipping it
 *
 * The 2026-09-06 dispatch ruling on objectui#7851: this class has four known
 * members and three of them are OPEN, so a blocking gate would go red on other
 * people's cards the day it landed and turn one card into four. The census IS
 * the deliverable — how many fences exist, how many carry an uncarried
 * expression, and on which pages — and that number is what decides later
 * whether the corpus gets cleaned first or a ledger gets built. ⛔ This file
 * does not make that decision.
 *
 * Same posture as `check-changeset-overwrite.mjs`, and the same boundary:
 * report-only means it declines to fail on its FINDINGS, never that it passes
 * without looking (objectstack#4928, objectui#4690). A broken derivation, an
 * unreadable input or a failed control is exit 1 — a gate that runs, goes
 * green and looked at nothing is the counterfeit this whole file guards
 * against, so it is exactly the thing that must be loud.
 *
 * ## Where the evaluated-channel universe comes from — derived, never a list
 *
 * A hand-typed list of "keys the renderer evaluates" would be a second dialect
 * of a declaration that already exists twice over, and it would rot silently in
 * the direction that produces FALSE FINDINGS on correct docs. So both halves
 * are re-derived on every run, and each one fails the gate rather than
 * shrinking if it stops matching:
 *
 *   CARRIAGE  `expressionBindableTextKeysFor(type)` out of the BUILT
 *             `@objectstack/spec` artifact — the same lookup
 *             `packages/react/src/SchemaRenderer.tsx` consumes. Read from the
 *             artifact rather than from prose or a table, which is the
 *             derivation objectui#7418 established and its triage seat asked
 *             every later reader to repeat rather than copy: the spec version
 *             moves.
 *   CHANNELS  the four legs `SchemaRenderer` evaluates, read off that file's
 *             own call sites — `evaluator.evaluate(newSchema.<key>)` (the
 *             `content` leg), `isConfigBag(newSchema.<key>)` (the `properties`
 *             and `props` bags), and
 *             `evaluate{Visibility,Enablement}Predicate(newSchema.<key>, …)`
 *             (the eight condition keys). Read from `run`-shaped call sites,
 *             never from the surrounding comments: that file's prose names
 *             `visibleOn`, `disabled` and the bags many times over, and a scan
 *             of the raw text would be describing its own docblocks.
 *
 * A node's carried set is the union of the two, and a node whose `type` has no
 * carriage row simply gets the channel keys — which is the point: `badge`,
 * `progress`, `input` and `list` carry NOTHING, so every `${…}` those nodes
 * author outside `content`, the bags and the condition keys is a finding.
 *
 * ## The parse surface is reported, because it is this instrument's blind spot
 *
 * A fence this file cannot parse is a fence it says nothing about, and a census
 * that reports only its hits hides how much it never read. So every run prints
 * `parsed` and `unparsed` and names every unparsed fence with its reason;
 * `--list` prints the whole inventory, parsed and unparsed alike.
 * objectui#7418's prototype reached 0 unparsed on `guide/expressions.md`
 * (39 of 39); this file reaches 0 unparsed over the whole tree, which takes
 * four tolerances beyond `JSON.parse`, all of them REMOVALS of non-data or an
 * envelope around it. None of them can invent a key:
 *
 *   1. Line comments and block comments outside strings. The pages annotate
 *      their examples this way.
 *   2. Raw newlines and tabs inside strings, re-escaped. These pages write
 *      multi-line ternaries inside a single `${…}` string.
 *   3. Trailing commas before `}` / `]`.
 *   4. Elision markers, in the three spellings the corpus uses — a bare `...`
 *      or `…` token, and a `"..."` STRING standing in a member position (never
 *      one in a value position, which is a real placeholder value, e.g.
 *      `"placeholder": "..."`).
 *
 * Plus one retry, not a tolerance: a fence that is an object BODY rather than
 * an object (`"dependencies": { … }`, a package.json excerpt) is retried
 * wrapped in braces.
 *
 * ## What it does not see, stated so nobody mistakes it for coverage
 *
 *   - A `${…}` inside an ARRAY on a node key (`"items": ["${a}"]`). Only string
 *     values directly on a node are judged.
 *   - A `${…}` in an object with no string `type`. Without a type there is no
 *     carriage row to judge against, and guessing one is how a gate produces
 *     false findings in both directions at once.
 *   - Anything outside a `json` / `jsonc` fence under `content/docs/**`. The
 *     `ts`/`tsx` blocks are `check-doc-snippet-types`' surface and are left to
 *     it; ⛔ this file changes no other gate's population.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

/** Where the teaching prose lives. The card's surface, and only it. */
export const DOCS_ROOT = 'content/docs';
/** The renderer whose evaluation legs define "carried". */
export const RENDERER_SOURCE = 'packages/react/src/SchemaRenderer.tsx';
/** Fence info strings whose body is a JSON document. */
export const JSON_FENCE_LANGUAGES = ['json', 'jsonc'];

const DOC_EXTENSIONS = ['.md', '.mdx'];

// ── The evaluated-channel universe ───────────────────────────────────────────

/**
 * The keys `SchemaRenderer` evaluates on every node, whatever its type, read off
 * that file's own call sites.
 *
 * Three shapes, because the renderer has three: a direct evaluate on a named
 * key, a config bag whose entries are all evaluated, and a predicate leg. The
 * carriage loop is deliberately NOT matched here — it indexes with a computed
 * key (`newSchema[key]`) because its keys come from the spec, which is the
 * other half of the derivation.
 *
 * Every group must match something. A rename upstream that silently emptied one
 * would narrow "carried" and turn correct documentation into findings, so an
 * empty group throws rather than reporting a smaller universe.
 */
export function deriveChannels(root = repoRoot) {
  const abs = join(root, RENDERER_SOURCE);
  if (!existsSync(abs)) {
    throw new Error(
      `${RENDERER_SOURCE} is not in this checkout, so the evaluated channels cannot be derived. ` +
        'Refusing to census against a guessed universe.',
    );
  }
  const source = readFileSync(abs, 'utf8');
  const collect = (pattern, label) => {
    const found = [...source.matchAll(pattern)].map((m) => m[1]);
    if (found.length === 0) {
      throw new Error(
        `the ${label} derivation matched nothing in ${RENDERER_SOURCE}. The call sites it reads have ` +
          'been renamed or removed; teach this derivation the new shape rather than letting the ' +
          'evaluated-channel universe shrink silently.',
      );
    }
    return [...new Set(found)].sort();
  };

  const direct = collect(/evaluator\.evaluate\(newSchema\.([A-Za-z_$][\w$]*)\)/g, 'direct-evaluate');
  const bags = collect(/isConfigBag\(newSchema\.([A-Za-z_$][\w$]*)\)/g, 'config-bag');
  const conditions = collect(
    /evaluate(?:Visibility|Enablement)Predicate\(newSchema\.([A-Za-z_$][\w$]*)\s*,/g,
    'condition-predicate',
  );

  return { direct, bags, conditions, all: [...new Set([...direct, ...bags, ...conditions])].sort() };
}

/**
 * The per-type carriage map, from the BUILT spec artifact.
 *
 * Not from the card that found this class, not from a table in a doc, and not
 * from `packages/types`: the lookup the renderer imports is the only answer that
 * cannot be stale, and it is versioned with the installed package.
 */
export async function loadCarriage() {
  let spec;
  try {
    spec = await import('@objectstack/spec/ui');
  } catch (error) {
    throw new Error(
      `the built @objectstack/spec artifact could not be imported (${error.message}). ` +
        'Run `pnpm install` first — without it there is no carriage map, and a census against an ' +
        'empty map would report every documented expression as uncarried.',
    );
  }
  const lookup = spec.expressionBindableTextKeysFor;
  if (typeof lookup !== 'function') {
    throw new Error(
      '@objectstack/spec/ui no longer exports `expressionBindableTextKeysFor`. That lookup IS the ' +
        'carriage map; teach this gate its replacement rather than defaulting to "carries nothing".',
    );
  }
  let version = 'unknown';
  try {
    const pkg = fileURLToPath(import.meta.resolve('@objectstack/spec/package.json'));
    version = JSON.parse(readFileSync(pkg, 'utf8')).version ?? 'unknown';
  } catch {
    // The version is printed for the record, never load-bearing.
  }
  return { keysFor: (type) => lookup(type) ?? [], version };
}

// ── Fence extraction ─────────────────────────────────────────────────────────

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walkFiles(abs, out);
    else if (DOC_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(abs);
  }
  return out;
}

/**
 * Comments out, raw newlines re-escaped, elision markers dropped — tolerances 1,
 * 2 and 4 of the four the header lists. All three are string-aware: a `//`
 * inside `"https://…"` is data, and so is a `"..."` in a value position.
 */
export function sanitizeFence(source) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (ch === '.' && source.slice(i, i + 3) === '...') {
      i += 2;
      continue;
    }
    if (ch === '…') continue;
    out += ch;
  }
  // Elisions first: removing one leaves the comma that introduced it, and that
  // trailing comma is what the next pass is for.
  return dropTrailingCommas(dropElisionStrings(out));
}

/** Tolerance 3, string-aware: `,` immediately before `}` or `]`. */
function dropTrailingCommas(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += ch;
  }
  return out;
}

/**
 * The last spelling of tolerance 4: an elision written AS a string, standing
 * where a member should be — `{ "type": "kanban", "..." }`. The dots survive the
 * scan above because they are inside a string, which is correct: the position is
 * what makes this one an elision. A dotted string after `:` is a real value
 * (`"placeholder": "..."`) and is left alone, which is why the preceding
 * `{` / `[` / `,` is part of the match rather than a lookbehind on nothing.
 */
function dropElisionStrings(text) {
  return text.replace(
    /([{[,])(\s*)"(?:\.{2,}|…+)"(\s*)(?=[,}\]])/g,
    (_m, open, before, after) => `${open}${before}${after}`,
  );
}

/** Every top-level JSON value in a fence, so a fence holding several parses. */
export function splitTopLevel(text) {
  const values = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  let junk = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      if (depth === 0) junk += ch;
      continue;
    }
    if (ch === '{' || ch === '[') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0 && start >= 0) {
        values.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) return { values, reason: 'unbalanced-brace' };
      continue;
    }
    if (depth === 0 && !/[\s,]/.test(ch)) junk += ch;
  }
  if (depth !== 0) return { values, reason: 'unterminated-brace' };
  if (values.length === 0) return { values, reason: 'no-json-value' };
  return { values, reason: junk.trim() === '' ? null : 'text-outside-any-value' };
}

/** Parse one fence body, with the object-BODY retry the header describes. */
export function parseFence(body) {
  // Every return carries the same four fields. A result whose SHAPE depends on
  // the outcome makes every caller — this file's own census and the pins in
  // `scripts/__tests__` alike — narrow a union before it can read `values`, and
  // `tsconfig.scripts.json` type-checks those pins.
  const failed = (reason) => ({ ok: false, reason, values: [], wrapped: false });
  const attempt = (text) => {
    const { values, reason } = splitTopLevel(text);
    if (reason) return failed(reason);
    const parsed = [];
    for (const value of values) {
      try {
        parsed.push(JSON.parse(value));
      } catch (error) {
        return failed(`invalid-json: ${error.message}`);
      }
    }
    return { ok: true, reason: null, values: parsed, wrapped: false };
  };

  const sanitized = sanitizeFence(body);
  const first = attempt(sanitized);
  if (first.ok) return first;
  // A fence that is an object BODY rather than an object.
  const wrapped = attempt(`{${sanitized}}`);
  return wrapped.ok ? { ...wrapped, wrapped: true } : first;
}

/** Every `json` / `jsonc` fence under the docs root, parsed or not. */
export function scanFences(root) {
  const files = walkFiles(join(root, DOCS_ROOT));
  const fences = [];
  for (const abs of files) {
    const rel = relative(root, abs).split(sep).join('/');
    const lines = readFileSync(abs, 'utf8').split('\n');
    let open = null;
    let body = [];
    for (let i = 0; i < lines.length; i++) {
      const fence = /^\s*```(\S*)\s*$/.exec(lines[i]);
      if (fence) {
        if (open) {
          if (JSON_FENCE_LANGUAGES.includes(open.lang)) {
            fences.push({ file: rel, line: open.line, lang: open.lang, body, ...parseFence(body.join('\n')) });
          }
          open = null;
          body = [];
        } else {
          open = { lang: (fence[1] || 'plaintext').toLowerCase(), line: i + 1 };
        }
        continue;
      }
      if (open) body.push(lines[i]);
    }
    if (open && JSON_FENCE_LANGUAGES.includes(open.lang)) {
      // An unclosed fence read the rest of the file as code. Report it as
      // unparsed rather than guessing where it ended.
      fences.push({
        file: rel,
        line: open.line,
        lang: open.lang,
        body,
        ok: false,
        reason: 'unterminated-fence',
        values: [],
        wrapped: false,
      });
    }
  }
  return { files: files.length, fences };
}

// ── The judgement ────────────────────────────────────────────────────────────

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const holdsExpression = (value) => typeof value === 'string' && value.includes('${');

/**
 * Every node — a plain object with a string `type` — reachable from a parsed
 * fence value, in document order.
 */
export function collectNodes(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out);
    return out;
  }
  if (!isPlainObject(value)) return out;
  if (typeof value.type === 'string') out.push(value);
  for (const child of Object.values(value)) collectNodes(child, out);
  return out;
}

/**
 * The line a finding should point at: the first line in this fence spelling
 * `"<key>"` alongside a `${`, each line claimed once so repeats advance instead
 * of all pointing at the first.
 */
function locate(fence, key, claimed) {
  for (let i = 0; i < fence.body.length; i++) {
    if (claimed.has(i)) continue;
    if (fence.body[i].includes(`"${key}"`) && fence.body[i].includes('${')) {
      claimed.add(i);
      return fence.line + 1 + i;
    }
  }
  return fence.line;
}

/**
 * The census. `channels` and `carriage` are injected so the controls below can
 * run the same judgement over a fixture without a second implementation of it.
 */
export function analyze(root, { channels, carriage }) {
  const scan = scanFences(root);
  const counters = {
    files: scan.files,
    fences: scan.fences.length,
    parsed: 0,
    unparsed: 0,
    wrapped: 0,
    nodes: 0,
    expressionSites: 0,
    carried: 0,
  };
  const sites = [];
  const unparsed = [];
  const inventory = [];

  for (const fence of scan.fences) {
    inventory.push({ file: fence.file, line: fence.line, lang: fence.lang, ok: fence.ok });
    if (!fence.ok) {
      counters.unparsed++;
      unparsed.push({ file: fence.file, line: fence.line, reason: fence.reason });
      continue;
    }
    counters.parsed++;
    if (fence.wrapped) counters.wrapped++;
    const claimed = new Set();
    for (const value of fence.values) {
      for (const node of collectNodes(value)) {
        counters.nodes++;
        const rows = carriage.keysFor(node.type);
        const carried = new Set([...channels.all, ...rows]);
        for (const [key, raw] of Object.entries(node)) {
          if (!holdsExpression(raw)) continue;
          counters.expressionSites++;
          if (carried.has(key)) {
            counters.carried++;
            continue;
          }
          sites.push({
            file: fence.file,
            line: locate(fence, key, claimed),
            fence: fence.line,
            type: node.type,
            key,
            value: raw.replace(/\s+/g, ' ').trim(),
            rows,
          });
        }
      }
    }
  }

  sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.key.localeCompare(b.key));
  return { counters, sites, unparsed, fences: inventory };
}

// ── Controls: the gate proves it can see, on every run ────────────────────────

/**
 * A gate that runs, goes green and looked at nothing is the counterfeit this
 * class of check produces most easily, so the instrument is exercised in BOTH
 * directions before the real census, on every run rather than once in a PR.
 *
 * The positive fixture is `guide/expressions.md`'s Status Badge block exactly as
 * it stood before PR #7847 repaired it: `badge` carries nothing, so both
 * `text` and `variant` are findings — and `text` is not even a `BadgeSchema`
 * key, which is how that site rendered an empty badge. The negative fixture is
 * the repaired shape plus the two channels that always carry, and must report
 * nothing.
 */
export const CONTROL_FIXTURES = {
  positive: `{
  "type": "badge",
  "text": "\${status}",
  "variant": "\${status === 'active' ? 'success' : 'warning'}",
  "visibleOn": "\${status !== null}"
}`,
  negative: `{
  "type": "card",
  "title": "\${item.name}",
  "description": "\${item.role}",
  "content": "\${greeting}",
  "properties": { "className": "\${theme.card}" },
  "visibleOn": "\${item.active}"
}`,
};

export function runControls({ channels, carriage }) {
  const judge = (source) => {
    const parsed = parseFence(source);
    if (!parsed.ok) return { failed: `the fixture did not parse: ${parsed.reason}` };
    const found = [];
    for (const value of parsed.values) {
      for (const node of collectNodes(value)) {
        const carried = new Set([...channels.all, ...carriage.keysFor(node.type)]);
        for (const [key, raw] of Object.entries(node)) {
          if (holdsExpression(raw) && !carried.has(key)) found.push(key);
        }
      }
    }
    return { found: found.sort() };
  };

  const positive = judge(CONTROL_FIXTURES.positive);
  const negative = judge(CONTROL_FIXTURES.negative);
  const failures = [];
  if (positive.failed) failures.push(`positive control: ${positive.failed}`);
  else if (positive.found.join(',') !== 'text,variant') {
    failures.push(
      `positive control: expected the two uncarried badge keys [text, variant], got ` +
        `[${positive.found.join(', ')}]. The instrument cannot see the site objectui#7418 repaired.`,
    );
  }
  if (negative.failed) failures.push(`negative control: ${negative.failed}`);
  else if (negative.found.length > 0) {
    failures.push(
      `negative control: a clean node reported [${negative.found.join(', ')}]. The instrument is ` +
        'reporting carried channels as findings, which is a false-positive gate.',
    );
  }
  return { positive: positive.found ?? [], negative: negative.found ?? [], failures };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (isEntrypoint(import.meta.url)) {
  const argOf = (name) => {
    const index = process.argv.indexOf(name);
    return index > -1 ? process.argv[index + 1] : null;
  };
  const root = resolve(argOf('--root') ?? repoRoot);
  const selfTestOnly = process.argv.includes('--self-test');
  const list = process.argv.includes('--list');

  let channels;
  let carriage;
  try {
    channels = deriveChannels();
    carriage = await loadCarriage();
  } catch (error) {
    console.error(
      `❌  ${error.message}\n\n` +
        '    A failure, not a skip: report-only means this gate declines to fail on its FINDINGS,\n' +
        '    never that it passes without looking (objectstack#4928, objectui#4690).',
    );
    process.exit(1);
  }

  const controls = runControls({ channels, carriage });
  console.log(
    `Evaluated channels, derived from ${RENDERER_SOURCE}: ` +
      `content=[${channels.direct.join(', ')}] bags=[${channels.bags.join(', ')}] ` +
      `conditions=[${channels.conditions.join(', ')}]`,
  );
  console.log(`Carriage map: @objectstack/spec@${carriage.version}'s expressionBindableTextKeysFor.`);
  console.log(
    `Controls: positive fixture reported [${controls.positive.join(', ')}] (expected text, variant); ` +
      `negative fixture reported ${controls.negative.length === 0 ? 'nothing' : `[${controls.negative.join(', ')}]`} ` +
      '(expected nothing).',
  );
  if (controls.failures.length > 0) {
    console.error(`\n❌  The instrument failed its own controls:\n${controls.failures.map((f) => `      ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('✅  Controls pass: this gate can see the class it is looking for, and does not cry wolf.');
  if (selfTestOnly) process.exit(0);

  let census;
  try {
    census = analyze(root, { channels, carriage });
  } catch (error) {
    console.error(`❌  The census could not read its inputs: ${error.message}`);
    process.exit(1);
  }

  const { counters, sites, unparsed } = census;
  console.log(
    `\nScanned ${counters.files} file(s) under ${DOCS_ROOT}: ` +
      `${counters.fences} ${JSON_FENCE_LANGUAGES.join('/')} fence(s), ` +
      `${counters.parsed} parsed, ${counters.unparsed} UNPARSED` +
      (counters.wrapped > 0 ? ` (${counters.wrapped} parsed as an object body)` : '') +
      `.\n` +
      `${counters.nodes} node(s) with a string \`type\`; ` +
      `${counters.expressionSites} \${…} site(s) on those nodes, ${counters.carried} of them carried.`,
  );

  // The blind spot is printed on every run, in both directions. A census that
  // reports only its hits hides how much it never looked at, and "0 unparsed" is
  // the sentence that makes "only N sites" mean something.
  if (counters.unparsed === 0) {
    console.log('✅  Blind spot: none — every fence above was parsed and judged.');
  } else {
    console.log(
      `\n⚠️  ${counters.unparsed} fence(s) this gate could NOT read — its blind spot, printed because a\n` +
        '    census that reports only its hits hides how much it never looked at:',
    );
    for (const fence of unparsed) console.log(`      ${fence.file}:${fence.line}  ${fence.reason}`);
  }
  if (list) {
    console.log('\nEvery fence, in document order:');
    for (const fence of census.fences) {
      console.log(`      ${fence.ok ? '  parsed' : 'UNPARSED'}  ${fence.file}:${fence.line}  (${fence.lang})`);
    }
  }

  if (sites.length === 0) {
    console.log('\n✅  No documented json fence authors ${…} on a key nothing evaluates.');
    process.exit(0);
  }

  const byFile = new Map();
  for (const site of sites) byFile.set(site.file, [...(byFile.get(site.file) ?? []), site]);

  console.log(
    `\n⚠️  ${sites.length} site(s) in ${byFile.size} page(s) author \${…} on a key nothing evaluates:\n`,
  );
  for (const [file, hits] of byFile) {
    console.log(`      ${file}`);
    for (const hit of hits) {
      console.log(
        `        :${hit.line}  ${hit.type}.${hit.key}  ` +
          `(carriage rows for \`${hit.type}\`: ${hit.rows.length === 0 ? 'none' : hit.rows.join(', ')})`,
      );
      console.log(`                 ${hit.value.length > 96 ? `${hit.value.slice(0, 93)}...` : hit.value}`);
    }
  }

  console.log(`
    What a hit means: \`SchemaRenderer\` evaluates exactly four channels — \`content\`,
    the carriage keys for the node's own type, the \`properties\` and \`props\` bags, and
    the condition keys. An expression written anywhere else reaches the renderer as the
    characters the author typed, so the page teaches a form that cannot work.

    Two repairs, chosen by what the passage teaches, never one blanket rule (the
    2026-09-01 ruling on objectui#7115, fork B — 「文档教现实」):
      - the passage is DEMONSTRATING binding  -> move it onto a channel that carries
        (a \`text\` node's \`content\` is evaluated on every type; or a real carriage key
        on the same node; or the \`properties\` bag);
      - the expression is incidental          -> author a literal, and say in prose which
        row is missing.
    ⛔ Adding a carriage row for the key is fork A and was rejected: that widens an
    authoring surface and is a maintainer decision, not a docs fix.

    Report-only: this gate does not fail the build on the findings above. Three cards of
    this class are open (objectui#7440, #7444, #7838) and each one fixes its own sites;
    see the header of scripts/check-doc-expression-carriage.mjs for why the census is the
    deliverable and what would justify flipping this to blocking.`);
  process.exit(0);
}
