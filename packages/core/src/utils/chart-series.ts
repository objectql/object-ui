/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * chart-series — shape a semantic-layer `queryDataset` result into the
 * `{ data, xAxisKey, series }` triple a chart renderer consumes (ADR-0021, #1759).
 *
 * Shared by `ObjectChart` (plugin-charts) and `DatasetWidget` (plugin-dashboard)
 * so multi-dimension charts visualise identically across surfaces.
 *
 * Rules:
 *  - **2+ dimensions, single measure** → pivot the SECOND dimension into one
 *    series per distinct value (grouped/coloured bars). `xAxisKey` = first
 *    dimension; each output row is one first-dimension bucket with a column per
 *    second-dimension value holding the measure. This makes the second dimension
 *    visible instead of just repeating the x-axis label.
 *  - **otherwise** (single dimension, or multiple measures) → first dimension is
 *    the x-axis and each measure is its own series (long format passes through).
 */

export interface ChartResultField {
  name: string;
  label?: string;
  format?: string;
}

/**
 * One renderer-internal series binding produced by {@link buildChartSeries}:
 * WHICH result-set column to draw and what to call it.
 *
 * NOT the spec's `ChartSeries` (`@objectstack/spec/ui`), which this type was
 * named after until objectstack#4115. That one is the AUTHORED dataset-binding
 * descriptor — `{ name, label?, type?, color?, stack?, yAxis, variant?,
 * dashArray?, opacity? }`, where `name` is a measure and no `data` is carried.
 * A third shape, `ChartDataSeries` in `@object-ui/types` (renamed in the same
 * burn-down), is the inline static-data series of an SDUI `ChartSchema` node.
 * Three different concepts; this is the one the chart renderers consume.
 */
export interface ChartSeriesBinding {
  dataKey: string;
  label: string;
}

export interface ChartSeriesResult {
  data: Array<Record<string, unknown>>;
  xAxisKey: string | undefined;
  series: ChartSeriesBinding[];
}

export function buildChartSeries(
  rows: Array<Record<string, unknown>> | null | undefined,
  dimensions: string[] | null | undefined,
  values: string[] | null | undefined,
  fields?: ChartResultField[] | null,
): ChartSeriesResult {
  const dims = (dimensions ?? []).filter(Boolean);
  const vals = (values ?? []).filter(Boolean);
  const safeRows = Array.isArray(rows) ? rows : [];
  const labelOf = (name: string): string =>
    (fields ?? []).find((f) => f.name === name)?.label ?? name;

  // Multi-dimension, single-measure → pivot the second dimension into series.
  if (dims.length >= 2 && vals.length === 1) {
    const xKey = dims[0];
    const groupKey = dims[1];
    const measure = vals[0];
    const seriesKeys: string[] = [];
    const byX = new Map<string, Record<string, unknown>>();

    for (const row of safeRows) {
      const xRaw = row[xKey];
      const xId = String(xRaw ?? '');
      if (!byX.has(xId)) byX.set(xId, { [xKey]: xRaw });
      const gId = String(row[groupKey] ?? '');
      if (gId !== '' && !seriesKeys.includes(gId)) seriesKeys.push(gId);
      byX.get(xId)![gId] = row[measure];
    }

    return {
      data: Array.from(byX.values()),
      xAxisKey: xKey,
      // Series labels are the second-dimension values themselves (already
      // server-resolved to display labels by queryDataset).
      series: seriesKeys.map((k) => ({ dataKey: k, label: k })),
    };
  }

  // Default: first dimension on the x-axis, one series per measure.
  return {
    data: safeRows,
    xAxisKey: dims[0],
    series: vals.map((v) => ({ dataKey: v, label: labelOf(v) })),
  };
}

/**
 * Resolve select/enum dimension VALUES to display LABELS in chart rows.
 *
 * Analytics groups by a select field's stored `value` (e.g. `active`), but a
 * chart axis should read the option `label` (e.g. `合作中`). The server SHOULD
 * resolve this (ADR-0021), but when it can't — an AI-built select whose
 * `options` the analytics layer never sees, so its `resolveDimensionLabels`
 * silently no-ops — the rows arrive value-keyed. The axis then shows raw enum
 * values, and (worse) option-keyed colour / category wiring built from the
 * field `label`s no longer lines up with the value-keyed rows, so categories
 * read empty. This is the chart-layer safety net the legacy aggregate path
 * already gets from `resolveGroupByLabels`.
 *
 * Each row is rewritten by replacing `row[dim]` with `labelMaps[dim][value]`
 * when a mapping exists. Measure columns are untouched, so the grouped count
 * stays attached to its (now label-keyed) category — `value` is the matching
 * key, `label` is only the display. Values with no mapping (already a label
 * because the server resolved it, a lookup id, free text) pass through, so this
 * is safe to run unconditionally and is idempotent.
 *
 * Returns a NEW array; a row that needs no change keeps its identity, and the
 * input rows are never mutated, so the server's raw rows survive for
 * index-aligned drill-through (`drillRawRows`).
 */
export function relabelDimensions(
  rows: Array<Record<string, unknown>> | null | undefined,
  labelMaps: Record<string, Record<string, string>> | null | undefined,
): Array<Record<string, unknown>> {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!labelMaps) return safeRows;
  const dims = Object.keys(labelMaps).filter(
    (d) => labelMaps[d] && Object.keys(labelMaps[d]).length > 0,
  );
  if (dims.length === 0) return safeRows;
  return safeRows.map((row) => {
    let next: Record<string, unknown> | null = null;
    for (const dim of dims) {
      const raw = row[dim];
      if (raw == null) continue;
      const label = labelMaps[dim][String(raw)];
      if (label != null && label !== raw) {
        if (!next) next = { ...row };
        next[dim] = label;
      }
    }
    return next ?? row;
  });
}

