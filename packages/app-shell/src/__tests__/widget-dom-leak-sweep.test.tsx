/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MEASUREMENT GATE: the objectui#3291 DOM-leak canary sweep, generalized beyond
 * `packages/fields` to the registry-reachable SDUI widgets of the four packages
 * objectui#4425 named (plugin-charts, plugin-calendar, plugin-chatbot,
 * plugin-dashboard).
 *
 * ## What this is, and what it deliberately is NOT
 *
 * This file landed as phase 1 of objectui#4425: **measure before converging.**
 * It renders every target through the real SDUI path with planted canaries and
 * checks every attribute of every rendered element against what HTML actually
 * defines. It changes **no widget contract and no widget source** — leaks it
 * finds are RECORDED in {@link LEAK_LEDGER} with a reason and an owning issue,
 * never silently tolerated and never fixed here.
 *
 * Phase 2 is now RULED (objectui#4425, comment 5270759246): option 1 —
 * `toDomProps`' whitelist is promoted to the SDUI widget contract, and the
 * migration runs as per-package cards that each delete their own ledger rows.
 * So this gate's job changed without its mechanism changing: it was the
 * measurement the ruling was waiting for, and it is now the ratchet that
 * migration is graded against. The reading, kept at current truth as each card
 * lands:
 *
 *   | package          | targets | targets leaking | leaked attributes |
 *   |------------------|---------|-----------------|-------------------|
 *   | plugin-charts    |       9 |               0 |                 0 |
 *   | plugin-calendar  |       3 |               0 |                 0 |
 *   | plugin-chatbot   |       3 |               0 |                 0 |
 *   | plugin-dashboard |       8 |               2 |             7 / 9 |
 *
 * **2 of 23 targets leak**, and both are in {@link LEAK_LEDGER} below:
 * `plugin-dashboard:metric` and `plugin-dashboard:metric-card`, the open tail
 * objectui#4425 owns directly. Two migration steps have closed their rows since
 * the phase-1 measurement:
 *
 *   - `plugin-chatbot:chatbot` / `chatbot-enhanced` — 14 attributes each,
 *     objectui#4431 / PR #4485, which also lifted `toDomProps` to
 *     `@object-ui/core` so later cards consume one executor.
 *   - `view:dashboard` — `DashboardRenderer`'s widget-grid container, 13
 *     attributes, objectui#4432 / this file's most recent edit.
 *
 * The three packages now reading 0 are NOT clean for the same reason, and the
 * difference is worth keeping straight: `plugin-charts` never spreads the node
 * onto its container at all; `plugin-calendar`'s components take a declared prop
 * list and drop what they do not name, so the node's keys never reach an
 * element; `plugin-chatbot` and `DashboardRenderer`'s grid reach zero by
 * FILTERING — they still spread, through `toDomProps`.
 *
 * `calendar-view` was originally swept with the `events` canary WITHHELD, because
 * authoring it crashed the component outright (objectui#4433) — a worse failure
 * than the leak this gate was looking for, and one that would have read as a
 * clean pass. That is fixed, so the omission is gone and the target is swept
 * with the full canary set; section 5 below carries what is left of it.
 *
 * ## The divergence that decided phase 2, and what is left of it
 *
 * objectui#4425's option 3 was "record the divergence rather than converge".
 * Both answers were live in the tree at once and this gate observed both, which
 * is how the ruling got its evidence:
 *
 *   - a **whitelist** (`toDomProps`, #3291): keep the declared DOM pass-through
 *     keys, drop everything else. Born in `packages/fields`, whose own gate
 *     (`fields/src/__tests__/widget-dom-leak-e2e.test.tsx`) is untouched by this
 *     file and stays the reference implementation of the technique; the
 *     MECHANISM now lives in `@object-ui/core` (`utils/dom-props.ts`, #4431) so
 *     every plugin package can reach it.
 *   - a **deny-list** (`plugin-dashboard/src/schemaHostProps.ts`, #4357/PR
 *     #4428): destructure seven measured non-DOM props out, spread the rest.
 *
 * The deny-list is correct for the seven props it enumerates — this sweep
 * confirms all seven are gone from `metric` and `metric-card`. What it cannot
 * close is the **open tail**, exactly as `toDomProps`' docblock predicted: an
 * authored key the component does not declare still reaches the DOM. That is not
 * a hypothetical here; it is ledger rows {@link LEAK_LEDGER} `metric` and
 * `metric-card`, where `zzcanary` / `reference_to` / an authored
 * `props: { colorVariant }` all land as attributes while every one of the seven
 * named keys is correctly stripped. A deny-list bounded by enumeration cannot be
 * finished; a whitelist bounded by declaration can. That contrast IS the
 * measurement phase 2 waited for, and the ruling went to the whitelist on it.
 *
 * So the divergence is no longer a standing state of the repo — it is a
 * migration in progress, and the two rows still below are the last of it inside
 * these four packages. `plugin-dashboard` is now MIXED by design: its
 * `DashboardRenderer` grid container filters through `toDomProps` (#4432) while
 * the two KPI components still run the deny-list, and the two surviving rows are
 * precisely that difference, measured.
 *
 * ## Why this file lives in `packages/app-shell`
 *
 * The objectui#4409 dependency-direction method, applied to this sweep. A gate
 * that renders widgets from four plugin packages must live somewhere that may
 * legally import all four. Measured against the manifests on this tree:
 *
 *   - None of the four target packages can host it. `plugin-dashboard` declares
 *     only `plugin-charts` (a devDependency); no target package depends on
 *     `plugin-calendar` or `plugin-chatbot` at all. Hosting the sweep in any one
 *     of them would invert the dependency direction for the other three — the
 *     same inversion #4409 refused when it kept the map gate out of
 *     `@object-ui/i18n`.
 *   - Four workspace entries declare all four: `apps/console`, `apps/site`,
 *     `examples/console-starter` and `packages/app-shell`. The first three are
 *     applications and examples, not the natural home of a cross-package
 *     invariant.
 *   - `packages/app-shell` declares all four (`devDependencies`, which is the
 *     correct field for a test-only import and is what
 *     `scripts/check-phantom-dependencies.mjs` honours for a `__tests__/` file),
 *     and it is already the home of this repo's cross-package gates —
 *     `__tests__/spec-symbol-parity.test.ts` and #4409's own
 *     `__tests__/defaults-maps-mirror-en-pack.test.tsx`.
 *
 * So one suite covers all four packages and the "one suite per package" fallback
 * the card allowed for was not needed.
 *
 * ## Four traps that make a sweep like this pass while testing NOTHING
 *
 * Each was hit while building this file, and each is now an assertion rather
 * than a comment. This is the non-vacuity discipline: a target that does not
 * really render is a RED gate, never a quiet zero.
 *
 * 1. **A lazy boundary answers with a skeleton.** Every `plugin-charts` target
 *    renders through `React.lazy` inside `ChartRenderer`. The first measurement
 *    scanned the Suspense fallback (`class="animate-pulse …"`) and reported nine
 *    clean chart targets while the chart component had never mounted. Every
 *    target therefore has to reach a readiness selector proving its REAL markup
 *    exists before anything is scanned — for the charts that is the
 *    `[data-slot="chart"]` container the spread actually lands on. See the
 *    import block below for why the modules behind that boundary cannot simply
 *    be preloaded at module scope.
 * 2. **Portals are not in the render container.** `chatbot-floating` mounts
 *    through `ReactDOM.createPortal` into `#floating-chatbot-portal` on
 *    `document.body`, so an RTL `container`-scoped scan saw ZERO elements and
 *    reported it clean. This sweep scans `document.body`.
 * 3. **An error boundary looks like a render.** `SchemaErrorBoundary` catches a
 *    throwing widget and renders its own tidy alert markup, which has no leaked
 *    attributes at all. Three calendar targets "passed" that way. Every target
 *    now asserts the boundary is ABSENT before scanning.
 * 4. **A host-less render is a different component.** `object-calendar` throws
 *    `useSchemaContext must be used within a SchemaRendererProvider` on a bare
 *    `SchemaRenderer`, and an unconfigured one renders a "configuration
 *    required" placeholder instead of the calendar. Renders go through the
 *    provider, and each target carries the minimum schema its real markup needs.
 *
 * ## The judge is duplicated, deliberately and temporarily
 *
 * `isKnownAttribute` / `findLeaks` below are a copy of the judge in
 * `packages/fields/src/__tests__/widget-dom-leak-e2e.test.tsx`. That judge lives
 * INSIDE a test file and is not exported, so reusing it would mean editing
 * `packages/fields` — out of scope for a measurement-only PR, and its gate is
 * the reference the card points at. Two copies of one judge is how one judge
 * becomes two disagreeing judges, so the copy is recorded as a finding rather
 * than left to be discovered: extracting it to a shared home is phase-2 work.
 * The calibration fixtures below are what keep this copy honest in the meantime.
 */

import type { ComponentType } from 'react';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';
// Module scope: the component registrations these packages perform as a side
// effect. The modules behind `ChartRenderer`'s `React.lazy` boundary CANNOT be
// preloaded the same way — `@object-ui/plugin-charts` exports only `.`, so
// `@object-ui/plugin-charts/ChartImpl` resolves for Vite's alias but not for
// tsc (TS2882), and widening that package's `exports` would be a public-surface
// change this measurement-only PR must not make. The readiness selector each
// chart target carries is what covers it instead: the load happens inside a
// deliberately generous 10s `waitFor` rather than outside it (AGENTS.md
// 测试纪律 / objectui#3010).
import '@object-ui/components';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-chatbot';
import '@object-ui/plugin-dashboard';

/* ════════════════════════════════════════════════════════════════════════════
 * The judge: is this attribute one HTML actually defines?
 * (copy of the #3291 judge — see "The judge is duplicated" above)
 * ══════════════════════════════════════════════════════════════════════════ */

/** Open families. `data-*` is the one open family the widget contract declares. */
const OPEN_PREFIXES = [
  'data-',
  'aria-',
  // `cmdk-root` / `cmdk-input` / … are marks the cmdk library puts on ITS OWN
  // DOM. Not prop pass-through.
  'cmdk-',
];

/** Global HTML attributes, legitimate on any element. */
const GLOBAL_HTML_ATTRIBUTES = new Set([
  'id', 'class', 'style', 'title', 'lang', 'dir', 'hidden', 'tabindex', 'role',
  'slot', 'part', 'exportparts', 'itemid', 'itemprop', 'itemref', 'itemscope',
  'itemtype', 'translate', 'draggable', 'spellcheck', 'autocapitalize',
  'autocorrect', 'contenteditable', 'enterkeyhint', 'inputmode', 'accesskey',
  'nonce', 'is', 'popover', 'inert', 'autofocus',
]);

/** Attributes whose IDL property is spelled too differently to match by case. */
const ATTRIBUTE_TO_IDL_ALIAS: Record<string, string> = {
  'class': 'className',
  'for': 'htmlFor',
  'accept-charset': 'acceptCharset',
  'http-equiv': 'httpEquiv',
};

/** MEASURED gaps in happy-dom's IDL — standard attributes it does not reflect. */
const HAPPY_DOM_IDL_GAPS: Record<string, Set<string>> = {
  select: new Set(['size']),
  option: new Set(['label']),
  textarea: new Set(['wrap']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
};

/**
 * SVG needs its own list: the reflection trick does not hold for SVG under
 * happy-dom, and lucide icons put a fixed set of presentation attributes on
 * every icon. Recharts adds a few more of its own.
 */
const SVG_ATTRIBUTES = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'viewbox', 'preserveaspectratio',
  'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx',
  'ry', 'd', 'points', 'transform', 'fill', 'fill-rule', 'fill-opacity',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity',
  'clip-path', 'clip-rule', 'mask', 'offset', 'stop-color', 'stop-opacity',
  'gradientunits', 'gradienttransform', 'patternunits', 'text-anchor',
  'dominant-baseline', 'font-size', 'font-family', 'font-weight',
  'vector-effect', 'shape-rendering', 'focusable', 'overflow', 'color',
  'orient', 'refx', 'refy', 'markerwidth', 'markerheight', 'markerunits',
  'patterncontentunits', 'spreadmethod', 'gradientscale', 'pathlength',
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
 * element, or when it belongs to an open family. The reflection check covers
 * `readonly`/`maxlength`/`colspan` and every other per-tag attribute
 * automatically instead of a hand-kept table that would rot.
 */
function isKnownAttribute(element: Element, attribute: string): boolean {
  const name = attribute.toLowerCase();

  if (OPEN_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;

  // Inline event handlers reflect as IDL properties on every element; React
  // never emits them as attributes, so one reaching the DOM means a
  // handler-shaped prop was stringified onto it. Treat as a leak.
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
        value: attribute.value.slice(0, 80),
        outerHTML: element.outerHTML.slice(0, 300),
      });
    }
  }
  return leaks;
}

/** Renders findings as the assertion's "actual", so a failure names everything. */
function leakReport(target: string, leaks: Leak[]): string {
  if (leaks.length === 0) return '';
  const lines = leaks.map(
    (leak) =>
      `  <${leak.tag}> leaked ${leak.attribute}="${leak.value}"\n` +
      `      in: ${leak.outerHTML}`,
  );
  return `${target} leaked ${leaks.length} non-DOM attribute(s):\n${lines.join('\n')}`;
}

/* ════════════════════════════════════════════════════════════════════════════
 * The canaries
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The props a host INJECTS, which a widget never authored and must not forward.
 * `schema` is injected by `SchemaRenderer` on every single render; the rest are
 * authored SDUI metadata that survives the renderer's own strip list (see
 * `packages/react/src/SchemaRenderer.tsx`, the `React.createElement` block) and
 * the `props` CONTAINER, whose contents the renderer already spreads separately.
 */
const INJECTED_SDUI_KEYS = {
  bind: 'data.revenue',
  events: { onClick: [{ action: 'navigate', params: { url: '/x' } }] },
  ariaLabel: 'Canary label',
  ariaDescribedBy: 'canary-desc',
};

/**
 * The OPEN TAIL: ordinary keys an author wrote on the node that no component
 * declares. This is the half a deny-list structurally cannot close, and the
 * reason #3291 chose a whitelist. `reference_to` and the `zzcanary*` family are
 * the same canaries the fields gate plants, kept identical on purpose so the two
 * gates report the same vocabulary.
 */
const AUTHORED_EXTRAS = {
  zzcanary: 'CANARY-STR',
  zzcanaryobj: { nested: true },
  zzcanarynum: 42,
  zzcanaryCamel: 'CANARY-CAMEL',
  reference_to: 'contacts',
};

/**
 * Authored `props: { … }`. `colorVariant` is objectui#4425's own measured
 * example — `metric-card` has no such prop, so it lands as `colorvariant`.
 */
const AUTHORED_PROPS = {
  colorVariant: 'success',
  zzcanaryprop: 'CANARY-PROP',
};

/**
 * The injected data-source ADAPTER. It does not come from the node — the
 * renderer strips the schema's own `dataSource` BINDING by name
 * (objectstack#5576) — it is the adapter a host hands `SchemaRenderer`, and it
 * is the one prop that only leaks on a dashboard that actually loads data. PR
 * #4428 shipped a six-key first pass because a schema-only measurement cannot
 * see it. Answering with empty results keeps every data-bound target on its
 * real render path rather than an error state.
 */
const FAKE_ADAPTER = {
  find: async () => [],
  findOne: async () => null,
  aggregate: async () => [],
  count: async () => 0,
  getObject: async () => null,
};

/* ════════════════════════════════════════════════════════════════════════════
 * The target set — MEASURED from the registry, not asserted from the card
 * ══════════════════════════════════════════════════════════════════════════ */

interface Target {
  /** Registry type, as `SchemaRenderer` resolves it. */
  readonly type: string;
  /** Minimum schema this widget needs before it renders its REAL markup. */
  readonly schemaExtras?: Record<string, unknown>;
  /** A selector proving the real component mounted (trap 1, 3 and 4 above). */
  readonly ready: string;
  /**
   * Canary keys withheld from this target, each with the reason. Withholding is
   * never a convenience: every entry here is pinned by its own case below, so a
   * withheld canary is a recorded defect, not a quiet exemption.
   */
  readonly omitCanaries?: readonly string[];
}

const CHART_DATA = [
  { name: 'Jan', sales: 400, revenue: 240, value: 400 },
  { name: 'Feb', sales: 300, revenue: 139, value: 300 },
];
const CHART_SERIES = [{ dataKey: 'sales' }, { dataKey: 'revenue' }];
const OBJECT_CHART_EXTRAS = {
  objectName: 'accounts',
  chartType: 'bar',
  categoryField: 'name',
  valueField: 'amount',
};
const CALENDAR_OBJECT_EXTRAS = {
  objectName: 'accounts',
  startDateField: 'start_at',
  titleField: 'name',
};

const TARGETS: Readonly<Record<string, readonly Target[]>> = {
  'plugin-charts': [
    { type: 'plugin-charts:bar-chart', schemaExtras: { data: CHART_DATA }, ready: '.recharts-responsive-container' },
    { type: 'plugin-charts:chart', schemaExtras: { chartType: 'bar', data: CHART_DATA, series: CHART_SERIES }, ready: '[data-slot="chart"]' },
    { type: 'plugin-charts:chart:bar', schemaExtras: { data: CHART_DATA, series: CHART_SERIES }, ready: '[data-slot="chart"]' },
    { type: 'plugin-charts:pie-chart', schemaExtras: { data: CHART_DATA, series: CHART_SERIES }, ready: '[data-slot="chart"]' },
    { type: 'plugin-charts:donut-chart', schemaExtras: { data: CHART_DATA, series: CHART_SERIES }, ready: '[data-slot="chart"]' },
    { type: 'plugin-charts:radar-chart', schemaExtras: { data: CHART_DATA, series: CHART_SERIES }, ready: '[data-slot="chart"]' },
    { type: 'plugin-charts:scatter-chart', schemaExtras: { data: CHART_DATA, series: CHART_SERIES }, ready: '[data-slot="chart"]' },
    { type: 'plugin-charts:object-chart', schemaExtras: OBJECT_CHART_EXTRAS, ready: '[data-slot="chart"]' },
    { type: 'view:chart', schemaExtras: OBJECT_CHART_EXTRAS, ready: '[data-slot="chart"]' },
  ],
  'plugin-calendar': [
    { type: 'plugin-calendar:calendar-view', ready: '[role="region"][aria-label="Calendar"]' },
    { type: 'plugin-calendar:object-calendar', schemaExtras: CALENDAR_OBJECT_EXTRAS, ready: '[role="region"][aria-label="Calendar"]' },
    { type: 'view:calendar', schemaExtras: CALENDAR_OBJECT_EXTRAS, ready: '[role="region"][aria-label="Calendar"]' },
  ],
  'plugin-chatbot': [
    // The message composer is this widget's real markup; the root above it is
    // the spread site.
    { type: 'plugin-chatbot:chatbot', ready: 'input' },
    { type: 'plugin-chatbot:chatbot-enhanced', ready: 'textarea' },
    // Trap 2: this one mounts through a portal, outside the render container.
    { type: 'plugin-chatbot:chatbot-floating', ready: '#floating-chatbot-portal' },
  ],
  'plugin-dashboard': [
    { type: 'plugin-dashboard:dashboard-grid', ready: '[data-testid="grid-layout"]' },
    { type: 'plugin-dashboard:metric', schemaExtras: { label: 'Revenue', value: 42 }, ready: '.rounded-lg.border' },
    { type: 'plugin-dashboard:metric-card', schemaExtras: { label: 'Revenue', value: 42 }, ready: '.rounded-lg.border' },
    { type: 'plugin-dashboard:object-metric', schemaExtras: { objectName: 'accounts' }, ready: '.rounded-lg.border' },
    { type: 'plugin-dashboard:pivot', ready: '[data-testid="pivot-empty-state"]' },
    { type: 'plugin-dashboard:object-pivot', schemaExtras: { objectName: 'accounts' }, ready: '[data-testid="pivot-empty-state"]' },
    { type: 'plugin-dashboard:object-data-table', schemaExtras: { objectName: 'accounts' }, ready: '[data-testid="table-empty-state"]' },
    // `DashboardRenderer`'s widget grid — the element its `{...props}` lands on.
    { type: 'view:dashboard', ready: '.grid.auto-rows-min' },
  ],
};

const ALL_TARGETS: readonly Target[] = Object.values(TARGETS).flat();

/**
 * The namespaces each package owns. Used by the parity case below to prove the
 * lists above still cover everything the four barrels register: a widget added
 * to a plugin without a line here fails loudly instead of quietly going
 * unscanned (the guarantee the fields gate gets from `FORM_FIELD_TYPES`).
 */
const OWNED_NAMESPACES: Readonly<Record<string, string>> = {
  'plugin-charts': 'plugin-charts:',
  'plugin-calendar': 'plugin-calendar:',
  'plugin-chatbot': 'plugin-chatbot:',
  'plugin-dashboard': 'plugin-dashboard:',
};

/**
 * Aliases these packages register under the SHARED `view:` namespace. They are
 * listed rather than derived because `view:` is not owned by any one package —
 * `plugin-list`, `plugin-detail` and others register into it too, so a prefix
 * scan would sweep other packages' widgets into these four packages' counts.
 */
const OWNED_VIEW_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'plugin-charts': ['view:chart'],
  'plugin-calendar': ['view:calendar'],
  'plugin-chatbot': [],
  'plugin-dashboard': ['view:dashboard'],
};

/* ════════════════════════════════════════════════════════════════════════════
 * The leak ledger — recorded defects, never silent baselines
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Every leak this sweep found on the tree it landed on, per target, with the
 * exact attribute names and the issue that owns the fix.
 *
 * ## Why a ledger and not a fix
 *
 * objectui#4425's phase-1 ruling is measurement only: this PR touches no widget
 * source and no widget contract. A gate that simply went red on landing would be
 * a broken build, and a gate that skipped the leaking targets would be the
 * silent baseline the ruling forbids. So each leak is written down, in full, at
 * the granularity of the individual attribute.
 *
 * ## The expiry discipline
 *
 * The assertion is EXACT SET EQUALITY, not "at most". A row is therefore a
 * two-way ratchet:
 *
 *   - a NEW leaked attribute on a ledgered target fails the gate, because the
 *     measured set no longer equals the recorded one;
 *   - FIXING a leak ALSO fails the gate, until the corresponding entry is
 *     deleted from this ledger in the same change.
 *
 * That second direction is the expiry: a row cannot outlive the defect it
 * records, because the fix cannot go green while the row is still here. There is
 * no date to forget and no allow-list to rot — the tree itself expires the row.
 * A ledger entry with no `issue` is not allowed; see the shape assertion below.
 */
interface LedgerEntry {
  /** Attribute names, exactly as they reach the DOM (lowercased by HTML). */
  readonly attributes: readonly string[];
  /** Why it leaks — the mechanism, not a restatement of the symptom. */
  readonly reason: string;
  /** The issue that owns the fix. Deleting the row is part of closing it. */
  readonly issue: string;
}

const LEAK_LEDGER: Readonly<Record<string, LedgerEntry>> = {
  /* ── plugin-dashboard: the OPEN TAIL a deny-list cannot close ───────────── */
  //
  // Read these two rows against what is NOT in them. Every one of the seven keys
  // `schemaHostProps.ts` enumerates (#4357 / PR #4428) is absent — `schema`,
  // `bind`, `events`, `props`, `ariaLabel`, `ariaDescribedBy`, `dataSource` are
  // all correctly stripped, on both components, including the adapter. The
  // deny-list does exactly what it claims.
  //
  // What remains is the half it cannot reach: keys the component does not
  // declare and the list never names. That is `toDomProps`' argument, measured
  // rather than predicted, and it is the reading objectui#4425 phase 2 is for.
  'plugin-dashboard:metric': {
    attributes: [
      'name', 'reference_to', 'zzcanary', 'zzcanarycamel', 'zzcanarynum',
      'zzcanaryobj', 'zzcanaryprop',
    ],
    reason:
      'the seven deny-listed props are gone; the open tail of authored keys ' +
      '`MetricWidget` does not declare still reaches the Card.',
    issue: 'objectui#4425',
  },
  'plugin-dashboard:metric-card': {
    attributes: [
      'colorvariant', 'label', 'name', 'reference_to', 'zzcanary',
      'zzcanarycamel', 'zzcanarynum', 'zzcanaryobj', 'zzcanaryprop',
    ],
    reason:
      'the same open tail as `metric`, plus two keys that are the tail in ' +
      'miniature: `colorvariant` is objectui#4425\'s own measured example, and ' +
      '`label` leaks because `MetricCardProps` spells its heading `title` — so ' +
      'authoring the key its sibling `MetricWidget` takes puts the heading on ' +
      'the DOM as an attribute instead of rendering it.',
    issue: 'objectui#4425',
  },
};

/* ════════════════════════════════════════════════════════════════════════════
 * The harness
 * ══════════════════════════════════════════════════════════════════════════ */

/** The text `SchemaErrorBoundary` renders when a widget throws (trap 3). */
const ERROR_BOUNDARY_MARKER = 'failed to render';

function canariesFor(target: Target): Record<string, unknown> {
  const canaries: Record<string, unknown> = { ...INJECTED_SDUI_KEYS, ...AUTHORED_EXTRAS };
  for (const key of target.omitCanaries ?? []) delete canaries[key];
  return canaries;
}

function schemaFor(target: Target): Record<string, unknown> {
  return {
    type: target.type,
    id: 'canary-node',
    name: 'canary_node',
    ...target.schemaExtras,
    ...canariesFor(target),
    props: { ...AUTHORED_PROPS },
  };
}

/**
 * Renders one target through the real SDUI host and returns the scan root.
 *
 * `document.body`, not the RTL container: `chatbot-floating` mounts through a
 * portal and is invisible to a container-scoped scan (trap 2).
 */
async function renderTarget(target: Target): Promise<Element> {
  render(
    <SchemaRendererProvider dataSource={FAKE_ADAPTER as never}>
      <SchemaRenderer schema={schemaFor(target) as never} dataSource={FAKE_ADAPTER as never} />
    </SchemaRendererProvider>,
  );

  // Non-vacuity, per target: the REAL markup must exist before anything is
  // scanned. Without this every trap in the docblock reads as a clean sweep.
  await waitFor(
    () => {
      if (!document.body.querySelector(target.ready)) {
        throw new Error(
          `${target.type}: readiness selector \`${target.ready}\` never matched. ` +
            `The widget did not reach its real markup, so scanning it would ` +
            `measure nothing. Body was:\n${document.body.innerHTML.slice(0, 600)}`,
        );
      }
    },
    { timeout: 10000 },
  );

  // Trap 3: a caught throw renders tidy, attribute-clean markup that would pass.
  expect(
    document.body.textContent?.includes(ERROR_BOUNDARY_MARKER)
      ? `${target.type} rendered a SchemaErrorBoundary instead of the widget:\n` +
          document.body.innerHTML.slice(0, 600)
      : '',
  ).toBe('');

  return document.body;
}

/** Leaked attribute names for a target, deduped and sorted — the ledger's unit. */
function leakedAttributeNames(leaks: readonly Leak[]): string[] {
  return [...new Set(leaks.map((leak) => leak.attribute))].sort();
}

beforeAll(() => {
  // Recharts measures its container through ResizeObserver, which happy-dom
  // does not implement; without it every chart target stays at the skeleton.
  (globalThis as Record<string, unknown>).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
  // The floating chatbot's portal container is appended to `document.body` and
  // is NOT owned by RTL, so `cleanup()` does not take it with it. Left behind,
  // it makes the next target's body scan report the previous target's leaks.
  for (const node of Array.from(document.querySelectorAll('#floating-chatbot-portal'))) {
    node.remove();
  }
  vi.restoreAllMocks();
});

/* ════════════════════════════════════════════════════════════════════════════
 * 1. The judge proves itself, BEFORE it is trusted on the sweep
 * ══════════════════════════════════════════════════════════════════════════ */

/** Ordinary, correct markup — several attributes whose IDL name differs. */
const CLEAN_FIXTURE = `
  <div id="root" class="a b" title="t" role="group" tabindex="0" hidden
       data-testid="x" aria-label="l" data-state="open">
    <input type="text" name="n" value="v" placeholder="p" readonly maxlength="5" />
    <textarea rows="3" cols="4" wrap="soft" readonly></textarea>
    <select size="2" multiple><option label="L" value="v" selected></option></select>
    <button type="button" disabled formnovalidate value="on">b</button>
    <label for="root">l</label>
    <table><colgroup><col span="2" /></colgroup><tbody><tr>
      <td colspan="2" rowspan="1" headers="h"></td></tr></tbody></table>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"
         fill="none" stroke="currentColor" stroke-width="2" class="icon">
      <path d="M0 0h24v24H0z" /></svg>
  </div>
`;

/** Every planted attribute here MUST be reported. */
const PLANTED_LEAKS: ReadonlyArray<readonly [string, string]> = [
  ['schema', '[object Object]'],
  ['events', '[object Object]'],
  ['bind', 'data.revenue'],
  ['props', '[object Object]'],
  ['arialabel', 'Canary label'],
  ['ariadescribedby', 'canary-desc'],
  ['datasource', '[object Object]'],
  ['colorvariant', 'success'],
  ['zzcanary', 'CANARY-STR'],
  ['zzcanaryobj', '[object Object]'],
  ['zzcanarynum', '42'],
  ['zzcanarycamel', 'CANARY-CAMEL'],
  ['reference_to', 'contacts'],
];

describe('the leak judge is calibrated (objectui#3291 / #4425)', () => {
  it('reports NOTHING on standard markup — no false positives', () => {
    const host = document.createElement('div');
    host.innerHTML = CLEAN_FIXTURE;
    document.body.appendChild(host);
    try {
      const leaks = findLeaks(host);
      expect(leaks.map((l) => `<${l.tag}> ${l.attribute}="${l.value}"`).join('\n')).toBe('');
    } finally {
      host.remove();
    }
  });

  it('reports EVERY planted fake attribute — no false negatives', () => {
    const host = document.createElement('div');
    const planted = PLANTED_LEAKS.map(([name, value]) => `${name}="${value}"`).join(' ');
    host.innerHTML = `<input type="text" name="n" ${planted} />`;
    document.body.appendChild(host);
    try {
      const found = new Set(findLeaks(host).map((leak) => leak.attribute));
      const missed = PLANTED_LEAKS.map(([name]) => name).filter((name) => !found.has(name));
      expect(missed).toEqual([]);
    } finally {
      host.remove();
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 2. The canary MECHANISM proves itself, end to end through the real path
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Calibrating the judge on static markup is not enough: it says nothing about
 * whether the CANARIES actually reach a widget through `SchemaRenderer`. These
 * two fixtures close that gap by running the whole harness against components
 * whose behaviour is known by construction.
 *
 * Predicted before the first run, and the reason this pair is here at all:
 *
 *   - `leaky` spreads everything it is handed onto a `<div>`, so it MUST report
 *     at least one leak from every canary family — the injected `schema`, the
 *     SDUI metadata, the authored open tail, the authored `props` contents, and
 *     the injected adapter.
 *   - `filtered` keeps only what may become an attribute, so it MUST report
 *     nothing while rendering the same node.
 *
 * A sweep whose canaries never arrive would report every target clean, and both
 * halves of this pair are what makes that failure impossible to miss: if the
 * mechanism breaks, `leaky` goes green and this case goes red.
 */
const FIXTURE_NAMESPACE = 'zz-leak-gate-fixture';
const LEAKY_FIXTURE_TYPE = `${FIXTURE_NAMESPACE}:leaky`;
const FILTERED_FIXTURE_TYPE = `${FIXTURE_NAMESPACE}:filtered`;

const LeakyFixture: ComponentType<Record<string, unknown>> = (props) => (
  <div data-testid="leaky-fixture" {...props} />
);

const FilteredFixture: ComponentType<Record<string, unknown>> = (props) => {
  // The `toDomProps` shape, inlined: keep the known-safe set, drop the rest.
  const domProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key === 'id' || key === 'className' || key.startsWith('data-') || key.startsWith('aria-')) {
      domProps[key] = props[key];
    }
  }
  return <div data-testid="filtered-fixture" {...domProps} />;
};

const LEAKY_FIXTURE_TARGET: Target = {
  type: LEAKY_FIXTURE_TYPE,
  ready: '[data-testid="leaky-fixture"]',
};
const FILTERED_FIXTURE_TARGET: Target = {
  type: FILTERED_FIXTURE_TYPE,
  ready: '[data-testid="filtered-fixture"]',
};

describe('the canary mechanism works through the real SDUI path (objectui#4425)', () => {
  beforeAll(() => {
    ComponentRegistry.register('leaky', LeakyFixture as never, {
      namespace: FIXTURE_NAMESPACE,
      skipFallback: true,
    });
    ComponentRegistry.register('filtered', FilteredFixture as never, {
      namespace: FIXTURE_NAMESPACE,
      skipFallback: true,
    });
  });

  it('a deliberately leaking widget is CAUGHT — every canary family arrives', async () => {
    const root = await renderTarget(LEAKY_FIXTURE_TARGET);
    const found = new Set(leakedAttributeNames(findLeaks(root)));

    // One representative per family. Losing any one of these means the sweep
    // stopped exercising that half of the leak surface.
    const perFamily: ReadonlyArray<readonly [string, string]> = [
      ['schema', 'the node injected on every render'],
      ['bind', 'authored SDUI metadata'],
      ['events', 'authored SDUI action metadata'],
      ['props', 'the props container'],
      ['arialabel', 'authored camelCase ARIA'],
      ['zzcanary', 'the authored open tail'],
      ['zzcanaryprop', 'the authored `props` contents'],
      ['datasource', 'the injected data-source adapter'],
    ];
    const missing = perFamily
      .filter(([attribute]) => !found.has(attribute))
      .map(([attribute, what]) => `${attribute} (${what})`);
    expect(missing).toEqual([]);
  });

  it('a widget that filters its spread is CLEAN — the judge is not just noisy', async () => {
    const root = await renderTarget(FILTERED_FIXTURE_TARGET);
    expect(leakReport(FILTERED_FIXTURE_TYPE, findLeaks(root))).toBe('');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 3. The target enumeration is non-empty, real, and still complete
 * ══════════════════════════════════════════════════════════════════════════ */

/** Canonical (namespaced) types the registry holds under a given prefix. */
function registeredTypesUnder(prefix: string): string[] {
  const configs = ComponentRegistry.getAllConfigs() as ReadonlyArray<{ type: string }>;
  return [...new Set(configs.map((config) => config.type))]
    .filter((type) => type.startsWith(prefix))
    .sort();
}

describe('the sweep covers a real, non-empty target set (objectui#4425)', () => {
  it.each(Object.keys(TARGETS))('%s contributes at least one target', (pkg) => {
    expect(TARGETS[pkg].length).toBeGreaterThan(0);
  });

  it('every target is actually registered — none silently renders "Unknown component type"', () => {
    const unregistered = ALL_TARGETS.map((target) => target.type).filter(
      (type) => !ComponentRegistry.has(type),
    );
    expect(unregistered).toEqual([]);
  });

  it.each(Object.keys(OWNED_NAMESPACES))(
    '%s: every widget it registers is swept — a new one cannot slip past',
    (pkg) => {
      // The guarantee `FORM_FIELD_TYPES` gives the fields gate, derived here
      // from the registry itself rather than from a hand-kept list.
      const swept = TARGETS[pkg]
        .map((target) => target.type)
        .filter((type) => type.startsWith(OWNED_NAMESPACES[pkg]))
        .sort();
      expect(swept).toEqual(registeredTypesUnder(OWNED_NAMESPACES[pkg]));
    },
  );

  it('the shared `view:` aliases these packages own are registered and swept', () => {
    const declared = Object.values(OWNED_VIEW_ALIASES).flat();
    expect(declared.filter((type) => !ComponentRegistry.has(type))).toEqual([]);
    const sweptTypes = new Set(ALL_TARGETS.map((target) => target.type));
    expect(declared.filter((type) => !sweptTypes.has(type))).toEqual([]);
  });

  it('the ledger is well formed — every row names a swept target, a reason and an issue', () => {
    const sweptTypes = new Set(ALL_TARGETS.map((target) => target.type));
    const problems: string[] = [];
    for (const [type, entry] of Object.entries(LEAK_LEDGER)) {
      if (!sweptTypes.has(type)) problems.push(`${type}: ledgered but not a swept target`);
      if (entry.attributes.length === 0) problems.push(`${type}: empty row — delete it instead`);
      if (!entry.issue.trim()) problems.push(`${type}: no owning issue`);
      if (!entry.reason.trim()) problems.push(`${type}: no reason`);
    }
    expect(problems).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 4. The sweep
 * ══════════════════════════════════════════════════════════════════════════ */

describe.each(Object.keys(TARGETS))(
  'no registry-reachable %s widget leaks an unledgered non-DOM prop (objectui#4425)',
  (pkg) => {
    it.each(TARGETS[pkg].map((target) => [target.type, target] as const))(
      '%s',
      async (type, target) => {
        const root = await renderTarget(target);
        const leaks = findLeaks(root);
        const found = leakedAttributeNames(leaks);
        const ledgered = [...(LEAK_LEDGER[type]?.attributes ?? [])].sort();

        // Exact equality in BOTH directions — see the ledger's expiry
        // discipline. A new leak fails; a fixed leak fails until its row goes.
        if (ledgered.length === 0) {
          expect(leakReport(type, leaks)).toBe('');
        } else {
          expect(found).toEqual(ledgered);
        }
      },
      30000,
    );
  },
);

/* ════════════════════════════════════════════════════════════════════════════
 * 5. The canary that was withheld, and is not any more
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `plugin-calendar:calendar-view` used to be swept WITHOUT the `events` canary,
 * because authoring `events` — the ordinary SDUI action metadata of AGENTS.md
 * section 4, legal on any node — crashed the component outright: its renderer
 * computed a `CalendarEvent[]`, passed it as `events={…}`, then spread
 * `{...props}` AFTER it, so the authored object overwrote the array and
 * `CalendarView` threw `events is not iterable`. A crashing render produces
 * tidy, attribute-clean error-boundary DOM, so the canary had to be withheld or
 * the target would have read as a clean pass (trap 3).
 *
 * objectui#4433 fixed that — the renderer destructures the authored key out
 * before the spread — so BOTH halves came out in the same change: the
 * `omitCanaries` entry is gone (this target is swept with the full canary set
 * above, `events` included) and this case flipped from pinning the crash to
 * pinning the render.
 *
 * It is kept rather than deleted because it is the DIAGNOSIS the sweep case
 * cannot be: the sweep plants the whole canary set at once, so a regression
 * there says only "calendar-view broke". This one plants `events` alone, and
 * names the key.
 *
 * The `omitCanaries` facility itself stays. Nothing withholds a canary today,
 * but it carries the discipline — a withheld canary is a recorded defect with
 * its own pin, never a quiet exemption — that objectui#4425 phase 2 will need
 * the next time a target cannot take the full set.
 */
describe('the canary once withheld from calendar-view is swept again (objectui#4433)', () => {
  it('authoring `events` on a calendar-view node renders the calendar', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <SchemaRendererProvider dataSource={FAKE_ADAPTER as never}>
          <SchemaRenderer
            schema={
              {
                type: 'plugin-calendar:calendar-view',
                id: 'canary-node',
                events: { onClick: [{ action: 'navigate' }] },
              } as never
            }
          />
        </SchemaRendererProvider>,
      );
      // The real component, not the error boundary `SchemaErrorBoundary`
      // rendered here before the fix.
      await waitFor(() => {
        expect(
          document.body.querySelector('[role="region"][aria-label="Calendar"]'),
        ).not.toBeNull();
      });
      expect(document.body.textContent ?? '').not.toContain(ERROR_BOUNDARY_MARKER);
      // The mechanism, not just the symptom: the authored `events` OBJECT no
      // longer reaches `CalendarView`'s `events` ARRAY prop, so nothing tries to
      // iterate it.
      expect(document.body.textContent ?? '').not.toContain('events is not iterable');
    } finally {
      errors.mockRestore();
    }
  }, 30000);
});
