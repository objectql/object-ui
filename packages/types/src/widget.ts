/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Widget System
 *
 * Type definitions for the Widget Manifest system.
 * Widgets are self-describing components with lifecycle hooks,
 * typed properties, events, and multiple implementation strategies.
 *
 * Aligned with @objectstack/spec WidgetManifest.
 *
 * @module widget
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Widget Property
// ---------------------------------------------------------------------------

/**
 * Widget property type
 */
export type WidgetPropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'enum'
  | 'color'
  | 'date'
  | 'code'
  | 'file'
  | 'slot'
  | 'expression';

/**
 * Widget property definition — describes a configurable input for the widget.
 */
export interface WidgetProperty {
  /** Property name (camelCase) */
  name: string;
  /** Display label */
  label?: string;
  /** Property type */
  type: WidgetPropertyType;
  /** Default value */
  defaultValue?: unknown;
  /** Whether the property is required */
  required?: boolean;
  /** Description / help text */
  description?: string;
  /** Enum values (for type: 'enum') */
  enum?: string[] | Array<{ label: string; value: any }>;
  /** Whether this is an advanced property (hidden by default in designer) */
  advanced?: boolean;
  /** Validation expression */
  validation?: string;
  /** Category for grouping in property editor */
  category?: string;
}

// ---------------------------------------------------------------------------
// Widget Event
// ---------------------------------------------------------------------------

/**
 * Widget event definition — describes an event the widget can emit.
 */
export interface WidgetEvent {
  /** Event name (camelCase, e.g., 'onRowClick') */
  name: string;
  /** Display label */
  label?: string;
  /** Description */
  description?: string;
  /** Payload schema (JSON Schema or simple type descriptor) */
  payload?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Widget Lifecycle
// ---------------------------------------------------------------------------

/**
 * Widget lifecycle hooks — callback names invoked at different stages.
 */
export interface WidgetLifecycle {
  /** Called when the widget is first mounted */
  onMount?: string;
  /** Called when widget properties change */
  onUpdate?: string;
  /** Called before the widget is removed from the DOM */
  onUnmount?: string;
  /** Called when widget becomes visible (IntersectionObserver) */
  onVisible?: string;
  /** Called when widget receives new data */
  onDataChange?: string;
  /** Called on widget error */
  onError?: string;
}

// ---------------------------------------------------------------------------
// Widget Implementation
// ---------------------------------------------------------------------------

/**
 * Implementation strategy for loading the widget.
 */
export type WidgetImplementation = 'npm' | 'remote' | 'inline';

/**
 * NPM implementation — load from an installed npm package.
 */
export interface NpmWidgetSource {
  type: 'npm';
  /** Package name (e.g., '@my-org/custom-map') */
  package: string;
  /** Export name (default: 'default') */
  export?: string;
  /** Minimum version requirement */
  version?: string;
}

/**
 * Remote implementation — load from a URL (Module Federation, CDN).
 */
export interface RemoteWidgetSource {
  type: 'remote';
  /** URL to the JavaScript module */
  url: string;
  /** Module name for Module Federation */
  module?: string;
  /** Scope for Module Federation */
  scope?: string;
  /** Integrity hash for security */
  integrity?: string;
}

/**
 * Inline implementation — widget code is provided directly.
 */
export interface InlineWidgetSource {
  type: 'inline';
  /** Inline React component code (JSX string) */
  code: string;
  /** Language of the code */
  language?: 'jsx' | 'tsx';
}

/**
 * Widget source — discriminated union of implementation strategies.
 */
export type WidgetSource = NpmWidgetSource | RemoteWidgetSource | InlineWidgetSource;

// ---------------------------------------------------------------------------
// Widget Manifest
// ---------------------------------------------------------------------------

/**
 * WidgetManifest — self-describing component definition.
 *
 * Provides everything needed to:
 * 1. Load the widget (implementation)
 * 2. Configure it in a designer (properties, events)
 * 3. Manage its runtime behavior (lifecycle)
 *
 * @example
 * ```json
 * {
 *   "name": "custom-map",
 *   "label": "Map View",
 *   "version": "1.0.0",
 *   "category": "visualization",
 *   "implementation": { "type": "npm", "package": "@my-org/map-widget" },
 *   "properties": [
 *     { "name": "center", "type": "object", "required": true },
 *     { "name": "zoom", "type": "number", "defaultValue": 10 }
 *   ],
 *   "events": [
 *     { "name": "onMarkerClick", "payload": { "markerId": "string" } }
 *   ],
 *   "lifecycle": {
 *     "onMount": "initMap",
 *     "onUnmount": "destroyMap"
 *   }
 * }
 * ```
 */
export interface WidgetManifest {
  /** Unique widget name (kebab-case, e.g., 'custom-map') */
  name: string;
  /** Display label */
  label: string;
  /** Widget version (semver) */
  version?: string;
  /** Description */
  description?: string;
  /** Icon name (Lucide) or SVG string */
  icon?: string;
  /** Category for grouping in designer */
  category?: string;
  /** Author/organization */
  author?: string;
  /** License */
  license?: string;

  // --- Implementation ---
  /** How to load the widget component */
  implementation: WidgetSource;

  // --- Properties ---
  /** Configurable properties */
  properties?: WidgetProperty[];

  // --- Events ---
  /** Events the widget can emit */
  events?: WidgetEvent[];

  // --- Lifecycle ---
  /** Lifecycle hook definitions */
  lifecycle?: WidgetLifecycle;

  // --- Designer ---
  /** Whether the widget can contain children */
  isContainer?: boolean;
  /** Default props when dropped in designer */
  defaultProps?: Record<string, any>;
  /** Preview image URL for designer catalog */
  preview?: string;
  /** Tags for search/discovery */
  tags?: string[];

  // --- Dependencies ---
  /** Peer dependencies required by this widget */
  peerDependencies?: Record<string, string>;
  /** CSS files to load */
  styles?: string[];
}

// ---------------------------------------------------------------------------
// Widget Registry Types
// ---------------------------------------------------------------------------

/**
 * Loaded widget instance — the resolved component + metadata.
 */
export interface LoadedWidget {
  /** The widget manifest */
  manifest: WidgetManifest;
  /** The resolved React component */
  component: any;
  /** Loading status */
  status: 'loading' | 'loaded' | 'error';
  /** Error message if loading failed */
  error?: string;
}

/**
 * Widget catalog — collection of available widgets.
 */
export interface WidgetCatalog {
  /** Catalog name */
  name: string;
  /** Catalog version */
  version: string;
  /** Available widgets */
  widgets: WidgetManifest[];
}
