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
 * Defines the WidgetManifest interface for runtime widget registration,
 * plugin auto-discovery from server metadata, and custom widget registry
 * for user-defined components.
 *
 * @module widget
 * @packageDocumentation
 */

/**
 * Widget manifest describing a runtime-loadable widget.
 *
 * A manifest provides all metadata needed to discover, load, and render
 * a widget without requiring an upfront import of its code.
 *
 * @example
 * ```ts
 * const manifest: WidgetManifest = {
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
export interface WidgetManifest {
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
  source: WidgetSource;

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
 */
export type WidgetSource =
  | WidgetSourceModule
  | WidgetSourceInline
  | WidgetSourceRegistry;

/** Load from an ES module URL */
export interface WidgetSourceModule {
  type: 'module';
  /** URL to the ES module (e.g., '/widgets/chart.js' or 'https://cdn.example.com/widget.mjs') */
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
 * Configurable input for a widget.
 */
export interface WidgetInput {
  /** Input field name (maps to prop name) */
  name: string;
  /** Input field type */
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'color' | 'date' | 'code' | 'file' | 'slot';
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
  manifest: WidgetManifest;
  /** The loaded React component */
  component: unknown;
  /** Timestamp when the widget was loaded */
  loadedAt: number;
}

/**
 * Widget registry event types.
 */
export type WidgetRegistryEvent =
  | { type: 'widget:registered'; widget: WidgetManifest }
  | { type: 'widget:unregistered'; name: string }
  | { type: 'widget:loaded'; widget: ResolvedWidget }
  | { type: 'widget:error'; name: string; error: Error };

/**
 * Widget registry event listener.
 */
export type WidgetRegistryListener = (event: WidgetRegistryEvent) => void;
