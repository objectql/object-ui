#!/usr/bin/env node
/**
 * Every authored icon NAME that reaches a resolver reading lucide's runtime
 * `icons` record must be a live key of that record.
 *
 * ── The class this gate exists for ──────────────────────────────────────────
 * lucide retires a spelling by DROPPING IT FROM THE RUNTIME `icons` RECORD
 * while keeping it as a deprecated named export. A retired name therefore
 * still imports, still type-checks, and still renders wherever it is used as a
 * COMPONENT — and resolves to `null` wherever it is used as a STRING, because
 * the string lookups read that record. Nothing goes red in either direction:
 * not the compiler, not a render test that only looks at the label, not a
 * test that reaches for the export (`Edit === SquarePen` and
 * `Smile === FaceSlightlySmiling` are both TRUE — the retired alias is the
 * very same object under a dead name). MEMBERSHIP of the record is the only
 * thing that separates them.
 *
 * It had been repaired twice, in two packages, by two cards (objectui#5586,
 * objectui#5622), each leaving behind a LOCAL pin over the names that card
 * happened to touch. objectui#5633 asked for one gate over the population
 * instead of a fifth local pin.
 *
 * ── What judges ────────────────────────────────────────────────────────────
 * The runtime `icons` record itself, loaded from the installed lucide, and
 * NOTHING ELSE. This gate deliberately carries no list of retired spellings:
 * a hand-kept vocabulary is the same defect one level up — it ages the moment
 * lucide retires the next name, and it ages SILENTLY. When it has to name a
 * replacement it derives one, by identity: the retired export and its live
 * spelling are the same object, so the live key is looked up in the record
 * rather than remembered.
 *
 * ── The two surfaces, and why picking the wrong one is worse than no gate ──
 * This repo resolves icon names against TWO different lucide vocabularies:
 *
 *   RECORD  — `icons` from 'lucide-react'            (1767 keys, measured)
 *   DYNAMIC — `iconNames` from 'lucide-react/dynamic.mjs' (2025 names)
 *
 * DYNAMIC is a strict superset: it still carries `edit`, `smile`, `filter`,
 * `alert-triangle`. So a gate that checked the dynamic list would BLESS every
 * name this class is about. Only names reaching a RECORD-reading resolver are
 * judged here; the dynamic sites are censused (below) precisely so that the
 * split stays declared and a site cannot move between surfaces unnoticed.
 *
 * ── What it checks (three parts, each self-verifying) ───────────────────────
 * 1. SURFACE CENSUS — rediscovers, from source, every module that reads either
 *    vocabulary, and fails when the discovered set differs from the declared
 *    one. The population is measured on every run rather than remembered: this
 *    is what stops a ninth hand-copied resolver appearing in silence. Its first
 *    run found FOUR record-reading resolvers that objectui#5633's own table did
 *    not know about (`form/button.tsx`, `plugin-list/ListView.tsx`,
 *    `plugin-detail/RelatedList.tsx`, `previews/ActionPreview.tsx`).
 *
 * 2. AUTHORED NODES — walks authored SDUI metadata (JSON documents and the
 *    schema object literals embedded in first-party TS) and checks the `icon`
 *    names on nodes whose `type` is a censused record-reading renderer. The
 *    node's own `type` is what answers "which resolver does this string
 *    reach?", which is why this check can be broad without being suppressible.
 *
 *    An `icon` on an UNTYPED node is judged only when its NEAREST TYPED
 *    ANCESTOR is a censused container whose entry DECLARES that its child items
 *    carry icon names (`descendants: true`) — a fact read off that container's
 *    renderer, exactly the way every `paths` entry in the table below was. A
 *    typed node ENDS any descent it sits inside, because its own `type` is
 *    still the answer to which resolver its string reaches. Untyped icons under
 *    every other ancestor remain declined, not flagged.
 *
 *    ── Re-measured over the schema catalog at objectui@ef2a3bd8d ────────────
 *    The parenthetical this replaced read "the eight such names in the schema
 *    catalog are child items of `button-group`, `breadcrumb`, `command` and
 *    `dropdown-menu` — three of which never read `icon`, and the fourth renders
 *    it as raw text". objectui#5930 falsified its second half, and the count
 *    was low by 53. Re-measured, by reading each renderer (objectui#5992):
 *
 *      61 untyped `icon` names, across SEVEN containers. Exactly ONE of them
 *      reaches a record-reading resolver:
 *
 *        dropdown-menu   3  RECORD — `resolveIcon(item.icon)` in
 *                           `renderers/overlay/dropdown-menu.tsx` (objectui#5930).
 *                           JUDGED HERE. Judged RECURSIVELY, because that
 *                           renderer recurses into `item.children` for submenus
 *                           and resolves the submenu trigger's icon through the
 *                           same call — a depth no single-level `items[].icon`
 *                           path can express.
 *        button-group    8  `renderers/basic/button-group.tsx` never reads
 *                           `button.icon` at all; the names render nothing
 *        breadcrumb      3  renderer never reads `icon`
 *        command         9  renderer never reads `icon`
 *        context-menu    4  renderer never reads `icon` — dropdown-menu's twin,
 *                           and NOT routed by objectui#5930
 *        timeline        4  rendered as RAW TEXT, `<span>{item.icon}</span>`;
 *                           the four authored names are emoji, not lucide names
 *        tree-view      30  read, but as a TWO-VALUED literal switch
 *                           (`node.icon === 'folder'`) — never a record lookup
 *
 *    `dropdown-menu.tsx` itself is correctly ABSENT from part 1's census: it
 *    imports `resolveIcon`, not `icons`, so the record read happens in
 *    `renderers/action/resolve-icon.ts`, which is already declared. Part 1
 *    stays at eight resolvers; this is a part-2 rule, not a census change.
 *
 * 3. ANCHORED MAPS — the first-party const maps that feed a record-reading
 *    resolver but are not authored nodes. This is the population the retired
 *    local pins covered, generalised: each anchor carries a minimum entry
 *    count, so a declaration that moved or was re-annotated fails LOUDLY
 *    instead of quietly extracting nothing and passing.
 *
 * ── Deliberate boundaries ──────────────────────────────────────────────────
 * - Test files are not scanned for authored nodes. Suites legitimately build
 *   fixtures out of names that must NOT resolve (`not-a-real-icon` is a
 *   control in two of them), and a gate that flagged its own controls gets
 *   suppressed.
 * - Imported lucide IDENTIFIERS are not checked repo-wide. 54 distinct retired
 *   identifiers are imported across ~350 sites and every one of them renders;
 *   flagging them would be a gate suppressed on day one. Identifiers ARE
 *   checked in the anchored icon maps of part 3, where a component map sits
 *   beside a string map that resolves the same glyphs and a dead spelling gets
 *   copied across — the exact path by which `bar-chart-3` and `gantt-chart`
 *   reached a string map (objectui#5586).
 *
 * Run:     node scripts/check-lucide-icon-record-names.mjs
 *          node scripts/check-lucide-icon-record-names.mjs --report
 * Exit:    0 = OK, 1 = a violation, a census drift, or a blind instrument
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';

/** This gate's OWN repo — where lucide and typescript are resolved from. */
const gateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── The declared census ──────────────────────────────────────────────────────
// Sites, NOT spellings. Rediscovered from source on every run by
// `discoverResolvers`: an entry that disappears and a module that appears both
// fail the gate. Add a new resolver here only after deciding which vocabulary
// it reads — that decision is the whole point of the split.
export const DECLARED_RECORD_READERS = [
  'packages/app-shell/src/views/metadata-admin/previews/ActionPreview.tsx',
  'packages/components/src/renderers/action/resolve-icon.ts',
  'packages/components/src/renderers/basic/icon.tsx',
  'packages/components/src/renderers/form/button.tsx',
  'packages/plugin-detail/src/RelatedList.tsx',
  'packages/plugin-list/src/ListView.tsx',
  'packages/plugin-list/src/components/TabBar.tsx',
  'packages/plugin-view/src/ViewSwitcher.tsx',
];

