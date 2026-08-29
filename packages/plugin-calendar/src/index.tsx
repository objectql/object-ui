/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import {
  ElementDataSourceGate,
  elementDataSourceBlock,
  useSchemaContext,
  type ElementDataSourceMapping,
} from '@object-ui/react';
import { ObjectCalendar } from './ObjectCalendar';
import type { ObjectCalendarComponentProps } from './ObjectCalendar';

// Export ObjectCalendar component
export { ObjectCalendar };
export type { ObjectCalendarComponentProps };

/**
 * @deprecated Use `ObjectCalendarComponentProps`. Renamed in objectui#4650
 * because `@objectstack/spec/ui` owns `ObjectCalendarProps` from 17.0.0, where
 * it means the AUTHORED props document of the `object-calendar` element — not
 * this component's props. The alias denotes the SAME type and is kept only so
 * existing importers keep compiling.
 */
export type { ObjectCalendarComponentProps as ObjectCalendarProps } from './ObjectCalendar';

// Export CalendarView component (merged from plugin-calendar-view)
export { CalendarView } from './CalendarView';
export type { CalendarViewProps, CalendarViewEvent } from './CalendarView';

/**
 * @deprecated Use `CalendarViewEvent`. Renamed in objectui#5044 because
 * `@object-ui/types` owns `CalendarEvent`, where it means the AUTHORING event
 * (`id: string`, `start` / `end` accepting ISO strings with `end` required,
 * plus `description`) — not this component's runtime event, whose `start` is a
 * real `Date` and whose `id` may be a number. The two are structurally
 * incompatible in both directions, so IDE auto-import picking the wrong one
 * failed as a remote `TS2322`. The alias denotes the SAME type and is kept only
 * so existing importers keep compiling.
 *
 * Spelled with its `from` clause for the same reason the
 * `ObjectCalendarProps` alias above is (objectui#4650): a re-export with no
 * module specifier is judged as its own declaration by
 * `scripts/check-spec-symbol-derivation.mjs`.
 */
export type { CalendarViewEvent as CalendarEvent } from './CalendarView';

// Import and register calendar-view renderer
import './calendar-view-renderer';

/**
 * What `ObjectCalendar` reads for its own query: `objectName`, `filter` and
 * `sort` (`ObjectCalendar.tsx` — `$filter: schema.filter`,
 * `$orderby: convertSortToQueryParams(schema.sort)`).
 *
 * `columns` and a row cap are not mapped: a calendar projects the fields its
 * `calendar` config names (start/end/title/color), and it fetches the whole
 * window rather than a capped page, so neither key has a read site to write to.
 */
const OBJECT_CALENDAR_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
  sort: true,
};

