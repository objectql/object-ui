#!/usr/bin/env node
/**
 * Every `type` string literal in a `content/docs/**` code block — `.mdx` and
 * `.md` alike — must name a component the repository actually registers, or be
 * declared, per file, as belonging to some other vocabulary. Since objectui#5106
 * the same question is also asked of the KEY TABLES that document a plugin's
 * registrations, on BOTH halves of the row: the namespaced key and the bare-name
 * fallback (see "The second surface" below).
 *
 * Run:  node scripts/check-doc-component-types.mjs   (also `pnpm check:doc-types`)
 * Exit: 0 = every teaching snippet names a registered type (or a declared
 *       exemption), 1 = at least one snippet teaches a type nothing registers,
 *       an exemption has gone stale, or the scan collapsed.
 *
 * ## The failure this closes (objectui#4823, recurrence #4 would have been free)
 *
 * `examples/schema-catalog/test/catalog-gallery-render.test.tsx` (objectui#4616)
 * renders every catalog entry and fails if any paints the registry's
 * "Unknown component type" panel (OBJUI-001). The TEACHING surface had no
 * equivalent: a ```plaintext block in `content/docs/**` is not rendered, not
 * parsed and not compared against anything, so a snippet could name any `type`
 * string at all and CI stayed green end to end.
 *
 * The same defect landed three times before this gate existed, each one found
 * by a human probe rather than by a check:
 *
 *   objectui#4786  `content/docs/**`                 taught `stats-card`
 *   objectui#4796  `content/docs/fields/grid.mdx`    taught `plugin:grid`   (real: `object-grid`)
 *   objectui#4796  `content/docs/fields/location.mdx` taught `plugin:map`   (real: `object-map`)
 *
 * A reader who copied any of them got a red panel instead of a component. The
 * first scan under this gate found two more of exactly that shape, fixed in the
 * same PR: `heading` (`utilities/runner.mdx`, `utilities/vscode-extension.mdx`
 * — nothing registers it; `h1` does) and `multi-step-form`
 * (`plugins/plugin-form.mdx` — the string appears nowhere in the repo outside
 * that snippet; the wizard is `object-form` + `formType: 'wizard'`, which
 * `WizardFormSchema` declares).
 *
 * NOT in scope, deliberately: whether the snippet's OTHER keys are read by the
 * renderer the type resolves to. That is objectui#4823's second dimension and
 * needs a per-renderer read-point contract; this gate answers one question only
 * — does the type exist.
 *
 * ## Where the registered-key universe comes from — derived, never a list
 *
 * A hard-coded key list would be the Nth copy of an enumeration this repo
 * already keeps in the register calls themselves, and it would rot the first
 * time a plugin adds a component. So the universe is derived from source on
 * every run, with no build step (which is what lets this run as a per-PR check
 * next to `check-doc-links.mjs` rather than behind a `turbo build`):
 *
 *   - DIRECT: `X.register('key', …)` / `X.registerLazy('key', …)` for the
 *     receivers listed in `REGISTRY_RECEIVERS`. `namespace` and `skipFallback`
 *     are read out of the call's OWN balanced argument span — not a fixed-size
 *     window. That distinction is load-bearing and was measured: with a
 *     1500-character window, `plugin-grid/src/index.tsx`'s `object-grid`
 *     registration (line 129) picked up the `skipFallback: true` belonging to
 *     the `grid` registration 12 lines below it, and the derivation silently
 *     dropped the bare `object-grid` key — which 13 doc sites teach correctly.
 *     A window bug in a derivation this gate trusts shows up as a false RED on
 *     correct documentation, so the span is matched, not guessed.
 *   - LOOP: `for (const v of ['a','b'])`, `for (const v of ARR)` and
 *     `ARR.forEach(v => …)` where `ARR` is a literal array in the same file.
 *     Five registration sites use this form (`html-elements.tsx`'s `TAGS`,
 *     `semantic.tsx`'s `tags`, and three `for (const variant of […])` blocks in
 *     `apps/console`).
 *   - INDIRECT: two helpers register from a collection, and each is named
 *     explicitly in `INDIRECT_REGISTRATIONS` with the collection it reads. Both
 *     entries are re-derived per run; a named collection that disappears or
 *     stops yielding keys fails the gate rather than shrinking the universe.
 *   - OPEN: a handful of call sites take a key that is not knowable statically
 *     (a third-party plugin's own type, a widget manifest's `type`). Those are
 *     listed in `OPEN_REGISTRATION_SITES` with the reason. Every OTHER
 *     unresolvable call site fails the gate as `unresolved-registration` — a
 *     new dynamic registration path must be taught to this derivation, because
 *     silently missing one narrows the universe and turns correct docs red.
 *
 * The universe is deliberately GENEROUS: it unions every key any package or app
 * in the repo can register, including the opt-in protocol placeholders, without
 * modelling which host loaded which package. A doc site is judged on "does this
 * string name a component that exists", never on "is it registered in the host
 * this page happens to describe". Host-specific registration is a different
 * question with a different answer per page, and a gate that guessed at it
 * would produce exactly the false reds that get gates deleted.
 *
 * ## How a doc site is judged, and why there is no structural discriminator
 *
 * `type` is not one vocabulary in these pages. Measured over all 143 files on
 * the tree this gate was written against — 560 `type: '…'` sites in fenced code
 * blocks — the corpus carries at least seven distinct vocabularies that all
 * spell the key `type`:
 *
 *   SDUI component keys   `{ type: 'object-grid', … }`          the one this gate judges
 *   action schemas        `action: { type: 'submit' }`          `@object-ui/types`' ActionSchema
 *   block schemas         `type: 'block-instance'`              `packages/types/src/blocks.ts`
 *   theme / report schemas`type: 'theme-switcher'`, `'matrix'`  `types/src/theme.ts`, `reports.ts`
 *   field + JSON-Schema   `type: 'string'`, `type: 'currency'`  variable / property declarations
 *   validation rules      `validation: [{ type: 'minLength' }]` form rule discriminants
 *   nav + feed items      `type: 'item'`, `type: 'comment'`     menu entries, activity feed items
 *
 * The obvious discriminator — classify by the enclosing key path, so a `type`
 * under `validation` is a rule and a `type` under `children` is a node — was
 * built and MEASURED before being rejected. Two findings killed it. First, the
 * snippets are TypeScript as often as JSON, and a TS annotation reads exactly
 * like an object key to a brace-tracking scanner: `const heroBlock: BlockSchema
 * = {` made `heroBlock` the enclosing key for everything inside it, and 31 of
 * the 92 off-registry sites came out with a path a human would not recognise.
 * Second, and fatally, the fix does not converge: `items` carries nav entries on
 * one page and renderable children on another, so any global parent-key rule is
 * a silent false GREEN on one of them. A misclassifying discriminator is worse
 * than none, because its mistakes are invisible in both directions.
 *
 * So the rule is flat and stated rather than inferred:
 *
 *     EVERY `type` string literal in a docs code block is a candidate SDUI
 *     component key. If its value is in the derived universe it passes. If it
 *     is not, the file must DECLARE it in `DOC_TYPE_EXEMPTIONS` with a written
 *     reason naming the vocabulary it really belongs to. Anything else is red.
 *
 * Exemptions are keyed by (file, value), never by file alone and never by value
 * alone. A whole-file exemption would silence real defects on pages that mix
 * vocabularies — `blocks/block-schema.mdx` carries `type: 'block'` AND
 * `type: 'div'` in the same document — and a value-only exemption would let a
 * page anywhere in the tree teach `submit` as a component. (file, value) also
 * keeps the entry honest: it says which page speaks which dialect, which is the
 * fact a reader of that page needs.
 *
 * Every entry is re-derived per run. An entry whose file no longer contains
 * that value, or that carries no reason, fails as `stale-exemption` — an
 * exemption is worth what its evidence is worth, and one that outlives its site
 * widens the hole for the next snippet that lands there.
 *
 * ## Line numbers are reported, but the unit of judgment is the value
 *
 * A site is reported with `file:line` so the author can go straight to it, and
 * the exemption is keyed without the line so ordinary editing above a snippet
 * does not invalidate the table.
 *
 * ## The second surface: plugin key tables (objectui#5106)
 *
 * The rule above reads FENCED CODE ONLY, on purpose — prose that mentions a type
 * in backticks is not a snippet. That scope had a measured cost. The objectui#5002
 * family (PRs #5071 / #5078 / #5079 / #5085 / #5089 / #5093 / #5100 / #5104)
 * replaced a fictional "manual `*Components` registration loop" on eight plugin
 * pages with one canonical form — a markdown table of the keys the plugin's entry
 * really registers. The new form is the right one, and it landed entirely OUTSIDE
 * the scan surface, while the code blocks it replaced had been inside it. Net
 * effect: the fact "which keys does this plugin claim" moved from a checked place
 * to an unchecked one, guarded only by hand comparison.
 *
 * So key tables are now read, and the anchor is the TABLE HEADER, not the row:
 *
 *     | Namespaced key | Bare-name fallback | Renderer behind it |
 *
 * Anchoring on the header rather than pattern-matching rows is the whole design,
 * and it was chosen after measuring the alternative. The obvious row heuristic —
 * "first cell is a backticked token containing a colon, second cell is a
 * backticked token" — was run over this tree and matched 33 rows, of which only
 * 22 were keys. The other 11 are a `:`-bearing vocabulary this repo writes in
 * tables constantly:
 *
 *   guide/console-architecture.md:104   `/apps/:appName/:objectName` | `ObjectView`
 *   utilities/runner.mdx:99             `http://localhost:5173/`     | `LocalBundleLoader`
 *   guide/metadata-diagnostics.md:43    `GET /api/v1/meta/items/:type/:name?layered=true`
 *   guide/designing-app-navigation.md:21 `{ "type": "object", … }`
 *
 * React route patterns, URLs, HTTP routes and JSON literals — every one of them a
 * false RED on correct documentation, which is the expensive direction for a gate
 * whose whole job is to be trusted about docs. The header is a DECLARATION by the
 * page that the rows beneath it are registry keys, so it discriminates perfectly
 * where a row shape cannot, and it costs an author nothing they were not already
 * writing.
 *
 * Both halves of the row are judged, and judging the namespaced half is the point
 * objectui#5106 was filed for: this gate never judged a namespace at all. It
 * compared bare keys against a universe that happens to contain namespaced keys
 * too, so `view:dashboard` documented as `plugin-dashboard:dashboard` produced no
 * signal from any static check — the bare `dashboard` matched and the row passed.
 * Flip `namespace: 'view'` to `'dash'` in `plugin-dashboard/src/index.tsx` and
 * `deriveRegistryKeys` follows it live to `dash:dashboard`, while every doc that
 * teaches `view:dashboard` stays green. That is the hole; the namespaced cell
 * closes it.
 *
 * What is deliberately NOT checked, and why: when the fallback cell reads
 * "none — `skipFallback: true`", this gate does not assert that the bare name is
 * absent from the universe. It cannot. The universe is a deliberate UNION across
 * every package in the repo (see "generous" above), so `view:grid` skipping its
 * own bare fallback says nothing about whether some other package registers a
 * bare `grid` — and one does. Asserting the negative would red
 * `plugins/plugin-grid.mdx:185`, which is correct. The positive half is checkable
 * and is checked; the negative half needs per-host registration modelling this
 * gate deliberately does not do.
 *
 * `DOC_TYPE_EXEMPTIONS` does not apply to table rows, and that is deliberate
 * rather than an omission. An exemption declares "this value belongs to another
 * vocabulary" — but a row under a header that says "Namespaced key" has already
 * declared its vocabulary, and there is no other one it could be. A row that
 * cannot be registered is a wrong row (or a header being borrowed for a table
 * that is not a key table), and both are worth fixing rather than silencing.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

// ── Configuration ────────────────────────────────────────────────────────────

/** Where the teaching prose lives. This gate walks `content/docs` and nothing
 *  else: not `skills/**`, not the package READMEs (`check-doc-snippet-types.mjs`
 *  covers those for its own question), not `docs/**`. */