/**
 * Inverse of {@link buildChartSeries}: map a clicked chart segment back to the
 * index of its source dataset row, so a chart click can drill through to the
 * same records a table/pivot row would.
 *
 * Mirrors `buildChartSeries`' pivot rule:
 *  - **2+ dimensions, single measure** (second dim pivoted into series) → match
 *    BOTH the x-axis dimension (`category`) and the series dimension (`seriesKey`).
 *  - **otherwise** → match the x-axis (first) dimension only.
 *
 * Comparison is string-wise on the rows' display values (which is what the chart
 * surfaces as `category` / series key). Returns `-1` when nothing matches.
 */
export function findChartSeriesRow(
  rows: Array<Record<string, unknown>> | null | undefined,
  dimensions: string[] | null | undefined,
  values: string[] | null | undefined,
  category: string | undefined,
  seriesKey?: string,
): number {
  const dims = (dimensions ?? []).filter(Boolean);
  const vals = (values ?? []).filter(Boolean);
  const safeRows = Array.isArray(rows) ? rows : [];
  const xDim = dims[0];
  if (!xDim) return -1;
  const c = String(category ?? '');
  if (dims.length >= 2 && vals.length === 1) {
    const gDim = dims[1];
    const s = String(seriesKey ?? '');
    return safeRows.findIndex((r) => String(r[xDim] ?? '') === c && String(r[gDim] ?? '') === s);
  }
  return safeRows.findIndex((r) => String(r[xDim] ?? '') === c);
}

/**
 * Build a per-category colour map from a select/lookup field's `options`.
 *
 * Keyed by BOTH the option `value` AND its display `label`, because a chart
 * row's category may carry either — the server resolves dataset select
 * dimensions value→label, while the legacy aggregate path keeps the raw value.
 * Returns `null` when the field has no options or none carry a colour, so the
 * caller can fall back to the positional palette.
 *
 * Shared by `ObjectChart` (plugin-charts) and `DatasetWidget` (plugin-dashboard)
 * so a select/lookup dimension's option colours (e.g. health green/red/yellow)
 * paint identically across the chart view and dashboard widgets.
 */
