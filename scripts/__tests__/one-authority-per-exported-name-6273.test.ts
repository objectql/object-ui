import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is itself an error (TS2578). See objectui#3494.
import { blank, scanSource } from '../js-comment-mask.mjs';

/**
 * ObjectUI — one authority per exported schema name (objectui#6273)
 *
 * ## The ruling this enforces
 *
 * The 2026-08-25 maintainer family ruling (decision 甲/A1 on objectui#6172,
 * verbatim acceptance 「同意」): **every exported schema name has exactly one
 * authority.** objectui#6172 (`FormField`, `MarkdownSchema`, `KanbanSchema`),
 * objectui#6155 (`KanbanCard` ×4) and objectui#6086 are the same defect
 * measured four times — one name, two structurally different declarations, and
 * an IDE auto-import that picks between them by alphabetical order. The wrong
 * pick does not surface as "you imported from the wrong package"; it surfaces
 * as a remote `TS2322` several lines away, which is what
 * `packages/plugin-calendar/src/__tests__/name-collision-5044.test.ts` records
 * for `CalendarEvent`.
 *
 * The cleanup cards fix instances. This file is the recurrence guard the
 * ruling ordered: it re-derives the collision set from source on every test
 * run, so the class cannot silently regrow after they land.
 *
 * ## What counts as an AUTHORITY, and what deliberately does not
 *
 * An authority is a site that gives an exported name its meaning. Two of them
 * in two different files means two meanings for one published name.
 *
 *   - **A declaration** — `export interface X`, `export type X`,
 *     `export enum X` (and their `declare` / `const enum` spellings). This is
 *     the shape every card in the family measured.
 *   - **An aliasing re-export that PUBLISHES a name** —
 *     `export type { A as X } from './a'`. It is not a declaration, but it
 *     puts a second meaning behind the name `X`, which is what the ruling is
 *     about. `packages/plugin-calendar/src/index.tsx` is today's live
 *     instance: it publishes the runtime `CalendarViewEvent` as
 *     `CalendarEvent`, a name `@object-ui/types` already declares.
 *
 * ⛔ **A deliberate re-export is NOT an authority.** `export { X } from './x'`,
 * `export type { X } from './x'`, `export * from './x'` and
 * `export * as ns from './x'` are ONE declaration with many export sites —
 * exactly how this monorepo is meant to fan a type out through barrels. A gate
 * that counted those would red on every package's `src/index.ts`, and an
 * assertion that reds on legitimate code gets deleted by the first person who
 * hits it, which puts the claim back where it started. `X as X` is a plain
 * re-export spelled long, and is skipped for the same reason.
 *
 * ⛔ **Near-spellings and derived names are NOT collisions.** The matcher
 * anchors the name on both ends, so `ConditionalFormattingRule` does not match
 * `KanbanConditionalFormattingRule` (`packages/types/src/objectql.ts:2202`) or
 * `KanbanNativeConditionalFormattingRule` (same file, :2181) — both of which
 * this repository really writes, next to the contested name.
 *
 * ## Two stated bounds, because a claim must be bounded or derivable
 *
 * (The 2026-08-25 batch-adjudication close-out, decision B1.)
 *
 *  1. **Type-level names only.** `export const`, `export function` and
 *     `export class` are out. The ruling's subject is the schema/type
 *     vocabulary, and the value namespace is a different population with a
 *     different remedy — 66 exported classes and every exported helper would
 *     arrive as noise the same run. Narrowing the claim and narrowing the
 *     population is one change; ⛔ never narrow one alone.
 *  2. **Alias sites are counted only where the alias is TYPE-marked** —
 *     `export type { A as X }` or `export { type A as X }`. This is lossless
 *     rather than a heuristic: `tsconfig.base.json` sets
 *     `"isolatedModules": true` repo-wide, so a type re-export MUST carry the
 *     `type` marker to compile at all. It also keeps a VALUE alias
 *     (`export { helper as Grid }`) from reddening against an unrelated
 *     `interface Grid` in the type namespace.
 *
 * A collision additionally requires at least one real DECLARATION among the
 * sites: two aliases publishing one name, with nothing declaring it, is a
 * different (and today empty) shape and is not what the ruling measured.
 *
 * ## ONE mask, and why — this differs from the sibling gate on purpose
 *
 * `scripts/__tests__/unconsumed-widget-option-claim-6186.test.ts` needs TWO
 * masks, because a computed access spells its key AS a string literal
 * (`x['thresholds']`) and blanking literals would erase the thing it looks
 * for. Nothing here has that property: a declaration and an export clause are
 * both CODE in every spelling they have, so this scan reads source with
 * comments AND string literals blanked, and there is no leg that needs
 * literals to survive. That single mask is what lets this file scan a
 * population containing `packages/create-plugin/src/templates.ts`, which
 * writes `export interface ${'$'}{vars.pascalName}Schema extends BaseSchema {`
 * inside a template literal (:417) — content, not a declaration — without
 * reddening on it.
 *
 * It is also the answer to the failure the sibling gate hit the moment it was
 * committed: **it reddened on its own source**, because a tracked-files
 * population first contained its own fixture table. The discriminator here is
 * real rather than a filename exemption, and it is proved twice below:
 * `authoritySites` is run over THIS FILE's own bytes and must find nothing
 * (masking alone is sufficient), and the population is bounded to the
 * published packages' `src/` because that is what the claim is about —
 * `scripts/` publishes nothing.
 *
 * ## What the instrument cannot see — read before trusting a verdict
 *
 *   - **A name assembled at runtime.** This is a text scan; nothing textual
 *     can see a type produced by a mapped/conditional type or a generated
 *     `.d.ts`. Generated output is untracked, so it is out by construction.
 *   - **Whether the two shapes actually disagree.** The card asks for
 *     "declared more than once with disagreeing shapes"; this gate answers
 *     "declared more than once", which is the decidable half. Structural
 *     comparison across two packages needs the type checker, and a name with
 *     two AGREEING declarations is still two authorities that drift
 *     independently — so the stricter reading is also the correct one.
 *   - **Whether a colliding name is reachable from its package's public
 *     entry.** The export graph is not walked. That over-includes a
 *     module-local `export interface` — deliberately, because the family cards
 *     counted exactly that way: objectui#6155's `KanbanCard ×4` includes
 *     `KanbanEnhanced.tsx` and `KanbanImpl.tsx`, neither of which is a barrel.
 *     Population and claim have to stay co-extensive with the cards they guard.
 *
 * ## The baseline is a RATCHET, in both directions
 *
 * `KNOWN_COLLISIONS` is today's measured population, named site by site,
 * taken on `79ebf30d1`. The card allows landing with it and requires it to
 * SHRINK as objectui#6172 / #6169 / #6170 / #6155 land; ⛔ silently exempting
 * these forever is not allowed, so the reconciliation below fails in BOTH
 * directions — a new name or a new site is fresh debt, and a listed site that
 * no longer collides is a stale entry that must be deleted in the same PR that
 * cleaned it. Without that second direction a baseline degrades into a
 * skip-list nobody dares touch (`scripts/check-skills-paths.mjs` and
 * `scripts/check-doc-fence-languages.mjs` carry the same rule).
 *
 * ⛔ Adding a line is not a supported way to make this pass.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ── Population ───────────────────────────────────────────────────────────────

/**
 * The published packages, DERIVED from their manifests rather than listed, so
 * a new package joins the population by existing. `private: true` is what
 * "not published" means to pnpm and to the release pipeline, and it is what
 * takes `@object-ui/test-support` and the VS Code extension out.
 */
