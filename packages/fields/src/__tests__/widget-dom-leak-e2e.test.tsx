/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * GATE: no field widget may leak a non-DOM prop onto a DOM element
 * (objectui#3291).
 *
 * Every registered field widget is rendered through BOTH hosts, and every
 * attribute of every element it produced is checked against what HTML actually
 * defines. An attribute nobody can explain is a leak.
 *
 * ## What this catches that a unit test cannot
 *
 * The leak was never in one widget. It was structural: a widget spread
 * `{...props}` onto its control, and the hosts hand a widget more than the DOM
 * can take. Measured on `origin/main`, a real form, a real widget:
 *
 * ```
 * <input placeholder="PH-f" zzcanary="CANARY-STR" zzcanaryobj="[object Object]"
 *        zzcanarynum="42" id="…" type="text" value="" name="f">
 * ```
 *
 * `zzcanaryobj="[object Object]"` is an ordinary key an author wrote on the
 * field config. That is why the fix is a WHITELIST (`toDomProps`) and why this
 * test plants canaries rather than checking a list of known-bad names: a
 * blacklist of today's renderer props would pass all three canaries above.
 *
 * ## Four things that silently defeat a test like this
 *
 * 1. **React warnings prove nothing.** React 19 passes an all-lowercase
 *    unknown attribute through in COMPLETE silence. In the audit sweep the
 *    only warning came from a camelCase canary — which was written to the DOM
 *    anyway. So this walks real DOM attributes and never listens for console
 *    output.
 * 2. **Both hosts, or the result is a false pass.** The form renderer strips a
 *    known set before forwarding; `SchemaRenderer` spreads the whole authored
 *    node with NO strip layer, so it leaks strictly more (`label` is only
 *    visible there). On that path the widget's own spread is the only defence.
 * 3. **An error variant that produces no error tests nothing.** `required` +
 *    a `false` boolean does NOT fail here — this repo made `required` a
 *    presence check, so `false` is a value (cloud#972). The audit's first pass
 *    under-reported the `error` leak by one widget for exactly this reason.
 *    Every error variant therefore ASSERTS the message rendered before it
 *    scans; a variant that silently produces no error fails the test.
 * 4. **This repo runs happy-dom, not jsdom** (`vitest.config.mts`), whose IDL
 *    coverage has real gaps — `select[size]`, `option[label]`, `textarea[wrap]`
 *    and `col[span]` are all standard HTML that happy-dom does not reflect.
 *    See {@link isKnownAttribute} for how the judge is built, and
 *    {@link HAPPY_DOM_IDL_GAPS} for each measured exception and its reason.
 *    Every one of those four was found BY the calibration fixture below, not
 *    by guesswork.
 *
 * ## The judge proves itself
 *
 * Two fixtures run before the sweep: standard markup that must yield ZERO
 * findings, and markup with planted fake attributes that must ALL be found.
 * When a happy-dom upgrade changes IDL coverage, those fail loudly instead of
 * the sweep going quietly blind.
 *
 * ## Deliberate coverage boundary
 *
 * Popovers are NOT opened. Radix needs pointer-capture APIs happy-dom does not
 * implement. Every widget's props spread lands on its inline control (the
 * trigger for a picker), which always renders — so the spread site IS covered,
 * but content that exists only inside an open dropdown is NOT scanned by this
 * test.
 *
 * Widgets are registered from STATIC imports wrapped in `withFieldCarrier`,
 * never via `registerAllFields()`, which wraps every loader in `React.lazy` —
 * an unbounded module load inside a bounded `waitFor` is this repo's known
 * flake generator (AGENTS.md 测试纪律 / objectui#3010).
 */

import type { ComponentType } from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';
// Module scope: pulls in the form renderer's registration side effect.
import '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';

import { withFieldCarrier } from '../withFieldCarrier';
import { FORM_FIELD_TYPES } from '../index';

import { TextField } from '../widgets/TextField';
import { TextAreaField } from '../widgets/TextAreaField';
import { NumberField } from '../widgets/NumberField';
import { BooleanField } from '../widgets/BooleanField';
import { SelectField } from '../widgets/SelectField';
import { DateField } from '../widgets/DateField';
import { DateTimeField } from '../widgets/DateTimeField';
import { TimeField } from '../widgets/TimeField';
import { EmailField } from '../widgets/EmailField';
import { PhoneField } from '../widgets/PhoneField';
import { UrlField } from '../widgets/UrlField';
import { MultiSelectField } from '../widgets/MultiSelectField';
import { RadioField } from '../widgets/RadioField';
import { CheckboxesField } from '../widgets/CheckboxesField';
import { TagsField } from '../widgets/TagsField';
import { CurrencyField } from '../widgets/CurrencyField';
import { PercentField } from '../widgets/PercentField';
import { PasswordField } from '../widgets/PasswordField';
import { RichTextField } from '../widgets/RichTextField';
import { LookupField } from '../widgets/LookupField';
import { FileField } from '../widgets/FileField';
import { ImageField } from '../widgets/ImageField';
import { LocationField } from '../widgets/LocationField';
import { FormulaField } from '../widgets/FormulaField';
import { SummaryField } from '../widgets/SummaryField';
import { AutoNumberField } from '../widgets/AutoNumberField';
import { UserField } from '../widgets/UserField';
import { ObjectField } from '../widgets/ObjectField';
import { VectorField } from '../widgets/VectorField';
import { GridField } from '../widgets/GridField';
import { ColorField } from '../widgets/ColorField';
import { SliderField } from '../widgets/SliderField';
import { RatingField } from '../widgets/RatingField';
import { CodeField } from '../widgets/CodeField';
import { AvatarField } from '../widgets/AvatarField';
import { AddressField } from '../widgets/AddressField';
import { GeolocationField } from '../widgets/GeolocationField';
import { SignatureField } from '../widgets/SignatureField';
import { QRCodeField } from '../widgets/QRCodeField';
import { ObjectRefField } from '../widgets/ObjectRefField';
import { FilterConditionField } from '../widgets/FilterConditionField';
import { RecipientPickerField } from '../widgets/RecipientPickerField';

/* ════════════════════════════════════════════════════════════════════════════
 * The judge: is this attribute one HTML actually defines?
 * ══════════════════════════════════════════════════════════════════════════ */

/** Open families. `data-*` is the one open family the widget contract declares. */
const OPEN_PREFIXES = [
  'data-',
  'aria-',
  // `cmdk-root` / `cmdk-input` / `cmdk-list` … are marks the cmdk library puts
  // on ITS OWN DOM. Not prop pass-through, and present on every cmdk-based
  // picker (`object-ref`, `lookup`, …) the moment it renders.
  'cmdk-',
];

/**
 * Global HTML attributes. Most are also IDL properties and would be caught by
 * the reflection check below; they are listed because a missing IDL for a
 * genuinely global attribute would otherwise read as a leak.
 */
const GLOBAL_HTML_ATTRIBUTES = new Set([
  'id', 'class', 'style', 'title', 'lang', 'dir', 'hidden', 'tabindex', 'role',
  'slot', 'part', 'exportparts', 'itemid', 'itemprop', 'itemref', 'itemscope',
  'itemtype', 'translate', 'draggable', 'spellcheck', 'autocapitalize',
  'autocorrect', 'contenteditable', 'enterkeyhint', 'inputmode', 'accesskey',
  'nonce', 'is', 'popover', 'inert', 'autofocus',
]);

/**
 * Attributes whose IDL property is spelled differently enough that the
 * case-insensitive reflection match below cannot find them.
 */
const ATTRIBUTE_TO_IDL_ALIAS: Record<string, string> = {
  'class': 'className',
  'for': 'htmlFor',
  'accept-charset': 'acceptCharset',
  'http-equiv': 'httpEquiv',
};

/**
 * MEASURED gaps in happy-dom's IDL, kept deliberately tiny — each entry is an
 * attribute HTML defines that happy-dom's element does not reflect as a
 * property, so reflection alone would report it as a leak.
 */
const HAPPY_DOM_IDL_GAPS: Record<string, Set<string>> = {
  // `HTMLSelectElement.size` is standard; happy-dom does not define it.
  select: new Set(['size']),
  // `HTMLOptionElement.label` is standard; happy-dom does not define it.
  option: new Set(['label']),
  // `HTMLTextAreaElement.wrap` is standard; happy-dom does not define it.
  textarea: new Set(['wrap']),
  // `HTMLTableColElement.span` is standard; happy-dom does not define it.
  col: new Set(['span']),
  colgroup: new Set(['span']),
};

/**
 * SVG needs its own list: the reflection trick does NOT hold for SVG under
 * happy-dom (`SVGElement` reflects almost nothing), and lucide icons put a
 * fixed set of presentation attributes on every icon they render.
 */
const SVG_ATTRIBUTES = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'viewbox', 'preserveaspectratio',
  'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx',
  'ry', 'd', 'points', 'transform', 'fill', 'fill-rule', 'fill-opacity',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity',
  'clip-path', 'clip-rule', 'mask', 'offset', 'stop-color', 'stop-opacity',
  'gradientunits', 'gradienttransform', 'patternunits', 'text-anchor',
  'dominant-baseline', 'font-size', 'font-family', 'font-weight', 'vector-effect',
  'shape-rendering', 'focusable', 'overflow', 'color',
]);

