/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry, resolveFieldRuleState, evalFieldPredicate, resolveCascadingOptions, CASCADE_OPTION_WIDGET_TYPES, EXPANDABLE_FIELD_TYPES, isValueStillOffered, isMissingForRequired, isServerOwnedValue } from '@object-ui/core';
import type { FormSchema, FormField as FormFieldConfig, FormFieldTab, FormFieldPane, FieldValidationRules, FieldCondition, SelectOption } from '@object-ui/types';
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '../../ui/form';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Switch } from '../../ui/switch';
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '../../ui/select';
import { renderChildren } from '../../lib/utils';
import { toControlValue, matchOptionValue, type OptionValue } from './option-value';
import { RHF_RECOGNIZED_RULE_KEYS } from './validationRuleKeys';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../../custom/resizable';
import { Alert, AlertDescription } from '../../ui/alert';
import { toast } from '../../ui/sonner';
import { AlertCircle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
// The fullscreen long-text affordance, dialog and draft/commit state machine
// (objectui#3398). The icons and the `Dialog` family that used to be imported
// here belonged to the hand-written copy this branch no longer carries.
import { FullscreenEditor } from '../../custom/fullscreen-editor';
import { cn } from '../../lib/utils';
import React from 'react';
import { SchemaRendererContext, usePredicateScope, isPermissionError, extractWriteErrorMessage, extractFieldErrors } from '@object-ui/react';
import { createSafeTranslation } from '@object-ui/i18n';

/** Inline section header rendered as a virtual field inside a flat SchemaRenderer field list.
 *  Collapsibility is controlled externally (collapsed state lives in DrawerForm). */
function SectionDivider({ label, description, collapsible, collapsed, onToggle, className }: {
  label?: string;
  description?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  if (!label && !description) return null;
  return (
    <div
      className={cn(
        'col-span-full pt-4 pb-1 border-b border-border',
        collapsible && 'cursor-pointer select-none',
        className
      )}
      onClick={collapsible ? onToggle : undefined}
      role={collapsible ? 'button' : undefined}
      aria-expanded={collapsible ? !collapsed : undefined}
    >
      {label && (
        <div className="flex items-center gap-1.5">
          {collapsible && (
            collapsed
              ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
      )}
      {/* A section's authored blurb. Carried on the divider because a sectioned
          form is ONE form with inline headers — there is no per-section wrapper
          left to render it (see FormSchema.fieldTabs / objectui#2959). */}
      {description && (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Field name → config, first declaration wins. */
function indexFieldsByName(fields: FormFieldConfig[]): Map<string, FormFieldConfig> {
  const byName = new Map<string, FormFieldConfig>();
  for (const f of fields) if (f?.name && !byName.has(f.name)) byName.set(f.name, f);
  return byName;
}

/**
 * The form's fields that no layout group claimed. `fieldTabs` / `fieldPanes` are
 * authored against field NAMES, so a field the author forgot to mention must
 * still render (above the group) instead of silently disappearing.
 */
function unclaimedFields(
  groups: Array<{ fields: FormFieldConfig[] }>,
  fields: FormFieldConfig[],
): FormFieldConfig[] {
  const claimed = new Set<string>();
  for (const group of groups) for (const f of group.fields) claimed.add(f.name);
  return fields.filter((f) => f?.name && !claimed.has(f.name));
}

/**
 * Pane sizes in the JSON protocol are percentages (spec `splitSize`). react-resizable-panels
 * documents a NUMERIC size as pixels and an unsuffixed STRING as a percentage —
 * in practice v4 resolves both the same way, but the string says which unit we
 * mean, so the intent survives a library change.
 */
const panePercent = (size: number | undefined): string | undefined =>
  typeof size === 'number' && Number.isFinite(size) ? String(size) : undefined;

const useSafeFormTranslation = createSafeTranslation(
  {
    'common.selectOption': 'Select an option',
    // objectui#3272 — the action bar's button copy when the schema authored no
    // `submitLabel` / `cancelLabel`. Deliberately the SHARED `common.*` keys
    // rather than new `form.*` twins: "Submit" and "Cancel" are the same words
    // the rest of the console already ships in ten packs, and a second copy of
    // a one-word string is exactly the drift #3231/#3263 had to undo. The
    // defaults here are byte-identical to the English literals they replaced,
    // so a form with no I18nProvider renders what it always did.
    'common.submit': 'Submit',
    'common.cancel': 'Cancel',
    // objectui#3272 — the fullscreen long-text editor (`mobile_fullscreen`).
    // A whole dialog, not a word: title, its sr-only description, the footer's
    // confirm button, and the trigger's accessible name. `Cancel` in the footer
    // reuses `common.cancel` above for the same reason.
    'form.fullscreen.title': 'Edit text',
    'form.fullscreen.description': 'Edit the full text value, then save or cancel your changes.',
    'form.fullscreen.done': 'Done',
    // The trigger's accessible name keeps the literal's shape —
    // `Edit ${label ?? 'text'} fullscreen` — as ONE sentence with a
    // TRANSLATED generic noun standing in for a missing label. The obvious
    // alternative (a second, label-less sentence key) would ship dead in all
    // ten packs: `label` is destructured off the field config before
    // `...fieldProps`, so the only caller never forwards it and the labelled
    // limb is unreachable today (filed separately). Interpolating a
    // translated noun keeps BOTH keys on the live path while leaving the
    // limb's fate to that issue.
    'form.fullscreen.toggle': 'Edit {{label}} fullscreen',
    'form.fullscreen.textFallback': 'text',
    // objectui#3231 — the dependency-gate sentence (#2284). Shared with the
    // option widgets' own fallback so both sides render one wording.
    'fields.options.selectFirst': 'Select {{fields}} first',
    // objectui#3263 — the built-in `select` branch's own empty copy. Same key
    // as the option widgets' fallback (`packages/fields`), so an empty option
    // list reads identically whichever render path produced it. The default
    // here is what a form with no I18nProvider renders — byte-identical to the
    // English literal this replaced.
    'fields.options.empty': 'No options available',
    'validation.required': '{{field}} is required',
    'validation.minLength': '{{field}} must be at least {{min}} characters',
    'validation.maxLength': '{{field}} must be at most {{max}} characters',
    'validation.min': '{{field}} must be at least {{min}}',
    'validation.max': '{{field}} must be at most {{max}}',
    'validation.pattern': '{{field}} format is invalid',
    'validation.email': 'Please enter a valid email address',
    'validation.url': 'Please enter a valid URL',
    'validation.formInvalid': 'Please check the highlighted fields: {{fields}}',
    // objectstack#5407 — the joiner between the field names is a LOCALE
    // property, not a code constant. It used to be a hardcoded `、` (U+3001),
    // which is right for zh/ja and wrong everywhere else — including `en`,
    // where the toast read "Subject、Account、Status". A locale that ships no
    // entry falls back through i18next to `en`'s ", ".
    'validation.formInvalidJoiner': ', ',
    'errors.forbidden': 'Access denied.',
    'form.noPermissionToSave': "You don't have permission to save this record.",
    'form.submitFailed': 'Could not save. Please try again.',
  },
  'common.selectOption',
);

// --- Dirty detection -------------------------------------------------------
// react-hook-form's `isDirty` compares current values against `defaultValues`
// by strict identity, which produces false positives on a freshly opened form:
// several field widgets normalize their empty state on mount (e.g. '' -> null,
// undefined -> '', a cleared lookup -> null), and `null !== undefined` makes
// RHF flag an untouched create form as dirty. That made the discard-guard pop
// its "unsaved changes?" prompt even when the user typed nothing. We instead
// compute dirtiness ourselves with a comparison that treats all empty-ish
// values as equivalent, so only a genuine edit (empty <-> meaningful, or one
// meaningful value -> another) counts.
const isEmptyish = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0);

const valuesEqualForDirty = (a: unknown, b: unknown): boolean => {
  if (isEmptyish(a) && isEmptyish(b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};

/** Own-property test — a field can legitimately be named `constructor`. */
const hasOwn = (o: Record<string, unknown>, k: string): boolean =>
  Object.prototype.hasOwnProperty.call(o ?? {}, k);

const computeDirty = (
  baseline: Record<string, unknown>,
  values: Record<string, unknown>,
): boolean => {
  const keys = new Set([
    ...Object.keys(baseline ?? {}),
    ...Object.keys(values ?? {}),
  ]);
  for (const k of keys) {
    if (!valuesEqualForDirty(baseline?.[k], values?.[k])) return true;
  }
  return false;
};

/**
 * Widget types that render a two-state control, whose empty state IS `false`
 * (see the `defaultValues` seeding below). Covers the bare builtin spellings
 * and the registry ids `mapFieldTypeToFormType` produces for the object-schema
 * `boolean` / `toggle` types (both → `field:boolean`).
 */
const BOOLEAN_WIDGET_TYPES = new Set([
  'checkbox', 'switch', 'boolean', 'toggle',
  'field:boolean', 'field:switch', 'field:checkbox',
]);

/**
 * Which control a field row will render as — the same precedence
 * `resolvedType` applies further down (explicit form-config `widget`, then the
 * resolved field metadata's own widget hint, then the bare `type`).
 */
const resolveWidgetType = (f: any): string => f?.widget || f?.field?.widget || f?.type;

const BUILTIN_FIELD_TYPES = new Set(['input', 'textarea', 'checkbox', 'switch', 'select']);

/**
 * Fields whose unrecognized validation-rule names were already reported, keyed
 * by field name + the sorted offending keys. Module-level for the same reason
 * as `basic/div.tsx`'s `_warnedDeprecations`: `rawFields` is a caller-owned
 * prop, and a schema-driven caller that rebuilds the array per render re-runs
 * the reporting effect every render — a diagnostic that repeats forever gets
 * muted by the very reader the message is written for (objectui#3965 measured
 * ~190 identical notices burying the real errors).
 */
const _reportedUnrecognizedRules = new Set<string>();

/**
 * Report a field's unrecognized validation-rule names ONCE per module load,
 * dev builds only (#5099's "dev-time error" limb — a customer's production
 * console is not the audience).
 *
 * Same shape as `warnDeprecatedOnce` in `basic/div.tsx` / `basic/span.tsx`,
 * and order matters the same way there and here: the production check returns
 * BEFORE the seen-set is marked, so a production render never suppresses the
 * dev notice. The memo includes the offending keys, not just the field name —
 * metadata that grows a NEW bad rule after the first report must still shout.
 */
function reportUnrecognizedRulesOnce(fieldName: string, unrecognized: string[]): void {
  if (process.env.NODE_ENV === 'production') return;
  const memo = `${fieldName}::${[...unrecognized].sort().join(',')}`;
  if (_reportedUnrecognizedRules.has(memo)) return;
  _reportedUnrecognizedRules.add(memo);
  // The message doubles as the fix instruction — it is what an agent
  // iterating on the metadata will read and follow.
  console.error(
    `[object-ui] form field '${fieldName}': validation rule(s) ${unrecognized
      .map((k) => `'${k}'`)
      .join(', ')} are not rules react-hook-form runs — the field renders, but these rules ` +
      `validate NOTHING. Recognized rules: ${[...RHF_RECOGNIZED_RULE_KEYS].join(', ')}. ` +
      `Check the spelling (\`minLength\`, not \`minlength\`); express email/url checks as a ` +
      `\`pattern\` whose \`value\` is a RegExp; and declare \`validation\` as an OBJECT — ` +
      `spreading an array leaves numeric keys that run nothing.`,
  );
}
/**
 * Widget-hint pickers that resolve records / object catalogs and read sibling
 * field values — they need `dataSource` and `dependentValues` threaded exactly
 * like a lookup does, but they are NOT declarable field types: they are reached
 * only through a `widget:` hint (`widgetHintOnly: true` in
 * `app-shell/src/utils/paramValueShape.ts`), so no object schema can produce a
 * field whose `type` is one of them.
 *
 * This is the ONLY form-specific half of the data-source rule; the other half
 * is the shared reference-bearing family — see {@link needsDataSourceWiring}.
 *
 * `capability-multiselect` was listed here until objectui#3308 retired the
 * widget name (ADR-0049 enforce-or-remove): no producer stamped the hint and
 * `field:capability-multiselect` was never registered on the live path, so the
 * entry could never match a resolvable widget.
 */
const DATA_SOURCE_ONLY_WIDGET_TYPES = new Set([
  'object-ref', 'filter-condition', 'recipient-picker',
]);

/**
 * Whether this widget key receives `dataSource` / `dependentValues` /
 * `dependsOnLabels` — i.e. whether the control it renders has to QUERY records
 * to do its job.
 *
 * The reference-bearing half is not restated here: it is
 * `EXPANDABLE_FIELD_TYPES`, the one relational-field family in
 * `@object-ui/core` that the `$expand` builder and predicate-record projection
 * already read. This renderer held a private copy of it
 * (`DATA_SOURCE_FIELD_TYPES`) until objectui#4790, whose TSDoc on the core side
 * claimed the two "mirror" each other; by then they had drifted apart in both
 * directions — `user` only in core, the three picker names only here — and the
 * gap was live, not theoretical: a `user` field got NONE of the three props.
 * `dataSource` and `dependentValues` each have a `SchemaRendererContext`
 * fallback inside the widget so the picker limped along, but `dependsOnLabels`
 * has none, so a dependent user picker interpolated raw API names into its
 * "select … first" hint — the very leak objectstack#5407 fixed for lookups.
 * The widget contract has always named `user` among the types this renderer
 * injects `dataSource` for (`fields/src/widgets/types.ts`).
 *
 * Members are WIDGET keys — `normalizeFieldType` output, the `field:` prefix
 * stripped — and they coincide with the core set's schema-type spellings
 * because `mapFieldTypeToFormType` maps each reference type onto a same-named
 * widget id (`lookup` → `field:lookup`, `user` → `field:user`, …). The one
 * exception is `tree`, which maps to `field:lookup` and so reaches this test as
 * `lookup`; the `tree` member is therefore inert on the object-schema path and
 * matches only a hand-authored `type: 'tree'`. It stays because the core set is
 * defined over SCHEMA types, where `tree` is a real reference type.
 */
function needsDataSourceWiring(widgetType: string): boolean {
  return (
    EXPANDABLE_FIELD_TYPES.has(widgetType) ||
    DATA_SOURCE_ONLY_WIDGET_TYPES.has(widgetType)
  );
}

// Option fields (`select`/`radio`/`multiselect`/`checkboxes`) support per-option
// `visibleWhen` cascading + `dependsOn` gating (#2284/#1583): the widget re-filters
// its OFFERED set against the live form record (`record.country == 'cn'` …). They
// take no `dataSource`, but they DO need the live `dependentValues` record —
// without it a cascading select never sees its controlling field and stays
// permanently gated on the "select the parent first" hint. The set itself is
// `CASCADE_OPTION_WIDGET_TYPES`, imported from `@object-ui/core` above: this
// form, the action dialog and the bulk dialog feed one evaluator and must read
// one allow-table (objectui#4770 — until then each held a private copy).

function stripRendererOnlyProps<T extends Record<string, any>>(props: T): T {
  const {
    dataSource: _dataSource,
    inputType: _inputType,
    options: _options,
    field: _field,
    schema: _schema,
    showActions: _showActions,
    fieldContainerClass: _fieldContainerClass,
    mobileStickyActions: _mobileStickyActions,
    mobile_fullscreen: _mobileFullscreen,
    dependentValues: _dependentValues,
    dependsOn: _dependsOn,
    // objectstack#5407 — the sibling name→label map is for widgets that NAME a
    // controlling field in their own copy (the lookup gate hint). No builtin
    // branch renders such copy, and an object-valued prop reaching a DOM node
    // is a React warning, so it is stripped here exactly like `dependentValues`.
    dependsOnLabels: _dependsOnLabels,
    emptyHint: _emptyHint,
    // The field's own label (objectui#3393). It is forwarded from the single
    // call site for ONE reader — the built-in `textarea` branch's fullscreen
    // dialog, which names the field in its title and in the expand button's
    // accessible name — and is renderer-only everywhere else: `<FormLabel>`
    // above already renders it, and every other built-in branch spreads its
    // leftover props straight onto a DOM node, where `label` would show up as
    // a stray `label="Notes"` attribute on an `<input>` / `<textarea>` /
    // Radix control. The `textarea` branch therefore reads it off the
    // PRE-strip props, exactly like `mobile_fullscreen`.
    label: _label,
    // The validation message (objectui#3222) is for REGISTERED widgets, which
    // need it to put `aria-invalid` on the control they render. The builtin
    // branch below renders its control directly inside `<FormControl>`, whose
    // Slot already injects `aria-invalid` / `aria-describedby` — so here the
    // prop has no reader and would only reach the DOM as a stray `error="…"`
    // attribute.
    error: _error,
    ...domProps
  } = props;

  return domProps as T;
}

/** Serialize a JS value as a CEL literal (string / number / bool / list / null). */
function celLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  const t = typeof v;
  if (t === 'string') return JSON.stringify(v);
  if (t === 'number' || t === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(celLiteral).join(', ')}]`;
  return JSON.stringify(String(v));
}

/**
 * Translate the legacy `FormField.condition` shape
 * (`{ field, equals?/notEquals?/in? }`) into an equivalent CEL visible-when
 * predicate, so it evaluates on the canonical engine like every other
 * conditional rule (issue #1584 / ADR-0036) instead of a bespoke JSON branch.
 * The present sub-conditions are AND-ed (matching the legacy "hide unless all
 * clauses hold"); returns `null` when there is nothing to gate on.
 */
function legacyConditionToCel(condition: FieldCondition | undefined): string | null {
  if (!condition || !condition.field) return null;
  const ref = `record[${JSON.stringify(condition.field)}]`;
  const clauses: string[] = [];
  if (condition.equals !== undefined) clauses.push(`${ref} == ${celLiteral(condition.equals)}`);
  if (condition.notEquals !== undefined) clauses.push(`${ref} != ${celLiteral(condition.notEquals)}`);
  if (Array.isArray(condition.in)) clauses.push(`${ref} in ${celLiteral(condition.in)}`);
  return clauses.length > 0 ? clauses.join(' && ') : null;
}

function normalizeFieldType(type: string): string {
  return type.startsWith('field:') ? type.slice('field:'.length) : type;
}

/**
 * How this field's label must be associated with what the widget renders
 * (`ComponentMeta.labelling`, objectui#3961) — `'control'` for a labelable
 * element (plain `<label for>`), `'group'` for a composite container or another
 * non-labelable control (`aria-labelledby` by IDREF).
 *
 * The DECLARATION is authoritative; this function only resolves WHOSE
 * declaration applies, and it mirrors `renderFieldComponent`'s resolution
 * exactly so producer and consumer cannot disagree about which component will
 * actually render:
 *
 *  - the builtin test is on the RAW type, exactly as there: a bare `select`
 *    renders the builtin `<Select>` branch and the registry is never consulted,
 *    while a `field:`-qualified `field:select` DOES resolve to the registered
 *    widget. Normalizing before this test would let a widget's declaration
 *    re-address the label of a builtin that renders in its place;
 *  - only then is the `field:` prefix stripped, to the key `getMeta` stores.
 *
 * Anything undeclared — third-party widgets, bare-name SDUI components, an
 * unregistered type — resolves to `'control'`: the single-control path, byte for
 * byte what this renderer emitted before the declaration existed.
 */
function resolveFieldLabelling(type: string): 'control' | 'group' | 'display' {
  if (BUILTIN_FIELD_TYPES.has(type)) return 'control';
  const declared = ComponentRegistry.getMeta(normalizeFieldType(type), 'field')?.labelling;
  return declared === 'group' || declared === 'display' ? declared : 'control';
}

/**
 * Does this type render a REGISTERED FIELD WIDGET (objectui#4788)?
 *
 * Mirrors `renderFieldComponent`'s resolution the same way
 * `resolveFieldLabelling` mirrors it, and for the same reason: the answer
 * decides whether the host wraps the output, so producer and consumer must not
 * be able to disagree about which component actually renders.
 *
 *  - a builtin name is decided on the RAW type and never consults the registry;
 *  - a bare name resolves through the `field:` namespace;
 *  - a colon-qualified type resolves directly, and is a FIELD widget only when
 *    it names the `field` namespace — the bare-name fallback (`alert`, `badge`,
 *    the display `text` widget) implements the universal `schema` contract, not
 *    `FieldWidgetComponentProps`, and is deliberately left alone.
 */
function resolvesToRegisteredFieldWidget(type: string): boolean {
  if (BUILTIN_FIELD_TYPES.has(type)) return false;
  if (type.includes(':')) {
    return type.startsWith('field:') && !!ComponentRegistry.get(type);
  }
  return !!ComponentRegistry.get(`field:${type}`);
}

/**
 * The container a registered field widget's replacement-display output is
 * wrapped in, so the field's visible label NAMES and its visible help text
 * DESCRIBES the surface that replaced the control (objectui#4788, maintainer
 * ruling of 2026-08-16 — option E of the measured option set). Reached two
 * ways: a READONLY registered widget (#4788's original gate, unchanged), and —
 * since objectui#4857 — a widget declared `labelling: 'display'`, whose whole
 * surface is such a display in every state (`formula` / `summary` /
 * `auto_number` / `vector`), so the wrapper applies in the editable state too.
 * The `data-slot` keeps its original name: what this container wraps is a
 * read-only display either way, whatever the form's own mode.
 *
 * ## What was broken
 *
 * A widget's readonly branch renders a REPLACEMENT DISPLAY — a `mailto:` anchor,
 * a formatted span, a chip row, a preview table — and returns before its
 * `toDomProps` spread, so not one prop the host handed down reaches an element.
 * Measured on `origin/main` at `1ef236e18`, a real form + bare registration, one
 * field per row, `description` set, counting the elements whose
 * `aria-describedby` names the rendered `<FormDescription>`:
 *
 * ```
 *                       readonly                                      editable
 * text      for=DANGLING hostIdEl=NONE consumers=0    for=RESOLVES-LABELABLE hostIdEl=input  consumers=1
 * boolean   for=DANGLING hostIdEl=NONE consumers=0    for=RESOLVES-LABELABLE hostIdEl=switch consumers=1
 * email     for=DANGLING hostIdEl=NONE consumers=0    for=RESOLVES-LABELABLE hostIdEl=input  consumers=1
 * formula   for=DANGLING hostIdEl=NONE consumers=0    for=DANGLING           hostIdEl=NONE   consumers=0
 * …(33 registered non-group-labelled types, every readonly row identical)
 * ```
 *
 * `hostIdEl=NONE` is the load-bearing reading: in the readonly state the
 * `…-form-item` id is on NO element in the document, so the visible label's
 * `for` pointed at nothing and the readonly surface had no accessible name at
 * all. That is a whole step worse than objectui#3990's family, where the label
 * at least published an id nobody consumed.
 *
 * ## Why the host, and not the 33 widgets
 *
 * Every widget-side variant needs each author to remember one more spread, and
 * the measurement showed exactly how such a fix goes silently wrong: an
 * `aria-labelledby` on a role-less `span` / `div` names NOTHING (`generic`
 * prohibits an author name), while `toHaveAccessibleName()` in jsdom answers
 * PASS for it — a ghost fix that ships green tests. Landing the mechanism once,
 * here, makes the 33 current widgets and any future third-party one correct by
 * construction: there is no "remember to spread" entry point left.
 *
 * ## The shape
 *
 * `<FormControl>` is a Radix `Slot`, so it injects the field's `id` /
 * `aria-describedby` / `aria-invalid` into THIS element instead of the widget's
 * root, and the widget below renders exactly the markup it rendered before.
 *
 *  - `role="group"` — the same semantic claim objectui#3990 established for the
 *    seven composite surfaces. It is what makes the name and the description
 *    land at all, and it does not promise the interactivity `textbox` would.
 *  - `aria-labelledby="<labelId> <hostId>"` — the label's id AND this element's
 *    own. `group` is not a name-from-content role, so the self-reference is what
 *    keeps the VALUE in the accessible name: an `email` field reads
 *    `"Email user@example.com"` rather than dropping the address that is the
 *    only thing on screen. (accname §2F: a node reached through
 *    `aria-labelledby` is named from its contents whatever its role.)
 *  - `aria-describedby` — forwarded as the Slot handed it down. A group is a
 *    description carrier under ARIA 1.2 with no focusable control required,
 *    which is the objectui#4005 reasoning applied to a second surface.
 *  - `aria-invalid` — DROPPED. It is control-channel state: it reports what a
 *    user's own editing may do wrong, to the element they would edit. A
 *    readonly display cannot be edited and cannot be made invalid by the person
 *    reading it. Same boundary objectui#3291 / objectui#3318 / objectui#4005
 *    drew, pinned from both sides in the tests.
 *
 * `aria-required` never reaches here at all — it rides the widget props, exactly
 * as before, for the same reason.
 */
type ReadonlyFieldGroupProps = {
  /** The id `<FormLabel>` published in place of its `for`. */
  labelId: string;
  children: React.ReactNode;
  /** Injected by `<FormControl>`'s Slot: the host control id (`…-form-item`). */
  id?: string;
  /** Injected by `<FormControl>`'s Slot: `<FormDescription>` (+ `<FormMessage>`). */
  'aria-describedby'?: string;
  /** Injected by `<FormControl>`'s Slot, and deliberately consumed here — see above. */
  'aria-invalid'?: boolean | 'true' | 'false';
};

const ReadonlyFieldGroup = React.forwardRef<HTMLDivElement, ReadonlyFieldGroupProps>(
  function ReadonlyFieldGroup(
    { labelId, children, id, 'aria-describedby': describedBy, 'aria-invalid': _ariaInvalid },
    ref,
  ) {
    return (
      <div
        ref={ref}
        id={id}
        role="group"
        // The host id is appended to the label IDREF, not substituted for it:
        // the field's name comes first and the rendered value follows. Falls
        // back to the label alone if the Slot ever stops handing down an id,
        // because half a name beats a reference to `"<labelId> undefined"`.
        aria-labelledby={id ? `${labelId} ${id}` : labelId}
        aria-describedby={describedBy}
        // Stable locator for this DOM layer (ADR-0054 C4) so end-to-end specs
        // and CSS have something to select that is not an a11y attribute.
        data-slot="readonly-field-group"
      >
        {children}
      </div>
    );
  },
);
ReadonlyFieldGroup.displayName = 'ReadonlyFieldGroup';

/**
 * Wrap `node` in {@link ReadonlyFieldGroup} when the host resolved a label id
 * for it, and hand it back untouched otherwise — so every field that is NOT a
 * readonly registered widget keeps the exact element tree it had, with
 * `<FormControl>`'s Slot injecting straight into the widget as before.
 */
function withReadonlyHostGroup(labelId: string | undefined, node: React.ReactNode): React.ReactNode {
  if (!labelId) return node;
  return <ReadonlyFieldGroup labelId={labelId}>{node}</ReadonlyFieldGroup>;
}

function stripRegisteredFieldProps(type: string, props: RenderFieldProps): RenderFieldProps {
  const {
    dataSource,
    inputType: _inputType,
    showActions: _showActions,
    fieldContainerClass: _fieldContainerClass,
    mobileStickyActions: _mobileStickyActions,
    mobile_fullscreen: _mobileFullscreen,
    dependentValues,
    dependsOnLabels,
    emptyHint,
    // Renderer-only, and deliberately NOT a new key in the widget contract
    // (objectui#3393). The call site started forwarding `label` for the
    // built-in fullscreen dialog; registered widgets must keep receiving
    // exactly what they received before, because `field` is their single
    // metadata carrier since v17 (objectui#3233) and it already carries the
    // label. Adding a second spelling here would give every AI-authored widget
    // two places to read one fact — and, since widgets spread their leftover
    // props onto the control they render, would also drop a `label` attribute
    // onto seven widgets' DOM overnight. Whether the contract SHOULD publish a
    // `label` prop is a separate decision against `FieldWidgetPropsSchema`.
    label: _label,
    // Retired from the widget contract in v17 (objectui#3233): `field` is the
    // single metadata carrier. The strip stays so an authored form field that
    // happens to carry a `schema` key cannot resurrect the second carrier —
    // or spill an object onto the DOM through a widget's `...props` spread.
    schema: _schema,
    ...fieldProps
  } = props;
  const normalizedType = normalizeFieldType(type);

  return {
    ...fieldProps,
    // `dependsOnLabels` rides with `dependentValues`: the widgets that gate on
    // a sibling field's VALUE are exactly the ones that have to NAME that field
    // in the gate hint (objectstack#5407). Stripped for everything else for the
    // same reason `emptyHint` is — an unknown object prop reaching a DOM node
    // through a widget's `...props` spread is a React warning.
    ...(needsDataSourceWiring(normalizedType) ? { dataSource, dependentValues, dependsOnLabels } : {}),
    // The cascade option widgets own the gate hint's presentation, so they get
    // the computed `emptyHint` alongside the live record (objectui#3231). It is
    // stripped by default because every OTHER registered widget spreads its
    // leftover props onto a DOM node, where an unknown `emptyHint` attribute is
    // a React warning — hence an allow-list, not an unconditional pass-through.
    ...(CASCADE_OPTION_WIDGET_TYPES.has(normalizedType) ? { dependentValues, emptyHint } : {}),
  };
}

/**
 * FullscreenTextarea — `<Textarea>` with a top-right "expand" button that
 * opens a fullscreen edit dialog. Mobile UX (round 3) — driven by the form
 * field's `mobile_fullscreen: true` flag (propagated from
 * `ObjectFormSchema.mobile.fullscreenLongText`).
 *
 * The affordance, the dialog and the draft/commit state machine are NOT written
 * here: they are the shared `FullscreenEditor` primitive (objectui#3398). This
 * branch used to carry a second, hand-written copy of the same interaction that
 * `@object-ui/fields` renders for the registered `field:textarea` /
 * `field:markdown` widgets — one form-level setting, two implementations, which
 * drifted exactly as two copies of a state machine do (objectui#3400 on this
 * side, objectui#3402 on the other). The merge direction follows the measured
 * import graph: `fields` depends on `components`, never the reverse, so the
 * primitive lives in `custom/fullscreen-editor.tsx` and both paths render it.
 *
 * What stays here is the part only this branch has: the INLINE textarea, and
 * the editor injected into the dialog body. `readOnly` / `disabled` are still
 * DECLARED props rather than passengers on `rest` (objectui#3400) — the inline
 * control needs them as real attributes, and the primitive needs them to decide
 * the affordance. Their meaning is now defined once, by the primitive:
 * `readOnly` renders no affordance at all, `disabled` leaves an inert one. See
 * `FullscreenEditor`'s own doc comment for why each is gated in more than one
 * place.
 */
function FullscreenTextarea({
  value,
  onChange,
  placeholder,
  className,
  label,
  readOnly,
  disabled,
  error,
  ...rest
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  readOnly?: boolean;
  disabled?: boolean;
  /**
   * The field's validation message (objectui#4824). DECLARED, so it is not a
   * passenger on `rest` — it must not reach the inline `<Textarea>` as a stray
   * `error="…"` attribute, and the primitive needs it by name.
   *
   * Like `label` and `mobile_fullscreen`, it is read off the PRE-strip props at
   * the call site: `stripRendererOnlyProps` discards `error` for the DOM,
   * correctly, because the INLINE control gets its `aria-invalid` from
   * `<FormControl>`'s Slot. The DIALOG's control is built from scratch and gets
   * nothing from that Slot, which is the whole of objectui#4824.
   */
  error?: string;
  [key: string]: any;
}) {
  // The inline control's own gate. `readOnly`/`disabled` are real attributes on
  // the `<Textarea>` below, but the attribute alone is not the write path —
  // this is, so it is gated here too. The DIALOG's write-back is gated by the
  // primitive; this function is reused for `onCommit` so the branch keeps a
  // single expression of "may a value leave this control".
  const locked = readOnly === true || disabled === true;
  const safeOnChange = (v: string) => { if (locked) return; onChange?.(v); };
  return (
    <div className="relative">
      <Textarea
        placeholder={placeholder}
        // The right padding reserves room for the expand button; with no button
        // rendered there is nothing to reserve, and the control should look
        // exactly like the plain read-only textarea the non-fullscreen exit
        // renders.
        className={cn(!readOnly && 'pr-10', className)}
        value={value ?? ''}
        onChange={(e) => safeOnChange(e.target.value)}
        {...rest}
        readOnly={readOnly}
        disabled={disabled}
      />
      <FullscreenEditor
        value={value ?? ''}
        onCommit={safeOnChange}
        label={label}
        // Unchanged ids: `form-textarea-fullscreen-toggle` / `-dialog` /
        // `-save`, distinct from the registered widgets' `textarea-` and
        // `richtext-` namespaces so a test can still say which render path it
        // found.
        testIdPrefix="form-textarea"
        readOnly={readOnly}
        disabled={disabled}
        error={error}
      >
        {(draft, setDraft, editorDisabled, editorAria) => (
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="h-full min-h-full resize-none text-base"
            disabled={editorDisabled}
            data-testid="form-textarea-fullscreen-input"
            /*
              Name + validation state, computed by the primitive and spread whole
              (objectui#4824 / #4832). This control used to carry neither: no
              `aria-invalid` at all, and an empty accessible name, while the
              inline `<Textarea>` above announced both off `<FormControl>`'s
              Slot. Spread rather than unpacked — this branch is not told which
              ids it names, so it cannot point at the host's `<FormMessage>`,
              which Radix `aria-hidden`s for as long as the dialog is open.
            */
            {...editorAria}
          />
        )}
      </FullscreenEditor>
    </div>
  );
}

// Form renderer component - Airtable-style feature-complete form
ComponentRegistry.register('form',
  ({ schema, className, onAction, ...props }: { schema: FormSchema; className?: string; onAction?: (action: any) => void; [key: string]: any }) => {
    const { t } = useSafeFormTranslation();
    // Prefix for the label ids the GROUP-labelled fields need (objectui#3961).
    // Owned here, not derived from `<FormItem>`'s own `useId()`: that id lives in
    // a context published INSIDE `FormItem`, and this renderer builds the label
    // element as a child of it — one render too early to read it. It is also the
    // reason the fix needs no change to `ui/form.tsx` (AGENTS.md #7 no-touch):
    // `<FormLabel>` spreads its props onto `Label` AFTER its own `htmlFor`, so
    // both halves — give the label an `id`, take its `for` away — travel as
    // ordinary props.
    const labelIdPrefix = React.useId();
    const {
      defaultValues: authoredDefaultValues = {},
      // The persisted record being edited (absent ⇒ this is an insert). Binds
      // `previous` for field-rule CEL and gates the read-only submit strip —
      // see FormSchema.previousValues and the two memos below (objectui#3484).
      previousValues,
      fields: rawFields = [],
      // No English default here — objectui#3272. A literal default made the
      // absence of an authored label indistinguishable from an author who
      // typed "Submit", and froze every un-labelled form's buttons to English
      // in a zh/ja/ar session. The default is now the ABSENCE of a value, and
      // the fallback happens at render through `t()` (see the action bar
      // below), so `submitLabel?: string` staying optional in the spec means
      // exactly what it says: unset = "whatever this session's language calls
      // it". An authored value still wins verbatim, including `''`.
      submitLabel,
      cancelLabel,
      showCancel = false,
      showSubmit = true,
      layout = 'vertical',
      columns = 1,
      onSubmit: onSubmitProp,
      onChange: onChangeProp,
      onDirtyChange: onDirtyChangeProp,
      onCancel: onCancelProp,
      resetOnSubmit = false,
      validationMode = 'onSubmit',
      disabled = false,
    } = schema;

    // ── Spec-vocabulary boundary (#3090) ──────────────────────────────────
    // `{ field: 'x' }` is the spec form-VIEW vocabulary — a reference to an
    // object field, resolvable only where an object schema exists (the
    // `normalizeSectionField` chokepoint in @object-ui/plugin-form). This
    // standalone renderer's vocabulary is `{ name: 'x' }` (the form data
    // path). Such an entry used to slip past the `f?.name` guards below and
    // reach a react-hook-form Controller with `name === undefined`, crashing
    // the WHOLE form on `name.split('.')` — with nothing saying which entry
    // was to blame. Partition them out and surface them loudly instead.
    const specVocabularyFields = React.useMemo(
      () =>
        (rawFields as any[]).filter(
          (f) => f && typeof f.field === 'string' && typeof f.name !== 'string',
        ),
      [rawFields],
    );
    const fields = React.useMemo(
      () =>
        specVocabularyFields.length === 0
          ? rawFields
          : (rawFields as any[]).filter((f) => !specVocabularyFields.includes(f)),
      [rawFields, specVocabularyFields],
    );
    React.useEffect(() => {
      for (const f of specVocabularyFields) {
        // This message doubles as the fix instruction — it is what an agent
        // iterating on the metadata will read and follow.
        console.error(
          `[object-ui] form field { field: '${f.field}' } was NOT rendered: \`field\` is the spec form-view ` +
            `vocabulary (a reference to an object field), and a standalone form has no object schema to resolve ` +
            `it against. Rename the key to \`name\` (the form data path) — or use an object-bound form ` +
            `(objectName + sections), whose section fields accept the spec shape.`,
        );
      }
      for (const f of rawFields as any[]) {
        if (f && typeof f.field === 'string' && typeof f.name === 'string') {
          console.warn(
            `[object-ui] form field '${f.name}' mixes vocabularies: it also carries { field: '${f.field}' } ` +
              `(spec form-view key), which this standalone renderer ignores. Drop one of the two.`,
          );
        }
      }
    }, [rawFields, specVocabularyFields]);

    // ── Unrecognized validation-rule names fail LOUDLY (#5099) ────────────
    // react-hook-form's field validator destructures a FIXED rule set (see
    // validationRuleKeys.ts, pinned against the installed bundle) and drops
    // every other key without a trace — a misspelled `minlength`, an invented
    // `email`, or the numeric keys left by spreading an ARRAY into
    // `validation` all yield a form that LOOKS validated and runs nothing.
    // `FieldValidationRules` already rejects these at compile time; this
    // catches the metadata that reaches the renderer as plain JSON, where
    // TypeScript never ran. Report-only by design: the maintainer ruling on
    // #5099 explicitly rejected normalizing/compiling at this read point
    // (consumer tolerance, AGENTS.md #0.1) — the fix belongs at the producer.
    // Dev-only and once per field+rule-set: see reportUnrecognizedRulesOnce.
    React.useEffect(() => {
      for (const f of rawFields as any[]) {
        const v = f?.validation;
        if (v == null || typeof v !== 'object') continue;
        const unrecognized = Object.keys(v).filter((k) => !RHF_RECOGNIZED_RULE_KEYS.has(k));
        if (unrecognized.length === 0) continue;
        reportUnrecognizedRulesOnce(String(f?.name), unrecognized);
      }
    }, [rawFields]);

    // A two-state control has no third state, so a boolean field that nobody
    // supplied a value for starts at `false` — not `undefined`. Without this
    // the switch renders OFF while the form holds NOTHING: the create payload
    // omits the column (it lands null, which reads as unchecked but isn't),
    // and a `required` boolean is refused as empty while the user is looking
    // at a perfectly valid answer — an AI-built tracker could not create an
    // UNFINISHED task (cloud#972). It has to be folded into `defaultValues`
    // itself, not seeded per-Controller, because this is also the baseline the
    // dirty check and the defaults-reset window below compare against; a value
    // that only lived in the field would be wiped by the first `form.reset`.
    // Callers that DO supply a value (including `null` from a loaded record)
    // are untouched.
    const defaultValues = React.useMemo(() => {
      const seeded: Record<string, unknown> = { ...(authoredDefaultValues as Record<string, unknown>) };
      let added = false;
      for (const f of fields as any[]) {
        if (typeof f?.name !== 'string') continue;
        if (hasOwn(seeded, f.name)) continue;
        if (!BOOLEAN_WIDGET_TYPES.has(resolveWidgetType(f))) continue;
        seeded[f.name] = false;
        added = true;
      }
      return added ? seeded : authoredDefaultValues;
    }, [authoredDefaultValues, fields]);

    // Initialize react-hook-form. `shouldFocusError: false` because RHF's
    // native focus-on-error only works for fields whose registered ref is a
    // focusable native input — it silently no-ops for custom widgets
    // (lookup / select / master-detail), which is exactly the #2793 case. We
    // own the scroll+focus explicitly in the onInvalid handler below so it
    // works for every field type and follows visual order.
    const form = useForm({
      defaultValues,
      mode: validationMode,
      shouldFocusError: false,
    });

    // Scoped to this form so the error-scroll query never reaches a sibling form.
    const formRef = React.useRef<HTMLFormElement>(null);

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    // Active `fieldTabs` panel. Undefined until something picks one — the
    // effective tab falls back to `defaultFieldTab`, then to the first tab.
    // Which tab of an in-progress form is showing is presentational and dies
    // with the form, so it stays component state (AGENTS.md #8).
    const [pickedFieldTab, setPickedFieldTab] = React.useState<string | undefined>(undefined);
    // Field names the last submit attempt rejected (client rules or server
    // `fields[]`), used to mark the tabs that hold them.
    const [rejectedFieldNames, setRejectedFieldNames] = React.useState<string[]>([]);

    // Live snapshot of all form values — subscribes to every change so
    // field-level CEL rules (visibleWhen/readonlyWhen/requiredWhen) re-evaluate
    // reactively as the user edits. Evaluated below via the canonical
    // `@objectstack/formula` engine (same dialect the server enforces). We seed
    // every declared field name to `null` first so a predicate that references
    // a field react-hook-form hasn't registered yet (e.g. on initial mount,
    // before defaults populate) evaluates against a present-but-null value
    // rather than faulting — mirroring the server, which evaluates over the
    // full merged record.
    const watched = form.watch() as Record<string, unknown>;

    // The `previous` binding — the persisted record, seeded the same way as
    // `ruleRecord` so a predicate naming a column the read didn't return
    // compares against `null` instead of faulting (objectui#3484). `undefined`
    // when the host supplied no `previousValues`, which is how an INSERT is
    // told apart from an UPDATE: the server exempts inserts from the
    // `readonlyWhen` strip entirely, so the renderer must not invent a
    // `previous` for them.
    const previousRecord = React.useMemo(() => {
      if (!previousValues || typeof previousValues !== 'object') return undefined;
      const out: Record<string, unknown> = {};
      for (const f of fields) if (f?.name) out[f.name] = null;
      for (const k of Object.keys(previousValues)) {
        if (previousValues[k] !== undefined) out[k] = previousValues[k];
      }
      return out;
    }, [fields, previousValues]);

    // Is this an INSERT? Same signal the memo above documents and the read-only
    // strip already gates on: `FormSchema.previousValues` is set by an
    // edit-mode host only, and its ABSENCE is the declared "this is an insert"
    // (objectui#3484). Read once here so the three rule-state call sites below
    // cannot each answer the mode differently.
    const isCreateForm = previousRecord === undefined;

    const ruleRecord = React.useMemo(() => {
      // Seed every declared field to `null` so a predicate referencing a field
      // that's absent / not-yet-registered evaluates against a present-null
      // value. The canonical CEL engine throws "No such key" on a *missing*
      // field (which would fail the predicate open), but compares cleanly
      // against `null`. Overlay only DEFINED watched values so an unregistered
      // field (value `undefined`) doesn't clobber its null seed back to missing.
      const out: Record<string, unknown> = {};
      for (const f of fields) if (f?.name) out[f.name] = null;
      // The persisted record sits UNDER the live values, exactly as the server
      // builds its own scope (`merged = { ...previous, ...data }` in objectql's
      // `stripReadonlyWhenFields`). Without it a predicate that names a record
      // column this form does not render evaluates against the `null` seed —
      // or nothing at all — and reaches a different verdict than the server.
      if (previousRecord) {
        for (const k of Object.keys(previousRecord)) out[k] = previousRecord[k];
      }
      for (const k of Object.keys(watched)) if (watched[k] !== undefined) out[k] = watched[k];
      return out;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields, previousRecord, JSON.stringify(watched)]);

    // Fields this form has resolved to READ-ONLY for the record as it now
    // stands — the exact set an UPDATE must not carry (objectui#3484).
    //
    // react-hook-form keeps a value for every registered field, so an edit form
    // seeded from a full record round-trips the WHOLE record on save, including
    // the fields it just rendered as read-only plain text. The user could not
    // have touched them and the value is the one already in the database, yet
    // the server dutifully strips them (`stripReadonlyWhenFields`) and reports
    // `droppedFields` — which the shell turned into "some fields were not
    // saved" on a save where nothing was even changed. Not sending them is the
    // fix; the warning channel then only fires for a write that really did lose
    // something.
    //
    // Gated on `previousRecord` because the strip this mirrors is UPDATE-ONLY:
    // objectql exempts INSERT from `readonlyWhen` entirely, so dropping keys on
    // create would make the client stricter than the server and silently lose
    // authored defaults.
    const readonlyFieldNames = React.useMemo(() => {
      const locked = new Set<string>();
      if (!previousRecord) return locked;
      for (const f of fields as FormFieldConfig[]) {
        const name = f?.name;
        if (!name) continue;
        const st = resolveFieldRuleState(
          {
            visibleWhen: (f as any).visibleWhen,
            readonlyWhen: (f as any).readonlyWhen,
            requiredWhen: (f as any).requiredWhen,
          },
          ruleRecord,
          {
            required: !!f.required,
            readonly: (f as any).readonly === true,
            serverOwnedValue: isServerOwnedValue(f, isCreateForm),
          },
          previousRecord,
          undefined,
          // Same locator as the render path (#5149). A failure here reports the
          // field, not a bare rule kind; `warnPredicateFailure` dedupes by
          // predicate source, so re-evaluating a rule the renderer already
          // evaluated cannot double-warn.
          `field '${name}'`,
        );
        if (st.readonly) locked.add(name);
      }
      return locked;
    }, [fields, ruleRecord, previousRecord, isCreateForm]);

    // When a field's CEL rule relaxes — it becomes hidden (visibleWhen FALSE) or
    // no longer required (requiredWhen FALSE) — clear any stale validation error
    // left from a prior submit attempt. react-hook-form keeps an error until the
    // erroring field itself revalidates; without this a "required" message would
    // linger after the condition that imposed it (e.g. status) changed.
    React.useEffect(() => {
      const errs = form.formState.errors as Record<string, unknown>;
      if (!errs || Object.keys(errs).length === 0) return;
      for (const f of fields as FormFieldConfig[]) {
        const name = f?.name;
        if (!name || !errs[name]) continue;
        const st = resolveFieldRuleState(
          {
            visibleWhen: (f as any).visibleWhen,
            readonlyWhen: (f as any).readonlyWhen,
            requiredWhen: (f as any).requiredWhen,
          },
          ruleRecord,
          {
            required: !!f.required,
            readonly: (f as any).readonly === true,
            serverOwnedValue: isServerOwnedValue(f, isCreateForm),
          },
          previousRecord,
          undefined,
          `field '${name}'`,
        );
        // View-level FormField.visibleOn hides the field the same way a
        // field-level visibleWhen does (#2212) — fold it into the verdict.
        const viewVisible =
          (f as any).visibleOn == null ||
          evalFieldPredicate((f as any).visibleOn, ruleRecord, true, previousRecord, undefined, {
            context: `visibleOn of field '${name}'`,
          });
        // A hidden field shows no errors at all; an un-required field clears
        // only its *required* error (keep legitimate format/min/etc. errors).
        const errType = (errs[name] as { type?: string } | undefined)?.type;
        if (!st.visible || !viewVisible || (!st.required && errType === 'required')) form.clearErrors(name);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruleRecord]);

    // Read DataSource from SchemaRendererContext and propagate it to field
    // widgets as a prop so they can dynamically load related records.
    const schemaCtx = React.useContext(SchemaRendererContext);
    const contextDataSource = schemaCtx?.dataSource ?? null;

    // Global predicate scope (from the host shell's ExpressionProvider) — carries
    // `current_user` etc. so per-option `visibleWhen` can gate on role/context in
    // addition to sibling field values. Empty object when no provider is mounted.
    const predicateScope = usePredicateScope();

    // Field name → label, for the "select the parent first" gate hint (#2284).
    const fieldLabelByName = React.useMemo(() => {
      const m: Record<string, string> = {};
      for (const f of fields as FormFieldConfig[]) if (f?.name) m[f.name] = (f as any).label || f.name;
      return m;
    }, [fields]);

    // --- Tabbed field layout (#2959) ---------------------------------------
    // `fieldTabs` spreads THIS form's fields across tab panels. Crucially there
    // is still exactly ONE <form> / react-hook-form instance: the panels are
    // force-mounted and merely CSS-hidden, so a tab the user navigated away from
    // keeps BOTH its values and its validation. (Rendering one form per tab lost
    // every non-active tab's input — the footer submit button can only be
    // associated with a single form — and unmounting a tab's fields makes
    // react-hook-form skip their rules, which let a required field on a tab
    // nobody opened sail past the client and return as a server 400.)
    const fieldTabs = React.useMemo<FormFieldTab[] | null>(() => {
      const declared = schema.fieldTabs;
      if (schema.children || !Array.isArray(declared)) return null;
      const usable = declared.filter((t) => t && typeof t.key === 'string');
      return usable.length > 1 ? usable : null;
    }, [schema.fieldTabs, schema.children]);

    /** Field name → the tab that owns it (first claim wins). */
    const tabKeyByFieldName = React.useMemo(() => {
      const m = new Map<string, string>();
      for (const tab of fieldTabs ?? []) {
        for (const name of tab.fields ?? []) if (!m.has(name)) m.set(name, tab.key);
      }
      return m;
    }, [fieldTabs]);

    const activeFieldTab = React.useMemo(() => {
      if (!fieldTabs?.length) return undefined;
      const keys = fieldTabs.map((t) => t.key);
      if (pickedFieldTab && keys.includes(pickedFieldTab)) return pickedFieldTab;
      if (schema.defaultFieldTab && keys.includes(schema.defaultFieldTab)) return schema.defaultFieldTab;
      return keys[0];
    }, [fieldTabs, pickedFieldTab, schema.defaultFieldTab]);

    // Resolve each tab's declared field names against the form's field list.
    const fieldTabGroups = React.useMemo(() => {
      if (!fieldTabs) return null;
      const byName = indexFieldsByName(fields as FormFieldConfig[]);
      return fieldTabs.map((tab) => ({
        key: tab.key,
        label: tab.label || tab.key,
        description: tab.description,
        containerClass: tab.containerClass,
        fields: (tab.fields ?? [])
          .map((name) => byName.get(name))
          .filter((f): f is FormFieldConfig => Boolean(f)),
      }));
    }, [fieldTabs, fields]);

    // A field no tab claimed must not vanish — it renders above the tab strip,
    // visible from every tab.
    const untabbedFields = React.useMemo(
      () => (fieldTabGroups ? unclaimedFields(fieldTabGroups, fields as FormFieldConfig[]) : []),
      [fieldTabGroups, fields],
    );

    // --- Split field layout (#2153) ----------------------------------------
    // `fieldPanes` places this form's fields in resizable panels. The <form>
    // wraps the whole panel GROUP, so — exactly as with `fieldTabs` — there is
    // still ONE react-hook-form instance behind the split: a submit from either
    // side carries every pane's values, and a rule in one pane can read a field
    // in another. A <form> INSIDE each panel could do neither: its submit saw
    // only its own fields, and its rule record didn't even contain the other
    // pane's names, so a cross-pane predicate faulted and failed open.
    //
    // Tabbed wins if a caller somehow declares both: a form is one or the other.
    const fieldPanes = React.useMemo<FormFieldPane[] | null>(() => {
      const declared = schema.fieldPanes;
      if (schema.children || fieldTabs || !Array.isArray(declared)) return null;
      const usable = declared.filter((p) => p && typeof p.key === 'string');
      return usable.length > 1 ? usable : null;
    }, [schema.fieldPanes, schema.children, fieldTabs]);

    const fieldPaneGroups = React.useMemo(() => {
      if (!fieldPanes) return null;
      const byName = indexFieldsByName(fields as FormFieldConfig[]);
      return fieldPanes.map((pane) => ({
        key: pane.key,
        defaultSize: panePercent(pane.defaultSize),
        minSize: panePercent(pane.minSize) ?? '20',
        containerClass: pane.containerClass,
        fields: (pane.fields ?? [])
          .map((name) => byName.get(name))
          .filter((f): f is FormFieldConfig => Boolean(f)),
      }));
    }, [fieldPanes, fields]);

    // Same guarantee as `untabbedFields`: an unclaimed field renders above the
    // panel group rather than being dropped.
    const unpanedFields = React.useMemo(
      () => (fieldPaneGroups ? unclaimedFields(fieldPaneGroups, fields as FormFieldConfig[]) : []),
      [fieldPaneGroups, fields],
    );

    // Tabs holding a field the LAST submit rejected, so their trigger can carry
    // a marker — otherwise a rejection on a background tab is invisible and the
    // user just sees a submit that does nothing. Fed from `announceFieldErrors`,
    // which covers both referees (client rules and server `fields[]`), and reset
    // when a submit gets past validation. Kept as state rather than derived from
    // `formState.errors` because react-hook-form re-renders the erroring field's
    // own Controller, not necessarily this component.
    const erroredFieldTabs = React.useMemo(() => {
      const out = new Set<string>();
      if (!fieldTabs) return out;
      for (const name of rejectedFieldNames) {
        const key = tabKeyByFieldName.get(name);
        if (key) out.add(key);
      }
      return out;
    }, [fieldTabs, tabKeyByFieldName, rejectedFieldNames]);

    // Cascade clear (#2284): when a select/radio's option list narrows — because a
    // controlling field changed or a role/context predicate flipped — a previously
    // chosen value may no longer be offered. Drop it so the form never submits a
    // stale "china + california" pair. Mirrors the dependent-lookup gate but for
    // static/predicate-driven option sets. Fail-open filtering keeps unrelated
    // fields untouched (no visibleWhen / dependsOn → nothing recomputed).
    React.useEffect(() => {
      for (const f of fields as FormFieldConfig[]) {
        const name = f?.name;
        if (!name) continue;
        const resolvedType = (f as any).widget || f.type;
        // `field:select` and `select` name the SAME field kind, so this clear
        // must recognise both spellings — the object-form path
        // (`mapFieldTypeToFormType`) emits the prefixed id, hand-written SDUI
        // schemas the bare one. Comparing the RAW string recognised only the
        // bare form, so every option field coming from an object schema fell
        // out of this effect entirely: its parent could narrow the offered set
        // and the stale value was never dropped, submitting the "china +
        // california" pair this effect exists to prevent (objectui#4014).
        // `normalizeFieldType` + the shared set is exactly what the render path
        // below already does for `isOptionField` (objectui#3231) — the two
        // readers of "is this an option field?" must not disagree.
        if (typeof resolvedType !== 'string') continue;
        if (!CASCADE_OPTION_WIDGET_TYPES.has(normalizeFieldType(resolvedType))) continue;
        const opts = (f as any).options as SelectOption[] | undefined;
        if (!opts || opts.length === 0) continue;
        const dependsOn = f.dependsOn;
        const hasOptionPredicate = opts.some((o) => (o as any)?.visibleWhen != null);
        if (!hasOptionPredicate && !dependsOn) continue;
        const current = form.getValues(name);
        if (current === undefined || current === null || current === '') continue;
        // Same shared resolver the widgets use, so gating/filtering stays in
        // lockstep — including the guard below.
        const { options: visible, gated } = resolveCascadingOptions(opts, ruleRecord, dependsOn, predicateScope);
        // Gated ≠ invalid (objectui#4247). While a dependency is empty the whole
        // list is WITHHELD, so `visible` is empty for a reason that says nothing
        // about the stored value — and this effect runs on mount, so a record
        // that merely ARRIVES with its controlling field empty (a later-cleared
        // parent, an import, a partially-migrated row) had the dependent
        // picklist wiped before the user touched anything, while the field
        // rendered "select the parent first" beside it. Gating is missing
        // information, not a verdict; the cascade converges when the parent IS
        // chosen and the resolved set genuinely excludes the value, which is the
        // clear below, unchanged. The four option WIDGETS carry the matching
        // guard — this effect is an independent second clear on the form host,
        // and the widgets' fix does not reach it.
        if (gated) continue;
        if (!isValueStillOffered(current, visible)) {
          form.setValue(name, Array.isArray(current) ? [] : undefined, {
            shouldValidate: false,
            shouldDirty: true,
          });
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruleRecord, predicateScope]);

    // React to defaultValues changes — but ONLY when the values actually
    // change, not on every new object identity. Callers often pass a freshly
    // built `defaultValues` object on each render; resetting on identity alone
    // wiped user input mid-interaction (e.g. a parent re-render between a submit
    // click and the deferred requestSubmit emptied the form, so validation then
    // failed on now-blank required fields and nothing was saved). Compare by
    // value so a genuine change (e.g. an edit-mode record finishing loading)
    // still resets, while identity churn is ignored.
    const lastDefaultsKey = React.useRef<string | undefined>(undefined);
    // The pristine snapshot the dirty check compares against. Kept in sync with
    // whatever we last reset the form to (initial defaults, or a loaded record).
    const baselineRef = React.useRef<Record<string, unknown>>(
      (defaultValues ?? {}) as Record<string, unknown>,
    );
    // LAYOUT effect, deliberately — not a passive one. A passive effect runs a
    // commit LATER than the render that produced the new values, so there is a
    // window in which the new inputs are already mounted and interactive but the
    // form still holds the old record. Anything typed in that window is
    // destroyed: the pending `reset()` overwrites the whole record with
    // `defaultValues`, silently dropping the field the user just filled. A
    // layout effect runs synchronously inside the same commit, before the
    // browser can paint or deliver a keystroke to those inputs, so the window
    // does not exist. This surfaced as a flaky wizard test (#2982): a step
    // transition changes `defaultValues`, and a value entered on the new step
    // before the deferred reset landed vanished from the create payload.
    React.useLayoutEffect(() => {
      let key: string;
      try { key = JSON.stringify(defaultValues ?? {}); } catch { key = String(Date.now()); }
      if (lastDefaultsKey.current === key) return;
      lastDefaultsKey.current = key;
      const incoming = (defaultValues ?? {}) as Record<string, unknown>;
      const outgoing = baselineRef.current;
      // `reset()` replaces the WHOLE record, so it also blanks fields the
      // incoming defaults say nothing about — and it lands here in a PASSIVE
      // effect, one commit after those fields were painted. Input arriving in
      // that window was silently discarded. The caught case is the wizard: it
      // reuses one inner form across steps and feeds back `formData`, the merge
      // of the steps submitted SO FAR — so at every step boundary the incoming
      // defaults are missing exactly the fields now on screen, and the create
      // POST went out without the step just filled (#2982):
      //
      //   RESET to {"name":"Alice"}  (values before: {"name":"Alice","note":"hello"})
      //
      // Carry such a value across the reset instead of dropping it.
      const carried = Object.entries(form.getValues() as Record<string, unknown>).filter(
        ([name, value]) =>
          // Only a field the CALLER HAS NEVER CARRIED is eligible — absent from
          // both the outgoing and the incoming defaults. Everywhere the caller
          // has an opinion it stays authoritative, so the three load-bearing
          // paths keep today's behavior exactly: a record landing after first
          // paint still fills every field it names; a `recordId` swap still
          // replaces the record outright (drawer/modal/split forms re-fetch
          // without re-entering their loading branch, so record B lands in the
          // still-mounted form and must not inherit an abandoned edit to A);
          // and a field the caller withdraws stops being the user's.
          !hasOwn(incoming, name) &&
          !hasOwn(outgoing, name) &&
          // The same empty-ish comparison the dirty check uses, so a widget
          // normalizing its own empty value on mount ('' -> null, undefined ->
          // '') is not mistaken for input and does not keep a field alive.
          !valuesEqualForDirty(outgoing[name], value),
      );
      // Set the baseline before resetting: `reset`/`setValue` notify the watcher
      // below synchronously, and it reads this to compute dirtiness.
      baselineRef.current = incoming;
      form.reset(defaultValues);
      for (const [name, value] of carried) {
        form.setValue(name, value, { shouldValidate: false, shouldDirty: true });
      }
      // Fresh values, so last attempt's rejected-field markers no longer apply.
      setRejectedFieldNames([]);
      // A reset that carried nothing is by definition pristine — clear any stale
      // dirty signal (e.g. an edit-mode record that just finished loading). One
      // that carried input is genuinely dirty against the caller's defaults, and
      // the host's discard guard has to keep hearing so.
      onDirtyChangeProp?.(carried.length > 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultValues]);

    // Watch for form changes - only track changes when onAction is available.
    // LAYOUT effect to stay in the same phase as the `defaultValues` reset
    // above. React runs every layout DESTROY (mutation phase) before any layout
    // CREATE, so a caller passing a fresh `onAction` each render — the common
    // case, it is usually an inline arrow — has this subscription torn down
    // before the reset runs and re-established after. That is what keeps a
    // reset from being reported as a user edit. Leaving this passive while the
    // reset is layout-phase inverts the order: the reset fires into the still
    // live previous subscription and a record landing looks like the user
    // editing every field it filled (#2968).
    React.useLayoutEffect(() => {
      if (onAction) {
        const subscription = form.watch((data) => {
          onAction({
            type: 'form_change',
            data,
            formData: data,
          });
        });
        return () => subscription.unsubscribe();
      }
    }, [form, onAction]);

    // Surface dirty state to the host (e.g. a modal/drawer guarding against
    // accidental discard of unsaved input). We compute it via a normalized
    // comparison against the pristine baseline (see computeDirty) rather than
    // react-hook-form's `isDirty`, which false-positives on fields that
    // self-normalize their empty value on mount. Layout-phase for the same
    // ordering reason as the subscription above.
    React.useLayoutEffect(() => {
      const subscription = form.watch((values) => {
        onDirtyChangeProp?.(
          computeDirty(baselineRef.current, values as Record<string, unknown>),
        );
      });
      return () => subscription.unsubscribe();
    }, [form, onDirtyChangeProp]);

    /**
     * Scroll a field into view and focus a control inside it. The field wrapper
     * carries `data-field` (FormItem), so this reaches custom widgets that RHF's
     * own focus cannot (#2793).
     */
    const revealField = (name: string) => {
      const root: ParentNode = formRef.current ?? document;
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(name)
          : name.replace(/["\\]/g, '\\$&');
      const target = root.querySelector<HTMLElement>(`[data-field="${escaped}"]`);
      if (target) {
        target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        const focusable = target.querySelector<HTMLElement>(
          'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
        );
        focusable?.focus?.({ preventScroll: true });
      }
    };

    /**
     * Tell the user WHICH fields are wrong, wherever the verdict came from.
     *
     * Toast naming the offending fields, then reveal the FIRST of them (in
     * declared/visual order, not the caller's key order) — activating its tab
     * first when it sits on a background one.
     *
     * Shared by the client-side invalid handler and the SERVER-rejection path:
     * the two failures are the same event as far as the person filling the form
     * is concerned; only the referee differs.
     */
    const announceFieldErrors = (names: string[]) => {
      if (names.length === 0) return;
      setRejectedFieldNames(names);
      const labels = names.map((n) => fieldLabelByName[n] || n);
      const MAX = 3;
      const fieldsText =
        labels.slice(0, MAX).join(t('validation.formInvalidJoiner')) +
        (labels.length > MAX ? '…' : '');
      toast.error(t('validation.formInvalid', { fields: fieldsText }));

      const errored = new Set(names);
      const firstName =
        (fields as FormFieldConfig[])
          .map((f) => f?.name)
          .find((n): n is string => Boolean(n) && errored.has(n as string)) ?? names[0];

      // In a tabbed layout the offending field may sit on a tab the user is not
      // looking at — naming it is useless if they can't see it. Activate its tab
      // first, then reveal it once that panel has actually been painted (it is
      // display:none until then, so scroll/focus would no-op).
      const tabKey = tabKeyByFieldName.get(firstName);
      if (tabKey && tabKey !== activeFieldTab) {
        setPickedFieldTab(tabKey);
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => revealField(firstName));
        } else {
          setTimeout(() => revealField(firstName), 0);
        }
        return;
      }
      revealField(firstName);
    };

    // Handle form submission
    const handleSubmit = form.handleSubmit(async (data) => {
      setIsSubmitting(true);
      setSubmitError(null);
      // This attempt cleared client validation — drop the previous attempt's
      // tab markers (the server may re-add its own below).
      setRejectedFieldNames([]);

      // Defensive check: If data is an Event, use getValues()
      let formData = data;
      // Check for Event-like properties
      const isEvent = data && (
        (data as any).nativeEvent || 
        typeof (data as any).preventDefault === 'function' || 
        typeof (data as any).stopPropagation === 'function' ||
        (data as any).target ||
        (data as any).bubbles
      );

      if (isEvent) {
        // This should not happen with RHF handleSubmit, but just in case
        formData = form.getValues();
      } else if (!formData || Object.keys(formData).length === 0) {
        // Fallback: if data is empty check getValues(), in case RHF failed to pass it for some reason
        const values = form.getValues();
        if (values && Object.keys(values).length > 0) {
             formData = values;
        }
      }

      // Drop the keys this form itself resolved to read-only. See
      // `readonlyFieldNames`: they are values the user had no way to change,
      // and re-sending them only earns a server-side strip plus a "some fields
      // were not saved" warning on a save that changed none of them.
      if (readonlyFieldNames.size > 0 && formData && typeof formData === 'object') {
        const kept: Record<string, unknown> = {};
        for (const k of Object.keys(formData)) {
          if (!readonlyFieldNames.has(k)) kept[k] = (formData as Record<string, unknown>)[k];
        }
        formData = kept as typeof formData;
      }

      try {
        if (onAction) {
          const result = await onAction({
            type: 'form_submit',
            data: formData,
            formData: formData,
          }) as any;

          // Check if submission returned an error
          if (result?.error) {
            setSubmitError(result.error);
            // Also surface as a toast so the message is visible even when the
            // in-form banner has scrolled out of view (long forms in modals/drawers).
            toast.error(result.error);
            return;
          }
        }

        if (onSubmitProp && typeof onSubmitProp === 'function') {
          await onSubmitProp(formData);
        }

        if (resetOnSubmit) {
          form.reset();
        }
      } catch (error) {
        // The server can reject field-by-field: `@objectstack/objectql`'s
        // validators throw `VALIDATION_FAILED` with `fields[]`, and both the
        // REST layer and the runtime dispatcher serve it as a 400 with those
        // entries intact. Every form used to drop them and show one undirected
        // toast — telling the user something was wrong, but not WHAT, on a
        // surface that already knows how to mark the input. Mark them.
        const fieldErrors = extractFieldErrors(error);
        if (fieldErrors) {
          const known = fieldErrors.filter((fe) =>
            (fields as FormFieldConfig[]).some((f) => f?.name === fe.field),
          );
          for (const fe of known) {
            form.setError(fe.field, {
              type: 'server',
              // Fall back to the envelope's top-level text rather than leaving
              // a marked field with no reason next to it.
              message: fe.message || extractWriteErrorMessage(error) || t('form.submitFailed'),
            });
          }
          // Only take over the whole failure when EVERY rejected field has a
          // visible input to carry it. If the server also rejected something
          // this form does not render, fall through: the top-level message
          // concatenates every field's reason, so the part the user cannot see
          // inline is still said out loud instead of silently dropped.
          if (known.length > 0 && known.length === fieldErrors.length) {
            announceFieldErrors(known.map((fe) => fe.field));
            // A fully-attributed rejection is not a form-level failure — the
            // banner would just repeat what is now written under each input.
            return;
          }
        }
        // A rejected write used to be rendered verbatim, which put raw server
        // diagnostics in front of end users — untranslated, and leaking the
        // object's machine name and the record id, e.g.
        // "FORBIDDEN: insufficient privileges to update showcase_private_note
        // pi-TgoJ4_DM55Fqz" (objectstack#3821). A permission denial is a
        // condition the UI already knows how to name, so say it in the user's
        // language and keep the server text for the console.
        const errorMessage = isPermissionError(error)
          ? t('form.noPermissionToSave')
          : extractWriteErrorMessage(error) ?? t('form.submitFailed');
        if (isPermissionError(error) && typeof console !== 'undefined') {
          console.warn('[form] write denied:', error);
        }
        setSubmitError(errorMessage);
        // Also surface as a toast so the message is visible even when the
        // in-form banner has scrolled out of view (long forms in modals/drawers).
        toast.error(errorMessage);

        // Log errors for debugging (dev environment only)
        // process may not be defined in all environments
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          console.error('Form submission error:', error);
        }
      } finally {
        setIsSubmitting(false);
      }
    }, (validationErrors) => {
      // Client-side (react-hook-form) validation blocked the submit. The
      // per-field errors render inline, but in long forms the offending field
      // is often scrolled out of view — the user clicks 创建 and sees nothing
      // happen. Surface a toast naming the fields so the feedback is visible
      // regardless of scroll position (mirrors the server-error toast above).
      announceFieldErrors(Object.keys(validationErrors || {}));
    });

    // Handle cancel
    const handleCancel = () => {
      form.reset();
      
      if (onCancelProp && typeof onCancelProp === 'function') {
        onCancelProp();
      }

      if (onAction) {
        onAction({
          type: 'form_cancel',
          data: form.getValues(),
        });
      }
    };

    // Determine grid classes based on columns (explicit classes for Tailwind JIT)
    // Mobile-first: 1 column on mobile, responsive breakpoints for larger screens
    const gridColsClass = 
      columns === 1 ? '' :
      columns === 2 ? 'md:grid-cols-2' :
      columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
      'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    
    const gridClass = columns > 1
      ? cn('grid gap-4', gridColsClass)
      : 'space-y-4';

    // Every field container (flat, or one per tab panel) lays its fields out on
    // the same grid, so per-field `colSpan` means the same thing on every tab.
    const fieldGridClass = schema.fieldContainerClass || gridClass;
    const fieldTabsPosition = schema.fieldTabsPosition || 'top';
    const isVerticalFieldTabs = fieldTabsPosition === 'left' || fieldTabsPosition === 'right';

    // The LIVE required verdict, per field name: present ⇒ required right now,
    // and the value is the message to show; absent ⇒ not required. Republished
    // by `renderFormField` below on every render, from the very same
    // `resolveFieldRuleState` result that draws the asterisk — so the
    // submit-time check and the star can never disagree (objectui#4161). A ref
    // rather than state: nothing renders off it, it must be readable from
    // inside a validator react-hook-form may have captured at mount, and
    // writing it must not itself schedule a render. Lazily initialised rather
    // than `useRef(new Map())`, whose argument is re-evaluated (and discarded)
    // on every render — the same React footgun documented at the call site.
    const requiredMessagesRef = React.useRef<Map<string, string> | undefined>(undefined);
    const requiredMessages = (requiredMessagesRef.current ??= new Map<string, string>());

    // --- Field rendering ---------------------------------------------------
    // Renders ONE field row (or a virtual section divider). Hoisted out of the
    // field loop so a tabbed layout can place the very same row inside a tab
    // panel — every field, on every tab, belongs to this one form instance.
    const renderFormField = (field: FormFieldConfig): React.ReactNode => {
      const {
        name,
        label,
        description,
        type = 'input',
        required: staticRequired = false,
        disabled: fieldDisabled = false,
        validation = {},
        condition,
        colSpan,
        hidden,
        widget,
        visibleOn,
        readonly: staticReadonly,
        visibleWhen,
        readonlyWhen,
        requiredWhen,
        ...fieldProps
      } = field;

      // Skip hidden fields
      if (hidden) return null;

      // Legacy `condition: { field, equals/notEquals/in }` — translated
      // to CEL and evaluated on the canonical engine over the seeded
      // live record (issue #1584), so it agrees with `visibleWhen` and
      // the server. Fail-open (a broken predicate shows the field),
      // matching the CEL rules below.
      const legacyConditionCel = legacyConditionToCel(condition);
      if (
        legacyConditionCel &&
        !evalFieldPredicate(legacyConditionCel, ruleRecord, true, undefined, undefined, {
          context: `condition of field '${name}'`,
        })
      ) {
        return null;
      }

      // Field-level CEL conditional rules (B2). Evaluated reactively
      // against the live record via the canonical engine — same
      // dialect the server enforces (requiredWhen / readonlyWhen), so
      // the UX and the persisted verdict agree. A field with no rules
      // resolves to its static flags unchanged.
      const ruleState = resolveFieldRuleState(
        { visibleWhen, readonlyWhen, requiredWhen },
        ruleRecord,
        {
          required: staticRequired,
          readonly: staticReadonly === true,
          // A CREATE form leaves a producer-owned control empty on purpose and
          // omits the key so the server resolves the declared runtime default
          // (#4069). Nothing may then declare the field required — neither the
          // static flag (which `@object-ui/plugin-form` already lowers at the
          // producer) nor a `requiredWhen` predicate resolving TRUE against the
          // live record, which used to re-require it here with nothing the user
          // could type to unblock the submit (#4085).
          serverOwnedValue: isServerOwnedValue(field, isCreateForm),
        },
        previousRecord,
        undefined,
        `field '${name}'`,
      );
      if (!ruleState.visible) return null;

      // View-level conditional visibility — spec FormField.visibleOn,
      // authored on the form view (not the object field). Same
      // canonical CEL engine and record scope as visibleWhen; both
      // the bare-string and `{ dialect, source }` wire shapes are
      // accepted, and a broken predicate fails open — loudly since
      // #5149 (#2212).
      if (
        visibleOn != null &&
        !evalFieldPredicate(visibleOn, ruleRecord, true, previousRecord, undefined, {
          context: `visibleOn of field '${name}'`,
        })
      ) {
        return null;
      }
      const required = ruleState.required;
      const readonly = ruleState.readonly;

      // Section divider — renders a collapsible FormSection header inline
      // so all fields share the same form instance (enables cross-section conditions).
      if (type === 'section-divider') {
        const fp = fieldProps as any;
        return (
          <SectionDivider
            key={name}
            label={label}
            description={description}
            collapsible={fp.collapsible}
            collapsed={fp.collapsed}
            onToggle={fp.onToggle}
            className={fp.className}
          />
        );
      }

      // Build validation rules
      const rules: any = {
        ...validation,
      };

      // `required` is a PRESENCE contract, not a truthiness one — and the
      // referee it has to agree with is the server. `@objectstack/spec`
      // FieldSchema.required (ADR-0113) reads "an insert must provide a
      // NON-NULL value", and objectql's record validator implements exactly
      // that: `isMissing` = undefined | null | blank string. `false` and `0`
      // are values.
      //
      // react-hook-form's own `required` rule breaks that contract in both
      // directions: it fails whenever `isBoolean(value) && !value` (its
      // accept-the-terms checkbox heritage), so a required boolean silently
      // becomes "must be TRUE" and the only state the control shows by
      // default is the one value that cannot be saved — an AI-built task
      // tracker could not create an UNFINISHED task (cloud#972); and it lets
      // a whitespace-only string through, which the server then rejects.
      //
      // So never hand RHF its `required` (`delete` also drops the copy that
      // rode in on `validation` from buildValidationRules, which must not
      // outlive a `requiredWhen` that resolved to FALSE) and express the
      // check as a `validate` entry keyed `required` — RHF reports an
      // object-form validate failure under its key, so the error still
      // surfaces as `type: 'required'` for the conditional-required cleanup
      // above.
      //
      // The entry is registered UNCONDITIONALLY and decides required-ness when
      // it RUNS, instead of being added only while the field is required
      // (objectui#4161). react-hook-form merges a Controller's `rules` INTO the
      // field descriptor it already holds — `_f: { ...previous._f, ...options }`
      // — so a rule key that simply stops being spelled is never removed: the
      // validator installed the first time `requiredWhen` evaluated TRUE
      // outlived every later FALSE. The two layers then disagreed: the display
      // layer re-evaluated (asterisk and `aria-required` both disappeared)
      // while submit stayed refused with "<field> is required" and no write was
      // ever issued. Always spelling the key gives that merge something to
      // overwrite, and reading the verdict out of `requiredMessages` at call
      // time keeps the answer correct even for the closure RHF captured at
      // mount — the fix must not rest on RHF re-registering per render, which
      // it does today only as a side effect of `useRef(control.register(…))`
      // re-evaluating its (discarded) initializer argument.
      //
      // Deliberately NOT re-evaluating the predicate inside the validator: that
      // would be a second evaluation site with its own copy of the record
      // assembly (the `null` seeding, the `previousRecord` overlay), i.e. the
      // exact drift this issue is about. The verdict published here IS the one
      // the asterisk was drawn from.
      delete rules.required;
      if (required) {
        requiredMessages.set(
          name,
          typeof validation.required === 'string'
            ? validation.required
            : t('validation.required', { field: label || name }),
        );
      } else {
        requiredMessages.delete(name);
      }
      const authoredValidate = rules.validate;
      rules.validate = {
        // A field-authored `validate` keeps running, and keeps its own
        // `type: 'validate'` error key.
        ...(typeof authoredValidate === 'function'
          ? { validate: authoredValidate }
          : (authoredValidate ?? {})),
        required: (value: unknown) => {
          const requiredMessage = requiredMessages.get(name);
          // Absent ⇒ not required as of NOW, whatever it was when this
          // validator was registered.
          if (requiredMessage === undefined) return true;
          return !isMissingForRequired(value) || requiredMessage;
        },
      };

      // Localize the standard validation messages emitted by
      // buildValidationRules. Each such rule carries a `messageKey`
      // and leaves `message` undefined for the auto-generated case
      // (a field-authored message is a string and is left untouched);
      // we fill the blanks through i18n so they track the label's
      // language. A fresh object avoids mutating the shared rule.
      const localizeRule = (
        rule: any,
        interp?: (r: any) => Record<string, unknown>,
      ) => {
        if (
          rule && typeof rule === 'object' &&
          rule.message == null && typeof rule.messageKey === 'string'
        ) {
          return {
            ...rule,
            message: t(rule.messageKey, { field: label || name, ...(interp?.(rule)) }),
          };
        }
        return rule;
      };
      if (rules.minLength) rules.minLength = localizeRule(rules.minLength, r => ({ min: r.value }));
      if (rules.maxLength) rules.maxLength = localizeRule(rules.maxLength, r => ({ max: r.value }));
      if (rules.min) rules.min = localizeRule(rules.min, r => ({ min: r.value }));
      if (rules.max) rules.max = localizeRule(rules.max, r => ({ max: r.value }));
      if (rules.pattern) rules.pattern = localizeRule(rules.pattern);

      // Use field.id or field.name for stable keys (never use index alone)
      const fieldKey = field.id ?? name;

      // Resolve the component type: prefer an explicit form-config
      // `widget`, then the object-schema field's own `widget` render
      // hint (carried on the field metadata, e.g. `object-ref`,
      // `filter-condition`, `recipient-picker`), then the bare `type`.
      // The nested-metadata fallback matters because some field
      // builders (e.g. the field-group/section layout path in
      // ObjectForm) pass the field metadata through without hoisting
      // its `widget` to the top-level form-config, which would
      // otherwise degrade a picker field to its raw `type` input.
      // (`.field` is the resolved metadata OBJECT — declared on FormField
      // since #3090, never the spec string; see types/form.ts)
      const resolvedType = widget || fieldProps.field?.widget || type;

      // Cascading / role-gated option lists (#2284). For option fields,
      // narrow the set by each option's `visibleWhen` (evaluated against
      // the live record + `current_user`), and gate the whole control
      // while a declared `dependsOn` parent is still empty — surfacing a
      // "select the parent first" hint instead of an unfiltered list.
      // `field:select` and `select` name the SAME field kind — the object-form
      // path (`mapFieldTypeToFormType`) emits the prefixed id, hand-written
      // form schemas the bare one. Comparing the raw string recognised only the
      // bare form, so every option field coming from an object schema fell out
      // of this block entirely and no gate hint was ever computed for it
      // (objectui#3231). `normalizeFieldType` is the same normalization
      // `stripRegisteredFieldProps` already applies a few lines down; the two
      // must agree on what a `select` is.
      const isOptionField = CASCADE_OPTION_WIDGET_TYPES.has(normalizeFieldType(resolvedType));
      const rawOptions = (fieldProps as any).options as SelectOption[] | undefined;
      // Resolve gating + `visibleWhen` filtering through the shared
      // core helper so this pre-filter can't drift from the widgets'
      // `useCascadingOptions` hook (#2715). Non-option fields pass
      // their options through untouched.
      const cascade = isOptionField
        ? resolveCascadingOptions(rawOptions, ruleRecord, field.dependsOn, predicateScope)
        : null;
      const optionGroupGated = cascade?.gated ?? false;
      const dependsOnFields = cascade?.dependsOnFields ?? [];
      const effectiveOptions = cascade ? cascade.options : rawOptions;
      // Same i18n key the option widgets fall back to (`fields.options.
      // selectFirst`, objectui#3231): one sentence, two callers — this one
      // interpolates the controlling fields' LABELS, a standalone widget its
      // raw metadata names — so the gate can never read differently depending
      // on which side produced it.
      //
      // That invariant held for the sentence but not for its `{{fields}}`
      // slot, which each caller filled with a hardcoded separator — `' / '`
      // here, `', '` in the lookup's own gate — so a field gated on two
      // parents still read two ways (objectui#4026). The separator is a
      // property of the locale, so all of them now read
      // `validation.formInvalidJoiner`: the key objectstack#5407 added for the
      // invalid-submit toast a few hundred lines up, which is the same class
      // of truncated-name list, rather than a second gate-only twin that would
      // reintroduce the divergence.
      const gatedHint = optionGroupGated
        ? t('fields.options.selectFirst', {
            fields: dependsOnFields
              .map((fn) => fieldLabelByName[fn] || fn)
              .join(t('validation.formInvalidJoiner')),
          })
        : undefined;

      // colSpan classes for grid layout.
      //
      // When the container uses container-query-based grid classes
      // (e.g. `@md:grid-cols-2`), the grid's base is `grid-cols-1`
      // on narrow containers. Applying a bare `col-span-2` in that
      // state causes CSS grid to synthesize an implicit 2nd column
      // track, distorting column widths. We must mirror the same
      // container-query prefix on the col-span utilities so they
      // only engage once the grid is actually multi-column.
      // The effective container is whatever wraps the fields: either
      // `fieldContainerClass` (overrides, typically container-query based)
      // or the locally-computed `gridClass` (viewport-based).
      const containerClass = schema.fieldContainerClass || gridClass;
      // Match both container-query (`@md:`) and viewport (`md:`) prefixes.
      // Return an explicit, statically-detectable class so Tailwind JIT
      // can scan and include it.
      const pickSpanClass = (targetCols: number): string => {
        const re = /(@)?(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl):grid-cols-(\d+)/g;
        const matches = Array.from(containerClass.matchAll(re)).map(m => ({
          at: m[1] || '',
          bp: m[2],
          cols: Number(m[3]),
        }));
        if (!matches.length) {
          // No responsive/container prefix found — bare class is safe
          // because the grid is already multi-column at all widths.
          if (targetCols === 2) return 'col-span-2';
          if (targetCols === 3) return 'col-span-3';
          return 'col-span-4';
        }
        const hit = matches.find(m => m.cols >= targetCols) || matches[matches.length - 1];
        const key = `${hit.at}${hit.bp}:${targetCols}`;
        // Explicit literal map so Tailwind JIT discovers these classes.
        const table: Record<string, string> = {
          '@sm:2':  '@sm:col-span-2',
          '@md:2':  '@md:col-span-2',
          '@lg:2':  '@lg:col-span-2',
          '@xl:2':  '@xl:col-span-2',
          '@2xl:2': '@2xl:col-span-2',
          '@sm:3':  '@sm:col-span-3',
          '@md:3':  '@md:col-span-3',
          '@lg:3':  '@lg:col-span-3',
          '@xl:3':  '@xl:col-span-3',
          '@2xl:3': '@2xl:col-span-3',
          '@4xl:3': '@4xl:col-span-3',
          '@sm:4':  '@sm:col-span-4',
          '@md:4':  '@md:col-span-4',
          '@lg:4':  '@lg:col-span-4',
          '@xl:4':  '@xl:col-span-4',
          '@2xl:4': '@2xl:col-span-4',
          '@4xl:4': '@4xl:col-span-4',
          'sm:2':   'sm:col-span-2',
          'md:2':   'md:col-span-2',
          'lg:2':   'lg:col-span-2',
          'xl:2':   'xl:col-span-2',
          'sm:3':   'sm:col-span-3',
          'md:3':   'md:col-span-3',
          'lg:3':   'lg:col-span-3',
          'xl:3':   'xl:col-span-3',
          'sm:4':   'sm:col-span-4',
          'md:4':   'md:col-span-4',
          'lg:4':   'lg:col-span-4',
          'xl:4':   'xl:col-span-4',
        };
        return table[key] || (targetCols === 2 ? 'col-span-2' : targetCols === 3 ? 'col-span-3' : 'col-span-4');
      };

      const colSpanClass = colSpan && colSpan > 1
        ? colSpan === 2 ? pickSpanClass(2)
        : colSpan === 3 ? pickSpanClass(3)
        : colSpan >= 4 ? pickSpanClass(4)
        : ''
        : '';

      // Metadata-derived stable locator (ADR-0054 C4): the renderer
      // emits it from the object + field name so every generated form
      // inherits it with zero per-app work. Object prefix omitted when
      // the form schema has no owning object.
      const fieldTestId = `field:${schema.objectName ? `${schema.objectName}.` : ''}${name}`;

      const fieldLabelling = resolveFieldLabelling(resolvedType);
      const groupLabelled = fieldLabelling === 'group';

      // A registered field widget whose output is a replacement display drops
      // every prop the host handed down, so the host wraps that output in a
      // named group of its own — see {@link ReadonlyFieldGroup} for the
      // measurement and the shape. Two ways a field gets here, one wrapper:
      //
      //  - `readonly === true` (objectui#4788): the widget's readonly branch
      //    renders the display in place of its control. Unchanged semantics —
      //    this arm still keys off the field STATE, not the declaration, so an
      //    undeclared third-party widget keeps exactly the #4788 behaviour;
      //  - `labelling: 'display'` (objectui#4857): the widget declares that its
      //    surface is a pure display in EVERY state — `formula` / `summary` /
      //    `auto_number` / `vector` have no editable branch at all — so the
      //    wrapper applies in the editable state too. Without this arm those
      //    four lost the host id whenever the form was editable: on the real
      //    object-form path they arrive as `disabled`, not `readonly`
      //    (ObjectForm keeps that distinction deliberately — option 1 of the
      //    #4857 option set was rejected), so the #4788 gate never fired and
      //    the label's `for` dangled.
      //
      // Two further gates, each carrying its own reason:
      //
      //  - `label`: with no visible label there is no naming channel to repair,
      //    and a `role="group"` that nothing names is the inert pair this issue
      //    exists to avoid. Standalone / label-less rendering therefore stays
      //    byte-identical, exactly as `toHostGroupProps` keeps it;
      //  - `!groupLabelled`: the group-labelled widgets already consume the
      //    host's id / name / description themselves (objectui#3961 → #3990 →
      //    #4005). Wrapping them too would nest a second group with the same
      //    name and take the id off the surface those PRs put it on;
      //  - a registered FIELD widget: the builtin branch renders a real control
      //    inside `<FormControl>` in the readonly state too, so its label keeps
      //    a `for` that resolves to a labelable element — measured, and left
      //    alone. (A `'display'` declaration can only come from a registered
      //    widget's meta, so for that arm this gate is belt-and-braces.)
      const hostWrappedDisplay =
        (readonly === true || fieldLabelling === 'display') &&
        !!label &&
        !groupLabelled &&
        resolvesToRegisteredFieldWidget(resolvedType);

      // The visible label is associated by IDREF instead of `for` — it gets an
      // `id`, and the surface that answers to it gets `aria-labelledby`. Two
      // paths reach this shape: a group-labelled widget (objectui#3961), where
      // the WIDGET answers, and a readonly registered widget (objectui#4788),
      // where the host's own wrapper does. `undefined` everywhere else, and
      // every use below is a conditional spread, so the single-control path
      // emits not one changed attribute — no second naming channel for the
      // fields that never needed one (the #3290 / #3222 / #3952 rule: one fact,
      // one author).
      //
      // Whitespace is squeezed out of the field name because this id is consumed
      // as an `aria-labelledby` IDREF, and that attribute is a SPACE-SEPARATED
      // list: an id containing a space would silently resolve to two ids,
      // neither of which exists.
      const hostLabelId =
        label && (groupLabelled || hostWrappedDisplay)
          ? `${labelIdPrefix}${String(name).replace(/\s+/g, '_')}-group-label`
          : undefined;

      // The widget-facing half. Only the group-labelled path hands the IDREF
      // DOWN to the widget: on the host-wrapped path (readonly, or a declared
      // `'display'` widget) the wrapper is the named surface, and passing the
      // same id to the widget as well would give one label two consumers — the
      // double channel #3978 removed.
      const groupLabelId = groupLabelled ? hostLabelId : undefined;

      return (
        <FormField
          key={fieldKey}
          control={form.control}
          name={name}
          rules={rules}
          render={({ field: formField, fieldState }) => (
            <FormItem
              className={colSpanClass || undefined}
              data-testid={fieldTestId}
              data-field={name}
            >
              {label && (
                <FormLabel
                  className="text-xs font-normal text-muted-foreground"
                  // A group-labelled widget (objectui#3961) is named by IDREF:
                  // publish the label's own `id` and drop the `for`. `htmlFor:
                  // undefined` is not a no-op — `<FormLabel>` sets
                  // `htmlFor={formItemId}` BEFORE spreading its props, so this
                  // key removes the attribute. It has to go: a `for` naming a
                  // `div` (or nothing at all) is inert HTML, and leaving it
                  // beside the `aria-labelledby` would give one label two
                  // association channels, one of which is broken.
                  //
                  // A readonly registered widget (objectui#4788) — and a
                  // widget declared `labelling: 'display'`, in every state
                  // (objectui#4857) — reaches the same shape through the
                  // host's own wrapper, and needs the `for` gone for the same
                  // reason: it was measurably DANGLING there, pointing at an
                  // id no element in the document carried.
                  {...(hostLabelId ? { id: hostLabelId, htmlFor: undefined } : null)}
                >
                  {label}
                  {required && (
                    // Purely visual redundancy now that `aria-required` rides
                    // on the control itself (objectui#3290). It used to carry
                    // `aria-label="required"`, which made the asterisk part of
                    // the control's accessible name; keeping both channels
                    // would have assistive tech announce required TWICE — once
                    // inside the name, once as the state. The state channel is
                    // the correct single source, so the marker leaves the
                    // accessibility tree entirely.
                    //
                    // `data-required-marker` is the stable locator for the
                    // sighted-user affordance (ADR-0054 C4), replacing the
                    // `aria-label` that end-to-end specs were selecting on —
                    // a11y attributes must not double as test hooks, which is
                    // how this one survived as long as it did.
                    <span
                      className="text-destructive ml-1"
                      data-required-marker="true"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  )}
                </FormLabel>
              )}
              <FormControl>
                {/* Render the actual field component based on resolved type.
                    A readonly registered widget's output goes inside the host's
                    own named group (objectui#4788) — every other field is handed
                    to `<FormControl>`'s Slot exactly as before. */}
                {withReadonlyHostGroup(hostWrappedDisplay ? hostLabelId : undefined, renderFieldComponent(resolvedType, {
                  ...fieldProps,
                  // Specialized fields need the raw metadata object. `.field`
                  // is the declared metadata slot (#3090 — never the spec
                  // string); fall back to the field config itself when no
                  // metadata was stashed (standalone forms).
                  field: field.field || field,
                  ...formField,
                  inputType: fieldProps.inputType,
                  // The field's label, forwarded explicitly because the
                  // destructure above takes it OFF `fieldProps` (objectui#3393).
                  // Without this key the built-in `textarea` branch's `label`
                  // was `undefined` on every render, so the fullscreen dialog's
                  // title fell to the generic "Edit text" and all three long-text
                  // fields on one form gave their expand buttons the SAME
                  // accessible name. Renderer-only: both strips drop it, so it
                  // reaches no DOM attribute and no registered widget.
                  label,
                  options: isOptionField ? effectiveOptions : fieldProps.options,
                  placeholder: fieldProps.placeholder ?? (resolvedType === 'select' ? t('common.selectOption') : undefined),
                  // `disabled` means "not interactive, muted"; `readonly` means
                  // "shown plainly, not editable" — keep them distinct so widgets
                  // that implement a real readonly display (e.g. EmailField's
                  // mailto link) actually receive it instead of always collapsing
                  // to the grayed-out disabled look. A dependency-gated option
                  // list (#2284) is disabled until its controlling field is set.
                  disabled: disabled || fieldDisabled || isSubmitting || optionGroupGated,
                  readonly,
                  // Gate hint shown when a dependent option list is still
                  // waiting on its controlling field (#2284).
                  emptyHint: gatedHint,
                  dataSource: contextDataSource,
                  // Live form values for dependent (cascading) lookups
                  // (#2215): the widget's `dependsOn` gate + filters must
                  // re-scope as the user picks the parent field in THIS
                  // form, not read a stale record snapshot. Forwarded to
                  // data-source widgets only (see stripRegisteredFieldProps).
                  dependentValues: ruleRecord,
                  // Field name → label for the SAME sibling fields
                  // `dependentValues` carries the values of, so a gated lookup
                  // can say "Select Account first" instead of naming the raw
                  // API name (objectstack#5407). The whole form's map is passed
                  // (not a per-field slice) because the widget reads only the
                  // entries its own `depends_on` names, and one stable
                  // reference keeps the widget's memo deps from thrashing.
                  dependsOnLabels: fieldLabelByName,
                  // The validation slot the widget props contract has declared
                  // all along and nobody produced (objectui#3222). Spelled
                  // `error` because that is what `@objectstack/spec/ui`'s
                  // `FieldWidgetPropsSchema` calls it — the published contract
                  // third-party / AI-authored widgets are written against.
                  //
                  // A widget consumes it for `aria-invalid` ONLY; the message
                  // TEXT belongs to `<FormMessage/>` below. Both halves matter:
                  // `aria-invalid` has to sit on the input element, which only
                  // the widget renders, and `<FormControl>`'s Slot does hand a
                  // correct `aria-invalid` down — but a widget that computes
                  // its own from a prop nobody passed OVERRIDES that Slot value
                  // with `false`. That is how seven widgets ended up never once
                  // announcing an invalid field.
                  //
                  // Undefined when the field is valid, so the key is simply
                  // absent from the DOM rather than rendering `error=""`.
                  error: fieldState.error?.message,
                  // Required is a STATE, so it travels the state channel
                  // (objectui#3290). Until now the resolved `required` (static
                  // `required` + `requiredWhen` CEL) drove exactly one thing —
                  // the red asterisk in `<FormLabel>` — which reached assistive
                  // tech only by being folded into the control's ACCESSIBLE
                  // NAME ("Title required"). Three ways that fails: a name is
                  // read in name order rather than announced as a state, "list
                  // the required fields" navigation cannot see it, and a field
                  // rendered without a `label` (compact layouts, inline grid
                  // editing) draws no asterisk at all, so the signal vanishes.
                  //
                  // No widget change is needed for this to land on the input:
                  // `aria-required` is already declared and typed on the widget
                  // props contract (`FieldWidgetComponentProps & AriaAttributes`)
                  // and every widget forwards its leftover props to the control
                  // it renders. The builtin branch is the same story — neither
                  // `stripRegisteredFieldProps` nor `stripRendererOnlyProps`
                  // touches `aria-*`. That is precisely why #3222 refused to
                  // sink a `required` BOOLEAN into the widget contract: a
                  // boolean gives the asterisk a second author and the next
                  // AI-written widget draws its own, while `aria-required` goes
                  // straight to the DOM with no new key to get wrong.
                  //
                  // `|| undefined` (not `String(required)`) so an optional
                  // field carries NO attribute at all. `aria-required="false"`
                  // is legal but semantically noisier than absence, and absence
                  // is what the dynamic `requiredWhen` FALSE case must produce.
                  //
                  // Deliberately NOT the native `required` attribute: that
                  // would arm the browser's own constraint-validation bubble
                  // alongside react-hook-form's messages — two validators, two
                  // UIs, one field. `aria-required` reports the state without
                  // triggering native validation.
                  'aria-required': required || undefined,
                  // The IDREF half of the group-labelled association
                  // (objectui#3961). Like `aria-required` this needs no new key
                  // in the widget contract — `aria-*` is declared on it as
                  // React's `AriaAttributes`, neither strip touches the prefix,
                  // and `toDomProps` forwards the whole `aria-` family — so the
                  // widget's existing spread carries it to the element it puts
                  // the host's `id` on. The widgets that render a real composite
                  // additionally answer with `role="group"`; `file`, whose single
                  // control is a `div[role="button"]`, just takes the name.
                  //
                  // Spread conditionally so the single-control path receives no
                  // such key at all: absent, not `undefined`.
                  ...(groupLabelId ? { 'aria-labelledby': groupLabelId } : null),
                }))}
              </FormControl>
              {description && (
                <FormDescription>{description}</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      );
    };

    // Extract designer-related props and conflicting handlers
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        onSubmit: _ignoredOnSubmit, // Prevent overwriting our handleSubmit
        onChange: _ignoredOnChange, // Prevent overwriting our onChange
        // Extract schema props that should not be spread to DOM (handled separately by schema destructuring above)
        submitLabel: _submitLabel,
        cancelLabel: _cancelLabel,
        showSubmit: _showSubmit,
        showCancel: _showCancel,
	        resetOnSubmit: _resetOnSubmit,
	        defaultValues: _defaultValues,
	        inputType: _inputType,
          dataSource: _dataSource,
          showActions: _showActions,
          fieldContainerClass: _fieldContainerClass,
          mobileStickyActions: _mobileStickyActions,
          // Remaining FormSchema-level props that are NOT valid <form> DOM
          // attributes. Some callers / the SDUI dispatch spread the whole form
          // node at the top level (in addition to `schema`), so these arrive in
          // `props` and would leak onto the DOM — React warns "does not
          // recognize the `objectName` prop" and "Unknown event handler
          // property `onDirtyChange`" (seen on every object list view). The
          // `schema` destructure above already consumes them; drop the
          // top-level copies here so nothing bleeds through `...formProps`.
          objectName: _objectName,
          onDirtyChange: _onDirtyChangeProp,
          onCancel: _onCancelProp,
          fields: _fields,
          layout: _layout,
          columns: _columns,
          validationMode: _validationMode,
          disabled: _disabledProp,
          fieldTabs: _fieldTabs,
          defaultFieldTab: _defaultFieldTab,
          fieldTabsPosition: _fieldTabsPosition,
          fieldPanes: _fieldPanes,
          fieldPanesOrientation: _fieldPanesOrientation,
          fieldPanesResizable: _fieldPanesResizable,
	        ...formProps
	    } = props;

    return (
      <Form {...form}>
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className={className}
            {...formProps}
            // Apply designer props
            data-obj-id={dataObjId}
            data-obj-type={dataObjType}
            style={style}
        >
          {/* Form Error Alert */}
          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Spec-vocabulary entries cannot be rendered here (#3090) — say so
              in the form instead of silently dropping the fields. */}
          {specVocabularyFields.length > 0 && (
            <Alert variant="destructive" className="mb-4" data-testid="form-spec-vocabulary-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {`Not rendered — spec form-view vocabulary ({ field: … }) in a standalone form: ` +
                  specVocabularyFields.map((f: any) => f.field).join(', ') +
                  '. Use { name: … }, or an object-bound form with sections.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          {schema.children ? (
            // If children are provided directly, render them
            <div className={schema.fieldContainerClass || 'space-y-4'}>
              {renderChildren(schema.children)}
            </div>
          ) : fieldTabGroups ? (
            // Tabbed field layout (#2959): one <form>, one react-hook-form
            // instance, N force-mounted panels. Inactive panels are CSS-hidden
            // (`data-[state=inactive]:hidden`) rather than unmounted, which is
            // what keeps their values and their validation alive.
            <>
              {untabbedFields.length > 0 && (
                <div className={cn(fieldGridClass, 'mb-4')}>
                  {untabbedFields.map(renderFormField)}
                </div>
              )}
              <Tabs
                value={activeFieldTab}
                onValueChange={setPickedFieldTab}
                orientation={isVerticalFieldTabs ? 'vertical' : 'horizontal'}
                // Always a flex container: `order-last` on the strip is what
                // puts it after the panels for `bottom`/`right`, and `order`
                // only applies to flex children.
                className={cn('flex w-full', isVerticalFieldTabs ? 'gap-4' : 'flex-col')}
              >
                <TabsList
                  className={cn(
                    // `self-start` keeps the strip its content's size instead of
                    // being stretched by the flex container above.
                    'self-start',
                    isVerticalFieldTabs
                      ? cn('h-auto flex-col', fieldTabsPosition === 'right' && 'order-last')
                      : fieldTabsPosition === 'bottom' ? 'order-last mt-4' : 'mb-4',
                  )}
                >
                  {fieldTabGroups.map((group) => (
                    <TabsTrigger
                      key={group.key}
                      value={group.key}
                      data-testid={`form-tab:${group.key}`}
                      data-error={erroredFieldTabs.has(group.key) || undefined}
                      className={cn(
                        isVerticalFieldTabs && 'w-full justify-start',
                        erroredFieldTabs.has(group.key) && 'text-destructive data-[state=active]:text-destructive',
                      )}
                    >
                      {group.label}
                      {erroredFieldTabs.has(group.key) && (
                        <span
                          aria-hidden="true"
                          className="ml-1.5 size-1.5 rounded-full bg-destructive"
                        />
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="min-w-0 flex-1">
                  {fieldTabGroups.map((group) => (
                    <TabsContent
                      key={group.key}
                      value={group.key}
                      forceMount
                      className="mt-0 data-[state=inactive]:hidden"
                      data-testid={`form-tab-panel:${group.key}`}
                    >
                      {group.description && (
                        <p className="mb-3 text-sm text-muted-foreground">{group.description}</p>
                      )}
                      <div className={group.containerClass || fieldGridClass}>
                        {group.fields.map(renderFormField)}
                      </div>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            </>
          ) : fieldPaneGroups ? (
            // Split field layout (#2153): one <form>, one react-hook-form
            // instance, N resizable panels. The <form> wraps the GROUP and the
            // panels hold only fields, so the split is purely presentational —
            // it cannot influence which values a submit collects.
            <>
              {unpanedFields.length > 0 && (
                <div className={cn(fieldGridClass, 'mb-4')}>
                  {unpanedFields.map(renderFormField)}
                </div>
              )}
              <ResizablePanelGroup
                orientation={schema.fieldPanesOrientation === 'vertical' ? 'vertical' : 'horizontal'}
                className="min-h-[300px] rounded-lg border"
              >
                {fieldPaneGroups.map((group, index) => (
                  <React.Fragment key={group.key}>
                    {index > 0 && (
                      <ResizableHandle
                        withHandle={schema.fieldPanesResizable !== false}
                        disabled={schema.fieldPanesResizable === false}
                      />
                    )}
                    <ResizablePanel defaultSize={group.defaultSize} minSize={group.minSize}>
                      {/* Each pane is its own `@container`: a pane's field grid
                          must measure the PANE, so a 2-column group collapses to
                          one when the divider is dragged narrow — measuring the
                          whole form would keep it 2-up and overflow. */}
                      <div
                        className={cn('@container p-4', group.containerClass || fieldGridClass)}
                        data-testid={`form-pane:${group.key}`}
                      >
                        {group.fields.map(renderFormField)}
                      </div>
                    </ResizablePanel>
                  </React.Fragment>
                ))}
              </ResizablePanelGroup>
            </>
          ) : (
            // Otherwise render fields from schema
            <div className={fieldGridClass}>
              {fields.map(renderFormField)}
            </div>
          )}

          {/* Form Actions */}
          {(schema.showActions !== false) && (
            <div
              className={cn(
                `flex flex-col sm:flex-row gap-2 ${layout === 'horizontal' ? 'sm:justify-end' : 'sm:justify-start'} mt-6`,
                schema.mobileStickyActions &&
                  'sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur border-t md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-0 md:backdrop-blur-none',
              )}
              data-testid={schema.mobileStickyActions ? 'form-mobile-sticky-actions' : undefined}
            >
              {showCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting || disabled}
                  className="w-full sm:w-auto"
                >
                  {/* `??`, not `||`: an authored `cancelLabel: ''` is an
                      explicit choice (an icon-only / deliberately blank
                      button), not "unset". Only null/undefined falls back. */}
                  {cancelLabel ?? t('common.cancel')}
                </Button>
              )}
              {showSubmit && (
              <Button
                type="submit"
                disabled={isSubmitting || disabled}
                className="w-full sm:w-auto"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel ?? t('common.submit')}
              </Button>
              )}
            </div>
          )}
        </form>
      </Form>
    );
  },
  {
    namespace: 'ui',
    label: 'Form',
    inputs: [
      { 
        name: 'fields', 
        type: 'array', 
        label: 'Fields',
        description: 'Array of field configurations with name, label, type, validation, etc.'
      },
      { 
        name: 'defaultValues', 
        type: 'object', 
        label: 'Default Values',
        description: 'Object with default values for form fields'
      },
      { name: 'submitLabel', type: 'string', label: 'Submit Button Label', defaultValue: 'Submit' },
      { name: 'cancelLabel', type: 'string', label: 'Cancel Button Label', defaultValue: 'Cancel' },
      { name: 'showCancel', type: 'boolean', label: 'Show Cancel Button', defaultValue: false },
      { 
        name: 'layout', 
        type: 'enum', 
        enum: ['vertical', 'horizontal'],
        label: 'Layout',
        defaultValue: 'vertical'
      },
      { 
        name: 'columns', 
        type: 'number', 
        label: 'Number of Columns',
        defaultValue: 1,
        description: 'For multi-column layouts (1-4)'
      },
      { 
        name: 'validationMode', 
        type: 'enum',
        enum: ['onSubmit', 'onBlur', 'onChange', 'onTouched', 'all'],
        label: 'Validation Mode',
        defaultValue: 'onSubmit'
      },
      { name: 'resetOnSubmit', type: 'boolean', label: 'Reset After Submit', defaultValue: false },
      { name: 'disabled', type: 'boolean', label: 'Disabled', defaultValue: false },
      { name: 'className', type: 'string', label: 'CSS Class' },
      { name: 'fieldContainerClass', type: 'string', label: 'Field Container CSS Class' }
    ],
    defaultProps: {
      submitLabel: 'Submit',
      cancelLabel: 'Cancel',
      showCancel: false,
      layout: 'vertical',
      columns: 1,
      validationMode: 'onSubmit',
      resetOnSubmit: false,
      disabled: false,
      fields: [
        {
          name: 'name',
          label: 'Name',
          type: 'input',
          required: true,
          placeholder: 'Enter your name',
        },
        {
          name: 'email',
          label: 'Email',
          type: 'input',
          inputType: 'email',
          required: true,
          placeholder: 'Enter your email',
        },
      ],
    },
  }
);

// Helper function to render field components with proper typing
interface RenderFieldProps {
  inputType?: string;
  options?: SelectOption[];
  placeholder?: string;
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  readonly?: boolean;
  /**
   * Active validation message, forwarded to registered widgets under the name
   * `@objectstack/spec/ui`'s `FieldWidgetPropsSchema` gives it (objectui#3222).
   */
  error?: string;
  /**
   * The field's authored label (objectui#3393). Renderer-only: consumed by the
   * built-in `textarea` branch's fullscreen dialog, stripped before the DOM and
   * before every registered widget (which reads it off `field`).
   */
  label?: string;
  [key: string]: any;
}

// Native date/time inputs only open their picker when the user clicks the tiny
// calendar/clock icon. For these types we open the picker on any click inside the
// box so they behave like the other field widgets (click-anywhere-to-edit).
const NATIVE_PICKER_INPUT_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function openNativePickerOnClick(inputType: string | undefined) {
  if (!inputType || !NATIVE_PICKER_INPUT_TYPES.has(inputType)) return undefined;
  return (e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (el.disabled || el.readOnly) return;
    try {
      (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Browsers throw when the picker can't be shown; the native icon still works.
    }
  };
}

/**
 * The built-in (unregistered) `select` branch's empty state — objectui#3263.
 *
 * A component rather than an inline `<div>` because the copy has to go through
 * `useSafeFormTranslation()`, and `renderFieldComponent` below is a plain
 * helper, not a component: it early-returns on the registered-widget path, so a
 * hook called there would run conditionally (rules-of-hooks). Owning the box
 * gives the hook a legitimate home without changing what the branch renders.
 *
 * The host's `emptyHint` still wins when it computed one (the #2284 dependency
 * gate, already translated via `fields.options.selectFirst`); this only
 * translates the branch's OWN fallback, which was the last hardcoded English
 * copy of that sentence in this file.
 *
 * Deliberately NOT `packages/fields`' `OptionsEmptyState`: different package,
 * different render path (this is the inline `BUILTIN_FIELD_TYPES` branch, that
 * one the registry). What the two share is the i18n KEY, not a component —
 * unifying them would impose one path's styling and props on the other.
 *
 * `...rest` is forwarded because `<FormControl>` is a Radix `Slot`: it hands the
 * control its `id` / `aria-describedby` / `aria-invalid`, so dropping the rest
 * props here would silently unlink the field's own label and error message.
 */
function BuiltinSelectEmptyState({
  emptyHint,
  className,
  ...rest
}: { emptyHint?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const { t } = useSafeFormTranslation();
  return (
    <div className={cn('text-sm text-muted-foreground', className)} {...rest}>
      {emptyHint || t('fields.options.empty')}
    </div>
  );
}

/**
 * The built-in (unregistered) `select` branch's control — objectui#3976.
 *
 * Radix's `Select.Root` renders NO DOM element of its own, so every prop it does
 * not recognise is silently DROPPED instead of reaching an element. The branch
 * used to spread its whole DOM pass-through onto that Root, which is where
 * `<FormControl>`'s Slot puts the field's `id` / `aria-describedby` /
 * `aria-invalid` and the call site puts `aria-required` — so a bare
 * `{ type: 'select' }` rendered a visible `<FormLabel for="…-form-item">`
 * pointing at an id NO element carried: the label was inert (clicking it did
 * nothing) and the field had no accessible name, no error link and no required
 * state at all.
 *
 * This is the exact mechanism objectui#3306 fixed on the WIDGET side
 * (`SelectField` routes its pass-through to `SelectTrigger`); the built-in
 * branch never followed, and the two `select` paths diverge because
 * `BUILTIN_FIELD_TYPES` contains `'select'` — so a bare `type: 'select'` never
 * consults the registry while an object-driven `field:select` does.
 *
 * A component (rather than inline JSX in the branch) is what makes the fix
 * possible at all: the Slot injects into whatever ELEMENT the branch returns, so
 * only a component boundary can receive those props and re-address them. Same
 * reason `BuiltinSelectEmptyState` above is a component.
 *
 * The pass-through lands on `SelectTrigger` — the focusable
 * `<button role="combobox">` the user and their screen reader actually interact
 * with — with the same two deliberate exceptions #3306 kept on Root:
 *
 *  - `name`: the one key Root genuinely consumes — it forwards it to the hidden
 *    native `<select>` that takes part in form submission. On the trigger it
 *    would sit uselessly on a non-submitter `<button>`.
 *  - `disabled`: Root is the single authority (it disables trigger, items and
 *    the hidden select together), so the raw prop must not get a second author.
 *
 * `ref` rides the pass-through for the same reason the `aria-*` do: react-hook-form
 * hands every field a `ref` and this branch dropped it on Root, so the built-in
 * select was the one built-in control RHF could not focus. Forwarded here to the
 * trigger, exactly like `input`/`textarea` hand theirs to a real element.
 */
type BuiltinSelectControlProps = {
  options: SelectOption[];
  placeholder?: string;
  /** The AUTHORED value — stringified for Radix on the way in (#3090). */
  value?: OptionValue | null;
  /** Receives the AUTHORED option value, not Radix's string (#3090). */
  onValueChange?: (next: OptionValue) => void;
  disabled?: boolean;
} & Omit<
  React.ComponentPropsWithoutRef<typeof SelectTrigger>,
  'value' | 'onValueChange' | 'disabled' | 'children'
>;

const BuiltinSelectControl = React.forwardRef<HTMLButtonElement, BuiltinSelectControlProps>(
  function BuiltinSelectControl(
    { options, placeholder, value, onValueChange, disabled, name, className, ...triggerDomProps },
    ref,
  ) {
    return (
      // Radix speaks strings: stringify going in, map the selection back to
      // the AUTHORED option value coming out, so a numeric/boolean option
      // round-trips typed instead of morphing to "2" in the payload (#3090).
      <Select
        name={name}
        value={toControlValue(value)}
        onValueChange={(v) => onValueChange?.(matchOptionValue(options, v))}
        disabled={disabled}
      >
        <SelectTrigger
          ref={ref}
          {...triggerDomProps}
          // `cn`-merged rather than spread-ordered: an authored `className` must
          // be able to override the touch-target height without deleting it by
          // accident, and this prop reached no element before the fix.
          className={cn('min-h-[44px] sm:min-h-0', className)}
        >
          {/* No `|| 'Select an option'` — objectui#3272. The single call site
              already supplies `t('common.selectOption')` for `select`, so the
              literal was all but unreachable; the ONE stack that did reach it
              was an authored `placeholder: ''` (the call site's `??` keeps an
              empty string), where a second fallback overrode the author's
              explicit blank with an untranslated English word. */}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt: SelectOption) => (
            <SelectItem key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  },
);

function renderFieldComponent(type: string, props: RenderFieldProps) {
  // 1. Try to resolve specialized field widget from registry first.
  //    Form fields should always prefer the `field:<type>` namespace when
  //    available (e.g. so { type: 'text' } in a form schema resolves to the
  //    text input field, not the display text widget that shares the same
  //    short name in the global registry).
  //
  //    Which entry answered decides which CONTRACT the resolved component
  //    implements, so the lookups are kept apart rather than folded into one
  //    `||` chain (objectui#3233):
  //
  //      - a `field:` entry is a FIELD WIDGET — `FieldWidgetComponentProps`,
  //        whose metadata carrier is `field` and nothing else since v17;
  //      - the bare-name fallback is a plain SDUI COMPONENT (the display
  //        `text` widget, `alert`, `badge` …). Its contract is the universal
  //        `schema` node every registered component receives from
  //        `SchemaRenderer`. That key is NOT retired and must still be passed,
  //        or such a field renders `undefined.className`.
  const namespacedWidget = !BUILTIN_FIELD_TYPES.has(type) && !type.includes(':')
    ? ComponentRegistry.get(`field:${type}`)
    : undefined;
  const RegisteredComponent = !BUILTIN_FIELD_TYPES.has(type)
    ? (namespacedWidget || ComponentRegistry.get(type))
    : undefined;
  // A colon-qualified type resolves directly, and is a field widget only when
  // it names the `field` namespace (`type: 'field:textarea'`).
  const isFieldWidget = !!namespacedWidget || type.startsWith('field:');

  if (RegisteredComponent) {
    const registeredProps = stripRegisteredFieldProps(type, props);

    if (isFieldWidget) {
      // `field` is the single metadata carrier (objectui#3233). It rides in
      // `registeredProps` untouched — the caller always sets it (`field.field
      // || field`, i.e. the raw metadata object, never undefined) and
      // `stripRegisteredFieldProps` keeps it.
      //
      // This used to ALSO pass `schema={props.field || props.schema || props}`,
      // a second key carrying the *same* object: `props.field` is truthy at the
      // only call site, so the two chain terms after it were unreachable and
      // `schema` was always `=== props.field`. Widgets therefore resolved
      // `field || schema` to `field` on this path every time — which is why
      // dropping the key here changes no payload, only the number of spellings
      // a widget author has to know.
      return <RegisteredComponent {...registeredProps} />;
    }

    // Non-field component reached through the bare-name fallback: `schema` is
    // ITS contract, not the retired field-widget carrier, so the original
    // resolution is preserved verbatim.
    const nodeSchema = props.field || props.schema || props;
    return <RegisteredComponent schema={nodeSchema} {...registeredProps} />;
  }

  const { inputType, options = [], placeholder, readonly, emptyHint, ...fieldProps } = props;
  const domFieldProps = stripRendererOnlyProps(fieldProps);
  // Text-like controls get a real readonly treatment (native `readOnly` +
  // a soft, non-"disabled" tint) instead of being grayed out. Toggle/choice
  // controls (checkbox/switch/select) have no meaningful "look but don't
  // touch" state of their own, so for those `readonly` falls back to disabled.
  const readonlyInputClass = readonly && 'bg-muted/40 cursor-default focus-visible:ring-0';

  switch (type) {
    case 'input':
      if (inputType === 'file') {
        // File inputs cannot be controlled with value prop
         const { value, ...fileProps } = domFieldProps;
         return <Input type="file" placeholder={placeholder} className="min-h-[44px] sm:min-h-0" {...fileProps} />;
      }
      return (
        <Input
          type={inputType || 'text'}
          placeholder={placeholder}
          className={cn('min-h-[44px] sm:min-h-0', readonlyInputClass)}
          {...domFieldProps}
          onClick={(e) => {
            openNativePickerOnClick(inputType)?.(e);
            domFieldProps.onClick?.(e);
          }}
          readOnly={readonly}
          value={domFieldProps.value ?? ''}
        />
      );

    case 'textarea': {
      // `mobile_fullscreen` is the flag's ONE spelling (objectui#3303). This
      // branch used to read `mobile_fullscreen || fullscreen`; the second term
      // had no producer anywhere in this repo or in `@objectstack/spec` — the
      // only `fullscreen` properties that exist belong to the unrelated
      // feedback/loading overlay — so it was undefined from the day it was
      // written, while advertising a spelling that silently does nothing to
      // whoever reads this file next (AGENTS.md #0.1). `ObjectForm` is the sole
      // producer and it stamps `mobile_fullscreen` (#3245/#3300), which is also
      // the single spelling `TextAreaField` and `RichTextField` read.
      //
      // `label` rides the same way: read off the PRE-strip props, because
      // `stripRendererOnlyProps` discards it for the DOM (objectui#3393). It
      // used to be discarded by a local `const { label: _label, ...rest }` on
      // the next line — which ESLint flagged as an unused binding, correctly:
      // the call site never forwarded a `label`, so the guard was defending
      // against something that never arrived, while every OTHER built-in
      // branch had no guard at all. Now the strip owns it for all branches.
      //
      // `error` rides the same way, and for the same reason (objectui#4824):
      // `stripRendererOnlyProps` discards it because the INLINE control takes
      // its `aria-invalid` from `<FormControl>`'s Slot and would only gain a
      // stray `error="…"` attribute. The fullscreen DIALOG's control is built
      // from scratch inside this branch, reaches no Slot, and so had no way to
      // say the field had failed — measured announcing nothing at all while the
      // inline control announced `aria-invalid="true"` for the same field. The
      // primitive, not this branch, decides what to do with it.
      const { mobile_fullscreen, label, error } = fieldProps as any;
      const rest = stripRendererOnlyProps(fieldProps);
      if (mobile_fullscreen) {
        return (
          <FullscreenTextarea
            placeholder={placeholder}
            label={label}
            error={error}
            // `readonly` is destructured off `props` at the top of this
            // function, so — exactly like `label` and `mobile_fullscreen` — it
            // is NOT in `rest` and has to be forwarded by name (objectui#3400).
            // The non-fullscreen exit below always did this; this exit forwarded
            // neither the attribute nor the tint, which is why a read-only long
            // text field was editable in place the moment the fullscreen flag
            // was on. (`disabled` rides `rest`, which no strip touches.)
            className={cn('min-h-[44px] sm:min-h-0', readonlyInputClass)}
            {...rest}
            readOnly={readonly}
            value={rest.value ?? ''}
          />
        );
      }
      return (
        <Textarea
          placeholder={placeholder}
          className={cn('min-h-[44px] sm:min-h-0', readonlyInputClass)}
          {...rest}
          readOnly={readonly}
          value={rest.value ?? ''}
        />
      );
    }

    case 'checkbox': {
      // For checkbox, we need to handle the value differently
      const { value, onChange, disabled: cbDisabled, ...checkboxProps } = domFieldProps;
      return (
        <Checkbox
          checked={value}
          onCheckedChange={onChange}
          disabled={cbDisabled || readonly}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          {...checkboxProps}
        />
      );
    }

    case 'switch': {
      // For switch, we need to handle the value differently (same as checkbox)
      const { value, onChange, disabled: swDisabled, ...switchProps } = domFieldProps;
      return (
        <Switch
          checked={value}
          onCheckedChange={onChange}
          disabled={swDisabled || readonly}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          {...switchProps}
        />
      );
    }

    case 'select': {
      // For select with react-hook-form, we need to handle the onChange
      const { value: selectValue, onChange: selectOnChange, disabled: selDisabled, ...selectProps } = domFieldProps;

      // Safety check for options. When a dependent (cascading) select is still
      // waiting on its controlling field the renderer passes a gate hint (#2284)
      // — surface that instead of the generic "no options" so the user knows to
      // pick the parent first rather than reading it as a broken widget.
      if (!options || options.length === 0) {
        return <BuiltinSelectEmptyState emptyHint={emptyHint} />;
      }

      // The DOM pass-through goes to the CONTROL, not to Radix's element-less
      // Root (objectui#3976) — see `BuiltinSelectControl`. Spread first so the
      // branch's own computations below win over anything the host forwarded,
      // the #3222 discipline.
      return (
        <BuiltinSelectControl
          {...selectProps}
          options={options}
          placeholder={placeholder}
          value={selectValue}
          onValueChange={selectOnChange}
          disabled={selDisabled || readonly}
        />
      );
    }

    default:
      return (
        <Input
          type={inputType || 'text'}
          placeholder={placeholder}
          className={cn(readonlyInputClass)}
          {...domFieldProps}
          onClick={(e) => {
            openNativePickerOnClick(inputType)?.(e);
            domFieldProps.onClick?.(e);
          }}
          readOnly={readonly}
        />
      );
  }
}