export const DECLARED_DYNAMIC_READERS = [
  'apps/console/src/utils/getIcon.ts',
  'packages/app-shell/src/utils/getIcon.ts',
  'packages/app-shell/src/views/metadata-admin/widgets.tsx',
  'packages/components/src/lib/lazy-icon.tsx',
];

/**
 * A module that builds its OWN `icons` object and indexes it is not a lucide
 * resolver. `plugin-chatbot/src/elements/tool.tsx` does exactly that, which
 * makes it a free negative control on discovery: if it ever shows up as a
 * reader, discovery is matching the NAME rather than the IMPORT, and every
 * other conclusion this gate draws is suspect.
 */
export const DISCOVERY_NEGATIVE_CONTROL = 'packages/plugin-chatbot/src/elements/tool.tsx';

export const SCAN_ROOTS = ['packages', 'apps', 'examples'];

// ── Authored-node census: component `type` -> where its icon NAMES sit ───────
// Every path below was read off the renderer named beside it. A `type` absent
// from this table is not judged, because nothing here knows which vocabulary
// (if any) its icons reach — and a gate that guessed would be a gate that gets
// suppressed.
//
// `descendants: true` extends that same declaration to the container's UNTYPED
// child items — see the part-2 paragraph in the header. It is deliberately
// OPT-IN per container rather than a blanket "nearest typed ancestor" rule:
// applying descent to every censused entry would extend a judgement that was
// measured against one shape (`action:bar`'s `actions[]`) to descendant shapes
// nobody read off a renderer, which is the guessing this table exists to
// refuse. `min` is the non-vacuity precondition ANCHORED_MAPS uses below: a
// descent that reaches NOTHING reports no violations and reads exactly like a
// clean tree.
export const RECORD_READING_TYPES = {
  'button': { paths: ['icon'], resolver: 'packages/components/src/renderers/form/button.tsx' },
  'action:bar': { paths: ['actions[].icon'], resolver: 'packages/components/src/renderers/action/resolve-icon.ts' },
  'action:button': { paths: ['icon'], resolver: 'packages/components/src/renderers/action/resolve-icon.ts' },
  'action:group': { paths: ['icon', 'actions[].icon'], resolver: 'packages/components/src/renderers/action/resolve-icon.ts' },
  'action:icon': { paths: ['icon'], resolver: 'packages/components/src/renderers/action/resolve-icon.ts' },
  'action:menu': { paths: ['icon', 'actions[].icon'], resolver: 'packages/components/src/renderers/action/resolve-icon.ts' },
  'data-table': { paths: ['rowActionDefs[].icon'], resolver: 'packages/components/src/renderers/complex/data-table.tsx' },
  // The container's OWN `icon` is never read (`paths: []`); its item icons sit
  // on untyped children, recursively, and every one of them goes through the
  // single `resolveIcon(item.icon)` call that serves BOTH the leaf arm and the
  // submenu-trigger arm (objectui#5930, objectui#5992).
  'dropdown-menu': {
    paths: [],
    descendants: true,
    min: 1,
    resolver: 'packages/components/src/renderers/action/resolve-icon.ts (via renderers/overlay/dropdown-menu.tsx)',
  },
  'view-switcher': { paths: ['views[].icon', 'viewActions[].icon'], resolver: 'packages/plugin-view/src/ViewSwitcher.tsx' },
};

