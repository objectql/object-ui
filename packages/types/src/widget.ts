/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Widget Manifest & Registry Types
 *
 * Defines the RuntimeWidgetManifest interface for runtime widget registration,
 * plugin auto-discovery from server metadata, and custom widget registry
 * for user-defined components.
 *
 * @module widget
 * @packageDocumentation
 */

import type { ComponentInputControlType } from './base.js';

/**
 * Widget manifest describing a runtime-loadable widget — what
 * `@object-ui/core`'s `WidgetRegistry` registers, and what the designer palette
 * lists.
 *
 * A manifest provides all metadata needed to discover, load, and render
 * a widget without requiring an upfront import of its code.
 *
 * Renamed off the spec's `WidgetManifest` name (objectstack#4115): the spec's
 * is the **field-widget plugin** manifest that sits beside its
 * `FieldWidgetProps` — `{ fieldTypes, category: input|display|picker|editor,
 * lifecycle: { onMount, onValidate, … }, events, properties, implementation,
 * screenshots, license, aria, performance }`. This one is the **SDUI component**
 * manifest: `type` is a schema-renderer component key, and it carries `source`,
 * `defaultProps`, `inputs`, `isContainer` and `capabilities`, none of which the
 * spec's models. The only keys the two share are `name`/`label`/`version`/
 * `icon`/`description`.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 *
 * @example
 * ```ts
 * const manifest: RuntimeWidgetManifest = {
 *   name: 'custom-chart',
 *   version: '1.0.0',
 *   type: 'chart',
 *   label: 'Custom Chart Widget',
 *   description: 'A custom chart powered by D3.',
 *   category: 'data-visualization',
 *   icon: 'BarChart',
 *   source: { type: 'module', url: '/widgets/custom-chart.js' },
 * };
 * ```
 */
export interface RuntimeWidgetManifest {
  /** Unique widget identifier (e.g., 'custom-chart', 'org.acme.table') */
  name: string;

  /** Semver version string */
  version: string;

  /** Component type key used for schema rendering (e.g., 'chart', 'grid') */
  type: string;

  /** Human-readable label for the widget */
  label: string;

  /** Short description of the widget */
  description?: string;

  /** Category for grouping in the designer palette */
  category?: string;

  /** Icon name (Lucide icon name) or SVG string */
  icon?: string;

  /** Thumbnail image URL for the designer palette */
  thumbnail?: string;

  /** Widget loading source configuration */
  source: RuntimeWidgetSource;

  /** Required peer dependencies (e.g., { 'react': '^18.0.0' }) */
  peerDependencies?: Record<string, string>;

  /** Dependencies on other widgets by name */
  dependencies?: string[];

  /** Default props to apply when the widget is first dropped in the designer */
  defaultProps?: Record<string, unknown>;

  /** Input schema for the widget's configurable properties */
  inputs?: WidgetInput[];

  /** Whether the widget can contain child components */
  isContainer?: boolean;

