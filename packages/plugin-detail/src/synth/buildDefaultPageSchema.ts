/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `buildDefaultPageSchema` — Pure function that synthesizes a canonical
 * Lightning-style Page schema from an object definition (and optional
 * record data + overrides).
 *
 * This is the foundation of Track 3 "convergence": once
 * `RecordDetailView` synthesizes a Page schema for the no-assignedPage
 * branch and renders via `<SchemaRenderer>`, the default and custom
 * detail paths share a single rendering pipeline. All Phase D/E/F
 * polish (record-aware header chip, chevron path, flush accordion,
 * discussion slot) then applies to every object's default detail page
 * automatically.
 *
 * Phase G slice 1: pure synthesis only. No runtime wiring yet —
 * `RecordDetailView` is not yet calling this. That comes in Phase H
 * once the synthesizer covers enough surface area to reach parity with
 * the existing DetailView output.
 */

import { deriveFieldGroupLayout } from '@objectstack/spec/data';
import type { ServiceObject } from '@objectstack/spec/data';
import { detectStatusField } from '@object-ui/types';
// The retirement gate (objectui#4914, ruling B). `@object-ui/fields`
// re-exports the same function; this module reads it from `@object-ui/core`
// because that is the dependency this package's synth layer already carries
// at this depth, and both spellings resolve to one table and one dedupe set.
import { isRetiredFieldType, reportRetiredFieldType } from '@object-ui/core';
import { inferDetailColumns } from '../autoLayout';

/** Minimal shape of an object definition we read here. We deliberately
 *  duck-type so this helper has zero hard dependency on a specific
 *  object-schema shape. */
export interface ObjectDefLike {
  name?: string;
  label?: string;
  fields?: Record<string, ObjectDefFieldLike>;
  /** Semantic role (ADR-0085): the linear-lifecycle field driving the
   *  `record:path` stepper. `false` = the status-shaped field is NOT a
   *  linear flow — suppress stage detection entirely (#2065). */
  stageField?: string | false;
  stages?: Array<{ value: any; label: string }>;
  /** Semantic role (ADR-0085): the object's most important fields —
   *  drives the highlight strip (first 4). */
  highlightFields?: string[];
  /** Name of the field that holds the record's display title (e.g. `name`,
   *  `subject`). When present we exclude it from the auto-derived highlight
   *  list to avoid duplicating the page H1. */
  primaryField?: string;
  /** Optional section grouping for the details region. */
  sections?: Array<{ title?: string; columns?: number; fields?: any[] }>;
  /**
   * Declared field groups from the object designer. Fields opt in via
   * `field.group === group.key`; the detail synthesizer derives sections
   * from them when no explicit sections are provided.
   *
   * DERIVED from the spec's own authorable group, not restated. This key is a
   * pass-through: nothing here reads a member of it, `deriveFieldGroupLayout`
   * (`@objectstack/spec/data`) does — so the set of members this type should
   * admit is by definition the set the spec declares, and hand-listing them
   * could only ever drift from it. It had: the hand-written list this replaces
   * carried `key`/`label`/`collapse` and the deprecated `collapsible`/`collapsed`
   * pair, but not `icon`, `description` or `defaultExpanded`. Two of those three
   * are read by this very file — `deriveFieldGroupDetailSections` passes
   * `s.icon`/`s.description` through to the section descriptors under a comment
   * citing #2548 ("Dropping them here made the spec keys silently inert on
   * detail pages") — so an author declaring the icon the synthesizer honours was
   * rejected by the type of the function that honours it.
   *
   * `Partial` is the one shape difference and it is deliberate: the spec makes
   * `key`/`label` required and `collapse` defaulted, but this is the duck type
   * for a raw object definition that has NOT been through a spec parse (the
   * whole reason it exists — see the interface header), so every member has to
   * be admissible as absent. Nothing here requires a group member to be present.
   */
  fieldGroups?: Array<Partial<NonNullable<ServiceObject['fieldGroups']>[number]>>;
  /**
   * Spec `enable` capability toggles. Only `files` is read here:
   * `enable.files === true` (opt-in, #2727) makes the synthesizer emit an
   * Attachments tab beside Details/Related (objectstack#4358).
   */
  enable?: { files?: boolean; [key: string]: any };
  // NOTE: the per-surface `detail` hints block was REMOVED from the spec by
  // ADR-0085 — presentation intent is declared via the top-level semantic
  // roles above (stageField / highlightFields / fieldGroups). Per-page
  // customization goes through an assigned Page schema.
}

/**
 * The field keys this synthesizer reads off an {@link ObjectDefLike}.
 *
 * Renamed off the spec's `ObjectFieldLike` (objectui#3161, objectstack#4115
 * ledger batch 7). Same two words, different subsystem: the spec's
 * `ObjectFieldLike` (`@objectstack/spec/system`) is the duck type
 * `translateObject` reads — `name`/`label`/`help`/`description`/`options`, i.e.
 * exactly the TRANSLATABLE keys — and it ends in `[key: string]: any`, so
 * deriving from it would trade this precise list for a bag that accepts
 * anything (the objectstack#4075 mechanism, on the spec's side this time).
 * This one is the LAYOUT input: `type` picks the widget, `group` matches a
 * `fieldGroups[].key`, `hidden` drops the field — three keys the spec's
 * declaration does not model and cannot report a typo in.
 * Pinned by `__tests__/spec-symbol-batch7.test.ts`.
 */