// ── Anchored first-party maps ────────────────────────────────────────────────
// The population the retired local pins covered, generalised. `min` is the
// precondition that makes "every entry" mean something: an extractor that finds
// fewer entries than the map is known to carry did not read the map, and
// reporting zero violations off zero entries is the failure mode this shape
// invites — which is why a short read is an ERROR, not a shrug.
export const ANCHORED_MAPS = [
  {
    file: 'packages/plugin-view/src/ObjectView.tsx',
    anchor: 'iconMap',
    kind: 'strings',
    min: 9,
    why: 'the producer handing ViewSwitcher its icon NAMES; `chart`/`gantt` died here (objectui#5586)',
  },
  {
    file: 'packages/plugin-view/src/ViewSwitcher.tsx',
    anchor: 'DEFAULT_VIEW_ICONS',
    kind: 'identifiers',
    min: 9,
    why: 'the component map beside that string map — a dead spelling here gets copied across',
  },
  {
    file: 'packages/plugin-list/src/ViewSwitcher.tsx',
    anchor: 'VIEW_ICONS',
    kind: 'identifiers',
    min: 9,
    why: 'the sibling switcher naming the same glyphs as components (objectui#5622)',
  },
  {
    file: 'packages/plugin-detail/src/DetailView.tsx',
    anchor: 'items.push',
    kind: 'pushed-objects',
    min: 3,
    why: 'system action items built as an `action:bar` schema; `edit` died here (objectui#5622)',
  },
];

// ── Load the judgement ───────────────────────────────────────────────────────
// `lucide-react` is not resolvable from the repo root — only the packages that
// declare it have it. Resolve it from the package owning the canonical
// resolver, so this gate reads the very copy `resolve-icon.ts` reads.
export const LUCIDE_OWNER_PKG = 'packages/components/package.json';
const lucideRequire = createRequire(join(gateRoot, LUCIDE_OWNER_PKG));
export const lucide = await import(pathToFileURL(lucideRequire.resolve('lucide-react')).href);
export const { iconNames } = await import(pathToFileURL(lucideRequire.resolve('lucide-react/dynamic.mjs')).href);
export const icons = lucide.icons;
export const lucideVersion = JSON.parse(readFileSync(lucideRequire.resolve('lucide-react/package.json'), 'utf8')).version;
const ts = createRequire(join(gateRoot, 'package.json'))('typescript');

