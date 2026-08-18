/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Layout Component Schemas
 * 
 * Type definitions for layout and container components.
 * These components organize and structure other components.
 * 
 * @module layout
 * @packageDocumentation
 */

import type { PageType as SpecPageType } from '@objectstack/spec/ui';
import type { BaseSchema, SchemaNode } from './base.js';

/**
 * Basic HTML div container
 */
export interface DivSchema extends BaseSchema {
  type: 'div';
  /**
   * Child components
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Text span component for inline text
 */
export interface TextSpanSchema extends BaseSchema {
  type: 'span';
  /**
   * Text content
   */
  value?: string;
  /**
   * Child components
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Text display component
 */
export interface TextSchema extends BaseSchema {
  type: 'text';
  /**
   * Text content to display
   */
  value?: string;
  /**
   * Text variant/style
   * @default 'body'
   */
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption' | 'overline';
  /**
   * Text alignment
   */
  align?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Image component
 */
export interface ImageSchema extends BaseSchema {
  type: 'image';
  /**
   * Image source URL
   */
  src: string;
  /**
   * Alt text for accessibility
   */
  alt?: string;
  /**
   * Image width
   */
  width?: string | number;
  /**
   * Image height
   */
  height?: string | number;
  /**
   * Object fit property
   */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

/**
 * Icon component
 */
export interface IconSchema extends BaseSchema {
  type: 'icon';
  /**
   * Icon name (lucide-react icon name)
   */
  name: string;
  /**
   * Icon size in pixels
   * @default 24
   */
  size?: number;
  /**
   * Icon color
   */
  color?: string;
}

/**
 * Separator/Divider component
 */
export interface SeparatorSchema extends BaseSchema {
  type: 'separator';
  /**
   * Orientation of the separator
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Whether to add decorative content
   */
  decorative?: boolean;
}

/**
 * Generic container component
 */
export interface ContainerSchema extends BaseSchema {
  type: 'container';
  /**
   * Max width constraint
   * @default 'lg'
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'screen' | false;
  /**
   * Center the container
   * @default true
   */
  centered?: boolean;
  /**
   * Padding
   */
  padding?: number;
  /**
   * Child components
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Flexbox layout component
 */
export interface FlexSchema extends BaseSchema {
  type: 'flex';
  /**
   * Flex direction
   * @default 'row'
   */
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  /**
   * Justify content alignment
   * @default 'start'
   */
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  /**
   * Align items
   * @default 'center'
   */
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  /**
   * Gap between items (Tailwind scale 0-8)
   * @default 2
   */
  gap?: number;
  /**
   * Allow items to wrap
   * @default false
   */
  wrap?: boolean;
  /**
   * Child components
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Stack layout component (Vertical Flex shortcut)
 */
export interface StackSchema extends Omit<FlexSchema, 'type'> {
  type: 'stack';
}

/**
 * CSS Grid layout component
 */
export interface GridSchema extends BaseSchema {
  type: 'grid';
  /**
   * Number of columns (responsive)
   * Can be number or object: { xs: 1, sm: 2, md: 3, lg: 4 }
   * @default 3
   */
  columns?: number | Record<string, number>;
  /**
   * Gap between items (Tailwind scale 0-8)
   * @default 4
   */
  gap?: number;
  /**
   * Child components
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Card component
 */
export interface CardSchema extends BaseSchema {
  type: 'card';
  /**
   * Card title
   */
  title?: string;
  /**
   * Card description
   */
  description?: string;
  /**
   * Card header content
   */
  header?: SchemaNode | SchemaNode[];
  /**
   * Card body/content (Legacy, use children)
   */
  body?: SchemaNode | SchemaNode[];
  /**
   * Child components
   */
  children?: SchemaNode | SchemaNode[];
  /**
   * Card footer content
   */
  footer?: SchemaNode | SchemaNode[];
  /**
   * Variant style
   * @default 'default'
   */
  variant?: 'default' | 'outline' | 'ghost';
  /**
   * Whether the card is hoverable
   * @default false
   */
  hoverable?: boolean;
  /**
   * Whether the card is clickable
   * @default false
   */
  clickable?: boolean;
  /**
   * Click handler
   */
  onClick?: () => void;
}

/**
 * Tabs component
 */
export interface TabsSchema extends BaseSchema {
  type: 'tabs';
  /**
   * Default active tab value
   */
  defaultValue?: string;
  /**
   * Controlled active tab value
   */
  value?: string;
  /**
   * Tabs orientation
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Tab items configuration
   */
  items: TabItem[];
  /**
   * Change handler
   */
  onValueChange?: (value: string) => void;
}

/**
 * Individual tab item
 */
export interface TabItem {
  /**
   * Unique tab identifier
   */
  value: string;
  /**
   * Tab label
   */
  label: string;
  /**
   * Tab icon
   */
  icon?: string;
  /**
   * Whether tab is disabled
   */
  disabled?: boolean;
  /**
   * Tab content
   */
  content: SchemaNode | SchemaNode[];
}

/**
 * Scroll area component
 */
export interface ScrollAreaSchema extends BaseSchema {
  type: 'scroll-area';
  /**
   * Height of the scroll container
   */
  height?: string | number;
  /**
   * Width of the scroll container
   */
  width?: string | number;
  /**
   * Scrollbar orientation
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /**
   * Child components
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Resizable panels component
 */
export interface ResizableSchema extends BaseSchema {
  type: 'resizable';
  /**
   * Direction of resizable panels
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical';
  /**
   * Minimum Height
   */
  minHeight?: string | number;
  /**
   * Show resize handle
   * @default true
   */
  withHandle?: boolean;
  /**
   * Resizable panels
   */
  panels: ResizablePanel[];
}

/**
 * Individual resizable panel
 */
export interface ResizablePanel {
  /**
   * Unique panel identifier
   */
  id: string;
  /**
   * Default size (percentage 0-100)
   */
  defaultSize?: number;
  /**
   * Minimum size (percentage 0-100)
   */
  minSize?: number;
  /**
   * Maximum size (percentage 0-100)
   */
  maxSize?: number;
  /**
   * Panel content
   */
  content: SchemaNode | SchemaNode[];
}

/**
 * Aspect ratio component
 */
export interface AspectRatioSchema extends BaseSchema {
  type: 'aspect-ratio';
  /**
   * Aspect ratio (width / height)
   * @default 16/9
   */
  ratio?: number;
  /**
   * Image URL to display
   */
  image?: string;
  /**
   * Image alt text
   */
  alt?: string;
  /**
   * Child components (alternative to image)
   */
  body?: SchemaNode | SchemaNode[];
  /**
   * Child components (alternative syntax)
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * List visualization names that are still accepted in the `pageType` slot.
 *
 * These are **not** page kinds. `@objectstack/spec` `ui/page.zod.ts` states it
 * outright: they are visualizations of a `list` page, selected via
 * `interfaceConfig.appearance.allowedVisualizations`. They are retained here as
 * a **named, sanctioned local extension** (issue #2231's prescription) pending
 * the "visualizations are not page types" cleanup, so that the spec-owned half
 * of `PageType` can be derived while the objectui-only half stays visible
 * instead of hiding inside a hand-written union.
 *
 * Narrowing this to `never` is the cleanup; it is a breaking type change for
 * anyone assigning `pageType: 'kanban'`, so it is a separate decision.
 */
export type PageVisualizationAlias =
  | 'grid'
  | 'gallery'
  | 'kanban'
  | 'calendar'
  | 'timeline';

/**
 * Page Type
 * Determines page behavior and default layout template.
 *
 * The spec-owned half is `@objectstack/spec`'s `PageType` **by reference**
 * (issue #2231/#2901; formerly a hand-written union). That mirror had drifted in
 * BOTH directions at once — it carried the five visualization names above, which
 * the spec explicitly repudiates, while the sibling zod `PageTypeSchema` in
 * `zod/layout.zod.ts` was missing `list`. Three disagreeing definitions of one
 * vocabulary lived in this package.
 */
export type PageType = SpecPageType | PageVisualizationAlias;

/**
 * Page Variable — local page state that components and expressions read and
 * write. Re-exported from `@objectstack/spec/ui` rather than restated
 * (objectstack#4115); the hand-written interface it replaces was
 * member-for-member identical, so the only thing it added was a second place
 * to drift from.
 */
import type { PageVariable } from '@objectstack/spec/ui';
export type { PageVariable };

/**
 * Page Region Size
 * Aligned with @objectstack/spec PageRegionSchema.width
 */
export type PageRegionWidth = 'small' | 'medium' | 'large' | 'full';

/**
 * Page Region (Header, Sidebar, Main, etc) — a region of the objectui page
 * NODE, holding renderer components.
 *
 * Renamed off the spec's `PageRegion` name (objectstack#4115), following the
 * same layer split that gave {@link PageNodeSchema} its name (objectui#3074):
 * the spec's `PageRegion` holds `PageComponent[]` — authored SDUI components
 * (`{ type: PageComponentType, properties }`) — while this holds
 * {@link SchemaNode}[], objectui's renderer node union. It also adds a semantic
 * `type` (the spec expresses region roles as component types instead:
 * `page:header`, `page:sidebar`) and a `className`, and widens `width` to any
 * string. Two layers of one idea, so they get two names.
 *
 * The `PageRegionWidth` alias below keeps its name: it is not a spec export,
 * and its members are exactly the spec's `width` enum.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export interface PageNodeRegion {
  /**
   * Region name/id (e.g. "sidebar", "main", "header")
   */
  name: string;
  /**
   * Region type — semantic role for layout rendering
   */
  type?: 'header' | 'sidebar' | 'main' | 'footer' | 'aside';
  /**
   * Region width (spec-aligned enum)
   */
  width?: PageRegionWidth | string;
  /**
   * Components in this region
   */
  components: SchemaNode[];
  /**
   * CSS class overrides
   */
  className?: string;
}

/**
 * Page layout component
 * Top-level container for a page route.
 * Aligned with @objectstack/spec PageSchema
 *
 * This is the SDUI NODE, not the authored page DOCUMENT — the spec's `Page`
 * is that, and the two are deliberately different types (same layer split as
 * {@link PageNodeRegion}).
 *
 * Tripwire: `__tests__/page-node-type-contract.test.ts`, which pins
 * `type` to exactly `'page'` — the `ComponentRegistry` key
 * `@object-ui/components` registers `PageRenderer` under, i.e. the wire key
 * authored metadata carries. Nothing else in the repo pins it.
 */
export interface PageNodeSchema extends BaseSchema {
  type: 'page';
  /**
   * Page title
   */
  title?: string;
  /**
   * Page icon (Lucide icon name)
   */
  icon?: string;
  /**
   * Page description
   */
  description?: string;
  /**
   * Page type — determines default layout and behavior
   * @default 'record'
   */
  pageType?: PageType;
  /**
   * Bound object name (for record pages)
   * Provides record context to components in regions
   */
  object?: string;
  /**
   * Layout template name (e.g. "default", "header-sidebar-main")
   * @default 'default'
   */
  template?: string;
  /**
   * Local page state variables
   * Initialized on mount and available to all components via context
   */
  variables?: PageVariable[];
  /**
   * Page layout regions
   * (Aligned with @objectstack/spec Page.regions)
   */
  regions?: PageNodeRegion[];
  // blankLayout removed — the `blank` page type has no renderer and was dropped
  // from @objectstack/spec PageTypeSchema (framework#2265, enforce-or-remove).
  /**
   * Main content array (Legacy/Simple mode)
   */
  body?: SchemaNode[];
  /**
   * Alternative content prop
   */
  children?: SchemaNode | SchemaNode[];
  /**
   * Whether this is the default page for the object/app
   * @default false
   */
  isDefault?: boolean;
  /**
   * Profiles that can access this page
   */
  assignedProfiles?: string[];
  /**
   * ARIA accessibility attributes.
   * Aligned with @objectstack/spec AriaPropsSchema.
   */
  aria?: {
    ariaLabel?: string;
    ariaDescribedBy?: string;
    role?: string;
  };
  /**
   * How the page's body is authored. Mirrors `@objectstack/spec`'s page
   * `kind` enum.
   *
   * Schema-authored (the `regions[].components[]` tree):
   * - `"full"` (default): the schema fully describes the page; the
   *   default-page synthesizer is bypassed entirely.
   * - `"slotted"`: the schema only provides overrides for one or more
   *   named slots (see `slots`). The default-page synthesizer fills in
   *   every slot the author did NOT override. Use this when you want
   *   to customize just the header / actions / one tab without
   *   re-authoring the rest of the page. Only meaningful when
   *   `pageType === 'record'`; ignored for other page types.
   *
   * Source-authored (`source` carries the body; `regions` is unused) —
   * ADR-0080, see `content/docs/guide/react-pages.md`:
   * - `"html"`: constrained JSX/HTML + Tailwind, PARSED into a SchemaNode
   *   tree and rendered. Never executed — safe for untrusted authors.
   *   `"jsx"` is a deprecated alias, still accepted.
   * - `"react"`: real React, transpiled and EVALUATED in the main tree.
   *   No sandbox; gated behind the `react-pages` host capability.
   *
   * @default 'full'
   */
  kind?: 'full' | 'slotted' | 'html' | 'jsx' | 'react';
  /**
   * Slotted override map. Each slot accepts a single SchemaNode or an
   * array (arrays are flattened into the slot position). Slots not
   * provided fall through to the synthesized default.
   *
   * Slot menu (v1):
   * - `header` — replaces the `page:header` node.
   * - `actions` — replaces the `record:quick_actions` action bar.
   * - `highlights` — replaces the highlight strip (chips + chevron
   *   path).
   * - `details` — replaces the body of the Details tab (a.k.a. the
   *   `record:details` sections). Use this to customize the Details
   *   layout while keeping Related / Activity / History tabs as
   *   synthesized.
   * - `tabs` — replaces the entire `page:tabs` node. Use this when
   *   you need to add custom tabs or reorder them; you own the full
   *   tab system. Wins over `details` when both are present.
   * - `discussion` — replaces the inline `record:discussion` footer.
   *
   * Each slot is a **full replacement** at the slot boundary — no
   * deep merge, no patch operations. To compose default + custom,
   * call the corresponding `buildDefault*` sub-builder from
   * `@object-ui/plugin-detail` and spread its output.
   *
   * Only honored when `kind === 'slotted'`.
   */
  slots?: PageSlotMap;
}

/**
 * Named-slot override map for slotted record pages.
 *
 * Each slot accepts a single SchemaNode or an array. The synthesizer
 * inlines the provided value verbatim at the slot's position in the
 * canonical Page schema; slots that are omitted fall through to the
 * synthesized default.
 *
 * See `PageSchema.slots` for the per-slot semantics.
 */
export interface PageSlotMap {
  header?: SchemaNode | SchemaNode[];
  actions?: SchemaNode | SchemaNode[];
  highlights?: SchemaNode | SchemaNode[];
  details?: SchemaNode | SchemaNode[];
  tabs?: SchemaNode | SchemaNode[];
  discussion?: SchemaNode | SchemaNode[];
}

/**
 * Union type of all layout schemas
 */
export type LayoutSchema =
  | DivSchema
  | TextSpanSchema
  | TextSchema
  | ImageSchema
  | IconSchema
  | SeparatorSchema
  | ContainerSchema
  | FlexSchema
  | StackSchema
  | GridSchema
  | CardSchema
  | TabsSchema
  | ScrollAreaSchema
  | ResizableSchema
  | AspectRatioSchema
  | PageNodeSchema;