export function buildOptionColorMap(options: unknown): Record<string, string> | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const map: Record<string, string> = {};
  for (const opt of options) {
    if (opt && typeof opt === 'object') {
      const o = opt as { value?: unknown; label?: unknown; color?: unknown };
      if (typeof o.color === 'string' && o.color) {
        if (o.value != null) map[String(o.value)] = o.color;
        if (o.label != null) map[String(o.label)] = o.color;
      }
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}

/**
 * Build the DECLARED category order from a select field's `options` — the
 * sequence the author wrote them in on the object (framework#3588).
 *
 * A picklist's option order is already the domain order: a sales `stage` field
 * lists Qualification → Needs Analysis → Proposal → Negotiation because that IS
 * the pipeline. Analytics groups by that field and returns buckets in whatever
 * order the GROUP BY produced (usually alphabetical), which for an
 * ordered-sequence chart — a funnel above all — draws a shape that reads as a
 * pipeline but isn't one.
 *
 * Emits BOTH the stored `value` and its display `label` per option, adjacent
 * and in declared order, for the same reason {@link buildOptionColorMap} keys
 * by both: a chart row's category may carry either, depending on whether the
 * server resolved the dimension's labels. Rank is "index of first match", so
 * either key ranks the option identically.
 *
 * Returns `null` for a field with no options, so callers keep their existing
 * ordering (a funnel falls back to descending by value).
 */
export function buildCategoryOrder(options: unknown): string[] | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const keys: string[] = [];
  for (const opt of options) {
    if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
      keys.push(String(opt));
      continue;
    }
    if (opt && typeof opt === 'object') {
      const o = opt as { value?: unknown; label?: unknown };
      if (o.value != null) keys.push(String(o.value));
      if (o.label != null && String(o.label) !== String(o.value)) keys.push(String(o.label));
    }
  }
  return keys.length > 0 ? keys : null;
}

/**
 * Rank map for {@link buildCategoryOrder} keys — `category → position`, first
 * occurrence wins. Categories absent from the declared order get no entry; the
 * caller decides where those sort (see `AdvancedChartImpl`, which keeps them
 * after the declared ones rather than dropping them).
 */
export function buildCategoryRank(order: string[] | null | undefined): Map<string, number> | null {
  if (!Array.isArray(order) || order.length === 0) return null;
  const rank = new Map<string, number>();
  order.forEach((key, i) => {
    if (!rank.has(key)) rank.set(key, i);
  });
  return rank.size > 0 ? rank : null;
}

/**
 * The i18n seam of the analytics label net (objectui#4030).
 *
 * `(storedValue, authoredLabel) => displayLabel` — the SAME signature
 * `resolveGroupByLabels` (plugin-charts) already takes for the legacy aggregate
 * path, which callers bind to `useSafeFieldLabel().fieldOptionLabel(object,
 * field, …)`. That resolver reads `{ns}.fieldOptions.<object>.<field>.<value>`,
 * the one convention list and form surfaces already translate select options
 * through (`useObjectLabel.translateOptions`, and `@objectstack/spec` names
 * objectui as its reader). Analytics reuses that channel rather than growing a
 * chart-side per-locale dialect.
 *
 * Omitted everywhere it isn't available (no i18n provider, an unresolvable
 * owning object): every helper below then behaves exactly as it did before this
 * seam existed.
 */
export type OptionLabelTranslator = (value: string, authoredLabel: string) => string;

/** One option, normalized out of the `{value,label}` / bare-string spellings. */
function optionValueLabel(opt: unknown): { value: string; label: string } | null {
  if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
    // A bare-string option IS its own label. Nothing to resolve, but there is
    // something to TRANSLATE — the bundle is keyed by the stored value.
    return { value: String(opt), label: String(opt) };
  }
  if (opt && typeof opt === 'object') {
    const o = opt as { value?: unknown; label?: unknown };
    if (o.value != null && o.label != null) return { value: String(o.value), label: String(o.label) };
  }
  return null;
}