/**
 * Prove the instrument can see the distinction it claims to judge, BEFORE any
 * silence of its is quoted as evidence. This gate's whole subject is that the
 * current tooling reports nothing; a blind probe would report nothing too, and
 * read as green.
 */
export function selfTest() {
  const problems = [];
  const recordSize = icons ? Object.keys(icons).length : 0;
  if (recordSize < 500) {
    problems.push(`the loaded \`icons\` record has ${recordSize} keys — that is not lucide's record; every result below is meaningless.`);
  }
  if (!Array.isArray(iconNames) || iconNames.length <= recordSize) {
    problems.push(`the dynamic \`iconNames\` list (${iconNames?.length}) is not larger than the \`icons\` record (${recordSize}) — the two surfaces this gate distinguishes are not distinguishable in this install.`);
  }
  // A name lucide keeps ONLY as a deprecated export. If the predicate cannot
  // reject THIS, it cannot reject anything: `Edit` imports, type-checks, and IS
  // `SquarePen`. Absence from the record is the only difference, and it is the
  // difference every conclusion below rests on.
  if (icons && Object.prototype.hasOwnProperty.call(icons, 'Edit')) {
    problems.push('`Edit` is a key of the runtime `icons` record in this install — the membership predicate no longer separates a retired alias from a live one.');
  }
  if (icons && !Object.prototype.hasOwnProperty.call(icons, 'SquarePen')) {
    problems.push('`SquarePen` is NOT a key of the runtime `icons` record — the predicate is rejecting live names, so it would fail everything for the wrong reason.');
  }
  return problems;
}

// ── Normalisation ────────────────────────────────────────────────────────────
// The transform the record-reading resolvers apply before their lookup. Five of
// the eight also map `Home` -> `House`; three do not, and three different
// tokenisers are in use. Taking the WIDEST tokeniser and the alias map means
// this gate never invents a violation a resolver would not have: a name is
// judged dead only when EVERY censused normalisation would still miss it.
export const toRecordKey = (name) => {
  const pascal = String(name)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return pascal === 'Home' ? 'House' : pascal;
};

export const isLiveKey = (name) => Object.prototype.hasOwnProperty.call(icons, toRecordKey(name));

// Derive the live spelling of a retired name BY IDENTITY, never from a list:
// lucide keeps the retired export pointing at the same object as its live key.
//
// Built LAZILY on first read and memoised, never at module top level. This file
// exports bindings, so whatever its top level ran would run inside every
// importer — the rule `check-entry-guard.mjs` calls import-safety (objectui#6133).
//
// ⛔ Do NOT "fix" this by moving the build behind the entry guard instead. That
// was measured, not reasoned about, and rejected (objectui#6092 PR 2's ablation,
// recorded on objectui#6147): the maps stay EMPTY for importers, the suite fails
// 5 of 25, and `describeName('BarChart3')` stops saying ``write `chart-column` ``
// and says "no live key names the same glyph" instead — a WRONG DIAGNOSIS for a
// real violation, printed by a gate that still exits 1. A green baseline bought
// with a lying error message is worse than an honest debt line. Lazy satisfies
// both sides: nothing runs on import, and every reader gets the built maps.
//
// ⛔ This does not make the module cheap to import, and is not trying to:
// `icons`/`iconNames` are top-level `await import('lucide-react')` above. That
// cost is a separate question (objectui#6147) and is deliberately left alone.
let memoisedLookups = null;

/** The two identity maps, built ONCE on the first read and memoised after. */
function glyphLookups() {
  if (memoisedLookups) return memoisedLookups;
  const keyByComponent = new Map();
  for (const [key, component] of Object.entries(icons)) if (!keyByComponent.has(component)) keyByComponent.set(component, key);
  const kebabByKey = new Map();
  for (const kebab of iconNames) kebabByKey.set(toRecordKey(kebab), kebab);
  memoisedLookups = { keyByComponent, kebabByKey };
  return memoisedLookups;
}

/** `{ key, kebab }` of the live spelling naming the SAME glyph, or null. */
export function liveSpellingFor(name) {
  const { keyByComponent, kebabByKey } = glyphLookups();
  const retiredExport = lucide[toRecordKey(name)];
  if (!retiredExport) return null;
  const liveKey = keyByComponent.get(retiredExport);
  if (!liveKey) return null;
  return { key: liveKey, kebab: kebabByKey.get(liveKey) ?? null };
}