export interface ObjectDefFieldLike {
  name?: string;
  label?: string;
  type?: string;
  options?: Array<{ value: any; label: string }>;
  /** Declared group membership — matches a `fieldGroups[].key`. */
  group?: string;
  /** Hidden fields never surface in derived sections. */
  hidden?: boolean;
}

export interface BuildPageOptions {
  /** Override the auto-derived highlight field list. */
  highlightFields?: string[];
  /** Override the auto-derived statusField / stages. */
  statusField?: string;
  stages?: Array<{ value: any; label: string }>;
  /** Override the auto-derived section grouping. */
  sections?: Array<{ title?: string; columns?: number; fields?: any[] }>;
  /** Suppress the auto-appended `record:discussion` slot. */
  hideDiscussion?: boolean;
  /** Suppress the auto-emitted Attachments tab (`enable.files`, objectstack#4358). */
  hideAttachments?: boolean;
  /** Suppress the auto-prepended `record:highlights` strip. */
  hideHighlights?: boolean;
  /** Suppress the auto-prepended `record:path` stepper. */
  hidePath?: boolean;
  /**
   * Opt in to the Reference Rail (aside region with
   * `record:reference_rail`). The rail is OFF by default — it fans out a
   * collection query per related list, which is wasteful on records the
   * author never intended to summarize. Set `showReferenceRail: true`
   * (per object via `detail.showReferenceRail`) to surface it; it then
   * emits only when `related` has at least 2 entries.
   */
  showReferenceRail?: boolean;
  /**
   * Force-suppress the Reference Rail even when `showReferenceRail` is on.
   * Retained for callers that toggle the rail off contextually.
   */
  hideReferenceRail?: boolean;
  /**
   * Suppress the auto-emitted `Related` tab in `buildDefaultTabs`.
   * Auto-set to `true` by `buildDefaultPageSchema` when the Reference
   * Rail is being emitted, to avoid showing the same related-list data
   * in two places (the rail and the tab). Authors can override.
   */
  hideRelatedTab?: boolean;
  /** Pass-through to `page:header.recordChrome`. Defaults to true. */
  recordChrome?: boolean;
  /**
   * Action definitions to surface in the header. When provided and
   * non-empty, the synthesizer emits a `record:quick_actions` node
   * immediately after `page:header`. Use ActionDef shape from the spec
   * (must include `locations: ['record_header']` to render).
   */
  headerActions?: any[];
  /**
   * Related child objects. When non-empty, the synthesizer adds a
   * "Related" tab containing one `record:related_list` per entry.
   *
   * - `objectName` and `relationshipField` are required.
   * - `title` overrides the default child-object label.
   * - `columns` / `limit` / `icon` / `sort` are forwarded to the renderer.
   */
  related?: Array<{
    title?: string;
    objectName: string;
    relationshipField: string;
    columns?: any[];
    limit?: number;
    icon?: string;
    /**
     * Row order for this list — the spec `record:related_list.sort` union,
     * forwarded verbatim onto the synthesized node.
     *
     * The host supplies it; this synthesizer neither derives nor overrides it.
     * `RecordDetailView` fills it from the child object's DEFAULT LIST VIEW
     * sort (objectui#5795 — ruled direction 1 on objectstack#11345,
     * maintainer 2026-08-23: inherit the child list view's sort, NO new spec
     * key), already lowered to the array arm. Omitted → the node carries no
     * `sort` and the related list falls back to the server's PK order, exactly
     * as before this key had a producer.
     */
    sort?: string | Array<{ field: string; order: 'asc' | 'desc' }>;
    /**
     * `relatedList: 'primary'` — a CORE relationship. Under the default
     * layout this list is promoted to its OWN tab; non-primary lists collapse
     * into a single "Related" tab. Ignored when `relatedLayout` forces a
     * uniform layout.
     */
    isPrimary?: boolean;
  }>;
  /**
   * How the related child lists are laid out under the tab strip.
   *
   * - **default (unset)** — the ADR-0085 prominence rule: lists flagged
   *   `relatedList: 'primary'` (`isPrimary`) each get their OWN tab; every
   *   other related list collapses into a single stacked `Related` tab. With
   *   no primary lists this is identical to the legacy stacked behavior, so
   *   the change is opt-in per relationship — never a surprise.
   * - `'stack'` — app-level override: ALL related lists stack vertically
   *   inside one `Related` tab, ignoring `isPrimary`.
   * - `'tabs'` — app-level override: EVERY related child gets its own peer
   *   tab (label = the child's `title`, falling back to `objectName`),
   *   ignoring `isPrimary`.
   *
   * Precise per-tab ordering / filtered splits / non-relationship tabs are a
   * custom Page concern (Tier 2) — this synthesizer only covers the derived
   * default. Ignored when the `Related` tab is suppressed (`hideRelatedTab`).
   */
  relatedLayout?: 'stack' | 'tabs';
  /**
   * When true, emit an Activity tab that renders `record:activity`.
   * The activity renderer fetches its own data via RecordContext.
   */
  showActivity?: boolean;
  /**
   * When provided, emit a History tab containing a `record:history`
   * renderer. The host supplies the audit-log `entries` and `loading`
   * flag because the data fetch logic lives in RecordDetailView.
   */
  history?: { entries: any[]; loading?: boolean; emptyText?: string; unknownUserText?: string };
  /**
   * When provided, emit an Approvals tab containing a `record:approvals`
   * renderer (objectui#3461). `node` is spread verbatim onto the node — the
   * host threads its LIVE approvals read (the same one driving the header's
   * decision buttons) through it so the tab and the header can never
   * disagree; the renderer self-fetches only when an authored page places
   * the node without this payload. `count` badges the tab (number of
   * approval requests on the record), same affordance as the auto-derived
   * related-list counts.
   */
  approvals?: { count?: number; node?: Record<string, any> };
  /**
   * Slot override map. When a slot is provided, the synthesizer emits
   * the override verbatim at the slot's position instead of computing
   * the default. Each slot accepts a single SchemaNode or an array
   * (arrays are flattened in place).
   *
   * Slot menu (v1):
   * - `header` — replaces `page:header`.
   * - `actions` — replaces `record:quick_actions`. The override fires
   *   even when `headerActions` is empty (i.e. the override lets you
   *   add a header bar where the synthesizer would have skipped one).
   * - `highlights` — replaces the highlight strip (chips + chevron
   *   path). The override fires even when neither auto-emission
   *   condition is met.
   * - `details` — replaces the Details tab body (the `record:details`
   *   node). Other tabs (Related / Activity / History) are unaffected.
   * - `tabs` — replaces the entire `page:tabs` node. Wins over
   *   `details` when both are provided. Use this to add or reorder
   *   tabs.
   * - `discussion` — replaces `record:discussion`. Fires even when
   *   `hideDiscussion` is true (the override is explicit intent to
   *   surface a custom footer).
   * - `rightRail` — additional component(s) to drop into the
   *   right-side `aside` region (the same region that hosts the
   *   auto-emitted `record:reference_rail`). When provided, the
   *   `aside` region is always rendered — even when no reference
   *   rail would otherwise be emitted — so plugins can contribute
   *   contextual side panels (activity feed, related summary,
   *   workflow status, presence list, etc.) without depending on
   *   the related-list heuristic.
   */
  slots?: {
    header?: any | any[];
    actions?: any | any[];
    alerts?: any | any[];
    highlights?: any | any[];
    details?: any | any[];
    tabs?: any | any[];
    discussion?: any | any[];
    rightRail?: any | any[];
  };
}