const DOCS_ROOT = 'content/docs';

/** Page extensions collected under `DOCS_ROOT`. BOTH are collected, and that is
 *  the whole content of the scan surface: `content/docs` is authored in a mix of
 *  `.mdx` and `.md` — the same guide tree, the same renderer, the same reader —
 *  and an extension is not a coverage decision. Deliberately kept identical to
 *  `check-doc-snippet-types.mjs`'s `DOC_EXTENSIONS`: two collectors walking one
 *  tree two different ways is a defect one level up from either gate, and it is
 *  how a page ends up covered by the question it passes and invisible to the one
 *  it fails.
 *
 *  Collecting only `.mdx` is what objectui#5342 measured, and unlike its sibling
 *  objectui#5174 this file was never lying about it — the sentence above used to
 *  say `.mdx` and the ledger was keyed by `.mdx` paths throughout. It was a
 *  stated coverage decision, not a broken promise, and the decision is now the
 *  other way: 40 `.md` pages sat outside the ledger, so they were neither
 *  covered nor declared ungated. Anything else under the tree (the `meta.json`
 *  sidecars) holds no prose and is not a page. */
const DOC_EXTENSIONS = ['.mdx', '.md'];

/** The header that marks a markdown table as a plugin KEY TABLE — the canonical
 *  form the objectui#5002 family standardised on, and the anchor this gate uses
 *  to read tables without reading prose. See "The second surface" in the header
 *  for the measurement that rejected row-shape matching in favour of this.
 *
 *  Matched on the first two cells only: pages spell the third column
 *  "Renderer behind it", and pinning a description column would make the gate
 *  brittle about wording that carries no meaning for it. Anchored with `^` and a
 *  literal `|` so it cannot match the same words in prose. */
const KEY_TABLE_HEADER = /^\s*\|\s*Namespaced key\s*\|\s*Bare-name fallback\s*\|/i;

/** A markdown delimiter row (`| --- | --- |`), which is what makes the line above
 *  it a header rather than an ordinary row that happens to read like one. */
const TABLE_DELIMITER = /^\s*\|[\s:|-]+\|\s*$/;