/** The sentence a violation prints — three distinct diagnoses, not one. */
export function describeName(name) {
  const key = toRecordKey(name);
  const live = liveSpellingFor(name);
  if (live) {
    return `"${name}" -> \`${key}\` is not a key of the runtime \`icons\` record. lucide keeps it only as a DEPRECATED EXPORT of the same glyph — write \`${live.kebab ?? live.key}\` (the spelling the record carries).`;
  }
  if (lucide[key]) {
    return `"${name}" -> \`${key}\` is exported by lucide but is not a key of the runtime \`icons\` record, and no live key names the same glyph.`;
  }
  return `"${name}" -> \`${key}\` is not a lucide icon at all.`;
}

// ── Source inventory ─────────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.turbo', '.next', 'storybook-static']);

/**
 * Test files are NOT scanned for authored nodes: suites legitimately build
 * fixtures out of names that must NOT resolve (`not-a-real-icon` is a control
 * in two of them), and a gate that flagged its own controls gets suppressed.
 */
export const isTestPath = (file) => /(^|\/)(__tests__|__mocks__|e2e)\//.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);

export function collectFiles(root) {
  const sources = [];
  const documents = [];
  const walk = (absolute) => {
    let entries;
    try { entries = readdirSync(absolute, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const child = join(absolute, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(child);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = relative(root, child).split(sep).join('/');
      if (/\.tsx?$/.test(rel) && !rel.endsWith('.d.ts')) sources.push(rel);
      else if (rel.endsWith('.json') && !/(^|\/)(package|tsconfig|package-lock)\.json$/.test(rel)) documents.push(rel);
    }
  };
  for (const scanRoot of SCAN_ROOTS) walk(join(root, scanRoot));
  sources.sort();
  documents.sort();
  return { sources, documents };
}

// ── AST helpers ──────────────────────────────────────────────────────────────
function parseSource(root, file) {
  const text = readFileSync(join(root, file), 'utf8');
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

function unwrap(node) {
  let current = node;
  for (;;) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) current = current.expression;
    else if (typeof ts.isTypeAssertionExpression === 'function' && ts.isTypeAssertionExpression(current)) current = current.expression;
    else return current;
  }
}

function objectProp(objectLiteral, name) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
    if (key === name) return property.initializer;
  }
  return null;
}

// ── Part 1: surface census ───────────────────────────────────────────────────
/**
 * Which modules read which lucide vocabulary — rediscovered from source, so the
 * population is MEASURED on every run rather than remembered. Its first run
 * found four record-reading resolvers and two dynamic ones that objectui#5633's
 * own table did not know about.
 */
export function discoverResolvers(root, files) {
  const record = [];
  const dynamic = [];
  for (const file of files) {
    if (isTestPath(file)) continue;
    const text = readFileSync(join(root, file), 'utf8');
    if (!text.includes('lucide-react')) continue;
    const sf = parseSource(root, file);
    let recordLocal = null;
    let readsDynamic = false;
    sf.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
      const specifier = node.moduleSpecifier.text;
      if (specifier.startsWith('lucide-react/dynamic')) readsDynamic = true;
      if (specifier !== 'lucide-react') return;
      const bindings = node.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) return;
      for (const element of bindings.elements) {
        if ((element.propertyName ?? element.name).text === 'icons') recordLocal = element.name.text;
      }
    });
    if (readsDynamic) dynamic.push(file);
    if (!recordLocal) continue;
    let indexes = false;
    const visit = (node) => {
      if (ts.isElementAccessExpression(node)) {
        const base = unwrap(node.expression);
        if (ts.isIdentifier(base) && base.text === recordLocal) indexes = true;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
    if (indexes) record.push(file);
  }
  return { record: record.sort(), dynamic: dynamic.sort() };
}

// ── Part 2: authored nodes ───────────────────────────────────────────────────
const ARRAY_PATH = /^(\w+)\[\]\.icon$/;

