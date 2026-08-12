/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The props `SchemaRenderer` hands a widget that are NOT DOM attributes
 * (objectui#4357).
 *
 * A dashboard widget is two things at once: an SDUI block reached through
 * `SchemaRenderer`, and a plain React component a host may render directly.
 * The React half wants a `...props` spread onto its root element so callers can
 * pass `aria-*`, `data-*`, `id`, `role`, `className`. The SDUI half means that
 * spread also receives the node's own metadata — and React writes unknown
 * lowercase attributes straight to the DOM, stringifying object values. That is
 * how every KPI card ended up with `schema="[object Object]"`.
 *
 * MEASURED at the call site (`packages/react/src/SchemaRenderer.tsx`, the
 * `React.createElement(Component, …)` block), one render carrying every SDUI key
 * at once. What a widget receives, and the attribute each one emitted:
 *
 *   | prop              | emitted as                   | what it is                           |
 *   |-------------------|------------------------------|--------------------------------------|
 *   | `schema`          | `schema="[object Object]"`   | the node itself, injected EVERY render |
 *   | `events`          | `events="[object Object]"`   | SDUI action metadata (`onClick: […]`) |
 *   | `props`           | `props="[object Object]"`    | the props container — the renderer already spreads its CONTENTS separately, so the container is pure metadata |
 *   | `bind`            | `bind="data.revenue"`        | SDUI data-binding path                |
 *   | `ariaLabel`       | `arialabel="…"`              | camelCase authored form; the renderer already emits the resolved `aria-label` |
 *   | `ariaDescribedBy` | `ariadescribedby="…"`        | ditto for `aria-describedby`          |
 *
 * The line this type draws is **"is the key an HTML attribute name"**. None of
 * the six is (the two dashed `aria-*` forms the renderer emits itself are, and
 * they keep flowing). Everything that IS one stays in the spread and reaches the
 * DOM exactly as before: `id`, `name`, `role`, `disabled`, `aria-*`, `data-*`,
 * `className`. Removing the spread instead would have been the wrong fix — it is
 * the component's only accessibility passthrough.
 *
 * The renderer strips its own schema metadata (`type` / `children` / `visible` /
 * `dataSource` / …) before spreading, so those never arrive; this type covers
 * only what survives that strip. Declared here rather than in each component
 * because two copies of one key list is how a list becomes two disagreeing
 * lists — the same reason `colorVariants` was extracted. The pin that keeps the
 * declaration honest for BOTH components is
 * `__tests__/MetricWidget.domProps.test.tsx`.
 */
export interface SchemaHostProps {
  /** The widget's own schema node, injected by `SchemaRenderer` on every render. */
  schema?: unknown;
  /** SDUI data-binding path (`'user.address.city'`). */
  bind?: unknown;
  /** SDUI event handlers (`{ onClick: [ActionDef, …] }`) — data, not DOM. */
  events?: unknown;
  /** The schema's props container; its contents are spread separately. */
  props?: unknown;
  /** Authored camelCase ARIA; the renderer emits the resolved `aria-label`. */
  ariaLabel?: unknown;
  /** Authored camelCase ARIA; the renderer emits `aria-describedby`. */
  ariaDescribedBy?: unknown;
}
