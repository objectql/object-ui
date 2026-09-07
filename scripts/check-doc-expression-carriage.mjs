#!/usr/bin/env node
/**
 * Every `${…}` a json fence authors on a node must sit on a channel
 * `SchemaRenderer` actually evaluates. REPORT-ONLY: it prints a census and never
 * fails the build on its findings.
 *
 * The scan surface is EXACTLY the one `check:doc-types`
 * (`check-doc-component-types.mjs`) walks — `content/docs`, every
 * `apps/<app>/docs` tree and the root pages it names — and it is that surface by
 * IMPORT rather than by copy; see "The scan surface" below.
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
 * `parsed` and `unparsed` PER FENCE LANGUAGE (`json` and `jsonc` today) and
 * names every unparsed fence with its reason; `--list` prints the whole
 * inventory, parsed and unparsed alike.
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
 *   - Anything outside a `json` / `jsonc` fence on the scan surface. The
 *     `ts`/`tsx` blocks are `check-doc-snippet-types`' surface and are left to
 *     it; ⛔ this file changes no other gate's population. The LANGUAGE SET is its
 *     own blind spot and is measured rather than asserted: every run prints the
 *     per-language counts, and every fence in a language this gate does not scan
 *     is still parsed, purely to report whether it would have been a JSON
 *     document holding a typed node.
 *   - The repository-root `docs/` tree, and therefore `docs/ARCHITECTURE.md` —
 *     objectui#7838's site. ⚠️ objectui#7878 was filed expecting this widening to
 *     reach that file; it does not, and the card's premise was corrected before
 *     dispatch rather than after. NO doc gate walks the root `docs/` tree
 *     (objectui#7856 is the open question about it): `check-doc-component-types`
 *     names `docs/**` in its own exclusion list, `check-readme-exports` reports
 *     `0 outside any package`, and `lint:root` ignores it. Widening onto a tree
 *     no sibling gate reads is a different decision from joining the surface
 *     three of them already share, and it is #7856's to make, not this file's.
 *
 * ## The scan surface — imported from `check:doc-types`, never re-declared
 *
 * objectui#7878. This census landed (PR objectui#7868) pointed at `content/docs`
 * alone while its two sibling doc gates had already been widened, by
 * objectui#6600 and objectui#7115, onto the per-app docs trees and the root
 * pages. That is the objectui#7115 geometry rebuilt one gate over: the root
 * `README.md` fell BETWEEN two gates' surfaces and taught an unregistered type
 * four times for as long as the example existed, for exactly one reason —
 * nothing read the file.
 *
 * So the surface is not re-declared here. `APP_DOCS`, `appDocsDirs` and
 * `ROOT_PAGES` are IMPORTED from `check-doc-component-types.mjs`, which makes the
 * two walks the same object rather than two arrays a test hopes are equal. The
 * three gates that carry copies of these constants do so for a stated reason that
 * does not apply here — importing `check-doc-snippet-types.mjs` pulls in its
 * `import ts from 'typescript'` at load, and `check-doc-fence-languages`' whole
 * value is running with no install. `check-doc-component-types.mjs` imports
 * node built-ins and `invoked-as.mjs`, the same four this file already imports,
 * so the copy would buy nothing and cost a pin. (`regenerate-known-schema-types`
 * already imports that module for the same reason.)
 *
 * `DOCS_ROOT` is the one leg still spelled here, because that gate declares it
 * `const` rather than `export const`; `check-doc-expression-carriage.test.ts`
 * pins this file's copy against that file's source text.
 *
 * ⚠️ Widening a scan surface is the change that can be GREEN ABOUT NOTHING, so
 * the widening is measured rather than asserted: the test pins that every leg of
 * the walk actually reaches a file, and the census prints the file count beside
 * the surface it walked.
 *
 * ## ⚠️ A hit is a CANDIDATE, not a verdict — `type` is not one vocabulary
 *
 * `check-doc-component-types` measured this and wrote it down: across the corpus
 * there are at least SEVEN distinct vocabularies that all spell the key `type` —
 * SDUI component keys, action schemas, block schemas, theme and report schemas,
 * field and JSON-Schema types, validation rules, nav and feed items. A node from
 * another vocabulary is judged here against a carriage map that does not govern
 * it, and can be reported while being perfectly correct. One of today's hits is
 * exactly that: `content/docs/api/schema-reference.md`'s `ActionSchema` example
 * authors a `${…}` on `condition`, which the ACTION runner's own gate evaluates,
 * not `SchemaRenderer`'s node channels.
 *
 * ⛔ The obvious fix — classify by the enclosing key path — was BUILT and
 * MEASURED by that gate before being rejected, because it does not converge:
 * `items` carries nav entries on one page and renderable children on another, so
 * any global parent-key rule is a silent false GREEN on one of them, and a
 * misclassifying discriminator is worse than none because its mistakes are
 * invisible in both directions. That ruling is inherited here rather than
 * re-litigated, and report-only is what makes inheriting it safe: a candidate a
 * human reads costs a minute, and nothing is blocked while the corpus is read.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_DOCS, appDocsDirs, ROOT_PAGES } from './check-doc-component-types.mjs';
import { isEntrypoint } from './invoked-as.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

/**
 * The guide tree, the first leg of the walk. Spelled here because
 * `check-doc-component-types.mjs` declares its own `DOCS_ROOT` as a plain `const`
 * — the other two legs are imported from it, and the test pins this string
 * against that file's source so the three legs cannot drift apart.
 */