/**
 * Run a select field's `options` through the locale bundle, returning options
 * whose `label` is the translated one (objectui#4030).
 *
 * The mirror of `useObjectLabel().translateOptions` — the channel list and form
 * surfaces localize select options through — kept pure and shape-tolerant so
 * the analytics net can apply it at the point the resolved options are read.
 * Everything downstream ({@link buildOptionColorMap},
 * {@link buildCategoryOrder}) keeps reading `option.label` and needs no
 * knowledge of i18n, exactly like `SelectCellRenderer` on the list side.
 *
 * Colour, order and every other option key survive untouched — only `label`
 * changes. Returns the input ARRAY ITSELF when there is no translator or
 * nothing translated, so an untranslated app keeps the identities (and the
 * memo/render behaviour) it had before.
 */
export function localizeFieldOptions(options: unknown, translate?: OptionLabelTranslator): unknown {
  if (!translate || !Array.isArray(options) || options.length === 0) return options;
  let changed = false;
  const next = options.map((opt) => {
    const vl = optionValueLabel(opt);
    if (!vl) return opt;
    const display = translate(vl.value, vl.label);
    if (display === vl.label) return opt;
    changed = true;
    // A bare-string option becomes an object so the translation has somewhere
    // to live; its value is preserved, which is the only identity that matters.
    return opt && typeof opt === 'object'
      ? { ...(opt as object), label: display }
      : { value: vl.value, label: display };
  });
  return changed ? next : options;
}

/**
 * Build a `{ value → label }` map from a select/enum field's `options`, for
 * resolving a grouped dimension's stored value to its display label (fed to
 * {@link relabelDimensions}). Mirrors {@link buildOptionColorMap}.
 *
 * Options may be `{ value, label }` objects or bare strings (value == label —
 * nothing to relabel). Only entries whose display label actually differs from
 * the key are kept, so the map is empty (→ `null`) when relabeling would be a
 * no-op and the caller can skip it entirely.
 *
 * **With a `translate` seam (objectui#4030) the map gains a SECOND key per
 * option: the AUTHORED label.** A dimension's rows reach this net keyed either
 * way — value-keyed when the server did not resolve the dimension (the whole
 * reason this net exists), already label-keyed when it did (ADR-0021) — and
 * the reported symptom is the second case: a chart legend showing the object's
 * English `label` verbatim beside a related list showing the translation. One
 * key resolves `orion`, the other re-translates `Orion Engineered Carbons`;
 * `relabelDimensions` is value-wise and idempotent, so whichever the row
 * carries lands on the same translated display.
 *
 * Value keys win over authored-label keys: a stored value that happens to
 * equal some other option's label is still that option's value.
 *
 * Without a translator this is byte-for-byte the pre-#4030 map — the authored
 * label then IS the display, so no second key is ever emitted.
 */
export function buildDimensionLabelMap(
  options: unknown,
  translate?: OptionLabelTranslator,
): Record<string, string> | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const byValue: Record<string, string> = {};
  const byAuthoredLabel: Record<string, string> = {};
  for (const opt of options) {
    const vl = optionValueLabel(opt);
    if (!vl) continue;
    const display = translate ? translate(vl.value, vl.label) : vl.label;
    if (display !== vl.value) byValue[vl.value] = display;
    if (display !== vl.label) byAuthoredLabel[vl.label] = display;
  }
  const map = { ...byAuthoredLabel, ...byValue };
  return Object.keys(map).length > 0 ? map : null;
}

/**
 * Field types that JOIN to another object, so they can be a hop in a dotted
 * dimension path. Mirrors the dataset designer's allowlist
 * (`useDatasetFields.ts`), matched case-insensitively so `masterDetail` and
 * `master_detail` both resolve.
 */
const RELATIONSHIP_FIELD_TYPES = new Set(['lookup', 'master_detail', 'masterdetail', 'master-detail']);

