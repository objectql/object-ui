/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * element:record_picker — an interactive element that lets the user pick one
 * record of an object and writes the selection into a page variable.
 *
 * Data binding follows the spec's ElementDataSource (`schema.dataSource`):
 *   { object, view?, filter?, sort?, limit? }
 * with `properties.object` accepted as a fallback. Display config is read off
 * `schema.properties`:
 *   { labelField='name', valueField='id', label?, placeholder?, emptyText? }
 *
 * The selection is written through `usePageVariableBinding(schema.id)`: the
 * page variable whose `source` equals this picker's id receives the selected
 * record's `valueField` (default the record id). With no bound variable the
 * picker is uncontrolled (still usable, just inert) so it never throws outside
 * a Page. The written value drives any predicate referencing `page.<var>`
 * (e.g. another component's `visible` / `visibility`).
 *
 * `view` is resolved through {@link useElementDataSource} rather than read off
 * the binding directly (objectstack#6953). This block used to take `object` /
 * `filter` / `sort` / `limit` off `schema.dataSource` and DROP `view`, so
 * `dataSource: { object: 'account', view: 'hot' }` — the spec's own example —
 * built an unfiltered picker over every account instead of the rows the saved
 * view selects. That symptom is quieter than the one objectstack#5576 fixed on
 * `list-view`: nothing errors, the list is simply WIDER than what was authored,
 * which is exactly the failure an AI-authored page hides best.
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import {
  ElementDataSourceErrorPanel,
  ElementDataSourceLoadingPanel,
  useAdapter,
  useElementDataSource,
  usePageVariableBinding,
} from '@object-ui/react';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import type { I18nLabel } from '@objectstack/spec/ui';
import {
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui';
import { cn } from '../../lib/utils';

function readProps<T extends Record<string, any>>(schema: any): T {
  // Per spec, element components carry their config in `schema.properties`.
  // Tolerate `schema.props` (legacy alias) so JSON written either way works.
  const fromProperties = (schema?.properties ?? {}) as T;
  const fromProps = (schema?.props ?? {}) as T;
  return { ...fromProps, ...fromProperties };
}

function toText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, any>;
    return String(o.label ?? o.name ?? o.title ?? o.en ?? '');
  }
  return String(v);
}

function ElementRecordPickerRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    object?: string;
    labelField?: string;
    valueField?: string;
    // All three are `string | I18nLabel` because that is what the contract says:
    // rc.6 widened the whole trio to the same inline-locale-map union, and the
    // read sites below now RESOLVE the map arm on each, so the declarations and
    // the renderer finally agree (objectui#5590 for `emptyText`, objectui#5637
    // for these two). `label` was `unknown` for as long as it went through
    // `toText`, which accepts anything; it is the contract's union now that it
    // resolves like one.
    label?: string | I18nLabel;
    placeholder?: string | I18nLabel;
    emptyText?: string | I18nLabel;
    filter?: unknown;
    sort?: any;
    limit?: number;
  }>(schema);

  const adapter = useAdapter() as any;

  // Per-element data binding (ElementDataSourceSchema) takes precedence over the
  // flat `properties.object` shorthand. `dataBinding.composed` carries the
  // binding's own keys already combined with the saved view its `view` names —
  // the view supplies the baseline, an explicit binding key overrides it, and
  // `filter` AND-combines because the spec calls the binding's filter
  // *additional*.
  //
  // The picker's OWN adapter is passed rather than left to the hook's context
  // fallback: this block reads its rows from `useAdapter()` (AppShellContext),
  // and resolving `view` against a different source than the one the rows come
  // from could report a view as missing on a host that has it.
  const dataBinding = useElementDataSource(schema, adapter);
  const composed = dataBinding.composed;
  // While a named view is unresolved (or unresolvable) there is no object to
  // query: reading one would fire the wide query the `view` was written to
  // narrow. `undefined` parks the fetch effect below; the render returns a
  // status panel instead.
  const unresolved = dataBinding.status === 'loading' || dataBinding.status === 'missing';
  const object = unresolved ? undefined : (composed?.object ?? props.object);
  const filter = composed?.filter ?? props.filter;
  const sort = composed?.sort ?? props.sort;
  const limit = composed?.limit ?? props.limit ?? 50;
  const labelField = props.labelField ?? 'name';
  const valueField = props.valueField ?? 'id';

  const binding = usePageVariableBinding(schema?.id);
  // Above every early return below, so hook order stays stable across
  // resolution states — same rule as the block comment further down.
  const { language } = useObjectTranslation();

  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const filterKey = React.useMemo(() => (filter ? JSON.stringify(filter) : ''), [filter]);

  React.useEffect(() => {
    let cancelled = false;
    if (!adapter || !object || typeof adapter.find !== 'function') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const query: any = {};
        if (filter) query.$filter = filter;
        if (sort) query.$orderby = sort;
        if (limit) query.$top = limit;
        const res = await adapter.find(object, query);
        const data: any[] = res?.data ?? res?.records ?? (Array.isArray(res) ? res : []);
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, object, filterKey, limit]);

  // Reflect the bound variable's value back into the control. When a variable
  // targets this picker we stay controlled for its whole lifetime (empty string
  // = no selection) so React never warns about an uncontrolled->controlled switch
  // once the first value lands. With no binding the picker is uncontrolled and
  // Radix manages its own state. shadcn Select keys on exact string values, so
  // coerce the id to a string.
  const current = binding?.value;
  const value = binding ? String(current ?? '') : undefined;

  const handleChange = React.useCallback(
    (next: string) => {
      binding?.setValue(next);
    },
    [binding],
  );

  // `label` and `placeholder` are `string | I18nLabel` and both land in a
  // position React refuses to stringify, so both resolve HERE, at their own read
  // site, through the same `pickLocalized` the settled `emptyText` shape below
  // uses (objectui#5637). They failed in two different ways, and only pinning
  // both explains why this is one change:
  //
  //   placeholder={ en, 'zh-CN' }  THREW `Objects are not valid as a React child`
  //   label={ en, 'zh-CN' }        rendered "Owner" — ENGLISH, to a zh-CN viewer
  //   label={ 'zh-CN', ja }        rendered NOTHING — the label element vanished
  //
  // The last two came from `toText`, whose object branch ends
  // `String(o.label ?? o.name ?? o.title ?? o.en ?? '')`. Reaching `o.en`
  // unconditionally is an ENGLISH PICK wearing locale resolution's clothes, and
  // its `?? ''` miss meets the `{label && …}` render site below — so a map that
  // simply omits English DELETED the label element, with nothing thrown and
  // nothing logged.
  //
  // ⛔ `toText` is deliberately not the fix site and is UNCHANGED. It is SHARED
  // with the row values (`toText(row?.[labelField])` below), which are record
  // FIELD VALUES, not `I18nLabel` — teaching it locale resolution would change
  // a second, unrelated call site whose contract is not this one.
  //
  // The placeholder default is applied BEFORE resolution, matching `emptyText`:
  // an absent key still means "Select a record…", and an authored `''` still
  // renders empty because `pickLocalized` passes either string through
  // untouched. `label` takes no default — absent resolves to `''`, which the
  // `{label && …}` site drops exactly as it always did.
  //
  // KNOWN GAP — the `translateLabel` half of this card's ruling is NOT applied
  // here. The sibling `label` read sites compose
  // `translateLabel(pickLocalized(…), language)`, but `translateLabel` and its
  // `KNOWN_LABEL_DICT` are module-private to
  // `renderers/layout/containers.tsx`, which this change's fence marks
  // out-of-scope; reaching them needs either an export from that file or a hoist
  // into a shared module, and `basic/ -> layout/` would be a new dependency
  // between renderer families. Tracked separately (objectui#5637 report).
  const label = pickLocalized(props.label, language);
  const placeholder = pickLocalized(props.placeholder ?? 'Select a record…', language);
  // `emptyText` is `string | I18nLabel`, and its destination is a TEXT NODE, so
  // it resolves through `pickLocalized` — the objectui-side helper the sibling
  // text-node sites read through (`element:text.content`,
  // `element:button.label`, `page:card.title`), which spells a miss as `''`
  // rather than the spec resolver's `undefined`. Before this the map arm was
  // handed to React as a child object, which React REFUSES rather than
  // stringifies: the whole picker subtree threw
  // `Objects are not valid as a React child`, the same pre-fix harm measured
  // for `schema.label` in `inline-locale-label-read-sites.test.tsx`.
  //
  // The default is applied BEFORE resolution so `?? 'No records'` keeps meaning
  // exactly what it meant (absent → default) and an authored `''` still renders
  // empty — `pickLocalized` passes either string through untouched.
  const emptyText = pickLocalized(props.emptyText ?? 'No records', language);

  // Placed AFTER every hook above so the hook order stays stable across
  // resolution states. A `view` that names nothing renders a configuration
  // error rather than an unfiltered picker: degrading to "all records" turns a
  // typo into a silently wider answer on a page that still looks like it works.
  if (dataBinding.status === 'missing') {
    return (
      <ElementDataSourceErrorPanel
        testId="record-picker"
        title="This record picker’s data source could not be resolved"
        message={dataBinding.error}
      />
    );
  }
  if (dataBinding.status === 'loading') {
    return <ElementDataSourceLoadingPanel testId="record-picker" />;
  }

  // `label`'s association with the trigger is wired the same way
  // `element:text_input` wires its own `label`/control pair (objectui#5735):
  // `htmlFor` on the label names `schema?.id`, and that same id lands on the
  // CONTROL — here `SelectTrigger`, a `button` with `role="combobox"` and
  // therefore labelable, so a plain `htmlFor`/`id` pair is the correct
  // association with no `aria-labelledby` needed (Radix sets none on the
  // trigger; objectui#3341's landed reasoning transfers verbatim). Only the
  // author can supply `schema.id`, so — exactly as on `text_input` — the
  // wiring can only hold when they did; with no `schema.id` the label renders
  // as unassociated caption text, same as before this change, rather than
  // reaching for a `useId()` fallback that would always name the control
  // (objectui#5771 — deliberately following #5735's answer to the same
  // question on its complement block, not re-opening it).
  return (
    <div
      className={cn('space-y-1.5', schema?.className)}
      data-testid="record-picker"
      data-picker-id={schema?.id}
    >
      {label && (
        <Label htmlFor={schema?.id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={loading || !!error || !object}
      >
        <SelectTrigger
          id={schema?.id}
          className="w-full max-w-xs"
          data-testid="record-picker-trigger"
        >
          <SelectValue
            placeholder={loading ? 'Loading…' : error ? 'Failed to load' : placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {rows.map((row, i) => {
            const v = row?.[valueField];
            const key = v == null ? String(i) : String(v);
            return (
              <SelectItem key={key} value={key}>
                {toText(row?.[labelField]) || key}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {!loading && !error && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

ComponentRegistry.register('record_picker', ElementRecordPickerRenderer, {
  namespace: 'element',
  skipFallback: true,
  label: 'Record Picker',
  category: 'input',
  // `filter` is DECLARED, not merely honoured (objectui#3830) — the fourth key
  // of objectui#3808's A class, which that issue's own three-way triage dropped
  // between the raw key dump and the lists. The renderer has read it all along
  // (`composed?.filter ?? props.filter` above, into `query.$filter`), and the
  // spec declares it (`ElementRecordPickerProps.filter`), but while it was
  // missing from this list every layer that reads a manifest said the opposite:
  // `element:record_picker` is not in `PUBLIC_BLOCKS` ("record picking is a
  // field widget, not a page block"), so the gap was not in `sdui.manifest.json`
  // — it was in the JSX-page compiler's prop whitelist, which
  // `renderers/layout/page.tsx` builds from `getKnownTypes()` plus these same
  // `inputs`. A JSX page writing `filter` got an `unknown-prop` warning from
  // `sdui-parser/src/validate.ts` on a key the renderer then went on to filter
  // by. That is objectui#3407 in the same shape as `readonly` — honoured,
  // undiscoverable — and the reverse half of the parity gate in
  // `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`, whose
  // explicit exemption for this key is deleted by the same change.
  inputs: [
    { name: 'object', type: 'string', label: 'Object' },
    {
      name: 'filter',
      // `'object'` is the spec's shape, not a chosen arm. `filter` is
      // `FilterConditionSchema.optional()`, and that schema is
      // `z.record(z.string(), z.unknown()).and(z.object({ $and, $or, $not }))`
      // — a plain object. `checkType`'s `'object'` case in
      // `sdui-parser/src/validate.ts` accepts exactly what the spec accepts
      // here (a non-null non-array object) and rejects exactly what it rejects
      // (arrays, strings, numbers, booleans — all verified against
      // `ElementRecordPickerPropsSchema.safeParse` in the parity test next to
      // this file). So this is the one case in the family where the coarse
      // vocabulary lines up with the contract exactly as declared: one arm, no
      // union to spell and nothing for the description to make up for. Contrast
      // `element:text_input.defaultValue`, whose `string | number` needs two
      // arms (objectui#3832), and `emptyText` below, which declares two for the
      // same reason once its render site learned to resolve both
      // (objectui#5590).
      type: 'object',
      label: 'Filter',
      // Taken from what the renderer DOES with the key, because the one thing
      // an author cannot read off the spec is which of the two places they may
      // write a filter actually wins.
      description:
        'Filter criteria narrowing which records the picker offers, as a spec FilterCondition object — `{ status: "open" }`, or `{ $and: [ … ] }` for a group. It becomes the `$filter` of the picker\'s own query, so it decides which records exist for the user, not merely how they are shown. PRECEDENCE: a node-level `dataSource` binding wins outright. The renderer reads `dataSource.filter ?? filter`, so when the binding — or the saved view its `view` names, which AND-combine with each other because the spec calls the binding\'s filter *additional* — supplies a filter, THIS key is dropped entirely rather than merged into it; it applies only when the node carries no `dataSource`, or that `dataSource` and its view both leave `filter` unset. A rule ARRAY (an ObjectQL AST, or a view\'s rule list) is not a FilterCondition and the spec rejects it here.',
    },
    { name: 'labelField', type: 'string', label: 'Label Field' },
    { name: 'valueField', type: 'string', label: 'Value Field' },
    {
      name: 'placeholder',
      // TWO arms, declared in the change that makes the second one render — the
      // order `emptyText` below established and `packages/types`'
      // `ComponentInput.type` doc prescribes. The contract has been
      // `string | Record< string, string >` since rc.6 widened this key to the
      // same `I18nLabel` union it widened the rest of the trio to; this entry
      // held one arm only because the renderer handed the map straight to
      // `SelectValue`, where React REFUSED it rather than stringifying it. The
      // read site resolves it now (`pickLocalized`, above), so withholding the
      // object arm would be the opposite defect — `type-mismatch` reported on a
      // legal write this input's own description teaches (objectui#5637).
      type: ['string', 'object'],
      label: 'Placeholder',
      description:
        'Prompt shown in the closed control while no record is selected (renderer default "Select a record…"). Display-only — it never reaches the query. Accepts either a plain string or an inline per-locale map (`{ en: "Owner", "zh-CN": "负责人" }`), the `I18nLabel` union rc.6 widened this key to; the renderer resolves the map against the active language at the read site, falling back through base language, a region-qualified sibling, `default`, then `en`. It is REPLACED while the picker is busy: "Loading…" during the fetch and "Failed to load" after an error both win over this key. An authored empty string stays empty; the default applies only when the key is absent.',
    },
    {
      name: 'label',
      // TWO arms, same reason and same ordering rule as `placeholder` above.
      // This key's pre-fix failure was the quieter one: it went through the
      // file's local `toText`, whose `o.en` fallback rendered ENGLISH to every
      // viewer and whose `?? ''` miss made a map without an `en` entry delete
      // the label element outright. Declaring the object arm while that was true
      // would have advertised a shape that reached the screen wrong or not at
      // all; the read site resolves it now (objectui#5637).
      type: ['string', 'object'],
      label: 'Label',
      description:
        'Caption rendered above the picker, in a `<label>` element — tied to the control by `htmlFor` when the node carries an `id`, so clicking it focuses the picker and the text becomes the combobox’s accessible name (objectui#5771). Display-only — it never reaches the query, and it is OMITTED entirely when the key is absent or resolves to an empty string. Accepts either a plain string or an inline per-locale map (`{ en: "Owner", "zh-CN": "负责人" }`), the `I18nLabel` union rc.6 widened this key to; the renderer resolves the map against the active language at the read site, with the same fallback chain as `placeholder`. Distinct from `labelField`, which names the RECORD field each offered row is titled by.',
    },
    // ── sort / limit / emptyText — declared on the rc.6 bump (objectui#4167) ──
    // `@objectstack/spec` 17.0.0-rc.6 lands objectstack#5775's other half: these
    // three arrive as newly DECLARED keys on `ElementRecordPickerProps`, and the
    // reverse direction of the parity gate went red demanding them the moment
    // the pin moved. That red was predicted, in writing, by the exemption that
    // covered the retired trio ("`sort` / `limit` / `emptyText` … become
    // brand-new A-class gaps, and this gate will go RED demanding them. That red
    // is correct and wanted"). All three were already READ here before they were
    // declared anywhere, which is the objectui#3407 shape — honoured, and
    // undiscoverable to every layer that reads a manifest.
    {
      name: 'sort',
      // `'array'` is the spec's shape, not a chosen arm: `sort` is
      // `z.array(z.object({ field, order: 'asc'|'desc' })).optional()`. Verified
      // against `ElementRecordPickerPropsSchema.safeParse` — the array of
      // `{ field, order }` parses, and the terse string spelling `'name asc'`
      // does NOT, which is worth saying in the description because it is the
      // form an author is most likely to reach for.
      type: 'array',
      label: 'Sort',
      description:
        'Row order, as an array of `{ field, order }` entries — `[{ field: "name", order: "asc" }]`. It becomes the `$orderby` of the picker\'s own query, so it decides the order records are offered in. `order` is `asc` or `desc`; the terse string form (`"name asc"`) is not accepted by the contract. PRECEDENCE: identical to `filter` above and for the same reason — the renderer reads `dataSource.sort ?? sort`, so a node-level `dataSource` binding (or the saved view its `view` names) REPLACES this key outright rather than merging with it; it applies only when the node carries no `dataSource`, or that `dataSource` and its view both leave `sort` unset.',
    },
    {
      name: 'limit',
      type: 'number',
      label: 'Limit',
      description:
        'Maximum number of records the picker offers, as a whole number. It becomes the `$top` of the picker\'s own query, so it bounds what the user can choose from rather than how the list is displayed — a record outside the limit cannot be picked at all, and the control gives no sign that more exist. DEFAULT: 50 when neither this nor `dataSource.limit` is set, applied by the renderer (`record-picker.tsx:107`), not by the schema. PRECEDENCE: `dataSource.limit ?? limit ?? 50` — a node-level binding wins outright.',
    },
    {
      name: 'emptyText',
      // TWO arms, and the order in which they were earned is the point. The
      // contract has been `string | Record< string, string >` since rc.6 widened
      // it to the same `I18nLabel` union it widened everywhere else, and since
      // objectui#3832 this entry could spell that union — but it deliberately
      // did NOT, because THIS RENDERER passed the value straight into a text
      // node with no locale resolution, and declaring an arm the renderer drops
      // advertises a shape that never reaches the screen. That narrowing was
      // correct for exactly as long as it was true. objectui#5590 made the
      // render site resolve the map (`pickLocalized`, above), so the second arm
      // is now a shape that DOES reach the screen and withholding it would be
      // the opposite defect — the gate reporting `type-mismatch` on a legal
      // write its own description teaches. Same resolution as
      // `element:text_input.defaultValue`, `element:text.content` and
      // `element:button.label`: declare the arm in the change that makes it
      // render, never before and never after.
      type: ['string', 'object'],
      label: 'Empty Text',
      description:
        'Text shown in place of the row list when the query returns no records (renderer default "No records", `record-picker.tsx:213`). Unlike `filter` / `sort` / `limit` this is display-only — it never reaches the query, and a node-level `dataSource` binding does not override it. Accepts either a plain string or an inline per-locale map (`{ en: "None", "zh-CN": "无记录" }`) — the `I18nLabel` union rc.6 widened this key to — and the renderer resolves the map against the active language at the read site, falling back through base language, `default`, then `en`. An authored empty string stays empty; the "No records" default applies only when the key is absent.',
    },
  ],
});

export { ElementRecordPickerRenderer };