function publishedPackageDirs(root: string): string[] {
  const packagesDir = path.join(root, 'packages');
  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const manifest = path.join(packagesDir, name, 'package.json');
      if (!fs.existsSync(manifest)) return false;
      return JSON.parse(fs.readFileSync(manifest, 'utf8')).private !== true;
    })
    .sort();
}

const SOURCE_SUFFIX = /\.(?:[cm]?ts|tsx)$/;

/**
 * Tests, specs and stories declare throwaway types that are never published,
 * and they quote real declarations as fixture text on purpose (three sites do
 * it today — see the negative controls). They are out of the POPULATION; they
 * are still fair game as matcher fixtures.
 */
const NOT_PUBLISHED_SOURCE = /(?:^|\/)__tests__\/|\.(?:test|spec|stories)\.[cm]?tsx?$/;

/**
 * Every tracked TypeScript file under a published package's `src/`.
 *
 * Derived from the same configuration the repo's other whole-tree gates read —
 * `node_modules`, `dist` and every build output are untracked, so they are out
 * by construction. `scripts/check-control-bytes.mjs` reads this repository the
 * same way.
 */
function populationFiles(root: string, published: readonly string[]): string[] {
  const inScope = new Set(published);
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean)
    .filter((rel) => {
      const owner = /^packages\/([^/]+)\/src\//.exec(rel);
      return (
        owner !== null &&
        inScope.has(owner[1]) &&
        SOURCE_SUFFIX.test(rel) &&
        !NOT_PUBLISHED_SOURCE.test(rel)
      );
    })
    .sort();
}