/* ════════════════════════════════════════════════════════════════════════════
 * The renderer boundary: consume or declare, never spread (objectui#4492)
 *
 * This renderer — registered TWICE, as `plugin-calendar:object-calendar` and as
 * `view:calendar`, so one implementation serves both keys — used to end in
 * `< ObjectCalendar schema={bound} dataSource={dataSource} {...props} />`, where
 * `props` was everything `SchemaRenderer` hands a registered widget: the node's
 * own authored keys, the contents of its `props` container, the injected runtime
 * props (`events`, `ariaLabel`/`role`, `data-obj-*`, …) and a host's trailing
 * props — an UNBOUNDED set, spread onto a component whose props are a CLOSED
 * list. `ObjectCalendarComponentProps` declares eight callbacks and a `locale`, so an
 * authored value under any of those names landed on the declared prop, and an
 * SDUI author writing JSON can never produce a function.
 *
 * MEASURED on the pre-fix tree (objectui#4492), all three uncaught or fatal:
 *
 *   - `onDateClick: 'NOT-A-FUNCTION'` → clicking an empty day cell throws
 *     `onDateClick is not a function`. `ObjectCalendar` tests `if (onDateClick)`
 *     and a non-empty string is TRUTHY, so the guard hands the string to a call.
 *   - `onNavigate: 'NOT-A-FUNCTION'` → clicking **Next period** throws
 *     `onNavigate is not a function`; `?.` guards nullish, not non-callable.
 *   - `locale: 'en_US'` → `toLocaleDateString('en_US')` throws
 *     `RangeError: Incorrect locale information provided` out of RENDER, taking
 *     the whole calendar to `SchemaErrorBoundary`.
 *
 * The first two are worse than an error boundary: React does not route
 * event-handler errors to `SchemaErrorBoundary`, so they surface as UNCAUGHT
 * window errors while the calendar keeps looking fine and that gesture is dead.
 *
 * The objectui#4425 phase-2 ruling (option 1, whitelist bounded by declaration)
 * applied to this renderer exactly as objectui#4453 applied it to the sibling
 * `calendar-view` renderer next door: **the forward set is exactly
 * {@link ObjectCalendarComponentProps}, every key resolved to the type that prop
 * declares; everything else is dropped.** `rest` below is READ for the declared
 * keys and is never spread — that is the whole of this fix.
 *
 * A deny-list could not close this: the leak is the open tail of author-supplied
 * keys, which no enumeration can finish. This list is finishable because
 * `ObjectCalendarComponentProps` declares it — and dropping the tail costs nothing,
 * because `ObjectCalendar` DESTRUCTURES a closed list and reads no other prop.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The DECLARED host escape hatch: `ObjectCalendar`'s callback surface, forwarded
 * only when the value really is a function.
 *
 * One key, two very different producers arriving through the SAME channel: an
 * SDUI author writing JSON, whose value can never be a function (so it is always
 * one of the crashes above), and a React host, whose passthrough works today and
 * must keep working. This is not hypothetical for this widget — `ListView`
 * builds an `object-calendar` node carrying `onRowClick: navigation.handleClick`
 * (`packages/plugin-list/src/ListView.tsx`, `baseProps`), a real FUNCTION on a
 * real node key. The key name cannot separate the two producers; only the
 * value's TYPE can. So the hatch is DECLARED here, and off-type input gets the
 * one answer every other resolver in this file gives: dropped — the same answer
 * as an absent key. That is the objectui#4435 declared-passthrough pattern, not
 * a lenient consumer coercion (AGENTS.md #0.1).
 *
 * The whole family is listed rather than the two reported keys, because the
 * defect is the family's: every one of these is a prop `ObjectCalendarComponentProps`
 * declares, so listing them narrows what may reach the component and widens
 * nothing.
 *
 * `onEdit` and `onDelete` are declared by `ObjectCalendarComponentProps` but are NOT
 * destructured by the component (`ObjectCalendar.tsx` — the record drawer builds
 * its own edit/delete handlers from `dataSource`), so forwarding them is inert
 * today. They are listed anyway: the hatch is bounded by the DECLARATION, and a
 * key that is declared, inert and silently dropped would be a second, quieter
 * contract than the one this boundary states. Their inertness is a census
 * observation, not a behaviour change — before and after this card, a value
 * under either name does nothing.
 */
const HOST_CALLBACKS = [
  'onEventClick',
  'onRowClick',
  'onDateClick',
  'onEdit',
  'onDelete',
  'onNavigate',
  'onViewChange',
  'onEventDrop',
] as const;

type HostCallbacks = Pick<ObjectCalendarComponentProps, (typeof HOST_CALLBACKS)[number]>;

/**
 * Read the declared callbacks out of the incoming props, keeping only the values
 * whose type the hatch declares. Never a spread of the raw props: an authored
 * key that is not on {@link HOST_CALLBACKS} cannot appear in the result at all.
 */
function pickHostCallbacks(incoming: Record<string, unknown>): HostCallbacks {
  const declared: Record<string, unknown> = {};
  for (const key of HOST_CALLBACKS) {
    const raw = incoming[key];
    if (typeof raw === 'function') declared[key] = raw;
  }
  return declared as HostCallbacks;
}

/**
 * Resolve the `locale` hatch: a string, and one `Intl` will actually accept.
 *
 * The type check is deliberately NOT `typeof raw === 'string'` — that is the
 * objectui#4494 lesson, and this card re-measured it on this widget: a
 * structurally invalid tag throws out of RENDER, so a typeof-string gate leaves
 * the measured crash wide open. `new Date().toLocaleDateString('en_US')` (the
 * underscore spelling a producer writes by accident) throws
 * `RangeError: Incorrect locale information provided`, and so do `''`, `'123'`
 * and `'a'`. `Intl.getCanonicalLocales` asks the one question that matters —
 * will `Intl` take this tag — instead of a hand-rolled BCP-47 dialect. A
 * well-formed tag nobody has data for (`zz-ZZ`) is NOT rejected here: `Intl`
 * resolves it to its own default, which is the component's business, not this
 * boundary's.
 */
function resolveAuthoredLocale(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    Intl.getCanonicalLocales(raw);
  } catch {
    return undefined;
  }
  return raw;
}

/**
 * Resolve the declared `data` prop: the records a PARENT pre-fetched.
 *
 * `ObjectCalendar` gates this path on `Array.isArray(externalData)` and uses it
 * to skip its own fetch, so an array is the only value that ever meant anything
 * under this key. Forwarding it typed is behaviour-identical for every input
 * (a non-array was already ignored) and keeps one rule at this boundary rather
 * than an exception.
 */