/** Flatten a slot value (single node or array) into a node array. */
function toNodeArray(slot: any | any[] | undefined): any[] {
  if (slot == null) return [];
  return Array.isArray(slot) ? slot.filter((n) => n != null) : [slot];
}

/**
 * Build ONE page component node — the single place this synthesizer decides
 * where a component's props live (objectui#4232).
 *
 * A page component's own shape is CLOSED. `PageComponentSchema` declares
 * `type` / `id` / `label` / `properties` / `events` / `style` / `className` /
 * `responsiveStyles` / `visibleWhen` / `visibility` / `dataSource` /
 * `responsive` / `aria` and nothing else, and ADR-0089 D3a flipped it to
 * `.strict()` — so a widget prop written at the TOP level of the node is not
 * dropped, it is a parse error:
 *
 * ```
 * unrecognized_keys | regions.0.components.0 |
 *   Unrecognized key(s) on this view/page schema: `recordChrome`, `actions`.
 *   Before ADR-0089 D3a these were dropped silently, shipping inert metadata;
 *   a mis-layered or stale key is now a loud parse error.
 * ```
 *
 * That error is what made Studio's page-create never complete: the create path
 * seeds `regions` from `buildDefaultPageSchema(objectDef)`
 * (`app-shell/views/metadata-admin/anchors.ts` → `createSeed`), the console
 * PUT carried the flat props, the server refused the body, and no page row was
 * ever stored.
 *
 * The canonical carrier is the node's `properties` bag — which is exactly
 * where the spec declares these props (`ComponentPropsMap`:
 * `PageHeaderProps.recordChrome`, `PageTabsProps.items`, …), and what
 * `SchemaRenderer` hoists back onto the node before dispatching to a renderer
 * (`packages/react/src/SchemaRenderer.tsx`, "COMPAT: Hoist 'properties' up to
 * schema level"). So the semantics are unchanged in both directions: the same
 * props reach the same renderers, and the body now parses.
 *
 * `undefined` values are dropped rather than written as present-but-undefined
 * keys, and a component with no props at all emits no `properties` key —
 * `PageComponentSchema.properties` is `.optional().default({})`, so `{ type }`
 * is complete.
 */
function componentNode(type: string, props: Record<string, unknown> = {}): any {
  const properties: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (props[key] !== undefined) properties[key] = props[key];
  }
  return Object.keys(properties).length > 0 ? { type, properties } : { type };
}