// ── The matcher ──────────────────────────────────────────────────────────────

/**
 * Comment- and literal-blanked source — the repo's ONE answer to "is this span
 * code, or prose?" (`scripts/js-comment-mask.mjs`). Masking only ever REMOVES
 * text, so a site found in the masked code implies the raw file carries it.
 * Regex literals and `${...}` interpolations are flagged literal too, which is
 * what keeps this file's own patterns out of its own scan.
 */
function codeOnly(source: string): string {
  const { comment, literal } = scanSource(source);
  const flags = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i++) flags[i] = comment[i] || literal[i];
  return blank(source, flags);
}

type SiteKind = 'declaration' | 'alias';

interface Site {
  readonly name: string;
  readonly kind: SiteKind;
  /** Human-readable, for the diagnostic. */
  readonly what: string;
  readonly index: number;
}

/**
 * A type-level declaration. The trailing identifier group is what separates
 * `export type X = …` (a declaration) from `export type { X } from './x'` and
 * `export type * from './x'` (re-exports, which open with `{` or `*` and
 * therefore cannot match).
 */
const DECLARATION =
  /(?<![\w$])export\s+(?:declare\s+)?(?:const\s+)?(interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;

/** `export { … }` / `export type { … }`. Group 1 marks a type-only clause. */
const EXPORT_CLAUSE = /(?<![\w$])export\s+(type\s+)?\{([^}]*)\}/g;