function judgeAuthoredNodes(root, { sources, documents }, types = RECORD_READING_TYPES) {
  const violations = [];
  const errors = [];
  let judged = 0;
  let declined = 0;
  let descendantJudged = 0;
  /** Per declaring container `type`, how many untyped child icons descent reached. */
  const descentReach = new Map();

  const judge = (typeName, gather, locate) => {
    const spec = types[typeName];
    if (!spec) return;
    for (const path of spec.paths) {
      for (const found of gather(path)) {
        judged += 1;
        if (!isLiveKey(found.value)) {
          violations.push({ where: locate(found.where), site: typeName, resolver: spec.resolver, detail: describeName(found.value) });
        }
      }
    }
  };

  /**
   * The descent site a node's children inherit. A node's OWN `type` is still
   * the answer to "which resolver does this string reach?", so a typed node
   * ENDS whatever descent it sits inside and opens a new one only if its own
   * census entry declares one. That is what keeps a `type: 'separator'` menu
   * item — which this renderer returns early for, drawing no icon — declined
   * rather than judged.
   */
  const descentBelow = (typeName, inherited) => {
    if (!typeName) return inherited;
    const spec = types[typeName];
    return spec?.descendants ? { type: typeName, spec } : null;
  };

  /** Judge one untyped child icon against the container that declared descent. */
  const judgeDescendant = (site, value, where) => {
    judged += 1;
    descendantJudged += 1;
    descentReach.set(site.type, (descentReach.get(site.type) ?? 0) + 1);
    if (!isLiveKey(value)) {
      violations.push({ where, site: `${site.type} (untyped child item)`, resolver: site.spec.resolver, detail: describeName(value) });
    }
  };

  for (const file of documents) {
    if (isTestPath(file)) continue;
    let document;
    try { document = JSON.parse(readFileSync(join(root, file), 'utf8')); } catch { continue; }
    // One walker, carrying a JSON-pointer trail so a violation names the node,
    // and the descent site (if any) its untyped children answer to.
    const walk = (node, trail, descent) => {
      if (Array.isArray(node)) { node.forEach((child, index) => walk(child, `${trail}[${index}]`, descent)); return; }
      if (!node || typeof node !== 'object') return;
      const typeName = typeof node.type === 'string' ? node.type : null;
      const inherits = !typeName && descent && typeof node.icon === 'string';
      if (inherits) judgeDescendant(descent, node.icon, `${file} ${trail}.icon`);
      if (typeof node.icon === 'string' && !inherits && !(typeName && types[typeName])) declined += 1;
      if (typeName) {
        judge(typeName, (path) => {
          const found = [];
          const arrayMatch = ARRAY_PATH.exec(path);
          if (path === 'icon') {
            if (typeof node.icon === 'string') found.push({ value: node.icon, where: `${trail}.icon` });
          } else if (arrayMatch && Array.isArray(node[arrayMatch[1]])) {
            node[arrayMatch[1]].forEach((child, index) => {
              if (child && typeof child.icon === 'string') found.push({ value: child.icon, where: `${trail}.${arrayMatch[1]}[${index}].icon` });
            });
          }
          return found;
        }, (where) => `${file} ${where}`);
      }
      const below = descentBelow(typeName, descent);
      for (const [key, value] of Object.entries(node)) walk(value, `${trail}.${key}`, below);
    };
    walk(document, '$', null);
  }

  for (const file of sources) {
    if (isTestPath(file)) continue;
    const text = readFileSync(join(root, file), 'utf8');
    if (!text.includes('icon')) continue;
    const sf = parseSource(root, file);
    const visit = (node, descent) => {
      let below = descent;
      if (ts.isObjectLiteralExpression(node)) {
        const typeInit = objectProp(node, 'type');
        const iconInit = objectProp(node, 'icon');
        const typeName = typeInit && ts.isStringLiteral(typeInit) ? typeInit.text : null;
        below = descentBelow(typeName, descent);
        const iconLiteral = iconInit && ts.isStringLiteral(iconInit) ? iconInit : null;
        const inherits = !typeName && descent && iconLiteral;
        if (inherits) judgeDescendant(descent, iconLiteral.text, `${file}:${lineOf(sf, iconLiteral)}`);
        if (iconLiteral && !inherits && !(typeName && types[typeName])) declined += 1;
        if (typeName) {
          judge(typeName, (path) => {
            const found = [];
            const arrayMatch = ARRAY_PATH.exec(path);
            if (path === 'icon') {
              if (iconInit && ts.isStringLiteral(iconInit)) found.push({ value: iconInit.text, where: iconInit });
            } else if (arrayMatch) {
              const arrayInit = objectProp(node, arrayMatch[1]);
              if (arrayInit && ts.isArrayLiteralExpression(arrayInit)) {
                for (const element of arrayInit.elements) {
                  if (!ts.isObjectLiteralExpression(element)) continue;
                  const childIcon = objectProp(element, 'icon');
                  if (childIcon && ts.isStringLiteral(childIcon)) found.push({ value: childIcon.text, where: childIcon });
                }
              }
            }
            return found;
          }, (where) => `${file}:${lineOf(sf, where)}`);
        }
      }
      ts.forEachChild(node, (child) => visit(child, below));
    };
    ts.forEachChild(sf, (child) => visit(child, null));
  }

  // Non-vacuity, the precondition ANCHORED_MAPS states in full below: a descent
  // declaration that reached NOTHING produces zero violations and reads exactly
  // like a clean tree. That is the failure this whole card is about one level
  // up, so it is an ERROR here rather than a shrug.
  for (const [typeName, spec] of Object.entries(types)) {
    if (!spec.descendants) continue;
    const reached = descentReach.get(typeName) ?? 0;
    const min = spec.min ?? 1;
    if (reached < min) {
      errors.push(
        `\`${typeName}\` declares its icon names on UNTYPED child items (\`descendants: true\`), but the authored-node walk `
        + `reached ${reached} of them — fewer than the ${min} it is declared to carry. Either the authored nodes moved `
        + 'or the descent no longer reaches them; a descent that reaches nothing reports no violations and reads as green. '
        + `Resolved through: ${spec.resolver}`,
      );
    }
  }

  return { violations, errors, judged, declined, descendantJudged };
}