/**
 * Detect the canonical "status" / "stage" field on an object definition.
 *
 * The implementation moved to `@object-ui/types` (`detectStatusField`) so
 * non-detail consumers of the `stageField` role — kanban default lanes in
 * app-shell/plugin-list — share the exact semantics (incl. the strict
 * `stageField: false` suppression). Re-exported here unchanged for the
 * long-standing plugin-detail import path.
 */
export { detectStatusField };

/**
 * Derive stage values from an object field's `options` (picklist).
 */
export function deriveStages(
  def: ObjectDefLike | undefined,
  statusField: string | null,
): Array<{ value: any; label: string }> | null {
  if (!def || !statusField) return null;
  const field = def.fields?.[statusField];
  const options = field?.options;
  if (!Array.isArray(options) || options.length === 0) return null;
  return options.map((o) => ({ value: o.value, label: o.label }));
}

/**
 * Resolve the record's title field — the value the page renders as its H1.
 * Declared role first (`primaryField` / `nameField` / deprecated
 * `displayNameField`), else the first conventional display-field name present
 * on the object. Mirrors `record-details`' titleCandidates so "what the H1
 * shows" and "what the strip skips" can never disagree.
 */
export function resolveTitleField(def: ObjectDefLike | undefined): string | null {
  if (!def) return null;
  const fields = def.fields || {};
  for (const candidate of [
    def.primaryField,
    (def as any).nameField,
    (def as any).displayNameField,
  ]) {
    if (typeof candidate === 'string' && candidate.length > 0 && candidate in fields) {
      return candidate;
    }
  }
  for (const candidate of ['name', 'full_name', 'title', 'subject', 'display_name']) {
    if (candidate in fields) return candidate;
  }
  return null;
}

/**
 * Pick up to N "highlight" fields by name. Skips the status field
 * (already shown in `record:path`) and obvious junk like id / created_at.
 */