export const DOCS_ROOT = 'content/docs';

/**
 * The other two legs of `check:doc-types`' surface, re-exported so this file's
 * scan surface is readable from one place and pinnable as ONE object rather than
 * as two arrays that agree today.
 */
export { APP_DOCS, appDocsDirs, ROOT_PAGES };

/**
 * The surface in one phrase, so the printed summary and this file's prose cannot
 * describe different walks. The app-docs leg is spelled with a GLOB STAR rather
 * than with an angle-bracket placeholder: this string is quoted into pull-request
 * bodies and issue comments, and GitHub's body sanitizer eats tag-shaped
 * fragments (AGENTS.md, "GitHub 会改写你写进 issue/PR 正文的字节").
 */
export const SURFACE_LABEL = `${DOCS_ROOT}, ${APP_DOCS.dir}/*/${APP_DOCS.subdir} and ${ROOT_PAGES.join(', ')}`;

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

/**
 * One tree. The three skipped names are `check-doc-component-types`' own
 * exclusions, carried over so "exactly the surface that gate walks" is true of
 * the traversal and not only of the roots. They change nothing under
 * `content/docs` today — that tree holds no `node_modules`, `dist` or dot-entry —
 * and they are what keeps the answer stable if an app docs tree ever grows one.
 */
function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walkFiles(abs, out);
    else if (DOC_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(abs);
  }
  return out;
}

/**
 * Every document on the scan surface, absolute, in a stable order: the guide
 * tree, then each `apps/<app>/docs` tree, then the root pages by name.
 *
 * A root page that does not resolve is DROPPED rather than fatal, which is the
 * same bargain `check-doc-component-types.scanDocs` strikes and for the same
 * reason — the fixture trees this file's tests build have no root README, and a
 * throwaway tree must stay scannable. ⚠️ The consequence is that a `ROOT_PAGES`
 * name going dangling would shrink this census SILENTLY. This gate is
 * report-only and its exit codes are not this card's to move (objectui#7878), so
 * the guard lives in the test instead: `check-doc-expression-carriage.test.ts`
 * pins that every leg of this walk reaches at least one real file.
 */