/** Lowercased IDL property names on a tag's prototype chain, cached per tag. */
const idlCache = new Map<string, Set<string>>();

function idlPropertiesFor(tagName: string): Set<string> {
  const tag = tagName.toLowerCase();
  const cached = idlCache.get(tag);
  if (cached) return cached;

  const names = new Set<string>();
  const element = document.createElement(tag);
  for (const own of Object.getOwnPropertyNames(element)) names.add(own.toLowerCase());
  for (
    let proto = Object.getPrototypeOf(element);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) names.add(name.toLowerCase());
  }
  idlCache.set(tag, names);
  return names;
}

/**
 * The rule: an attribute is legitimate when HTML/SVG defines it for that
 * element, or when it belongs to an open family.
 *
 * The reflection check ("does the element's prototype chain carry a property
 * with this name, case-insensitively?") is what makes this maintainable — it
 * covers `readonly→readOnly`, `maxlength→maxLength`, `colspan→colSpan` and
 * every other per-tag attribute automatically, instead of a hand-kept table
 * per element type that would rot.
 */
function isKnownAttribute(element: Element, attribute: string): boolean {
  const name = attribute.toLowerCase();

  if (OPEN_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;

  // Inline event handlers (`onclick`) reflect as IDL properties on every
  // element; React never emits them as attributes, so reaching one means a
  // handler-shaped prop was stringified onto the DOM. Treat as a leak.
  if (name.startsWith('on')) return false;

  const tag = element.tagName.toLowerCase();

  if (element.namespaceURI === 'http://www.w3.org/2000/svg') {
    return SVG_ATTRIBUTES.has(name) || GLOBAL_HTML_ATTRIBUTES.has(name);
  }

  if (GLOBAL_HTML_ATTRIBUTES.has(name)) return true;
  if (HAPPY_DOM_IDL_GAPS[tag]?.has(name)) return true;

  const idl = idlPropertiesFor(tag);
  const alias = ATTRIBUTE_TO_IDL_ALIAS[name];
  if (alias && idl.has(alias.toLowerCase())) return true;
  return idl.has(name);
}

interface Leak {
  tag: string;
  attribute: string;
  value: string;
  outerHTML: string;
}

/** Every unexplained attribute on `root` and its descendants. */
function findLeaks(root: Element): Leak[] {
  const leaks: Leak[] = [];
  const elements: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      if (isKnownAttribute(element, attribute.name)) continue;
      leaks.push({
        tag: element.tagName.toLowerCase(),
        attribute: attribute.name,
        value: attribute.value,
        outerHTML: element.outerHTML.slice(0, 400),
      });
    }
  }
  return leaks;
}