export function deriveHighlightFields(
  def: ObjectDefLike | undefined,
  statusField: string | null,
  max = 4,
): string[] {
  if (!def) return [];
  // Semantic role first (ADR-0085): top-level `highlightFields`. (The
  // deprecated `compactLayout` fallback was retired with the alias —
  // framework#2536.)
  const declared = Array.isArray(def.highlightFields) && def.highlightFields.length > 0
    ? def.highlightFields
    : null;
  if (declared) {
    // Drop the title field from a DECLARED list too: it is already the page
    // H1, and repeating it as the first chip duplicated the record name —
    // truncated — directly under the identical heading. The heuristic branch
    // below always skipped it; both branches now agree (#2548 follow-up).
    // Filtering before the slice means the title never wastes a strip slot.
    const titleField = resolveTitleField(def);
    return declared
      .filter((n): n is string => typeof n === 'string' && n.length > 0 && n !== titleField)
      .slice(0, max);
  }
  // System fields and tenancy metadata never make useful highlights —
  // they either have no friendly label (organization_id renders as the
  // workspace name with no field name beside it) or are mostly noise
  // (audit IDs). Filter them up-front so the fallback walk below doesn't
  // pick them when a richer field isn't available.
  const skip = new Set<string>([
    'id', '_id',
    'created_at', 'updated_at', 'deleted_at',
    'created_by', 'updated_by', 'deleted_by',
    'organization_id', 'workspace_id', 'tenant_id',
    'org_id',
  ]);
  if (statusField) skip.add(statusField);
  // The record's display/primary field is already shown as the page H1 —
  // surfacing it again in the highlight strip duplicates content and
  // wastes a slot (e.g. Task pages would show 主题 twice). Skip the
  // common candidates and whatever the def declares as `primaryField`,
  // `nameField`, or the deprecated `displayNameField` alias (ADR-0079).
  if (def.primaryField) skip.add(def.primaryField);
  if ((def as any).nameField) skip.add((def as any).nameField);
  if ((def as any).displayNameField) skip.add((def as any).displayNameField);
  for (const candidate of ['name', 'full_name', 'title', 'subject', 'display_name']) {
    if (candidate in (def.fields || {})) skip.add(candidate);
  }
  const preferred = [
    'owner', 'owner_id', 'amount', 'rating', 'source',
    'priority', 'industry', 'phone', 'email',
    'close_date', 'due_date', 'start_date', 'expected_close_date',
    'account', 'account_id', 'contact', 'contact_id',
  ];
  // Field types that render well as compact highlight pills.
  // Long-form / structural types (textarea, markdown, json, grid) and
  // booleans don't carry enough at-a-glance information here — they're
  // either too wide or visually noisy.
  //
  // `owner` left this set with objectui#4914 — a RETIRED spelling, refused by
  // the gate below before this membership test runs. The deletion is lockstep
  // hygiene; the gate is the behavioural half. Note the `preferred` list above
  // still names `owner`: that is a field NAME, and the surviving idiom is
  // exactly `{ type: 'user', name: 'owner' }`, so it must stay.
  const HIGHLIGHT_FRIENDLY_TYPES = new Set<string>([
    'currency', 'number', 'integer', 'decimal', 'percent',
    'date', 'datetime', 'time',
    'reference', 'lookup', 'user',
    'select', 'enum', 'multiselect', 'status',
    'email', 'phone', 'url',
    'text', 'string',
  ]);
  const out: string[] = [];
  const fields = def.fields || {};
  /**
   * THE GATE (objectui#4914, ruling B), ahead of BOTH selection loops.
   *
   * A retired spelling is refused a highlight slot and the author is told once.
   * Before the ruling `owner` was highlight-friendly, so the synthesized page
   * put a pill on the strip for a field whose own editor answers with a
   * tombstone — one page, two verdicts on one field.
   *
   * It has to run on the `preferred` pass too, and that pass is why: it selects
   * by NAME and never looks at the type, and the FIRST name it prefers is
   * `owner`. Gating only the type-driven loop below would have left the one
   * shape this whole card is about — a field named `owner` still TYPED `owner`
   * — sailing into the strip through the other door, with the fix reading as
   * complete.
   */
  const refusedAsRetired = (name: string): boolean => {
    const ftype = (fields as any)[name]?.type;
    if (typeof ftype !== 'string' || !isRetiredFieldType(ftype)) return false;
    reportRetiredFieldType(ftype);
    return true;
  };
  for (const name of preferred) {
    if (name in fields && !skip.has(name) && !refusedAsRetired(name)) out.push(name);
    if (out.length >= max) return out;
  }
  for (const name of Object.keys(fields)) {
    if (out.includes(name) || skip.has(name)) continue;
    if (refusedAsRetired(name)) continue;
    const fieldDef = (fields as any)[name];
    const ftype = fieldDef?.type;
    // When a type is declared, require it to be highlight-friendly.
    // Untyped fields (legacy schemas) fall through to keep prior
    // behaviour.
    if (ftype && !HIGHLIGHT_FRIENDLY_TYPES.has(ftype)) continue;
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Sub-builder: the canonical `page:header` node.
 *
 * Exported so authors of slotted pages can compose
 * `[buildDefaultHeader(def), customNode]` without copying the
 * synthesizer's internals.
 */
export function buildDefaultHeader(
  _def: ObjectDefLike | undefined,
  options: Pick<BuildPageOptions, 'recordChrome'> & { actions?: any[] } = {},
): any {
  return componentNode('page:header', {
    recordChrome: options.recordChrome !== false,
    ...(Array.isArray(options.actions) && options.actions.length > 0
      ? { actions: options.actions }
      : {}),
  });
}

/**
 * Sub-builder: the `record:quick_actions` action bar.
 *
 * Returns `null` when `headerActions` is empty/missing so callers can
 * spread the result conditionally.
 */
export function buildDefaultActions(
  _def: ObjectDefLike | undefined,
  headerActions: any[] | undefined,
): any | null {
  if (!Array.isArray(headerActions) || headerActions.length === 0) return null;
  return componentNode('record:quick_actions', {
    actions: headerActions,
    location: 'record_header',
  });
}

/**
 * Sub-builder: the highlight strip — `record:highlights` chips plus
 * `record:path` chevron (when a status field is configured).
 *
 * Returns an array because the strip is conceptually one region with
 * two adjacent nodes.
 */
export function buildDefaultHighlights(
  def: ObjectDefLike | undefined,
  options: Pick<BuildPageOptions,
    'highlightFields' | 'statusField' | 'stages' | 'hideHighlights' | 'hidePath'
  > = {},
): any[] {
  const statusField = options.statusField ?? detectStatusField(def);
  const stages = options.stages ?? (statusField ? deriveStages(def, statusField) : null);
  const highlightFields =
    options.highlightFields ?? deriveHighlightFields(def, statusField);
  const out: any[] = [];
  if (!options.hideHighlights && highlightFields.length > 0) {
    out.push(componentNode('record:highlights', { fields: highlightFields }));
  }
  if (!options.hidePath && statusField && stages && stages.length > 0) {
    out.push(componentNode('record:path', { statusField, stages }));
  }
  return out;
}

/**
 * Derive detail sections from the object's declared `fieldGroups` plus each
 * field's `group` membership. The grouping SEMANTICS (declared order, empty
 * groups dropped, trailing untitled bucket, audit-field handling, collapse
 * behaviour incl. legacy alias handling) are single-sourced in
 * `@objectstack/spec` (`deriveFieldGroupLayout`, ADR-0085 §5); this adapter
 * only maps the shared result onto DetailSection's shape.
 *
 * Returns `null` when grouping does not apply — no declared groups, or no
 * visible field references one — so callers fall back to their existing
 * layout (flat or auto-split).
 *
 * Section fields are emitted as rich descriptors (`{ name, label, type,
 * options }`) so DetailSection renders typed values without re-resolving
 * the object definition.
 */
export function deriveFieldGroupDetailSections(
  def: ObjectDefLike | undefined,
): Array<Record<string, any>> | null {
  if (!def) return null;
  const derived = deriveFieldGroupLayout(def);
  if (!derived) return null;

  const fields = def.fields || {};
  const toField = (name: string) => {
    const f = fields[name] || {};
    return {
      name,
      label: f.label || name,
      type: f.type || 'text',
      ...(f.options ? { options: f.options } : {}),
      ...((f as any).reference_to || (f as any).reference
        ? { reference_to: (f as any).reference_to || (f as any).reference }
        : {}),
      ...((f as any).reference_field ? { reference_field: (f as any).reference_field } : {}),
      ...((f as any).currency ? { currency: (f as any).currency } : {}),
      // Spec channel for per-field currency — renderers resolve
      // currency → currencyConfig.defaultCurrency → tenant default (#2548).
      ...((f as any).currencyConfig ? { currencyConfig: (f as any).currencyConfig } : {}),
    };
  };

  // Column count is derived ONCE from the object's TOTAL detail-field count and
  // applied to every section — mirroring the entry form (plugin-form's
  // `derivedSections` uses `inferColumns(totalFieldCount)` uniformly), so a
  // record reads at the same width in view and edit (objectui#2578). Without
  // this each section re-inferred from its OWN field count, so a 15-field group
  // showed 3 columns in detail while the form showed 4. The grid's CSS
  // breakpoints still clamp to the real rendered width.
  const totalFields = derived.reduce((n, s) => n + s.fields.length, 0);
  const columns = inferDetailColumns(totalFields);

  // Untitled trailing bucket: omitting `name`/`title` keeps the section flat
  // (record-details defaults showBorder to false for untitled sections)
  // instead of surfacing an internal key as a header.
  return derived.map((s) => ({
    ...(s.key !== undefined ? { name: s.key, title: s.label ?? s.key } : {}),
    // Group header chrome (ADR-0085 §5): the shared derivation passes the
    // declared icon/description through; DetailSection renders them under
    // the section title. Dropping them here made the spec keys silently
    // inert on detail pages (#2548 follow-up).
    ...(s.icon ? { icon: s.icon } : {}),
    ...(s.description ? { description: s.description } : {}),
    ...(s.collapse !== 'none' ? { collapsible: true } : {}),
    ...(s.collapse === 'collapsed' ? { defaultCollapsed: true } : {}),
    columns,
    fields: s.fields.map(toField),
  }));
}

/**
 * Resolve the sections for the Details tab body:
 *   1) explicit `options.sections` from the caller (programmatic API —
 *      Studio preview / metadata-admin anchors);
 *   2) else sections derived from the object's `fieldGroups` semantic role;
 *   3) else `undefined` — record:details falls back to its flat layout.
 */
export function resolveDetailSections(
  def: ObjectDefLike | undefined,
  sections?: BuildPageOptions['sections'],
): BuildPageOptions['sections'] | undefined {
  if (Array.isArray(sections) && sections.length > 0) return sections;
  return deriveFieldGroupDetailSections(def) ?? undefined;
}

/**
 * Sub-builder: the Details tab body — a single `record:details` node.
 */
export function buildDefaultDetails(
  def: ObjectDefLike | undefined,
  sections?: BuildPageOptions['sections'],
  hideFields?: string[],
): any {
  return componentNode('record:details', {
    sections: resolveDetailSections(def, sections),
    ...(hideFields && hideFields.length > 0 ? { hideFields } : {}),
  });
}

/**
 * Sub-builder: the `page:tabs` node. Emits Details / Related /
 * Activity / History tabs in stable order based on the options.
 *
 * Useful for slotted authors who want to add a custom tab — they can
 * call `buildDefaultTabs(def, opts)` and splice their tab into
 * `.items[]`.
 */
export function buildDefaultTabs(
  def: ObjectDefLike | undefined,
  options: Pick<BuildPageOptions,
    'sections' | 'related' | 'showActivity' | 'history' | 'highlightFields' | 'statusField' | 'hideRelatedTab' | 'relatedLayout' | 'hideAttachments' | 'approvals'
  > = {},
): any {
  const statusField = options.statusField ?? detectStatusField(def);
  const highlightFields =
    options.highlightFields ?? deriveHighlightFields(def, statusField);
  // Every tab carries a STABLE, semantic `value` (objectui#2257): the active
  // tab is URL-addressable (`?tab=<value>`, ADR-0054 C3), so values must
  // survive related lists being added/removed — an index-derived value
  // (`tab-2`) would silently point at a different tab after a schema change.
  const items: any[] = [
    { label: 'Details', value: 'details', children: [buildDefaultDetails(def, options.sections, highlightFields)] },
  ];
  if (
    !options.hideRelatedTab &&
    Array.isArray(options.related) &&
    options.related.length > 0
  ) {
    const relatedNode = (rel: NonNullable<BuildPageOptions['related']>[number]) =>
      componentNode('record:related_list', {
        title: rel.title,
        objectName: rel.objectName,
        relationshipField: rel.relationshipField,
        ...(rel.columns ? { columns: rel.columns } : {}),
        ...(rel.limit ? { limit: rel.limit } : {}),
        ...(rel.icon ? { icon: rel.icon } : {}),
        // objectui#5795. Emitted only when the host actually supplied one, for
        // the reason every sibling key here is: a `sort: undefined` written
        // onto the node is a different fact from "the author said nothing",
        // and it is the one a later liveness audit would read.
        ...(rel.sort ? { sort: rel.sort } : {}),
      });
    const asOwnTab = (rel: NonNullable<BuildPageOptions['related']>[number]) => ({
      label: rel.title || rel.objectName,
      value: `related:${rel.objectName}`,
      ...(rel.icon ? { icon: rel.icon } : {}),
      children: [relatedNode(rel)],
    });
    if (options.relatedLayout === 'tabs') {
      // App-level override: one peer tab per related child.
      for (const rel of options.related) items.push(asOwnTab(rel));
    } else if (options.relatedLayout === 'stack') {
      // App-level override: all related lists share one stacked `Related` tab.
      items.push({ label: 'Related', value: 'related', children: options.related.map(relatedNode) });
    } else {
      // DEFAULT (rule Z, ADR-0085 prominence): `isPrimary` lists become their
      // own tab; the rest collapse into one `Related` tab. Owned-before-lookup
      // order is preserved by deriveRelatedLists upstream. With no primary
      // lists this is identical to the legacy stacked default (opt-in per
      // relationship, never a surprise).
      const primary = options.related.filter((r) => r.isPrimary);
      const rest = options.related.filter((r) => !r.isPrimary);
      for (const rel of primary) items.push(asOwnTab(rel));
      if (rest.length > 0) {
        items.push({ label: 'Related', value: 'related', children: rest.map(relatedNode) });
      }
    }
  }
  // Approvals tab (objectui#3461) — emitted only when the host reports the
  // record actually HAS approval requests, so approval-free records carry no
  // dead tab. A peer of Details/Related for the same reason as Attachments
  // below: footer placement buried the one thing a submitter opens the
  // record to learn ("who is this waiting on"). The English label localizes
  // through the tab strip's KNOWN_LABEL_DICT (→ 审批 etc.).
  if (options.approvals) {
    items.push({
      label: 'Approvals',
      value: 'approvals',
      ...(options.approvals.count != null ? { count: options.approvals.count } : {}),
      children: [componentNode('record:approvals', { ...(options.approvals.node || {}) })],
    });
  }
  // Attachments tab (objectstack#4358) — emitted for `enable.files: true`
  // objects so the panel is a peer of Details/Related instead of a footer
  // widget buried under the discussion feed. `PageTabsRenderer` derives the
  // count badge from the `record:attachments` node the same way it counts
  // `record:related_list` tabs. The English label goes through the tab
  // strip's KNOWN_LABEL_DICT (→ 附件 etc.), matching its sibling tabs.
  if (def?.enable?.files === true && !options.hideAttachments) {
    items.push({ label: 'Attachments', value: 'attachments', children: [buildDefaultAttachments()] });
  }
  if (options.showActivity) {
    items.push({ label: 'Activity', value: 'activity', children: [componentNode('record:activity')] });
  }
  if (options.history) {
    items.push({
      label: 'History',
      value: 'history',
      children: [
        componentNode('record:history', {
          entries: options.history.entries,
          loading: options.history.loading,
          emptyText: options.history.emptyText,
          unknownUserText: options.history.unknownUserText,
        }),
      ],
    });
  }
  return componentNode('page:tabs', { items });
}

/**
 * Sub-builder: the inline `record:discussion` footer slot.
 */
export function buildDefaultDiscussion(): any {
  return componentNode('record:discussion');
}

/**
 * Sub-builder: the `record:attachments` panel (#2727). Emitted only when the
 * object opts in via `enable.files: true` — the same gate the server enforces
 * on `sys_attachment` rows (403 FILES_DISABLED otherwise).
 */
export function buildDefaultAttachments(): any {
  return componentNode('record:attachments');
}

/**
 * Synthesize the canonical Page schema for an object's default detail
 * page.
 *
 * Shape:
 *   { type:'record', template:'full-width', regions:[ { name:'main',
 *     components: [page:header, record:highlights?, record:path?,
 *     page:tabs, record:discussion?] } ] }
 *   For `enable.files: true` objects the tabs node carries a peer
 *   Attachments tab (`record:attachments` — objectstack#4358).
 *
 * Notes:
 *   - The `record:details` tab content is registered separately and
 *     internally still defers to DetailView for actual field
 *     rendering (see record-details.tsx). When Phase G fully extracts
 *     DetailSection into a `record:section` renderer, this synthesis
 *     output won't need to change — only the inner record:details
 *     implementation will swap.
 *   - We DO NOT emit `record:related_list` here because related list
 *     metadata is not on `objectDef`; that wiring lives in the related
 *     adapter and remains the author's job until a follow-up phase
 *     exposes it through the synthesizer.
 */
export function buildDefaultPageSchema(
  def: ObjectDefLike | undefined,
  options: BuildPageOptions = {},
): any {
  const slots = options.slots || {};
  const components: any[] = [];

  // 1) Header slot. When no header override is set, fold any
  //    `headerActions` into the header itself so PageHeaderRenderer
  //    renders custom + system actions side-by-side in a single row
  //    (avoids the floating `record:quick_actions` overlay colliding
  //    with the system Edit/Share/Delete cluster).
  if ('header' in slots && slots.header !== undefined) {
    components.push(...toNodeArray(slots.header));
  } else {
    components.push(
      buildDefaultHeader(def, {
        recordChrome: options.recordChrome,
        actions: options.headerActions,
      }),
    );
  }

  // 2) Header action bar — only emitted as a separate node when an
  //    explicit `actions` slot override is provided. Otherwise actions
  //    are merged into the header above.
  if ('actions' in slots && slots.actions !== undefined) {
    components.push(...toNodeArray(slots.actions));
  }

  // 2.5) Alerts slot — rendered between the header/actions row and the
  //      highlights strip. No default emission; only renders when the
  //      page explicitly provides alerts (e.g. unverified-email banner,
  //      "record is locked" notice). The `record:alert` renderer handles
  //      its own visibility predicate and dismiss persistence.
  if ('alerts' in slots && slots.alerts !== undefined) {
    components.push(...toNodeArray(slots.alerts));
  }

  // 3) Highlight strip (chips + chevron path).
  if ('highlights' in slots && slots.highlights !== undefined) {
    components.push(...toNodeArray(slots.highlights));
  } else {
    components.push(...buildDefaultHighlights(def, {
      highlightFields: options.highlightFields,
      statusField: options.statusField,
      stages: options.stages,
      hideHighlights: options.hideHighlights,
      hidePath: options.hidePath,
    }));
  }

  // Decide whether to emit the Reference Rail. When emitted, suppress
  // the duplicate Related tab to avoid showing the same data twice
  // (HubSpot/Dynamics convention). Authors can opt out of either via
  // `hideReferenceRail` / `hideRelatedTab`.
  const willEmitRail =
    options.showReferenceRail === true &&
    !options.hideReferenceRail &&
    Array.isArray(options.related) &&
    options.related.length >= 2;
  const hideRelatedTab =
    options.hideRelatedTab ?? willEmitRail;

  // 4) Tabs — `tabs` slot wins over `details` slot when both are
  //    provided (broader override). When only `details` is provided,
  //    splice it into the Details tab body and keep Related/Activity/
  //    History tabs synthesized.
  if ('tabs' in slots && slots.tabs !== undefined) {
    components.push(...toNodeArray(slots.tabs));
  } else if ('details' in slots && slots.details !== undefined) {
    const detailsBody = toNodeArray(slots.details);
    const tabsNode = buildDefaultTabs(def, {
      sections: options.sections,
      related: options.related,
      showActivity: options.showActivity,
      history: options.history,
      approvals: options.approvals,
      highlightFields: options.highlightFields,
      statusField: options.statusField,
      hideRelatedTab,
      relatedLayout: options.relatedLayout,
      hideAttachments: options.hideAttachments,
    });
    // Replace the first tab's children (Details) with the override. The items
    // live in the node's `properties` bag — the canonical carrier per
    // ADR-0089 D3a (see `componentNode`).
    const tabItems = tabsNode.properties?.items;
    if (Array.isArray(tabItems) && tabItems.length > 0) {
      tabItems[0] = { ...tabItems[0], children: detailsBody };
    }
    components.push(tabsNode);
  } else {
    components.push(buildDefaultTabs(def, {
      sections: options.sections,
      related: options.related,
      showActivity: options.showActivity,
      history: options.history,
      approvals: options.approvals,
      highlightFields: options.highlightFields,
      statusField: options.statusField,
      hideRelatedTab,
      relatedLayout: options.relatedLayout,
      hideAttachments: options.hideAttachments,
    }));
  }

  // 5) Discussion footer. (Attachments are NOT part of this footer: for
  //    `enable.files` objects buildDefaultTabs emits a peer Attachments tab
  //    instead — objectstack#4358.)
  if ('discussion' in slots && slots.discussion !== undefined) {
    components.push(...toNodeArray(slots.discussion));
  } else if (!options.hideDiscussion) {
    components.push(buildDefaultDiscussion());
  }

  // 6) Reference Rail — Salesforce/HubSpot-style aside summary of
  //    related collections. Auto-emit only when the record has at
  //    least 2 related lists; otherwise the rail is mostly noise.
  //    Hidden on screens below `xl` so the main column owns full width
  //    at common laptop widths.
  const regions: any[] = [
    {
      name: 'main',
      width: 'full',
      components,
    },
  ];

  const rightRailExtras = toNodeArray(slots.rightRail);
  const willEmitAside = willEmitRail || rightRailExtras.length > 0;

  if (willEmitAside) {
    const asideComponents: any[] = [];
    if (willEmitRail) {
      // No `icon` on rail entries: `ReferenceRailEntrySchema` is `$strict`
      // without it, so emitting `rel.icon` here wrote a key the spec refuses
      // at save — and no render path ever read it (objectui#5494).
      asideComponents.push(componentNode('record:reference_rail', {
        entries: (options.related as any[]).map((rel) => ({
          objectName: rel.objectName,
          relationshipField: rel.relationshipField,
          title: rel.title,
          displayField: rel.displayField,
          limit: 3,
        })),
      }));
    }
    // Author-contributed right-rail nodes follow the reference rail so the
    // canonical "related" summary stays anchored at the top.
    if (rightRailExtras.length > 0) {
      asideComponents.push(...rightRailExtras);
    }
    regions.push({
      name: 'aside',
      width: 'small',
      className: 'hidden xl:flex flex-col gap-4',
      components: asideComponents,
    });
  }

  return {
    type: 'record',
    pageType: 'record',
    object: def?.name,
    template: 'full-width',
    regions,
  };
}