function resolveExternalData(raw: unknown): ObjectCalendarComponentProps['data'] {
  return Array.isArray(raw) ? raw : undefined;
}

/**
 * Resolve the declared `loading` prop, which the component honours only
 * alongside external `data`. A boolean or the absent-key answer.
 */
function resolveExternalLoading(raw: unknown): ObjectCalendarComponentProps['loading'] {
  return typeof raw === 'boolean' ? raw : undefined;
}

/**
 * Resolve a host-supplied `dataSource` ADAPTER arriving on the props channel.
 *
 * Two different things are spelled `dataSource` in this repo, and they collide
 * by name: the spec's per-element `PageComponentSchema.dataSource` BINDING
 * (`{ object, view, filter, … }`, plain metadata) and the runtime data-source
 * ADAPTER. `SchemaRenderer` already strips the binding off the node so it cannot
 * be spread as a prop, and deliberately preserves a host's explicit React
 * `dataSource` prop, which arrives last — that host path is kept here, and kept
 * at its old precedence (an explicit prop still wins over the context adapter).
 *
 * It is now type-checked by the adapter's call surface rather than accepted raw,
 * so a binding-shaped object reaching this key through the node's `props`
 * container falls back to the context adapter instead of shadowing it — the
 * shape that produced `dataSource.find is not a function` in objectstack#5576.
 * `find` is the method `ObjectCalendar` itself guards on before fetching.
 */
function resolveHostDataSource(raw: unknown): ObjectCalendarComponentProps['dataSource'] {
  return raw && typeof (raw as { find?: unknown }).find === 'function'
    ? (raw as ObjectCalendarComponentProps['dataSource'])
    : undefined;
}

// Register object-calendar component
export const ObjectCalendarRenderer: React.FC<{ schema: any; [key: string]: any }> = elementDataSourceBlock(({
  schema,
  // The merged node className + SDUI scope class, set by `SchemaRenderer` AFTER
  // the node's `props` container: CONSUMED and forwarded, as before.
  className,
  // Everything else. READ for declared keys, NEVER spread: this is the raw
  // channel the old `{...props}` handed straight to `ObjectCalendar`, and the
  // reason an authored string could land on a function-typed prop.
  ...rest
}) => {
  const { dataSource } = useSchemaContext() || {};

  // The declared host hatches, each kept only at its declared type. Read out of
  // `rest`; `rest` itself never reaches `ObjectCalendar`.
  const hostCallbacks = pickHostCallbacks(rest);
  const locale = resolveAuthoredLocale(rest.locale);
  const externalData = resolveExternalData(rest.data);
  const externalLoading = resolveExternalLoading(rest.loading);
  const hostDataSource = resolveHostDataSource(rest.dataSource);

  // The spec's `PageComponentSchema.dataSource` binding (objectstack#6953): a
  // calendar authored with the binding and no `objectName` never fetched, and
  // rendered an empty month with no error.
  return (
    <ElementDataSourceGate
      schema={schema}
      mapping={OBJECT_CALENDAR_DATA_SOURCE}
      dataSource={dataSource}
      testId="object-calendar"
      errorTitle="This calendar’s data source could not be resolved"
    >
      {/*
        The forward set is exactly `ObjectCalendarComponentProps` — nothing else can reach
        the component, because nothing is spread from `rest` (objectui#4492).
        The registry's own declared inputs (`objectName`, `calendar`, and the
        flat `startDateField` / `titleField` / … spelling `ObjectView` and
        `ListView` emit) are consumed through `schema`, never through this
        channel, so none of them needs a forward.
      */}
      {(bound) => (
        <ObjectCalendar
          schema={bound}
          dataSource={hostDataSource ?? dataSource}
          className={className}
          data={externalData}
          loading={externalLoading}
          locale={locale}
          {...hostCallbacks}
        />
      )}
    </ElementDataSourceGate>
  );
});

ComponentRegistry.register('object-calendar', ObjectCalendarRenderer, {
  namespace: 'plugin-calendar',
  label: 'Object Calendar',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'calendar', type: 'object', label: 'Calendar Config', description: 'startDateField, endDateField, titleField, colorField' },
  ],
});

ComponentRegistry.register('calendar', ObjectCalendarRenderer, {
  namespace: 'view',
  label: 'Calendar View',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'calendar', type: 'object', label: 'Calendar Config', description: 'startDateField, endDateField, titleField, colorField' },
  ],
});