/** A table cell holding exactly one backticked token, and nothing else. */
const BACKTICKED_CELL = /^`([^`]+)`$/;

/** The fallback cell's "this registration passes `skipFallback: true`" spelling.
 *  Recognised so the row is still JUDGED on its namespaced half rather than
 *  skipped — a row this gate cannot read is a row it silently stops guarding. */
const NO_FALLBACK_CELL = /^none\b/i;

/** Where registrations live. Every workspace source root that can register. */
const SOURCE_ROOTS = ['packages', 'apps', 'examples'];

/**
 * Receiver expressions whose `.register(` / `.registerLazy(` is a
 * ComponentRegistry registration. Spelled out rather than matched loosely
 * because this repo has several unrelated `.register(` methods — react-hook-form
 * controls, the formula table, the record context, `serviceWorker.register` —
 * and treating those as registrations would put arbitrary strings into the
 * universe.
 */
const REGISTRY_RECEIVERS = ['ComponentRegistry', 'componentRegistry', 'registry', 'scope'];

/**
 * Helpers that register from a collection instead of from a literal argument.
 * Each entry names the collection it reads; the derivation re-reads that
 * collection every run and fails if it is gone.
 */
const INDIRECT_REGISTRATIONS = [
  {
    site: 'packages/components/src/renderers/placeholders.tsx',
    collection: 'PROTOCOL_COMPONENTS',
    kind: 'array',
    namespace: 'protocol-placeholder',
    reason:
      '`registerPlaceholder(type)` registers every entry of PROTOCOL_COMPONENTS under the ' +
      '`protocol-placeholder` namespace (opt-in via registerPlaceholders(); apps/console calls it). ' +
      'The keys are protocol vocabulary the docs legitimately teach.',
  },
  {
    site: 'packages/fields/src/index.tsx',
    collection: 'fieldWidgetMap',
    kind: 'object-keys',
    namespace: 'field',
    skipFallbackSet: 'FIELD_TYPES_SKIP_FALLBACK',
    reason:
      '`registerField(fieldType)` registers each key of fieldWidgetMap as `field:<type>` (plus the ' +
      'bare key unless FIELD_TYPES_SKIP_FALLBACK holds it), and `registerAllFields()` runs it for ' +
      'every key at module load. Field pages teach these bare keys.',
  },
];

/**
 * Registration call sites whose key genuinely cannot be known statically. Each
 * is matched by `<file>:<line>` and must still BE a register call on that line,
 * so a moved or deleted site is reported rather than silently forgiven.
 */
const OPEN_REGISTRATION_SITES = {
  'packages/core/src/registry/PluginScopeImpl.ts': {
    receiver: 'registry',
    reason:
      'PluginScope.register() forwards a third-party plugin\'s own type through to the registry. ' +
      'The key belongs to the plugin, not to this repository, so there is nothing here to derive.',
  },
  'packages/core/src/registry/WidgetRegistry.ts': {
    receiver: 'componentRegistry',
    reason:
      'WidgetRegistry registers `manifest.type` from a host-supplied widget manifest. The manifest ' +
      'is data, not source, so its types are not derivable from this tree.',
  },
};

/**
 * Per-file declarations that a `type` value in that page belongs to a
 * vocabulary other than the SDUI component registry.
 *
 * Keyed `<repo-relative doc path>` -> `<type value>` -> reason. The reason must
 * name the vocabulary and, where one exists, where it is declared — an
 * exemption that only says "not a component" teaches the next reader nothing
 * and cannot be re-checked.
 */
const DOC_TYPE_EXEMPTIONS = {
  'content/docs/api/schema-reference.md': {
    action:
      'ActionSchema discriminant under an ACTION LIST, never a rendered child — an action\'s own ' +
      '`dialog.actions[]` and `chain[]`, a detail page\'s `actions[]` and a CRUD dialog\'s ' +
      '`actions[]` are each typed `ActionSchema[]` (packages/types/src/crud.ts:154, 175, 290, 341), ' +
      'and that interface declares `type: \'action\'` at crud.ts:68. Same vocabulary as the ' +
      '`core/enhanced-actions.mdx` entry below. (This reason used to cite `CRUDSchema`\'s ' +
      '`toolbar.actions[]` / `rowActions[]` / `batchActions[]` as the carriers; those keys were ' +
      'retired with `CRUDSchema` in objectui#5373, and the sites this exemption covers on the page ' +
      'now sit under ActionSchema and DetailSchema.)',
    string:
      'PageNodeSchema variable declaration\'s data type inside `variables[]`, next to `name` / ' +
      '`defaultValue` — `PageVariable` (packages/types/src/layout.ts:566, re-exported from ' +
      '@objectstack/spec\'s `PageVariableSchema`). Same vocabulary as blocks/block-schema.mdx\'s ' +
      '`string`.',
  },
  'content/docs/blocks/authentication.mdx': {
    submit:
      'ActionSchema discriminant under a button\'s `action` key, not a node type. ' +
      '`@object-ui/types` ActionSchema.',
  },
  'content/docs/blocks/block-schema.mdx': {
    block:
      'BlockSchema discriminant — `packages/types/src/blocks.ts` declares `type: \'block\'`, and ' +
      '`packages/types/src/zod/blocks.zod.ts` validates it. A block definition is not a rendered node.',
    'block-instance':
      'BlockInstanceSchema discriminant — packages/types/src/blocks.ts:357, zod/blocks.zod.ts:130. A ' +
      'reference to a block is a definition, not a rendered node: it is absent from `AnySchema` ' +
      '(types/src/index.ts) and nothing resolves its `blockId`.',
    'block-library':
      'BlockLibrarySchema discriminant — packages/types/src/blocks.ts:263, zod/blocks.zod.ts:100. The ' +
      'shape of a block-library PAYLOAD, not a browser component: absent from `AnySchema`, and no ' +
      'renderer reads it.',
    'block-editor':
      'BlockEditorSchema discriminant — packages/types/src/blocks.ts:315, zod/blocks.zod.ts:116. The ' +
      'shape of an editor CONFIGURATION, not an editor component: absent from `AnySchema`, and no ' +
      'block editor exists to consume it.',
    // `slot` was here, exempted pending objectui#4895. That card ruled (maintainer,
    // 2026-08-19, recorded on the issue): Option B, docs-truth fix — the family stays
    // type-level, the phantom `type: 'slot'` node is DELETED from the page, and the
    // page teaches the declared `slotContent` key instead. `slot` is now spelled
    // nowhere in blocks/block-schema.mdx, so an exemption for it would itself fail as
    // `stale-exemption`. Nothing to exempt; the entry is gone rather than re-pointed.
    string:
      'BlockVariable.type — a variable declaration\'s data type, next to `defaultValue` / `required`.',
  },
  'content/docs/blocks/dashboard.mdx': {
    navigate: 'ActionSchema discriminant under a node\'s `action` key.',
  },
  'content/docs/blocks/ecommerce.mdx': {
    submit: 'ActionSchema discriminant under a node\'s `action` key.',
  },
  'content/docs/blocks/forms.mdx': {
    submit: 'ActionSchema discriminant under a node\'s `action` key.',
  },
  'content/docs/blocks/marketing.mdx': {
    analytics: 'ActionSchema discriminant under a node\'s `action` key.',
  },
  'content/docs/components/complex/filter-ui.mdx': {
    'date-range':
      'Filter control type — `packages/types/src/crud.ts:329` and `views.ts:804` declare it in the ' +
      'filter enum, alongside `date-picker` / `number-range`.',
  },
  'content/docs/components/complex/view-switcher.mdx': {
    share:
      'First member of a TypeScript union of view-action ids (`\'share\' | \'settings\' | ' +
      '\'duplicate\' | \'delete\'`) in a Schema API declaration, not a node type.',
  },
  'content/docs/components/index.md': {
    'component-name':
      'Metasyntactic placeholder in the page\'s "Usage Pattern" template — the block shows the SHAPE ' +
      'every component schema has (`type` / `className` / component-specific props) and the value ' +
      'stands for whichever key the reader picked from the catalog below it. Nothing registers the ' +
      'literal string, by design.',
  },
  'content/docs/core/app-schema.mdx': {
    item: 'AppSchema menu entry kind — a navigation item, sibling of `group`. Not a rendered node.',
    group: 'AppSchema menu entry kind — a navigation group holding `children` items.',
  },
  'content/docs/core/enhanced-actions.mdx': {
    action:
      'ActionSchema discriminant. This page documents the action vocabulary end to end, so every ' +
      '`type: \'action\'` here is an action definition rather than a node.',
    message: 'ActionSchema discriminant for the message/toast action under `onFailure`.',
  },
  'content/docs/core/report-schema.mdx': {
    line: 'Chart series kind under a report section\'s `chart.series`, not a node type.',
    'page-break':
      'ReportSection kind — `packages/types/src/reports.ts:210` declares the section enum ' +
      '(`header | summary | chart | table | text | page-break`).',
    'report-builder':
      'ReportBuilderSchema discriminant — packages/types/src/reports.ts:464, zod/reports.zod.ts:154.',
    string: 'Report field data type in a `fields` declaration, not a node type.',
  },
  'content/docs/core/schema-renderer.mdx': {
    'my-widget':
      'Deliberate placeholder in the "register your own component" walkthrough — the page teaches ' +
      'the reader to register this key, so it is unregistered here by design.',
  },
  'content/docs/fields/object.mdx': {
    array: 'JSON Schema property type inside a field\'s `schema.properties`, not a node type.',
    string: 'JSON Schema property type inside a field\'s `schema.properties`, not a node type.',
  },
  'content/docs/guide/architecture.md': {
    'my-grid':
      'Deliberate placeholder in the "register your component, then address it by key" contrast — ' +
      'the snippet\'s own line above spells `ComponentRegistry.register(\'my-grid\', MyGrid)`, so it ' +
      'is unregistered in this repository by design.',
    string:
      '`ComponentInput.type` in a `register(...)` call\'s `inputs[]` — a DESIGNER input\'s coarse ' +
      'control kind (packages/types/src/base.ts:386), sibling of `number` / `boolean` / `enum`. ' +
      'Not a node type.',
  },
  'content/docs/guide/component-registry.md': {
    custom:
      'Placeholder discriminant in a "type your custom component" `interface CustomSchema extends ' +
      'BaseSchema` declaration — the page is teaching the reader to declare their own schema ' +
      'interface, so the literal is theirs to register.',
    'my-component':
      'Deliberate placeholder in the "register a custom component" walkthrough — the page registers ' +
      'this key itself (`ComponentRegistry.register(\'my-component\', MyComponent, …)`) and then ' +
      'shows the JSON that addresses it.',
    string:
      '`ComponentInput.type` in a `register(...)` call\'s `inputs[]` — a designer input\'s coarse ' +
      'control kind (packages/types/src/base.ts:386), not a node type.',
  },
  'content/docs/guide/console-architecture.md': {
    delete:
      '`ActionDef.type` passed to `useActionRunner().execute(...)` — a RunnableActionType, the ' +
      'action vocabulary declared at packages/core/src/actions/ActionRunner.ts:112. An action being ' +
      'run, not a node being rendered.',
  },
  'content/docs/guide/dashboard-filters.md': {
    bar: 'Dashboard widget kind under `widgets[]`, alongside `line` — same vocabulary as the ' +
      'plugins/plugin-dashboard.mdx entry below. Not a node type.',
    line: 'Dashboard widget kind under `widgets[]`, alongside `bar` — same vocabulary as the ' +
      'plugins/plugin-dashboard.mdx entry below. Not a node type.',
  },
  'content/docs/guide/objectos-integration.mdx': {
    'my-custom-widget':
      'Deliberate placeholder in the "register a lazy custom widget" walkthrough — the reader ' +
      'supplies this key.',
  },
  'content/docs/guide/plugin-development.md': {
    array:
      '`ComponentInput.type` in this walkthrough\'s own `register(...)` `inputs[]` — a designer ' +
      'input\'s coarse control kind (packages/types/src/base.ts:386), not a node type.',
    board:
      'The walkthrough\'s OWN plugin key. This page builds `@object-ui/plugin-board` end to end, so ' +
      'every `board` here — the `BoardSchema` interface, the `register(\'board\', BoardRenderer, …)` ' +
      'call, the test fixture and the final JSON — is the key the READER registers by following the ' +
      'page. Unregistered in this repository by design.',
    enum: '`ComponentInput.type` in the walkthrough\'s `inputs[]` — the coarse kind that carries an ' +
      '`enum` list of allowed values, not a node type.',
    string:
      '`ComponentInput.type` in the walkthrough\'s `inputs[]` (packages/types/src/base.ts:386), not ' +
      'a node type.',
  },
  'content/docs/guide/plugins.md': {
    module:
      'The `package.json` manifest\'s OWN `"type": "module"` field — Node\'s ESM switch, in a block ' +
      'showing the plugin package\'s manifest. Not a UI schema at all. objectui#5127 is the same ' +
      'collision measured on `objectui check`, which read every JSON file\'s root `type` as a ' +
      'component key and reported `module` as unknown in any Node project.',
    'my-feature':
      'Deliberate placeholder for the reader\'s own plugin schema — the page\'s `MyFeatureSchema ' +
      'extends BaseSchema` declaration in the "author your plugin\'s types" step.',
  },
  'content/docs/guide/record-edit-modes.md': {
    picklist:
      'ObjectStack object-metadata FIELD type inside a `fields` record, alongside `text` and ' +
      '`lookup` — the picker/lookup family spelling packages/core/src/utils/record-title.ts:101 ' +
      'names explicitly. A field\'s data type, not a node type.',
  },
  'content/docs/guide/schema-overview.md': {
    action:
      'ActionSchema discriminant in a `const action: ActionSchema = { … }` declaration — this page ' +
      'tours each schema family by declaring one of each, so the literal is the document\'s own ' +
      'discriminant. Same vocabulary as core/enhanced-actions.mdx.',
    block:
      'BlockSchema discriminant in a `const block: BlockSchema = { … }` declaration — ' +
      'packages/types/src/blocks.ts, validated by zod/blocks.zod.ts. A block definition is not a ' +
      'rendered node.',
    group: 'AppSchema menu entry kind — a navigation group holding `children` items, same ' +
      'vocabulary as core/app-schema.mdx.',
    item: 'AppSchema menu entry kind — a navigation item, sibling of `group`. Same vocabulary as ' +
      'core/app-schema.mdx. Not a rendered node.',
    string:
      'BlockVariable.type in the BlockSchema tour\'s `variables[]` — a variable declaration\'s data ' +
      'type, next to `name` / `defaultValue`.',
  },
  'content/docs/guide/schema-playground.md': {
    reset:
      'ActionSchema discriminant under a form\'s `actions[]`, alongside `submit` — an action ' +
      'definition in a list, not a rendered child. Same vocabulary as blocks/authentication.mdx.',
    submit:
      'ActionSchema discriminant under a form\'s `actions[]`, alongside `reset` — an action ' +
      'definition in a list, not a rendered child. Same vocabulary as blocks/authentication.mdx.',
  },
  'content/docs/guide/schema-rendering.md': {
    'admin-panel':
      'Stand-in for one of the READER\'s own registered components in the "move logic to ' +
      'expressions" pattern block, whose subject is `visibleOn` — the two nodes exist to be shown ' +
      'and hidden, and nothing about the pattern depends on which components they are. Weaker than ' +
      'the `my-component` placeholder above it, which the same page registers in its own snippet: ' +
      'these two are never registered on the page, so the name alone does not announce that they ' +
      'are the reader\'s. Recorded here as the disclosed cost of leaving the block\'s subject alone.',
    'my-component':
      'Deliberate placeholder — the snippet\'s own line above spells ' +
      '`ComponentRegistry.register(\'my-component\', MyComponent)`, then shows the schema that ' +
      'addresses it.',
    'user-panel':
      'Stand-in for one of the READER\'s own registered components in the `visibleOn` pattern block, ' +
      'the `${!user.isAdmin}` half of the pair — see the `admin-panel` entry above for the full ' +
      'reason and its known weakness.',
  },
  'content/docs/plugins/index.md': {
    'plugin-component-name':
      'Metasyntactic placeholder in the page\'s "Usage Pattern" template — the block shows the shape ' +
      'every plugin node has and the value stands for whichever plugin key the reader picked from ' +
      'the table above it. Nothing registers the literal string, by design.',
  },
  'content/docs/plugins/plugin-dashboard.mdx': {
    bar: 'Dashboard widget kind under `widgets[]`, alongside `line`. Not a node type.',
    line: 'Dashboard widget kind under `widgets[]`, alongside `bar`. Not a node type.',
  },
  'content/docs/plugins/plugin-detail.mdx': {
    comment: 'FeedItem kind in a `FeedItem[]` literal — `@object-ui/types` activity feed vocabulary.',
    field_change: 'FeedItem kind in a `FeedItem[]` literal — activity feed vocabulary.',
  },
  // `content/docs/plugins/plugin-form.mdx` used to need `minLength` / `maxLength`
  // exempted here, as "ValidationRule discriminants under a field's
  // `validation[]`". Both halves of that reason were fiction (objectui#5118): no
  // `ValidationRule` type exists in this repository, and `validation` is not an
  // array — it is `FieldValidationRules`, an object keyed by rule name, so a
  // rule never carries a `type` discriminant at all. The page now authors the
  // real shape, which spells no `type` there, and the entries went stale.
  'content/docs/plugins/plugin-grid.mdx': {
    count_unique: 'Column summary aggregation under `columns[].summary`, not a node type.',
    multiple:
      'SelectionConfig mode under `selection` — the spec\'s `none` / `single` / `multiple` ' +
      'vocabulary (`SelectionConfigSchema`, @objectstack/spec/ui), not a node type.',
  },
  'content/docs/plugins/plugin-report.mdx': {
    matrix: 'ReportSchema.type kind — a report definition\'s shape, sibling of `joined` / `summary`.',
    joined: 'ReportSchema.type kind — a report definition\'s shape, sibling of `matrix` / `summary`.',
  },
  'content/docs/utilities/runner.mdx': {
    'my-component':
      'Deliberate placeholder in the "load your own plugin" walkthrough — the reader registers it.',
    'your-component':
      'Deliberate placeholder in the "load your own plugin" walkthrough — the reader registers it.',
  },
  'content/docs/utilities/vscode-extension.mdx': {
    ajax: 'ActionSchema discriminant under a form\'s `onSubmit`, not a node type.',
    api: 'Data source kind under a node\'s `dataSource`, not a node type.',
  },
};

/**
 * Floors. A refactor that quietly empties any of these walks would satisfy
 * every assertion in this file while comparing nothing, so each input the
 * verdict depends on has a size the tree is known to clear by a wide margin.
 */
const FLOORS = {
  // `files`, not `docFiles`: the counter `scanDocs` publishes is `files`, so the
  // key used to name a counter that has never existed. `undefined < 100` is
  // `false`, so this floor — the one that catches the walk finding NOTHING —
  // silently passed an empty tree for its whole life. Found while adding the key
  // table floors below (objectui#5106); the mis-key is now unspellable, because
  // `analyze` fails on any FLOORS key that names no counter.
  files: 100,
  codeBlocks: 400,
  typeSites: 300,
  registryKeys: 300,
  // objectui#5106. Roughly half of what this tree holds today (4 tables, 24 rows,
  // 45 judged keys), matching the margin the four floors above keep: a floor is a
  // collapse detector, not a ratchet, and one set at today's exact count turns
  // every legitimate docs edit red. What it must catch is the scan silently
  // finding NOTHING — a renamed header, a broken walk, a regex that stopped
  // matching — because zero rows compared against a universe passes while
  // asserting nothing at all, which is the failure this whole surface exists to
  // prevent one level up.
  keyTables: 2,
  keyTableRows: 12,
  keyTableKeys: 20,
};

// ── Source utilities ─────────────────────────────────────────────────────────

/**
 * Blank out `//` and block comments, preserving every byte position and line
 * break so reported line numbers stay true, and return alongside it a mask
 * marking which positions sit INSIDE a string literal.
 *
 * Both faces are needed and for opposite reasons. Comments must go because
 * registrations are quoted verbatim inside JSDoc in several files
 * (`Registry.ts`, `WidgetRegistry.ts`, `layout/src/index.ts`) and a comment is
 * not a registration. String CONTENTS must stay, because that is where the keys
 * are — but a receiver match that begins inside a string is prose, not a call:
 * `packages/core/src/errors/index.ts:27` carries the sentence "Ensure the
 * component is registered via registry.register() before rendering", which
 * matches the receiver pattern and resolves to no key at all.
 */
function stripComments(text) {
  let out = '';
  const inString = new Uint8Array(text.length);
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      for (; i < stop; i++) out += text[i] === '\n' ? '\n' : ' ';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        inString[i] = 1;
        if (text[i] === '\\') {
          out += text[i] + (text[i + 1] ?? '');
          if (i + 1 < n) inString[i + 1] = 1;
          i += 2;
          continue;
        }
        out += text[i];
        if (text[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return { source: out, inString };
}

/**
 * Return the index just past the `)` matching the `(` at `open`, respecting
 * nested brackets and string literals. Returns -1 when unbalanced.
 */
function spanEnd(text, open) {
  let depth = 0;
  let i = open;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function walkFiles(dir, predicate, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const isTestFile = (rel) =>
  rel.includes(`${sep}__tests__${sep}`) ||
  rel.includes('/__tests__/') ||
  /\.(test|spec)\.[tj]sx?$/.test(rel) ||
  /\.(guard|regression)\.test\./.test(rel);

// ── Registry derivation ──────────────────────────────────────────────────────

/**
 * Resolve the literal names a registration's first argument can take.
 * Returns `null` when the argument is not statically knowable.
 */
function resolveKeyArgument(source, callOpen) {
  const after = source.slice(callOpen + 1);
  const literal = /^\s*(['"])([^'"]*)\1\s*,/.exec(after);
  if (literal) return [literal[2]];

  const identifier = /^\s*([A-Za-z_$][\w$]*)\s*,/.exec(after);
  if (!identifier) return null;
  const name = identifier[1];
  const before = source.slice(0, callOpen);

  // for (const v of ['a', 'b'])
  const inline = [...before.matchAll(new RegExp(`for\\s*\\(\\s*const\\s+${name}\\s+of\\s+\\[([^\\]]*)\\]`, 'g'))].pop();
  if (inline) return [...inline[1].matchAll(/(['"])([^'"]+)\1/g)].map((m) => m[2]);

  // for (const v of ARR)   |   ARR.forEach(v => …)
  const viaArray = [
    ...before.matchAll(
      new RegExp(
        `for\\s*\\(\\s*const\\s+${name}\\s+of\\s+([A-Za-z_$][\\w$]*)|([A-Za-z_$][\\w$]*)\\s*\\.\\s*forEach\\s*\\(\\s*\\(?${name}\\b`,
        'g',
      ),
    ),
  ].pop();
  const arrayName = viaArray && (viaArray[1] || viaArray[2]);
  if (!arrayName) return null;
  const declaration = new RegExp(
    `(?:const|let|var)\\s+${arrayName}\\s*(?::[^=]*)?=\\s*(?:new Set\\()?\\[([\\s\\S]*?)\\]`,
    'm',
  ).exec(source);
  if (!declaration) return null;
  const names = [...declaration[1].matchAll(/(['"])([^'"]+)\1/g)].map((m) => m[2]);
  return names.length ? names : null;
}

function literalArray(source, name) {
  const m = new RegExp(`(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=\\s*\\[([\\s\\S]*?)\\n\\];`, 'm').exec(source);
  if (!m) return null;
  return [...m[1].matchAll(/(['"])([^'"]+)\1/g)].map((x) => x[2]);
}

function literalObjectKeys(source, name) {
  const m = new RegExp(`(?:const|let|var)\\s+${name}\\b[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\n\\};`, 'm').exec(source);
  if (!m) return null;
  return [...m[1].matchAll(/^\s*(['"])([^'"]+)\1\s*:/gm)].map((x) => x[2]);
}

function literalSet(source, name) {
  const m = new RegExp(`(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`, 'm').exec(source);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/(['"])([^'"]+)\1/g)].map((x) => x[2]));
}

/**
 * The tables are injectable for the same reason the sibling gates' are: they are
 * keyed by real repository paths, so a fixture tree can only exercise the
 * MECHANISM if it can supply its own. The defaults are the live tables, which is
 * what every caller outside the test suite wants.
 */
export function deriveRegistryKeys(root, options = {}) {
  const indirect = options.indirectRegistrations ?? INDIRECT_REGISTRATIONS;
  const openRegistrations = options.openRegistrationSites ?? OPEN_REGISTRATION_SITES;
  const keys = new Map();
  const findings = [];
  const counters = { sourceFiles: 0, callSites: 0, resolved: 0, open: 0, indirect: 0 };
  const openSeen = new Set();
  const indirectSeen = new Set();
  const indirectSites = new Set(indirect.map((entry) => entry.site));

  const add = (key, site) => {
    if (!key || key.includes('${')) return;
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key).push(site);
  };

  const receiverPattern = new RegExp(
    `(?<![\\w$])(?:${REGISTRY_RECEIVERS.join('|')})\\s*\\.\\s*(register|registerLazy)\\s*\\(`,
    'g',
  );

  const sourceFiles = [];
  for (const rootDir of SOURCE_ROOTS) {
    const abs = join(root, rootDir);
    walkFiles(abs, (f) => /\.(ts|tsx)$/.test(f) && !isTestFile(relative(root, f)), sourceFiles);
  }

  for (const abs of sourceFiles.sort()) {
    const rel = relative(root, abs).split(sep).join('/');
    const raw = readFileSync(abs, 'utf8');
    if (!/\.register(Lazy)?\s*\(/.test(raw)) continue;
    counters.sourceFiles++;
    const { source, inString } = stripComments(raw);
    receiverPattern.lastIndex = 0;
    let match;
    while ((match = receiverPattern.exec(source))) {
      if (inString[match.index]) continue;
      counters.callSites++;
      const callOpen = match.index + match[0].length - 1;
      const line = lineAt(source, match.index);
      const site = `${rel}:${line}`;
      const names = resolveKeyArgument(source, callOpen);
      if (!names) {
        if (indirectSites.has(rel)) {
          // The key comes from a collection this file iterates; the collection
          // itself is read below by INDIRECT_REGISTRATIONS.
          indirectSeen.add(rel);
          continue;
        }
        const open = openRegistrations[rel];
        if (open) {
          counters.open++;
          openSeen.add(rel);
          continue;
        }
        findings.push({
          reason: 'unresolved-registration',
          site,
          detail:
            `the key argument of this ${match[1]}() call is not a string literal and could not be ` +
            'resolved to one. Teach `resolveKeyArgument` this form, or declare the site in ' +
            'OPEN_REGISTRATION_SITES with the reason it cannot be known statically.',
        });
        continue;
      }
      counters.resolved++;
      const end = spanEnd(source, callOpen);
      const span = end < 0 ? source.slice(callOpen, callOpen + 2000) : source.slice(callOpen, end);
      const nsMatch = /namespace\s*:\s*(['"])([^'"]+)\1/.exec(span);
      const namespace = nsMatch && !nsMatch[2].includes('${') ? nsMatch[2] : null;
      const skipFallback = /skipFallback\s*:\s*true/.test(span);
      for (const name of names) {
        if (namespace) {
          add(`${namespace}:${name}`, site);
          if (!skipFallback) add(name, site);
        } else {
          add(name, site);
        }
      }
    }
  }

  for (const rel of Object.keys(openRegistrations)) {
    if (!openSeen.has(rel)) {
      findings.push({
        reason: 'stale-open-site',
        site: rel,
        detail:
          'OPEN_REGISTRATION_SITES names this file, but no unresolvable registration call was found ' +
          'in it. Re-confirm the site or delete the entry.',
      });
    }
  }

  for (const entry of indirect) {
    if (!indirectSeen.has(entry.site)) {
      findings.push({
        reason: 'stale-indirect-registration',
        site: entry.site,
        detail:
          'INDIRECT_REGISTRATIONS names this file, but it no longer contains a registration whose key ' +
          'comes from a collection. The helper was probably rewritten to register literals; drop the ' +
          'entry so the universe is not padded from a collection nothing reads.',
      });
    }
    const abs = join(root, entry.site);
    let source;
    try {
      source = stripComments(readFileSync(abs, 'utf8')).source;
    } catch {
      findings.push({
        reason: 'stale-indirect-registration',
        site: entry.site,
        detail: 'file named in INDIRECT_REGISTRATIONS no longer exists.',
      });
      continue;
    }
    const names =
      entry.kind === 'array' ? literalArray(source, entry.collection) : literalObjectKeys(source, entry.collection);
    if (!names || names.length === 0) {
      findings.push({
        reason: 'stale-indirect-registration',
        site: `${entry.site} (${entry.collection})`,
        detail:
          `the collection \`${entry.collection}\` no longer resolves to a non-empty list of literal ` +
          'keys. The derivation would silently lose these registrations, so this is reported rather ' +
          'than skipped.',
      });
      continue;
    }
    const skip = entry.skipFallbackSet ? literalSet(source, entry.skipFallbackSet) : new Set();
    counters.indirect += names.length;
    for (const name of names) {
      // Same shape as a direct call: the namespaced key always, plus the bare
      // fallback unless the helper's skip set holds it. `PROTOCOL_COMPONENTS`
      // entries are ALREADY namespaced strings (`view:grid`, `field:text`), so
      // the bare form there is the spelling the docs actually teach and the
      // `protocol-placeholder:` prefix is the derived one — the reverse of the
      // usual reading, but the same two keys either way.
      if (entry.namespace) {
        add(`${entry.namespace}:${name}`, entry.site);
        if (!skip.has(name)) add(name, entry.site);
      } else {
        add(name, entry.site);
      }
    }
  }

  return { keys, findings, counters };
}

// ── Docs scan ────────────────────────────────────────────────────────────────

/**
 * Collect every `type: '<value>'` / `"type": "<value>"` site inside a fenced
 * code block. Fences are tracked so prose that merely mentions a type in
 * backticks is not read as a snippet.
 *
 * In the SAME walk, collect the rows of every plugin key table — the tables
 * introduced by the objectui#5002 family and anchored by `KEY_TABLE_HEADER`.
 * One walk rather than two because two collectors over one tree is the defect
 * this file's `DOC_EXTENSIONS` note already warns about, one level down: they
 * drift, and a page ends up covered by the surface it passes and invisible to
 * the one it fails.
 *
 * Key tables are read OUTSIDE fences, which is the opposite of the snippet rule
 * and correct for both: a table is prose-level markdown, and a table drawn
 * inside a ``` block is an example OF a table, not a claim about this repo.
 */
export function scanDocs(root) {
  const docsDir = join(root, DOCS_ROOT);
  const files = walkFiles(docsDir, (f) => DOC_EXTENSIONS.some((ext) => f.endsWith(ext))).sort();
  const sites = [];
  const tableRows = [];
  const counters = { files: files.length, codeBlocks: 0, typeSites: 0, keyTables: 0, keyTableRows: 0 };

  for (const abs of files) {
    const rel = relative(root, abs).split(sep).join('/');
    const lines = readFileSync(abs, 'utf8').split('\n');
    let inFence = false;
    let lang = null;
    for (let i = 0; i < lines.length; i++) {
      const fence = /^\s*```(\S*)\s*$/.exec(lines[i]);
      if (fence) {
        if (inFence) {
          inFence = false;
          lang = null;
        } else {
          inFence = true;
          lang = fence[1] || 'plaintext';
          counters.codeBlocks++;
        }
        continue;
      }
      if (!inFence) {
        if (KEY_TABLE_HEADER.test(lines[i]) && TABLE_DELIMITER.test(lines[i + 1] ?? '')) {
          counters.keyTables++;
          const header = i + 1;
          // Consume the body until the table ends. A table ends at the first line
          // that is not a row; markdown needs no terminator, so "not a row" is the
          // only signal there is.
          for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
            const cells = lines[j]
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim());
            counters.keyTableRows++;
            tableRows.push({
              file: rel,
              line: j + 1,
              header,
              namespaced: cells[0] ?? '',
              fallback: cells[1] ?? '',
              text: lines[j].trim(),
            });
            i = j;
          }
        }
        continue;
      }
      for (const m of lines[i].matchAll(/(?:"type"|'type'|(?<![\w$.])type)\s*:\s*(['"])([^'"]*)\1/g)) {
        const value = m[2];
        if (!value) continue;
        counters.typeSites++;
        sites.push({ file: rel, line: i + 1, lang, value, text: lines[i].trim() });
      }
    }
    if (inFence) {
      // An unclosed fence means the rest of the file was read as code. Report it
      // rather than guessing, because the alternative is a silently truncated scan.
      sites.push({ file: rel, line: lines.length, lang: 'unterminated', value: null, unterminated: true });
    }
  }
  return { sites, tableRows, counters };
}

// ── Verdict ──────────────────────────────────────────────────────────────────

/**
 * Identity of an exemption, for the hit set that decides staleness.
 *
 * `JSON.stringify` rather than a joined string: a separator has to be a byte
 * that cannot occur in either half, and the obvious pick — a control character —
 * is exactly what this repository has now paid for four times (objectstack#4763,
 * #4890, PR #5140 / #5157). One raw control byte makes `grep` treat the whole
 * file as binary: zero matches, no signal, and the next agent greps this gate
 * and finds nothing. A two-element array has no separator to choose.
 */
const exemptionKey = (file, value) => JSON.stringify([file, value]);

export function analyze(root, options = {}) {
  const exemptions = options.exemptions ?? DOC_TYPE_EXEMPTIONS;
  const registry = deriveRegistryKeys(root, options);
  const docs = scanDocs(root);
  const findings = [...registry.findings];
  const counters = {
    ...docs.counters,
    registryKeys: registry.keys.size,
    ...registry.counters,
    registered: 0,
    exempted: 0,
    keyTableKeys: 0,
    keyTableRegistered: 0,
  };

  const exemptionHits = new Map();

  for (const site of docs.sites) {
    if (site.unterminated) {
      findings.push({
        reason: 'unterminated-code-fence',
        site: `${site.file}:${site.line}`,
        detail: 'a code fence is never closed, so the scan cannot tell code from prose in this file.',
      });
      continue;
    }
    if (registry.keys.has(site.value)) {
      counters.registered++;
      continue;
    }
    const reason = exemptions[site.file]?.[site.value];
    if (typeof reason === 'string' && reason.trim().length > 0) {
      counters.exempted++;
      exemptionHits.set(exemptionKey(site.file, site.value), true);
      continue;
    }
    findings.push({
      reason: 'unregistered-doc-type',
      site: `${site.file}:${site.line}`,
      value: site.value,
      lang: site.lang,
      text: site.text,
    });
  }

  // Key-table rows. Judged on BOTH halves and NOT routed through
  // `DOC_TYPE_EXEMPTIONS` — see "The second surface" in the file header for why a
  // row under this header has no other vocabulary it could belong to.
  for (const row of docs.tableRows) {
    const namespaced = BACKTICKED_CELL.exec(row.namespaced);
    if (!namespaced) {
      findings.push({
        reason: 'unreadable-key-table-row',
        site: `${row.file}:${row.line}`,
        detail:
          `the first cell of this row under the key table at :${row.header} is not a single ` +
          'backticked key. Either write it as `namespace:type`, or — if this table does not ' +
          'document registrations — give it a header other than "Namespaced key | Bare-name ' +
          'fallback", which is what tells this gate to judge the rows.',
      });
      continue;
    }
    counters.keyTableKeys++;
    if (registry.keys.has(namespaced[1])) {
      counters.keyTableRegistered++;
    } else {
      findings.push({
        reason: 'unregistered-key-table-key',
        site: `${row.file}:${row.line}`,
        value: namespaced[1],
        half: 'namespaced',
        text: row.text,
      });
    }

    const fallback = BACKTICKED_CELL.exec(row.fallback);
    if (!fallback) {
      // "none — `skipFallback: true`" is the declared no-fallback spelling. The
      // namespaced half above was still judged, which is the half that matters.
      if (!NO_FALLBACK_CELL.test(row.fallback)) {
        findings.push({
          reason: 'unreadable-key-table-row',
          site: `${row.file}:${row.line}`,
          detail:
            'the bare-name fallback cell is neither a single backticked key nor the declared ' +
            '"none — `skipFallback: true`" spelling, so this gate cannot tell whether the row ' +
            'claims a bare key or claims there is none.',
        });
      }
      continue;
    }
    counters.keyTableKeys++;
    if (registry.keys.has(fallback[1])) {
      counters.keyTableRegistered++;
    } else {
      findings.push({
        reason: 'unregistered-key-table-key',
        site: `${row.file}:${row.line}`,
        value: fallback[1],
        half: 'bare fallback',
        text: row.text,
      });
    }
  }

  for (const [file, values] of Object.entries(exemptions)) {
    for (const [value, why] of Object.entries(values)) {
      if (typeof why !== 'string' || why.trim().length === 0) {
        findings.push({
          reason: 'stale-exemption',
          site: `${file} -> ${value}`,
          detail: 'exemption carries no written reason.',
        });
        continue;
      }
      if (!exemptionHits.has(exemptionKey(file, value))) {
        findings.push({
          reason: 'stale-exemption',
          site: `${file} -> ${value}`,
          detail:
            'no code block in that file spells this type any more. Delete the entry, or re-point it ' +
            'at the file that now carries the snippet.',
        });
      }
    }
  }

  return { findings, counters, registryKeys: registry.keys };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const HINTS = {
  'unregistered-doc-type':
    'A documentation code block teaches a `type` that nothing in this repository registers. A reader ' +
    'who copies it gets the renderer\'s red "Unknown component type" panel (OBJUI-001) instead of a ' +
    'component. Either spell the registered key (grep `ComponentRegistry.register(` for the real ' +
    'name), or — if the value belongs to another vocabulary (an action schema, a validation rule, a ' +
    'field data type, a nav item kind) — declare it in DOC_TYPE_EXEMPTIONS with a reason naming that ' +
    'vocabulary. See objectui#4823.',
  'unregistered-key-table-key':
    'A plugin KEY TABLE — a table headed `| Namespaced key | Bare-name fallback | … |` — documents a ' +
    'key that nothing in this repository registers. This table is the canonical way a plugin page ' +
    'states which schema types its entry claims (objectui#5002 family), so a wrong cell here ' +
    'misdocuments the plugin\'s whole public surface. Both halves are judged: the NAMESPACED half ' +
    'against the `namespace:` the registration really passes, and the bare half against the ' +
    'fallback it publishes. If the namespaced half is the one reported, check the `namespace` option ' +
    'in the plugin\'s `ComponentRegistry.register(` call before editing the doc — the registration ' +
    'may be what moved. Unlike a fenced snippet this is NOT exemptible: the header has already ' +
    'declared these rows to be registry keys. See objectui#5106.',
  'unreadable-key-table-row':
    'A row under a key-table header could not be read as a key. Either the row is malformed, or the ' +
    'header `| Namespaced key | Bare-name fallback | … |` is being used for a table that does not ' +
    'document registrations — give that one a different header, since this one is what tells the gate ' +
    'to judge the rows beneath it.',
  'stale-exemption':
    'An entry in DOC_TYPE_EXEMPTIONS no longer matches the tree. Re-point it or delete it — an ' +
    'exemption whose site has gone silently widens the hole for the next snippet that lands there.',
  'unresolved-registration':
    'A ComponentRegistry registration takes a key this derivation cannot resolve to literals. Left ' +
    'unhandled it shrinks the universe, which turns CORRECT documentation red. Teach ' +
    '`resolveKeyArgument` the form, or declare the site in OPEN_REGISTRATION_SITES.',
  'stale-open-site':
    'OPEN_REGISTRATION_SITES names a file that no longer has an unresolvable registration.',
  'stale-indirect-registration':
    'An INDIRECT_REGISTRATIONS entry no longer resolves to keys, so the universe lost them silently.',
  'unterminated-code-fence':
    'A doc file has an unclosed ``` fence. The scan cannot separate code from prose past that point.',
};

const invokedDirectly = isEntrypoint(import.meta.url);

if (invokedDirectly) {
  const argOf = (name) => {
    const index = process.argv.indexOf(name);
    return index > -1 ? process.argv[index + 1] : null;
  };
  const root = resolve(argOf('--root') ?? resolve(scriptDir, '..'));

  let result;
  try {
    result = analyze(root);
  } catch (error) {
    console.error(
      `❌  ${error.message}\n\n` +
        '    Reported as a failure rather than a pass: this gate decides whether the docs teach types ' +
        'that exist,\n    so losing an input means it cannot decide, and a green verdict would have ' +
        'looked at nothing.',
    );
    process.exit(1);
  }

  const { findings, counters } = result;

  for (const [key, floor] of Object.entries(FLOORS)) {
    // A floor naming a counter that does not exist is not a floor. It compares
    // `undefined`, which is never below anything, so it reads as permanently
    // satisfied — the exact shape that let `docFiles` stand as a dead floor. A
    // collapse detector that can itself collapse is worth less than none, so this
    // is checked before the comparison rather than left to review.
    if (!Object.hasOwn(counters, key)) {
      console.error(
        `FLOORS names \`${key}\`, which is not a counter this scan publishes ` +
          `(${Object.keys(counters).sort().join(', ')}). A floor over a missing counter compares ` +
          '`undefined` and can never fail, so it guards nothing. Fix the spelling or drop the entry.',
      );
      process.exit(1);
    }
    if (counters[key] < floor) {
      console.error(
        `The scan collapsed: ${key} = ${counters[key]}, below the floor of ${floor}. The docs walk or ` +
          'the registry derivation is broken, and an empty comparison would pass while asserting nothing.',
      );
      process.exit(1);
    }
  }

  console.log(
    `Scanned ${counters.files} doc file(s) (${DOC_EXTENSIONS.join(' + ')}), ` +
      `${counters.codeBlocks} code block(s), ` +
      `${counters.typeSites} \`type\` literal(s) against ${counters.registryKeys} registered key(s) ` +
      `derived from ${counters.sourceFiles} source file(s) (${counters.resolved} resolved call site(s), ` +
      `${counters.indirect} indirect, ${counters.open} open): ` +
      `${counters.registered} registered, ${counters.exempted} exempted; ` +
      `${counters.keyTables} key table(s), ${counters.keyTableRows} row(s), ` +
      `${counters.keyTableKeys} table key(s) judged (namespaced + bare), ` +
      `${counters.keyTableRegistered} registered.`,
  );

  if (findings.length === 0) {
    console.log('✅  Every documented component type is registered.');
    process.exit(0);
  }

  console.error(`\n❌  ${findings.length} problem(s):\n`);
  for (const finding of findings) {
    if (finding.reason === 'unregistered-doc-type') {
      console.error(`      ${finding.site}  [${finding.reason}]  type '${finding.value}' (${finding.lang})`);
      console.error(`          ${finding.text}`);
      continue;
    }
    if (finding.reason === 'unregistered-key-table-key') {
      console.error(`      ${finding.site}  [${finding.reason}]  ${finding.half} '${finding.value}'`);
      console.error(`          ${finding.text}`);
      continue;
    }
    console.error(`      ${finding.site}  [${finding.reason}]  ${finding.detail}`);
  }
  for (const reason of Object.keys(HINTS)) {
    if (findings.some((f) => f.reason === reason)) console.error(`\n${reason}: ${HINTS[reason]}`);
  }
  console.error(
    '\nThe teaching surface is not rendered by anything, so a wrong type there is invisible to every ' +
      'other check\nin the repo — which is why this is a gate and not a review note. See the header of ' +
      'scripts/check-doc-component-types.mjs (objectui#4823).',
  );
  process.exit(1);
}