/**
 * Renders the finding as the assertion's "actual" value, so a failure names
 * the widget, the element, the attribute, its value and the markup. A 46-widget
 * sweep failing as `expected [] to equal [ …47 items ]` is unusable.
 */
function leakReport(widgetType: string, variant: string, leaks: Leak[]): string {
  if (leaks.length === 0) return '';
  const lines = leaks.map(
    (leak) =>
      `  <${leak.tag}> leaked ${leak.attribute}="${leak.value}"\n` +
      `      in: ${leak.outerHTML}`,
  );
  return (
    `field:${widgetType} [${variant}] leaked ${leaks.length} non-DOM ` +
    `attribute(s):\n${lines.join('\n')}`
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * The judge proves itself, BEFORE it is trusted on 46 widgets
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ordinary, correct markup. Every attribute here is one HTML defines, several
 * chosen precisely because their IDL name differs from the attribute
 * (`readonly`/`maxlength`/`colspan`/`class`/`for`), plus the two happy-dom IDL
 * gaps (`select[size]`, `option[label]`) and a cmdk mark.
 */
const CLEAN_FIXTURE = `
  <div id="root" class="a b" title="t" role="group" tabindex="0" hidden
       data-testid="x" aria-label="l" data-state="open">
    <input type="text" name="n" value="v" placeholder="p" readonly maxlength="5"
           minlength="1" required autofocus autocomplete="off" inputmode="text"
           step="1" min="0" max="9" pattern=".*" list="dl" />
    <textarea rows="3" cols="4" wrap="soft" readonly></textarea>
    <select size="2" multiple><option label="L" value="v" selected></option></select>
    <button type="button" disabled formnovalidate value="on">b</button>
    <a href="#" target="_blank" rel="noopener" download hreflang="en"></a>
    <label for="root">l</label>
    <img src="s.png" alt="a" width="10" height="10" loading="lazy" decoding="async" />
    <table><colgroup><col span="2" /></colgroup><tbody><tr>
      <td colspan="2" rowspan="1" headers="h"></td></tr></tbody></table>
    <div cmdk-root=""><div cmdk-list=""></div></div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round" class="icon"><path d="M0 0h24v24H0z" /></svg>
  </div>
`;

/** Every planted attribute here MUST be reported. */
const PLANTED_LEAKS: ReadonlyArray<readonly [string, string]> = [
  // The renderer-only props that reached the DOM in the audit.
  ['schema', '[object Object]'],
  ['error', 'Title is required'],
  ['emptyhint', 'Select country first'],
  ['datasource', '[object Object]'],
  ['dependentvalues', '[object Object]'],
  ['dependson', 'country'],
  ['inputtype', 'text'],
  ['compact', 'true'],
  ['onselectrecord', 'function'],
  // The SDUI-only extra.
  ['label', 'Title'],
  // The open tail: arbitrary keys an author wrote on the field config.
  ['zzcanary', 'CANARY-STR'],
  ['zzcanaryobj', '[object Object]'],
  ['zzcanarynum', '42'],
  ['zzcanarycamel', 'CANARY-CAMEL'],
  ['reference_to', 'contacts'],
];

describe('the leak judge is calibrated (objectui#3291)', () => {
  it('reports NOTHING on standard markup — no false positives', () => {
    const host = document.createElement('div');
    host.innerHTML = CLEAN_FIXTURE;
    document.body.appendChild(host);
    try {
      const leaks = findLeaks(host);
      expect(
        leaks.map((l) => `<${l.tag}> ${l.attribute}="${l.value}"`).join('\n'),
      ).toBe('');
    } finally {
      host.remove();
    }
  });

  it('reports EVERY planted fake attribute — no false negatives', () => {
    const host = document.createElement('div');
    const planted = PLANTED_LEAKS.map(([name, value]) => `${name}="${value}"`).join(' ');
    // On an <input>, so nothing can be excused by a permissive container.
    host.innerHTML = `<input type="text" name="n" ${planted} />`;
    document.body.appendChild(host);
    try {
      const found = new Set(findLeaks(host).map((leak) => leak.attribute));
      const missed = PLANTED_LEAKS.map(([name]) => name).filter((name) => !found.has(name));
      expect(missed).toEqual([]);
      expect(found.size).toBe(PLANTED_LEAKS.length);
    } finally {
      host.remove();
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * Every registered field widget, both hosts
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Static components for the widget map's keys. Kept as one object so the
 * parity assertion below can prove it covers the whole registry: a NEW field
 * type added to `fieldWidgetMap` without a line here fails loudly rather than
 * quietly going unscanned.
 */
const WIDGETS: Record<string, ComponentType<any>> = {
  text: TextField,
  textarea: TextAreaField,
  number: NumberField,
  boolean: BooleanField,
  select: SelectField,
  date: DateField,
  datetime: DateTimeField,
  time: TimeField,
  email: EmailField,
  phone: PhoneField,
  url: UrlField,
  multiselect: MultiSelectField,
  radio: RadioField,
  checkboxes: CheckboxesField,
  tags: TagsField,
  currency: CurrencyField,
  percent: PercentField,
  password: PasswordField,
  markdown: RichTextField,
  html: RichTextField,
  richtext: RichTextField,
  lookup: LookupField,
  master_detail: LookupField,
  file: FileField,
  image: ImageField,
  location: LocationField,
  formula: FormulaField,
  summary: SummaryField,
  auto_number: AutoNumberField,
  user: UserField,
  owner: UserField,
  object: ObjectField,
  vector: VectorField,
  grid: GridField,
  color: ColorField,
  slider: SliderField,
  rating: RatingField,
  code: CodeField,
  avatar: AvatarField,
  address: AddressField,
  geolocation: GeolocationField,
  signature: SignatureField,
  qrcode: QRCodeField,
  'object-ref': ObjectRefField,
  'filter-condition': FilterConditionField,
  'recipient-picker': RecipientPickerField,
};

/** Option widgets render an "unfillable" placeholder unless offered a list. */
const OPTION_TYPES = new Set(['select', 'multiselect', 'radio', 'checkboxes', 'tags']);
const OPTIONS = [
  { label: 'Alpha', value: 'alpha' },
  { label: 'Beta', value: 'beta' },
];

/**
 * The value each variant starts from: `null` is MISSING for the required check
 * this repo implements (presence, not truthiness — `false` and `0` are values,
 * cloud#972), so one value drives a real validation failure for every type,
 * including `boolean`. Trap 3 above is why that matters, and why every error
 * variant asserts the message before it scans.
 */
const MISSING_VALUE = null;

/** Author-written extras — the open tail that a blacklist cannot close. */
const AUTHORED_EXTRAS = {
  zzcanary: 'CANARY-STR',
  zzcanaryobj: { nested: true },
  zzcanarynum: 42,
  zzcanaryCamel: 'CANARY-CAMEL',
  reference_to: 'contacts',
};

function fieldConfig(type: string, extras: Record<string, unknown> = {}) {
  return {
    name: 'f',
    label: 'F',
    type: `field:${type}`,
    ...(OPTION_TYPES.has(type) ? { options: OPTIONS } : {}),
    ...extras,
  };
}

function renderForm(field: Record<string, unknown>, required: boolean) {
  const Form = ComponentRegistry.get('form')!;
  return render(
    <Form
      schema={{
        type: 'form',
        mode: 'create',
        showSubmit: true,
        showCancel: false,
        submitLabel: 'Create',
        defaultValues: { f: MISSING_VALUE },
        fields: [{ ...field, required }],
        onSubmit: () => {},
      }}
    />,
  );
}

/**
 * The form row. Waiting on `[data-field]` (emitted by `FormItem` for EVERY
 * field) rather than widget-specific copy keeps the wait condition identical
 * for all 46 widgets and independent of what any one of them renders.
 */
async function formRow(): Promise<Element> {
  return waitFor(() => {
    const row = document.querySelector('[data-field="f"]');
    if (!row) throw new Error('field row never rendered');
    return row;
  });
}

beforeAll(() => {
  for (const [type, Widget] of Object.entries(WIDGETS)) {
    // `withFieldCarrier` is the real registration seam (objectui#3233) — going
    // around it would test a widget in a shape no host ever produces.
    ComponentRegistry.register(type, withFieldCarrier(Widget) as any, {
      namespace: 'field',
      skipFallback: true,
    });
  }
}, 60000);

beforeEach(() => {
  if (!(Element.prototype as any).scrollIntoView) {
    (Element.prototype as any).scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('no field widget leaks non-DOM props to the DOM (objectui#3291)', () => {
  it('covers every field type the form can render', () => {
    // The gate's reach. Without this, adding a widget adds an unscanned widget.
    expect(Object.keys(WIDGETS).sort()).toEqual([...FORM_FIELD_TYPES].sort());
  });

  const types = Object.keys(WIDGETS);

  it.each(types)('field:%s — form path, plain field', async (type) => {
    renderForm(fieldConfig(type), false);
    const row = await formRow();
    expect(leakReport(type, 'form/plain', findLeaks(row))).toBe('');
  });

  it.each(types)('field:%s — form path, author-written extra keys', async (type) => {
    // The largest measured leak source: the form renderer destructures a fixed set
    // of known keys and forwards the rest verbatim, so anything else an author
    // put on the field config arrives at the widget as a prop.
    renderForm(fieldConfig(type, AUTHORED_EXTRAS), false);
    const row = await formRow();
    expect(leakReport(type, 'form/authored-extras', findLeaks(row))).toBe('');
  });

  it.each(types)('field:%s — form path, after a real validation failure', async (type) => {
    renderForm(fieldConfig(type), true);
    const row = await formRow();

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    // Trap 3: scan only once the error is PROVEN to exist. A variant that
    // silently produced none would otherwise pass while testing nothing.
    await waitFor(() => {
      expect(document.querySelector('[data-field="f"]')?.textContent ?? '').toContain(
        'is required',
      );
    });

    expect(leakReport(type, 'form/validation-error', findLeaks(await formRow()))).toBe('');
  });

  it.each(types)('field:%s — SDUI path, plain node', async (type) => {
    // Strictly wider than the form path: `SchemaRenderer` spreads the whole
    // authored node as props with no strip layer, so the widget's own spread
    // is the only defence here.
    const { container } = render(
      <SchemaRenderer schema={{ ...fieldConfig(type), type: `field:${type}` } as any} />,
    );
    await waitFor(() => expect(container.firstElementChild).toBeTruthy());
    expect(leakReport(type, 'sdui/plain', findLeaks(container))).toBe('');
  });

  it.each(types)('field:%s — SDUI path, author-written extra keys', async (type) => {
    const { container } = render(
      <SchemaRenderer
        schema={{ ...fieldConfig(type, AUTHORED_EXTRAS), type: `field:${type}` } as any}
      />,
    );
    await waitFor(() => expect(container.firstElementChild).toBeTruthy());
    expect(leakReport(type, 'sdui/authored-extras', findLeaks(container))).toBe('');
  });
});