/** One `A as B` specifier, with the inline `type` marker if it carries one. */
const ALIAS_SPECIFIER = /^\s*(type\s+)?([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)\s*$/;

/** Every site in `source` that gives an exported type-level name its meaning. */
function authoritySites(source: string): Site[] {
  const code = codeOnly(source);
  const sites: Site[] = [];

  for (const match of code.matchAll(DECLARATION)) {
    sites.push({
      name: match[2],
      kind: 'declaration',
      what: `${match[1]} declaration`,
      index: match.index ?? 0,
    });
  }

  for (const match of code.matchAll(EXPORT_CLAUSE)) {
    const clauseIsTypeOnly = Boolean(match[1]);
    for (const specifier of match[2].split(',')) {
      const alias = ALIAS_SPECIFIER.exec(specifier);
      if (alias === null) continue;
      const [, inlineTypeMarker, from, to] = alias;
      // `X as X` is a plain re-export spelled long — one declaration, one more
      // export site, no new meaning.
      if (from === to) continue;
      // Bound 2: only a TYPE-marked alias publishes into the type namespace,
      // and `isolatedModules` makes the marker mandatory.
      if (!clauseIsTypeOnly && !inlineTypeMarker) continue;
      sites.push({
        name: to,
        kind: 'alias',
        what: `aliasing re-export \`${from} as ${to}\``,
        index: match.index ?? 0,
      });
    }
  }

  return sites;
}

interface Located extends Site {
  readonly rel: string;
  readonly line: number;
}

interface Document {
  readonly rel: string;
  readonly source: string;
}

/**
 * Names carrying an authority in TWO OR MORE files, at least one of which is a
 * real declaration.
 *
 * Distinct FILES, not distinct sites: two `export interface X` in one file is
 * TypeScript declaration merging — legal, one authority, one file's business.
 * Two `export type X` in one file is a compile error `tsc` already owns.
 */
function collisions(corpus: readonly Document[]): Map<string, Located[]> {
  const byName = new Map<string, Located[]>();
  for (const { rel, source } of corpus) {
    for (const site of authoritySites(source)) {
      const line = source.slice(0, site.index).split('\n').length;
      const bucket = byName.get(site.name);
      if (bucket) bucket.push({ ...site, rel, line });
      else byName.set(site.name, [{ ...site, rel, line }]);
    }
  }

  const colliding = new Map<string, Located[]>();
  for (const [name, sites] of byName) {
    if (new Set(sites.map((site) => site.rel)).size < 2) continue;
    if (!sites.some((site) => site.kind === 'declaration')) continue;
    colliding.set(
      name,
      [...sites].sort((a, b) => (a.rel === b.rel ? a.line - b.line : a.rel < b.rel ? -1 : 1)),
    );
  }
  return new Map([...colliding].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

const filesOf = (sites: readonly Located[]): string[] => [
  ...new Set(sites.map((site) => site.rel)),
];

// ── The baseline ─────────────────────────────────────────────────────────────

/**
 * ⛔ SHRINK-ONLY. `name -> the files that carry an authority for it`, measured
 * on `79ebf30d1` (2026-08-25): 46 names.
 *
 * Every line is debt the 2026-08-25 family ruling ordered cleaned. The remedy
 * is the same for all of them and no entry records a judgement anyone has to
 * re-make: pick the ONE authority, delete or re-point the others, and delete
 * the line here in the same PR. objectui#6172 / #6169 / #6170 / #6155 are the
 * batches. `FormField`, which objectui#6172 named, is already gone from this
 * table — it had a single declaration when this was measured.
 *
 * ⚠️ `CalendarEvent` is the one entry whose second authority is an ALIAS
 * rather than a declaration (`packages/plugin-calendar/src/index.tsx` publishes
 * `CalendarViewEvent as CalendarEvent`). It is a deliberate, ruled-on
 * deprecation shim — the 2026-08-19 maintainer ruling on objectui#5044, option
 * A — and it is listed rather than exempted because the alias is still a second
 * meaning behind the name and the ruling that put it there also said it comes
 * off. It is also this table's proof that the alias leg is not vacuous on the
 * real tree.
 */
const KNOWN_COLLISIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ['ActionContext', ['packages/core/src/actions/ActionRunner.ts', 'packages/types/src/ui-action.ts']],
  ['ActionResult', ['packages/core/src/actions/ActionRunner.ts', 'packages/types/src/ui-action.ts']],
  ['ActionSchema', ['packages/types/src/crud.ts', 'packages/types/src/ui-action.ts']],
  ['AggregationConfig', ['packages/plugin-grid/src/useGroupedData.ts', 'packages/types/src/data-protocol.ts']],
  ['AppShellProps', ['packages/app-shell/src/types.ts', 'packages/layout/src/AppShell.tsx']],
  ['BreadcrumbItem', ['packages/types/src/data-display.ts', 'packages/types/src/navigation.ts']],
  ['BreadcrumbSchema', ['packages/types/src/data-display.ts', 'packages/types/src/navigation.ts']],
  ['CalendarEvent', ['packages/plugin-calendar/src/index.tsx', 'packages/types/src/complex.ts']], // the ruled-on objectui#5044 alias — see the header
  ['CalendarSchema', ['packages/plugin-calendar/src/ObjectCalendar.tsx', 'packages/types/src/form.ts']],
  ['ChatMessage', ['packages/plugin-chatbot/src/ChatbotEnhanced.tsx', 'packages/types/src/complex.ts']],
  ['ChatToolInvocation', ['packages/plugin-chatbot/src/ChatbotEnhanced.tsx', 'packages/types/src/complex.ts']],
  ['ComboboxOption', ['packages/components/src/custom/combobox.tsx', 'packages/types/src/form.ts']],
  ['ComponentConfig', ['packages/core/src/registry/Registry.ts', 'packages/types/src/base.ts']],
  ['ComponentMeta', ['packages/core/src/registry/Registry.ts', 'packages/types/src/base.ts']],
  ['ConditionalFormattingRule', ['packages/plugin-kanban/src/KanbanEnhanced.tsx', 'packages/plugin-kanban/src/KanbanImpl.tsx', 'packages/types/src/objectql.ts']],
  ['ConfirmDialogState', ['packages/app-shell/src/views/ActionConfirmDialog.tsx', 'packages/plugin-designer/src/hooks/useConfirmDialog.ts']],
  ['ConnectionState', ['packages/collaboration/src/useRealtimeSubscription.ts', 'packages/data-objectstack/src/index.ts']],
  ['DataSource', ['packages/app-shell/src/types.ts', 'packages/types/src/data.ts']],
  ['Diagnostic', ['packages/app-shell/src/views/metadata-admin/previews/simulator/flow-sim-types.ts', 'packages/cli/src/commands/doctor.ts', 'packages/sdui-parser/src/types.ts']],
  ['DiagnosticLevel', ['packages/app-shell/src/views/metadata-admin/previews/simulator/flow-sim-types.ts', 'packages/cli/src/commands/doctor.ts']],
  ['DomProps', ['packages/core/src/utils/dom-props.ts', 'packages/fields/src/widgets/toDomProps.ts']],
  ['FilterBuilderCondition', ['packages/components/src/custom/filter-builder.tsx', 'packages/types/src/complex.ts']],
  ['FilterBuilderOperator', ['packages/components/src/custom/filter-builder.tsx', 'packages/types/src/complex.ts']],
  ['FilterGroup', ['packages/components/src/custom/filter-builder.tsx', 'packages/types/src/complex.ts']],
  ['FormFieldSpec', ['packages/app-shell/src/views/metadata-admin/form-spec.ts', 'packages/react/src/spec-bridge/bridges/form-view.ts']],
  ['FormSectionSpec', ['packages/app-shell/src/views/metadata-admin/form-spec.ts', 'packages/react/src/spec-bridge/bridges/form-view.ts']],
  ['FormViewSpec', ['packages/app-shell/src/views/metadata-admin/form-spec.ts', 'packages/react/src/spec-bridge/bridges/form-view.ts']],
  ['KanbanCard', ['packages/plugin-kanban/src/KanbanEnhanced.tsx', 'packages/plugin-kanban/src/KanbanImpl.tsx', 'packages/plugin-kanban/src/types.ts', 'packages/types/src/complex.ts']], // objectui#6155 — the ×4 that card measured
  ['KanbanColumn', ['packages/plugin-kanban/src/KanbanEnhanced.tsx', 'packages/plugin-kanban/src/KanbanImpl.tsx', 'packages/plugin-kanban/src/types.ts', 'packages/types/src/complex.ts']], // the same four files; no family card named it
  ['KanbanSchema', ['packages/plugin-kanban/src/types.ts', 'packages/types/src/complex.ts']], // objectui#6172
  ['MarkdownSchema', ['packages/plugin-markdown/src/types.ts', 'packages/types/src/data-display.ts']], // objectui#6172
  ['MenuItem', ['packages/types/src/app.ts', 'packages/types/src/overlay.ts']],
  ['MetadataTypeStatus', ['packages/app-shell/src/providers/MetadataProvider.tsx', 'packages/react/src/context/AppShellContext.tsx']],
  ['NamedActionDef', ['packages/plugin-grid/src/resolveBulkActions.ts', 'packages/plugin-grid/src/resolveLegacyRowActions.ts']],
  ['OrgTranslate', ['packages/app-shell/src/console/organizations/orgErrorMessage.ts', 'packages/app-shell/src/console/organizations/orgRoleLabel.ts']],
  ['PageHeaderComponentProps', ['packages/app-shell/src/layout/PageHeader.tsx', 'packages/layout/src/PageHeader.tsx']],
  ['RecordDetailDrawerProps', ['packages/plugin-dashboard/src/RecordDetailDrawer.tsx', 'packages/plugin-detail/src/RecordDetailDrawer.tsx']],
  ['SchemaNode', ['packages/sdui-parser/src/types.ts', 'packages/types/src/base.ts']],
  ['ThemeProviderProps', ['packages/providers/src/types.ts', 'packages/react/src/context/ThemeContext.tsx']],
  ['TranslateFn', ['packages/app-shell/src/providers/saveAdvisoryToast.ts', 'packages/app-shell/src/providers/writeWarningToast.ts', 'packages/fields/src/widgets/file-size-guard.ts']],
  ['UndoRedoState', ['packages/plugin-designer/src/hooks/useUndoRedo.ts', 'packages/types/src/ui-action.ts']],
  ['UserDataAdapter', ['packages/app-shell/src/context/UserStateAdapters.tsx', 'packages/data-objectstack/src/userState.ts']],
  ['ValidationFunction', ['packages/types/src/data-protocol.ts', 'packages/types/src/field-types.ts']],
  ['VersionEntry', ['packages/collaboration/src/useConflictResolution.ts', 'packages/plugin-designer/src/components/VersionHistory.tsx']],
  ['ViewSwitcherProps', ['packages/plugin-list/src/ViewSwitcher.tsx', 'packages/plugin-view/src/ViewSwitcher.tsx']],
  ['ViewType', ['packages/plugin-list/src/ViewSwitcher.tsx', 'packages/types/src/views.ts']],
]);

/**
 * Split the measured collisions against the baseline. Both directions fail.
 *
 * `fresh` — a name, or a site of a known name, the baseline does not list.
 * `stale` — a listed site that no longer carries an authority: the collision
 * shrank (good) and the line must come down with it (owed).
 */
function reconcile(
  observed: ReadonlyMap<string, readonly Located[]>,
  baseline: ReadonlyMap<string, readonly string[]>,
): { fresh: string[]; stale: string[] } {
  const fresh: string[] = [];
  for (const [name, sites] of observed) {
    const allowed = new Set(baseline.get(name) ?? []);
    const surprises = sites.filter((site) => !allowed.has(site.rel));
    if (surprises.length === 0) continue;
    const detail = sites.map((site) => `      ${site.rel}:${site.line} — ${site.what}`).join('\n');
    fresh.push(
      `  ${name} — ${baseline.has(name) ? 'a NEW site for a known collision' : 'a NEW colliding name'}\n${detail}\n` +
        `      baseline line, if this is being accepted as debt: ` +
        `['${name}', [${filesOf(sites).map((rel) => `'${rel}'`).join(', ')}]],`,
    );
  }

  const stale: string[] = [];
  for (const [name, files] of baseline) {
    const seen = new Set((observed.get(name) ?? []).map((site) => site.rel));
    const gone = files.filter((rel) => !seen.has(rel));
    if (gone.length === 0) continue;
    stale.push(
      `  ${name} — no longer collides at:\n${gone.map((rel) => `      ${rel}`).join('\n')}`,
    );
  }

  return { fresh, stale };
}

// ── Controls: the matcher discriminates before it is trusted ─────────────────

describe('objectui#6273 — the matcher discriminates', () => {
  /**
   * ⭐ The POSITIVE control. It proves the assertions further down CAN fail;
   * an assertion that cannot fire is the vacuous-green shape this whole card
   * exists to prevent, reproduced inside the guard. The sibling gate
   * (objectui#6186) shipped a leg that silently never fired, and its positive
   * control is what caught it — so the alias leg gets its own cases here, not
   * just the declaration leg.
   */
  it('fires on every spelling an authority can take', () => {
    for (const [source, expected] of [
      ['export interface KanbanCard { id: string }', 'KanbanCard'],
      ['export type KanbanCard = { id: string };', 'KanbanCard'],
      ['export enum KanbanCard { A }', 'KanbanCard'],
      ['export const enum KanbanCard { A }', 'KanbanCard'],
      ['export declare interface KanbanCard { id: string }', 'KanbanCard'],
      ["export type { CalendarViewEvent as CalendarEvent } from './CalendarView';", 'CalendarEvent'],
      ["export type { A as B, CalendarViewEvent as CalendarEvent } from './x';", 'CalendarEvent'],
      ["export { type CalendarViewEvent as CalendarEvent } from './CalendarView';", 'CalendarEvent'],
      ['export type {\n  CalendarViewEvent as CalendarEvent,\n} from "./CalendarView";', 'CalendarEvent'],
    ] as const) {
      expect(
        authoritySites(source).map((site) => site.name),
        source,
      ).toContain(expected);
    }
  });

  /**
   * ⭐ The load-bearing half. Every negative below is a spelling this
   * repository really writes, cited where it lives. An assertion that redded
   * on any of them would be deleted by the first person who hit it, and the
   * ruling would go back to unguarded — worse than never writing this file.
   */
  it('stays silent on every re-export, near-spelling and quotation this tree really carries', () => {
    for (const source of [
      // Deliberate re-exports — one declaration, many export sites.
      "export type { StatusFieldSource } from './record-semantics.js';", // types/src/index.ts:71
      "export * from './registry/Registry.js';", //                        core/src/index.ts:10
      "export * as urlParams from './urlParams';", //                      the namespace spelling
      "export { ObjectKanban } from './ObjectKanban';", //                 a value re-export
      "export type { KanbanCard as KanbanCard } from './types';", //       `X as X`, spelled long
      // A VALUE alias. `isolatedModules` means a TYPE alias must say so, and
      // this repo's are all `export type { … }` clauses.
      "export { formatTitleTemplate as formatRecordTitle } from './title';", // app-shell/src/utils/index.ts:9
      "export { default as en } from './en';", //                          i18n/src/locales/index.ts:5
      // Value declarations — out of the stated bound.
      'export const KanbanCard = 1;',
      'export function KanbanCard() { return null; }',
      'export class KanbanCard {}',
      // Not exported at all.
      'interface ObjectActionConfig { id: string }', //                    app-shell/src/hooks/useObjectActions.ts:21
      // Imports name types too; naming one is not declaring it.
      "import type { KanbanCard } from '@object-ui/types';",
      // Prose and quotation — the mask's whole job.
      '// export interface KanbanCard is declared in @object-ui/types',
      '/** `export type { X as Y }` publishes a second meaning. */',
      "expect(typesFile).toContain('export interface HeatmapSchema extends BaseSchema {');", // create-plugin/src/__tests__/templates.test.ts:449
      "expect(source).toContain('export type { ChatMessage }');", // plugin-chatbot/src/__tests__/chat-message-contract.test.ts:448
      "expect(typesSrc).toContain('export interface CalendarEvent {');", // plugin-calendar/src/__tests__/name-collision-5044.test.ts:173
      'const tpl = `export interface ${vars.pascalName}Schema extends BaseSchema {`;', // create-plugin/src/templates.ts:417
    ]) {
      expect(authoritySites(source), source).toEqual([]);
    }
  });

  /**
   * ⭐ The self-reference control, and the reason this gate needs no filename
   * exemption. The sibling objectui#6186 gate reddened on its own source the
   * moment it became a tracked file, because its fixture table quotes the very
   * shape it scans for. This table does too — every string in the block above
   * spells a declaration or an export clause. Masking is the real
   * discriminator, and this asserts it directly, independently of the
   * population bound: run the matcher over THIS FILE's own bytes and it must
   * find nothing.
   */
  it('finds no authority in its own source, on masking alone', () => {
    const ownSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    expect(ownSource.length, 'the self-scan read an empty file').toBeGreaterThan(1000);
    expect(authoritySites(ownSource)).toEqual([]);
  });

  /**
   * The other half of "discriminates": shapes that DO produce authority sites
   * but must not be reported as collisions.
   */
  it('reports no collision for a re-export fan-out, a fresh alias, or a near-spelling', () => {
    const green: readonly Document[][] = [
      // One declaration, fanned out through two barrels — the monorepo's
      // normal shape, and the thing a naive gate reds on.
      [
        { rel: 'packages/types/src/complex.ts', source: 'export interface KanbanCard { id: string }' },
        { rel: 'packages/types/src/index.ts', source: "export type { KanbanCard } from './complex';" },
        { rel: 'packages/plugin-kanban/src/index.tsx', source: "export type { KanbanCard } from '@object-ui/types';" },
      ],
      // An alias publishing a name nothing else declares — the CURE the family
      // cards apply, e.g. `MenuItem as AppMenuItem` (types/src/index.ts:59) and
      // `ValidationFunction as FieldValidationFunction` (:429). It must stay
      // green or the remedy reds.
      [
        { rel: 'packages/types/src/app.ts', source: 'export interface MenuItem { id: string }' },
        { rel: 'packages/types/src/index.ts', source: "export type { MenuItem as AppMenuItem } from './app';" },
      ],
      // Derived names next to the contested one — both real, both in
      // packages/types/src/objectql.ts.
      [
        { rel: 'packages/types/src/objectql.ts', source: 'export interface KanbanNativeConditionalFormattingRule { a: 1 }' },
        { rel: 'packages/plugin-kanban/src/x.tsx', source: 'export type ConditionalFormattingRule = { a: 1 };' },
      ],
      // Declaration merging inside ONE file: legal TypeScript, one authority.
      [
        {
          rel: 'packages/types/src/base.ts',
          source: 'export interface ComponentMeta { a: 1 }\nexport interface ComponentMeta { b: 2 }',
        },
      ],
    ];
    for (const corpus of green) {
      expect([...collisions(corpus).keys()], JSON.stringify(corpus)).toEqual([]);
    }
  });

  it('reports a collision when a second declaration, or an aliasing re-export, arrives', () => {
    const declared = [
      { rel: 'packages/types/src/complex.ts', source: 'export interface KanbanCard { id: string }' },
      { rel: 'packages/plugin-kanban/src/types.ts', source: 'export interface KanbanCard { id: number }' },
    ];
    expect([...collisions(declared).keys()]).toEqual(['KanbanCard']);

    const aliased = [
      { rel: 'packages/types/src/complex.ts', source: 'export interface CalendarEvent { id: string }' },
      { rel: 'packages/plugin-calendar/src/index.tsx', source: "export type { CalendarViewEvent as CalendarEvent } from './CalendarView';" },
    ];
    expect([...collisions(aliased).keys()]).toEqual(['CalendarEvent']);
  });
});

// ── Controls: the ratchet moves in both directions ───────────────────────────

describe('objectui#6273 — the baseline is a ratchet, not a skip-list', () => {
  const baseline: ReadonlyMap<string, readonly string[]> = new Map([
    ['KanbanCard', ['packages/plugin-kanban/src/types.ts', 'packages/types/src/complex.ts']],
  ]);
  const at = (rel: string, source: string) => ({ rel, source });
  const twoDeclarations = [
    at('packages/types/src/complex.ts', 'export interface KanbanCard { id: string }'),
    at('packages/plugin-kanban/src/types.ts', 'export interface KanbanCard { id: number }'),
  ];

  it('accepts exactly the population it names', () => {
    const { fresh, stale } = reconcile(collisions(twoDeclarations), baseline);
    expect({ fresh, stale }).toEqual({ fresh: [], stale: [] });
  });

  it('fails on a new site for a known collision', () => {
    const grown = [
      ...twoDeclarations,
      at('packages/plugin-kanban/src/KanbanImpl.tsx', 'export interface KanbanCard { id: symbol }'),
    ];
    const { fresh, stale } = reconcile(collisions(grown), baseline);
    expect(fresh.join('\n')).toContain('packages/plugin-kanban/src/KanbanImpl.tsx');
    expect(stale).toEqual([]);
  });

  it('fails on a collision the baseline never named', () => {
    const other = [
      at('packages/types/src/complex.ts', 'export interface KanbanColumn { id: string }'),
      at('packages/plugin-kanban/src/types.ts', 'export interface KanbanColumn { id: number }'),
    ];
    expect(reconcile(collisions(other), baseline).fresh.join('\n')).toContain('a NEW colliding name');
  });

  /**
   * ⭐ The direction that keeps the table honest. The card requires the
   * baseline to SHRINK as the family cards land, and ⛔ forbids exempting the
   * population forever — so a cleaned collision has to fail until its line
   * comes down.
   */
  it('fails when a listed collision has been cleaned and its line was left behind', () => {
    const cleaned = [
      at('packages/types/src/complex.ts', 'export interface KanbanCard { id: string }'),
      at('packages/plugin-kanban/src/types.ts', "export type { KanbanCard } from '@object-ui/types';"),
    ];
    const { fresh, stale } = reconcile(collisions(cleaned), baseline);
    expect(fresh).toEqual([]);
    expect(stale.join('\n')).toContain('packages/plugin-kanban/src/types.ts');
  });
});

// ── The claim itself, re-derived from source ─────────────────────────────────

describe('objectui#6273 — every exported schema name has exactly one authority', () => {
  const published = publishedPackageDirs(repoRoot);
  const files = populationFiles(repoRoot, published);
  const corpus: Document[] = files.map((rel) => ({
    rel,
    source: fs.readFileSync(path.join(repoRoot, rel), 'utf8'),
  }));

  /**
   * ⚠️ The population refuses to collapse. A scan that finds nothing reads
   * exactly like a scan that found nothing wrong, and every assertion below
   * would be vacuously green forever. Three floors, because three different
   * things can collapse independently: the package derivation, the file walk,
   * and the MATCHER itself — a regex or a mask change that stops matching
   * would otherwise turn this file green while measuring nothing.
   *
   * Measured on `79ebf30d1`: 38 published packages, 1,364 files, 2,158
   * authority sites. The floors sit well below, so ordinary growth and
   * ordinary deletion do not touch them.
   */
  it('scans a population that has not collapsed', () => {
    expect(published.length, 'no published package was derived').toBeGreaterThan(30);
    expect(files.length, 'the source walk found no published TypeScript at all').toBeGreaterThan(1000);
    const sites = corpus.reduce((total, doc) => total + authoritySites(doc.source).length, 0);
    expect(sites, 'the matcher found no authority anywhere — it has stopped matching').toBeGreaterThan(1500);
  });

  it('declares no name twice outside the named, shrinking baseline', () => {
    const { fresh, stale } = reconcile(collisions(corpus), KNOWN_COLLISIONS);

    expect(
      fresh,
      'The 2026-08-25 family ruling (objectui#6172, decision 甲/A1): every exported schema\n' +
        'name has exactly one authority. These names have two or more — a second declaration,\n' +
        'or an aliasing re-export publishing a name something else already declares:\n\n' +
        `${fresh.join('\n\n')}\n\n` +
        '  Remedy: pick the ONE authority, and re-point the others at it —\n' +
        "  `export type { X } from '<the-owner>'` is a re-export, not a second declaration,\n" +
        '  and this gate does not count it. If the two shapes are genuinely different\n' +
        '  things, rename one (the `MenuItem as AppMenuItem` pattern in\n' +
        '  packages/types/src/index.ts:59 is this repo’s worked example).\n' +
        '  ⛔ KNOWN_COLLISIONS is SHRINK-ONLY: adding a line is not a supported way\n' +
        '  to make this pass.',
    ).toEqual([]);

    expect(
      stale,
      'KNOWN_COLLISIONS lists collisions that no longer exist. Good news — but the entry\n' +
        'has to come down with the fix, or the baseline turns into a permanent skip-list\n' +
        'and stops meaning anything:\n\n' +
        `${stale.join('\n\n')}`,
    ).toEqual([]);
  });
});
