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

import type { BaseSchema, SchemaNode } from './base';

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
export interface SpanSchema extends BaseSchema {
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
 * Page Type
 * Determines page behavior and default layout template.
 * Aligned with @objectstack/spec Page.type
 */
export type PageType = 'record' | 'home' | 'app' | 'utility';

/**
 * Page Variable
 * Local page state that can be read/written by components and expressions.
 * Aligned with @objectstack/spec PageVariableSchema
 */
export interface PageVariable {
  /** Variable name */
  name: string;
  /** Variable type @default 'string' */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Default value for initialization */
  defaultValue?: any;
}

/**
 * Page Region Size
 * Aligned with @objectstack/spec PageRegionSchema.width
 */
export type PageRegionWidth = 'small' | 'medium' | 'large' | 'full';

/**
 * Page Region (Header, Sidebar, Main, etc)
 * Aligned with @objectstack/spec PageRegionSchema
 */
export interface PageRegion {
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
 */
export interface PageSchema extends BaseSchema {
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
  regions?: PageRegion[];
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
}

/**
 * Union type of all layout schemas
 */
export type LayoutSchema =
  | DivSchema
  | SpanSchema
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
  | PageSchema;