/** The `fields` map of an object metadata doc, or null when it isn't one. */
function fieldDefsOf(schema: unknown): Record<string, unknown> | null {
  const fields = (schema as { fields?: unknown } | null | undefined)?.fields;
  return fields && typeof fields === 'object' && !Array.isArray(fields)
    ? (fields as Record<string, unknown>)
    : null;
}

/**
 * The object a relationship field points at, or `undefined` when the field is
 * not a relationship (or names no target).
 *
 * The target lives under `reference` on framework-served field defs; older /
 * spec shapes spell it `reference_to` / `referenceTo` / `reference_to_object`,
 * and any of them may carry a bare name, a one-element array, or `{ object }`.
 * Same canonicalization as the dataset designer's `resolveReferenceTo`.
 *
 * The **type gate is deliberate**: only a declared relationship is walked, so a
 * path segment naming a plain field can never be turned into an object name and
 * fetched speculatively.
 */
export function resolveRelationshipTarget(fieldDef: unknown): string | undefined {
  if (!fieldDef || typeof fieldDef !== 'object') return undefined;
  const def = fieldDef as {
    type?: unknown;
    reference?: unknown;
    reference_to?: unknown;
    referenceTo?: unknown;
    reference_to_object?: unknown;
  };
  const type = typeof def.type === 'string' ? def.type.toLowerCase() : '';
  if (!RELATIONSHIP_FIELD_TYPES.has(type)) return undefined;
  const raw = def.reference ?? def.reference_to ?? def.referenceTo ?? def.reference_to_object;
  if (typeof raw === 'string' && raw) return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0]) return raw[0];
  if (raw && typeof raw === 'object') {
    const obj = (raw as { object?: unknown }).object;
    if (typeof obj === 'string' && obj) return obj;
  }
  return undefined;
}

/**
 * Resolve each dataset dimension's underlying `field` to that field's select
 * `options`, following DOTTED relationship paths to the object that actually
 * owns the terminal field (objectui#4053).
 *
 * A dimension's `field` is either a local field name (`industry`) or a
 * relationship path (`crm_account.industry`, and — per ADR-0071, which the
 * dataset designer emits — `crm_account.owner.department`). Reading the options
 * as `baseSchema.fields[path]` only ever works for the local spelling: for a
 * dotted path the options live on the RELATED object, the lookup missed
 * silently, and the chart fell through to the raw stored enum while the same
 * field as a local dimension rendered its labels beside it.
 *
 * This is the object-resolution step of that ONE lookup, not a dotted-path
 * variant beside it: a single-segment path never enters the walk and resolves
 * exactly as before, so the local path cannot drift away from the joined one.
 *
 * `loadObjectSchema` supplies each hop's object metadata doc — the caller's
 * existing channel (the same `GET /meta/object/:name` read that produced
 * `baseSchema`), so no new fetch layer is introduced. It is memoized per call,
 * because sibling dimensions routinely share a prefix (`crm_account.industry`
 * alongside `crm_account.type` fetches `crm_account` once), and seeded with
 * `baseSchema` under its own `name` so the base is never re-fetched.
 *
 * Best-effort by construction: a hop that is not a relationship, a target that
 * cannot be loaded, or a terminal field that carries no `options` simply yields
 * no entry, and the caller keeps the raw value. Returns `{ fieldPath → options }`
 * for the paths that did resolve.
 *
 * Thin wrapper over {@link resolveDimensionFieldMeta}, which is the same ONE
 * walk keeping the identity of what it found. Callers that translate option
 * labels need that identity (the i18n key is
 * `fieldOptions.<owningObject>.<terminalField>.<value>`, and for a dotted path
 * the owner is the RELATIONSHIP TARGET, not the dataset's base object) — see
 * objectui#4030.
 */