// ── Part 3: anchored first-party maps ────────────────────────────────────────
function judgeAnchoredMaps(root, anchors) {
  const violations = [];
  const errors = [];
  let judged = 0;

  for (const anchor of anchors) {
    if (!existsSync(join(root, anchor.file))) {
      errors.push(`anchored map source is gone: ${anchor.file} (${anchor.why}). Fix the anchor; do not delete it.`);
      continue;
    }
    const sf = parseSource(root, anchor.file);
    const found = [];
    const visit = (node) => {
      if (anchor.kind === 'pushed-objects') {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && `${node.expression.expression.getText(sf)}.${node.expression.name.text}` === anchor.anchor) {
          for (const argument of node.arguments) {
            if (!ts.isObjectLiteralExpression(argument)) continue;
            const iconInit = objectProp(argument, 'icon');
            if (iconInit && ts.isStringLiteral(iconInit)) found.push({ value: iconInit.text, node: iconInit });
          }
        }
      } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === anchor.anchor
        && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        for (const property of node.initializer.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const init = property.initializer;
          if (anchor.kind === 'strings' && ts.isStringLiteral(init)) found.push({ value: init.text, node: init });
          if (anchor.kind === 'identifiers') {
            if (ts.isIdentifier(init)) found.push({ value: init.text, node: init });
            else if (ts.isJsxSelfClosingElement(init) && ts.isIdentifier(init.tagName)) found.push({ value: init.tagName.text, node: init });
            else if (ts.isJsxElement(init) && ts.isIdentifier(init.openingElement.tagName)) found.push({ value: init.openingElement.tagName.text, node: init });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);

    if (found.length < anchor.min) {
      errors.push(
        `anchored map \`${anchor.anchor}\` in ${anchor.file} yielded ${found.length} entries, fewer than the ${anchor.min} it is known to carry — `
        + 'the declaration moved, was re-annotated, or the reader broke. A reader that finds nothing reports no violations, '
        + `which is why this is an ERROR and not a shrug. (${anchor.why})`,
      );
      continue;
    }
    judged += found.length;
    for (const entry of found) {
      // Identifier anchors name lucide EXPORTS, already record-key shaped;
      // string anchors name authored kebab spellings. `toRecordKey` is the
      // identity on the former, so one predicate serves both.
      if (!isLiveKey(entry.value)) {
        violations.push({ where: `${anchor.file}:${lineOf(sf, entry.node)}`, site: `${anchor.anchor} (${anchor.kind})`, resolver: anchor.why, detail: describeName(entry.value) });
      }
    }
  }
  return { violations, errors, judged };
}

// ── The whole judgement ──────────────────────────────────────────────────────
/**
 * One authored-node census entry. Spelled out as a type rather than left to be
 * inferred from `RECORD_READING_TYPES`, because every override this function
 * takes exists to be a DIFFERENT table from the declared one — inferring the
 * parameter from the default makes the declared table the only one that fits,
 * which is precisely backwards for a seam whose job is substitution.
 *
 * @typedef {{ paths: string[], resolver: string, descendants?: boolean, min?: number }} RecordReadingType
 *
 * @typedef {{
 *   anchors?: readonly any[],
 *   declaredRecordReaders?: readonly string[],
 *   declaredDynamicReaders?: readonly string[],
 *   negativeControl?: string,
 *   recordReadingTypes?: Record<string, RecordReadingType>,
 * }} AnalyzeOptions
 *
 * @param {string} root
 * @param {AnalyzeOptions} [options]
 */
export function analyze(root, {
  anchors = ANCHORED_MAPS,
  declaredRecordReaders = DECLARED_RECORD_READERS,
  declaredDynamicReaders = DECLARED_DYNAMIC_READERS,
  negativeControl = DISCOVERY_NEGATIVE_CONTROL,
  recordReadingTypes = RECORD_READING_TYPES,
} = {}) {
  const errors = [...selfTest()];
  const { sources, documents } = collectFiles(root);
  const discovered = discoverResolvers(root, sources);

  const censusDiff = (label, found, declared, hint) => {
    for (const file of found) {
      if (!declared.includes(file)) {
        errors.push(`UNDECLARED ${label}: ${file}\n      ${hint}\n      Add it to the census in scripts/check-lucide-icon-record-names.mjs after deciding which vocabulary it reads.`);
      }
    }
    for (const file of declared) {
      if (!found.includes(file)) {
        errors.push(`STALE ${label} census entry: ${file} no longer reads that vocabulary (or moved). Update the census — do not delete the gate.`);
      }
    }
  };
  censusDiff('record-reading resolver', discovered.record, declaredRecordReaders,
    'It resolves an icon NAME through lucide\'s runtime `icons` record, where a retired spelling resolves to nothing and NOTHING goes red.');
  censusDiff('dynamic-surface resolver', discovered.dynamic, declaredDynamicReaders,
    'It resolves names through `lucide-react/dynamic.mjs`, which still carries retired spellings — a second, more forgiving vocabulary.');

  if (discovered.record.length === 0) {
    errors.push('discovery found NO record-reading resolver at all — it is not matching imports any more, and every "no violations" below is vacuous.');
  }
  if (negativeControl && (discovered.record.includes(negativeControl) || discovered.dynamic.includes(negativeControl))) {
    errors.push(`discovery classified ${negativeControl} as a lucide resolver. It builds its OWN local \`icons\` object — discovery is matching the NAME rather than the IMPORT.`);
  }

  const authored = judgeAuthoredNodes(root, { sources, documents }, recordReadingTypes);
  const anchored = judgeAnchoredMaps(root, anchors);
  errors.push(...authored.errors, ...anchored.errors);

  return {
    discovered,
    errors,
    violations: [...authored.violations, ...anchored.violations],
    counters: {
      sources: sources.length,
      documents: documents.length,
      authoredJudged: authored.judged,
      authoredDeclined: authored.declined,
      authoredDescendantJudged: authored.descendantJudged,
      anchoredJudged: anchored.judged,
    },
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const invokedDirectly = isEntrypoint(import.meta.url);
if (invokedDirectly) {
  const result = analyze(gateRoot);
  const { counters, discovered, errors, violations } = result;

  if (process.argv.includes('--report')) {
    console.log(`lucide ${lucideVersion} resolved from ${LUCIDE_OWNER_PKG}`);
    console.log(`RECORD vocabulary: ${Object.keys(icons).length} keys | DYNAMIC vocabulary: ${iconNames.length} names (superset by ${iconNames.length - Object.keys(icons).length})`);
    console.log(`scanned ${counters.sources} TS sources + ${counters.documents} JSON documents under ${SCAN_ROOTS.join('/, ')}/`);
    console.log(`record-reading resolvers discovered (${discovered.record.length}):`);
    for (const file of discovered.record) console.log(`    ${file}`);
    console.log(`dynamic-surface resolvers discovered (${discovered.dynamic.length}), NOT judged here:`);
    for (const file of discovered.dynamic) console.log(`    ${file}`);
    console.log(`authored icon names judged: ${counters.authoredJudged} (${counters.authoredDescendantJudged} of them on UNTYPED child items of a declared container) | icon names on nodes this gate declines to judge: ${counters.authoredDeclined}`);
    console.log(`anchored map entries judged: ${counters.anchoredJudged}`);
    console.log('');
  }

  if (errors.length === 0 && violations.length === 0) {
    console.log(
      `OK  lucide icon names: ${counters.authoredJudged + counters.anchoredJudged} authored/declared names reaching `
      + `${discovered.record.length} record-reading resolvers are live \`icons\` keys `
      + `(record ${Object.keys(icons).length} keys; dynamic surface ${discovered.dynamic.length} sites, ${iconNames.length} names, not judged here).`,
    );
    process.exit(0);
  }

  console.error('FAIL  lucide icon names\n');
  for (const violation of violations) {
    console.error(`    - ${violation.where}  [${violation.site}]`);
    console.error(`      ${violation.detail}`);
    console.error(`      Resolved through: ${violation.resolver}`);
  }
  if (violations.length > 0 && errors.length > 0) console.error('');
  for (const message of errors) console.error(`    - ${message}`);
  console.error(
    '\nlucide retires a spelling by dropping it from the runtime `icons` record while keeping it as a\n'
    + 'deprecated export, so a retired name still imports, still type-checks and still renders as a\n'
    + 'COMPONENT — and resolves to nothing as a STRING. Nothing else goes red. See objectui#5633.',
  );
  process.exit(1);
}