  /** Widget capabilities */
  capabilities?: WidgetCapabilities;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Describes how to load the widget's code at runtime.
 *
 * Renamed off the spec's `WidgetSource` name (objectstack#4115). Both are
 * discriminated unions on `type`, which is what makes the collision dangerous:
 * they share the member name `inline` and mean opposite things by it. The
 * spec's `inline` carries source **code** to evaluate (`{ type: 'inline', code:
 * string }`), objectui's carries an **already-resolved component**
 * ({@link WidgetSourceInline}). The other members do not overlap at all — the
 * spec has `npm`/`remote`, objectui has `module`/`registry` — so a value of one
 * union is never a valid value of the other.
 *
 * The variant interfaces keep their `WidgetSource…` names: the spec does not
 * export those, and renaming them would churn the public surface without
 * removing a collision.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export type RuntimeWidgetSource =
  | WidgetSourceModule
  | WidgetSourceInline
  | WidgetSourceRegistry;

/**
 * Load from an ES module URL.
 *
 * ⚠️ SECURITY WARNING: Only use URLs from trusted sources.
 * Never pass user-supplied URLs directly. URLs should be validated
 * and controlled by your application. This feature uses dynamic imports
 * which bypass static analysis and may be restricted by Content Security Policy.
 */
export interface WidgetSourceModule {
  type: 'module';
  /**
   * URL to the ES module (e.g., '/widgets/chart.js' or 'https://cdn.example.com/widget.mjs')
   * Must be from a trusted source - never user input.
   */
  url: string;
  /** Named export to use (default: 'default') */
  exportName?: string;
}

/** The component is provided inline (already loaded) */
export interface WidgetSourceInline {
  type: 'inline';
  /** The React component (already resolved) */
  component: unknown;
}

/** The component is registered in the global component registry */
export interface WidgetSourceRegistry {
  type: 'registry';
  /** The component type key in the registry */
  registryKey: string;
}

/**
 * Configurable input for a widget — the authoring face of one entry in a
 * {@link RuntimeWidgetManifest}'s `inputs`.
 *
 * ## `type` names the shared arm vocabulary; it does not restate it
 *
 * `type` is {@link ComponentInputControlType}, the single declaration in
 * `./base.js` (objectui#5675). It used to spell the eleven arm literals inline,
 * which made this the third site writing out one vocabulary — after
 * objectui#3832 gave that vocabulary a name and objectui#4972 converged the
 * last structural copy of the surrounding interface onto `ComponentInput`.
 *
 * The inline restatement was member-equal to the shared declaration when it was
 * replaced — measured in both directions, quoted in the PR that did it — so
 * this is a convergence and not a widening or a narrowing: the set of values a
 * widget author may write is exactly what it was.
 *
 * What it buys is that the two can no longer drift, and one drift direction was
 * SILENT. `WidgetRegistry.load()` in `@object-ui/core` translates each
 * `WidgetInput` into a `ComponentInput` and passes `type` straight through, so
 * a member REMOVED from the shared vocabulary would break that assignment
 * loudly at compile time — while a member ADDED to it produced no error
 * anywhere: widget authoring would simply have stayed narrower than component
 * registration, with nothing in the tree saying so.
 *
 * Deliberately the SINGLE-kind form. `ComponentInput.type` also accepts an
 * ARRAY of arms, for a key whose contract is a union (objectui#3832). Widget
 * inputs have never carried that capability; granting it here would be a
 * widening rather than a convergence, so it stays out — the same disposition
 * objectui#4972 recorded when it left this face alone.
 *
 * ## Where this face still diverges from `ComponentInput` — recorded, not repaired
 *
 * Two differences remain, and the ruling on both is NOT NOW rather than "these
 * are the same thing" (objectui#5675). Widget authoring and component
 * registration are not obviously one surface, and nothing measured is pulling
 * for the merge. They are written down here so the next reader meets a
 * decision instead of an accident.
 *
 * 1. **The enum slot is spelled `options` here and `enum` on `ComponentInput`.**
 *    One concept, two names, one package. It is adapted rather than broken:
 *    `WidgetRegistry.load()` maps `enum: input.options` at the seam, and
 *    `sdui-parser`'s manifest serializer reads `enum` downstream of that. So
 *    the cost is not a value that fails to arrive — it is a hand-written rename
 *    that every reader of both faces has to know about, and that a future key
 *    added to either side can forget. Renaming either spelling is a change to a
 *    published key on a published type, which needs its own mandate.
 *
 * 2. **`ComponentInput` carries five keys this face does not** — `inputType`,
 *    `min`, `max`, `step`, `placeholder` (thirteen keys against this face's
 *    eight; `options`/`enum` above accounts for the difference in the other
 *    direction). They are not lost in translation — they are unwritable from a
 *    widget manifest to begin with, so the `ComponentInput` that
 *    `WidgetRegistry` synthesises never carries one. Measured before leaving
 *    them out: no reader in this repository consumes any of the five on
 *    `ComponentInput` either, and `sdui-parser`'s serializer forwards six keys
 *    (`name`, `type`, `required`, `enum`, `binding`, `description`) and none of
 *    these. Copying them here would mirror surface that nothing reads on the
 *    face it already lives on.
 *
 *    ⚠️ FOUR of those five are now ADR-0049 RETIREMENT TOMBSTONES on
 *    `ComponentInput` (`min` / `max` / `step` / `placeholder` — `?: never` plus
 *    a named Zod refusal, objectui#5905), so what this clause records is no
 *    longer "five keys this face declines to copy" but ONE live key
 *    (`inputType`) plus four unwritable ones. Copying any of them here is now
 *    doubly wrong: the four are REFUSED on the face they already live on, and
 *    `inputType` is the open fork objectui#5905 reported — `plugin-markdown`
 *    authors it and the serializer still drops it, which is a ruling to make,
 *    not a surface to mirror.
 *
 * Pin: `__tests__/widget-input-control-vocabulary.test.ts`.
 */
export interface WidgetInput {
  /** Input field name (maps to prop name) */
  name: string;
  /**
   * Input field type — ONE coarse control kind.
   *
   * The vocabulary is {@link ComponentInputControlType}, shared with
   * `ComponentInput` rather than restated; see this interface's own doc block
   * for why the single-kind form is deliberate.
   */
  type: ComponentInputControlType;
  /** Human-readable label */
  label?: string;
  /** Default value */
  defaultValue?: unknown;
  /** Whether this input is required */
  required?: boolean;
  /** Enum options (for type: 'enum') */
  options?: string[] | Array<{ label: string; value: unknown }>;
  /** Help text */
  description?: string;
  /** Whether this is an advanced setting (hidden by default) */
  advanced?: boolean;
}

/**
 * Widget capabilities flag set.
 */
export interface WidgetCapabilities {
  /** Widget supports data binding via dataSource */
  dataBinding?: boolean;
  /** Widget supports real-time updates */
  realTime?: boolean;
  /** Widget supports export (PDF, CSV, etc.) */
  export?: boolean;
  /** Widget supports responsive sizing */
  responsive?: boolean;
  /** Widget supports theming */
  themeable?: boolean;
  /** Widget supports drag and drop */
  draggable?: boolean;
  /** Widget supports resize */
  resizable?: boolean;
}

/**
 * Resolved widget: a manifest with its loaded component.
 */
export interface ResolvedWidget {
  /** The original manifest */
  manifest: RuntimeWidgetManifest;
  /** The loaded React component */
  component: unknown;
  /** Timestamp when the widget was loaded */
  loadedAt: number;
}

/**
 * Widget registry event types.
 */
export type WidgetRegistryEvent =
  | { type: 'widget:registered'; widget: RuntimeWidgetManifest }
  | { type: 'widget:unregistered'; name: string }
  | { type: 'widget:loaded'; widget: ResolvedWidget }
  | { type: 'widget:error'; name: string; error: Error };

/**
 * Widget registry event listener.
 */
export type WidgetRegistryListener = (event: WidgetRegistryEvent) => void;