export async function resolveDimensionFieldOptions(
  baseSchema: unknown,
  fieldPaths: Array<string | undefined | null>,
  loadObjectSchema: (objectName: string) => Promise<unknown>,
): Promise<Record<string, unknown>> {
  const meta = await resolveDimensionFieldMeta(baseSchema, fieldPaths, loadObjectSchema);
  const out: Record<string, unknown> = {};
  for (const [path, entry] of Object.entries(meta)) out[path] = entry.options;
  return out;
}

/**
 * What {@link resolveDimensionFieldOptions} found for ONE dimension field path
 * — the options AND the identity of the field they belong to.
 */
export interface DimensionFieldMeta {
  /**
   * The object that OWNS the terminal field: the dataset's base object for a
   * local path, the last relationship's TARGET for a dotted one. `undefined`
   * only when the base schema carries no `name` and the path is local.
   */
  object: string | undefined;
  /** The terminal field's own name — the LAST path segment, never the path. */
  field: string;
  /** The terminal field's `options`, exactly as the metadata doc carries them. */
  options: unknown;
}

/**
 * {@link resolveDimensionFieldOptions} keeping what it walked THROUGH.
 *
 * Same single walk, same best-effort tolerance, same memoized loader — it just
 * returns `{ object, field, options }` per resolved path instead of the options
 * alone. Split out for objectui#4030: applying the locale bundle to a resolved
 * option label needs the key the bundle is written under
 * (`fieldOptions.<object>.<field>.<value>`), and for `crm_account.industry`
 * that object is `crm_account` — the walk already knows it and used to drop it
 * on the floor. Deriving it at the call site would mean re-walking the
 * relationship chain a second time, i.e. two derivations of one fact.
 */
export async function resolveDimensionFieldMeta(
  baseSchema: unknown,
  fieldPaths: Array<string | undefined | null>,
  loadObjectSchema: (objectName: string) => Promise<unknown>,
): Promise<Record<string, DimensionFieldMeta>> {
  const out: Record<string, DimensionFieldMeta> = {};
  const paths = Array.from(new Set((fieldPaths ?? []).filter((p): p is string => !!p)));
  if (paths.length === 0) return out;

  const cache = new Map<string, Promise<unknown>>();
  const baseName = (baseSchema as { name?: unknown } | null | undefined)?.name;
  if (typeof baseName === 'string' && baseName) cache.set(baseName, Promise.resolve(baseSchema));
  const load = (name: string): Promise<unknown> => {
    let hit = cache.get(name);
    if (!hit) {
      // A rejected hop resolves to null rather than throwing, so one unreachable
      // relationship costs its own dimension's labels and not the whole chart's.
      hit = Promise.resolve().then(() => loadObjectSchema(name)).catch(() => null);
      cache.set(name, hit);
    }
    return hit;
  };

  for (const path of paths) {
    const segments = path.split('.');
    let schema: unknown = baseSchema;
    // The object owning the CURRENT schema — walked forward with it, so the
    // terminal field's owner is whatever it holds when the walk ends.
    let owner = typeof baseName === 'string' && baseName ? baseName : undefined;
    let walked = true;
    // Every segment but the last must be a relationship; walk to its target.
    // Hops are sequential by nature — hop N's object is only known once hop
    // N-1 has been read.
    for (let i = 0; i < segments.length - 1; i += 1) {
      const target = resolveRelationshipTarget(fieldDefsOf(schema)?.[segments[i]]);
      if (!target) { walked = false; break; }
      // eslint-disable-next-line no-await-in-loop
      schema = await load(target);
      if (!schema) { walked = false; break; }
      // Prefer the loaded doc's own `name` over the reference's spelling, so a
      // reference written against an alias still keys the bundle canonically.
      const loadedName = (schema as { name?: unknown }).name;
      owner = typeof loadedName === 'string' && loadedName ? loadedName : target;
    }
    if (!walked) continue;
    const field = segments[segments.length - 1];
    const terminal = fieldDefsOf(schema)?.[field] as { options?: unknown } | undefined;
    if (terminal?.options !== undefined) out[path] = { object: owner, field, options: terminal.options };
  }
  return out;
}