export function listDocuments(root) {
  const files = walkFiles(join(root, DOCS_ROOT));
  for (const dir of appDocsDirs(root)) files.push(...walkFiles(dir));
  files.push(...ROOT_PAGES.map((name) => join(root, name)).filter((abs) => existsSync(abs)));
  return files;
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

/** Every `json` / `jsonc` fence on the scan surface, parsed or not. */
export function scanFences(root) {
  const files = listDocuments(root);
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
          const scanned = JSON_FENCE_LANGUAGES.includes(open.lang);
          fences.push({
            file: rel,
            line: open.line,
            lang: open.lang,
            body,
            scanned,
            // A fence outside the scanned languages is parsed too, but only to
            // MEASURE the dialect blind spot below — it is never judged.
            ...parseFence(body.join('\n')),
          });
          open = null;
          body = [];
        } else {
          open = { lang: (fence[1] || 'plaintext').toLowerCase(), line: i + 1 };
        }
        continue;
      }
      if (open) body.push(lines[i]);
    }
    if (open) {
      // An unclosed fence read the rest of the file as code. Report it as
      // unparsed rather than guessing where it ended.
      fences.push({
        file: rel,
        line: open.line,
        lang: open.lang,
        body,
        scanned: JSON_FENCE_LANGUAGES.includes(open.lang),
        ok: false,
        reason: 'unterminated-fence',
        values: [],
        wrapped: false,
      });
    }
  }
  return { files: files.length, documents: files.map((abs) => relative(root, abs).split(sep).join('/')), fences };
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
  const judged = scan.fences.filter((fence) => fence.scanned);
  const counters = {
    files: scan.files,
    fences: judged.length,
    parsed: 0,
    unparsed: 0,
    wrapped: 0,
    nodes: 0,
    expressionSites: 0,
    carried: 0,
  };
  /** Per fence language, so the next reader can see which dialects were read. */
  const byLanguage = new Map();
  const bump = (lang, field) => {
    const row = byLanguage.get(lang) ?? { fences: 0, parsed: 0, unparsed: 0 };
    row[field]++;
    byLanguage.set(lang, row);
  };
  const sites = [];
  const unparsed = [];
  const inventory = [];
  /**
   * The DIALECT blind spot: a fence outside the scanned languages whose body is
   * a JSON document holding a typed node. Counted, never judged — a `jsonc`
   * spelling was invisible to an earlier draft of this gate, and the way that
   * was found was a human reading a page, which is the detection mechanism this
   * whole card exists to replace.
   */
  const unscannedJsonLike = [];

  for (const fence of scan.fences) {
    if (!fence.scanned) {
      if (fence.ok && fence.values.some((value) => collectNodes(value).length > 0)) {
        unscannedJsonLike.push({ file: fence.file, line: fence.line, lang: fence.lang });
      }
      continue;
    }
    inventory.push({ file: fence.file, line: fence.line, lang: fence.lang, ok: fence.ok });
    bump(fence.lang, 'fences');
    bump(fence.lang, fence.ok ? 'parsed' : 'unparsed');
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
  const languages = [...byLanguage.entries()].sort((a, b) => b[1].fences - a[1].fences).map(([lang, row]) => ({ lang, ...row }));
  return { counters, documents: scan.documents, sites, unparsed, fences: inventory, languages, unscannedJsonLike };
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

  const { counters, sites, unparsed, languages, unscannedJsonLike } = census;
  console.log(
    `\nScanned ${counters.files} file(s) across ${SURFACE_LABEL}: ` +
      `${counters.fences} ${JSON_FENCE_LANGUAGES.join('/')} fence(s), ` +
      `${counters.parsed} parsed, ${counters.unparsed} UNPARSED` +
      (counters.wrapped > 0 ? ` (${counters.wrapped} parsed as an object body)` : '') +
      `.\n` +
      `${counters.nodes} node(s) with a string \`type\`; ` +
      `${counters.expressionSites} \${…} site(s) on those nodes, ${counters.carried} of them carried.`,
  );

  // Per fence language, because the SET of languages is its own blind spot and it
  // has already bitten once: a `jsonc` spelling three teaching blocks use was
  // invisible to an earlier draft, and the way that was found was a human reading
  // the page. A column per dialect is what lets the next reader see at a glance
  // whether another one is being missed.
  console.log(
    `By fence language: ${languages
      .map((row) => `${row.lang} ${row.fences} (${row.parsed} parsed, ${row.unparsed} unparsed)`)
      .join('; ')}`,
  );
  if (unscannedJsonLike.length === 0) {
    console.log(
      `✅  Dialect blind spot: none — no fence OUTSIDE ${JSON_FENCE_LANGUAGES.join('/')} parses as a JSON ` +
        'document holding a typed node.',
    );
  } else {
    console.log(
      `\n⚠️  ${unscannedJsonLike.length} fence(s) outside ${JSON_FENCE_LANGUAGES.join('/')} parse as a JSON ` +
        'document holding a typed node. NOT judged — reported so the language set can be widened\n' +
        '    deliberately rather than discovered by a human reading a page:',
    );
    for (const fence of unscannedJsonLike) console.log(`      ${fence.file}:${fence.line}  (${fence.lang})`);
  }

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

    \u26a0\ufe0f Read the passage before repairing: a hit is a CANDIDATE, not a verdict.
    \`type\` is at least seven vocabularies in these pages (measured by
    check-doc-component-types), and a node from another one — an ActionSchema, a field
    declaration, a nav item — is judged here against a carriage map that does not govern
    it. That gate built the obvious discriminator and rejected it as non-convergent; this
    one inherits the ruling, which is affordable precisely because it blocks nothing.

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
