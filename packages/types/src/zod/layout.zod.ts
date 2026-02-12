/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Layout Component Zod Validators
 * 
 * Zod validation schemas for layout and container components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/layout
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * Div Schema - Basic HTML container
 */
export const DivSchema = BaseSchema.extend({
  type: z.literal('div'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Span Schema - Inline text container
 */
export const SpanSchema = BaseSchema.extend({
  type: z.literal('span'),
  value: z.string().optional().describe('Text content'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Text Schema - Text display component
 */
export const TextSchema = BaseSchema.extend({
  type: z.literal('text'),
  value: z.string().optional().describe('Text content'),
  variant: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'caption', 'overline'])
    .optional()
    .default('body')
    .describe('Text variant/style'),
  align: z.enum(['left', 'center', 'right', 'justify']).optional().describe('Text alignment'),
});

/**
 * Image Schema - Image component
 */
export const ImageSchema = BaseSchema.extend({
  type: z.literal('image'),
  src: z.string().describe('Image source URL'),
  alt: z.string().optional().describe('Alt text for accessibility'),
  width: z.union([z.string(), z.number()]).optional().describe('Image width'),
  height: z.union([z.string(), z.number()]).optional().describe('Image height'),
  objectFit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down']).optional().describe('Object fit property'),
});

/**
 * Icon Schema - Icon component (Lucide icons)
 */
export const IconSchema = BaseSchema.extend({
  type: z.literal('icon'),
  name: z.string().describe('Icon name (lucide-react)'),
  size: z.number().optional().default(24).describe('Icon size in pixels'),
  color: z.string().optional().describe('Icon color'),
});

/**
 * Separator Schema - Divider component
 */
export const SeparatorSchema = BaseSchema.extend({
  type: z.literal('separator'),
  orientation: z.enum(['horizontal', 'vertical']).optional().default('horizontal').describe('Separator orientation'),
  decorative: z.boolean().optional().describe('Whether decorative'),
});

/**
 * Container Schema - Generic container component
 */
export const ContainerSchema = BaseSchema.extend({
  type: z.literal('container'),
  maxWidth: z.union([
    z.enum(['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full', 'screen']),
    z.boolean(),
  ]).optional().default('lg').describe('Max width constraint'),
  centered: z.boolean().optional().default(true).describe('Center the container'),
  padding: z.number().optional().describe('Padding value'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Flex Schema - Flexbox layout component
 */
export const FlexSchema = BaseSchema.extend({
  type: z.literal('flex'),
  direction: z.enum(['row', 'col', 'row-reverse', 'col-reverse'])
    .optional()
    .default('row')
    .describe('Flex direction'),
  justify: z.enum(['start', 'end', 'center', 'between', 'around', 'evenly'])
    .optional()
    .default('start')
    .describe('Justify content alignment'),
  align: z.enum(['start', 'end', 'center', 'baseline', 'stretch'])
    .optional()
    .default('center')
    .describe('Align items'),
  gap: z.number().optional().default(2).describe('Gap between items (Tailwind scale 0-8)'),
  wrap: z.boolean().optional().default(false).describe('Allow items to wrap'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Stack Schema - Vertical flex layout (shortcut)
 */
export const StackSchema = BaseSchema.extend({
  type: z.literal('stack'),
  direction: z.enum(['row', 'col', 'row-reverse', 'col-reverse']).optional(),
  justify: z.enum(['start', 'end', 'center', 'between', 'around', 'evenly']).optional(),
  align: z.enum(['start', 'end', 'center', 'baseline', 'stretch']).optional(),
  gap: z.number().optional(),
  wrap: z.boolean().optional(),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Grid Schema - CSS Grid layout component
 */
export const GridSchema = BaseSchema.extend({
  type: z.literal('grid'),
  columns: z.union([
    z.number(),
    z.record(z.string(), z.number()),
  ]).optional().default(3).describe('Number of columns (responsive)'),
  gap: z.number().optional().default(4).describe('Gap between items (Tailwind scale 0-8)'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Card Schema - Card component
 */
export const CardSchema = BaseSchema.extend({
  type: z.literal('card'),
  title: z.string().optional().describe('Card title'),
  description: z.string().optional().describe('Card description'),
  header: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Card header content'),
  body: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Card body content'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Child components'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Card footer content'),
  variant: z.enum(['default', 'outline', 'ghost']).optional().default('default').describe('Card variant style'),
  hoverable: z.boolean().optional().default(false).describe('Whether the card is hoverable'),
  clickable: z.boolean().optional().default(false).describe('Whether the card is clickable'),
  onClick: z.function().optional().describe('Click handler'),
});

/**
 * Tab Item Schema
 */
export const TabItemSchema = z.object({
  value: z.string().describe('Unique tab identifier'),
  label: z.string().describe('Tab label'),
  icon: z.string().optional().describe('Tab icon'),
  disabled: z.boolean().optional().describe('Whether tab is disabled'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Tab content'),
});

/**
 * Tabs Schema - Tabs component
 */
export const TabsSchema = BaseSchema.extend({
  type: z.literal('tabs'),
  defaultValue: z.string().optional().describe('Default active tab value'),
  value: z.string().optional().describe('Controlled active tab value'),
  orientation: z.enum(['horizontal', 'vertical']).optional().default('horizontal').describe('Tabs orientation'),
  items: z.array(TabItemSchema).describe('Tab items configuration'),
  onValueChange: z.function().optional().describe('Change handler'),
});

/**
 * Scroll Area Schema
 */
export const ScrollAreaSchema = BaseSchema.extend({
  type: z.literal('scroll-area'),
  height: z.union([z.string(), z.number()]).optional().describe('Height of scroll container'),
  width: z.union([z.string(), z.number()]).optional().describe('Width of scroll container'),
  orientation: z.enum(['vertical', 'horizontal', 'both']).optional().default('vertical').describe('Scrollbar orientation'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Resizable Panel Schema
 */
export const ResizablePanelSchema = z.object({
  id: z.string().describe('Unique panel identifier'),
  defaultSize: z.number().optional().describe('Default size (percentage 0-100)'),
  minSize: z.number().optional().describe('Minimum size (percentage 0-100)'),
  maxSize: z.number().optional().describe('Maximum size (percentage 0-100)'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Panel content'),
});

/**
 * Resizable Schema - Resizable panels component
 */
export const ResizableSchema = BaseSchema.extend({
  type: z.literal('resizable'),
  direction: z.enum(['horizontal', 'vertical']).optional().default('horizontal').describe('Direction of resizable panels'),
  minHeight: z.union([z.string(), z.number()]).optional().describe('Minimum height'),
  withHandle: z.boolean().optional().default(true).describe('Show resize handle'),
  panels: z.array(ResizablePanelSchema).describe('Resizable panels'),
});

/**
 * Aspect Ratio Schema
 */
export const AspectRatioSchema = BaseSchema.extend({
  type: z.literal('aspect-ratio'),
  ratio: z.number().optional().default(16 / 9).describe('Aspect ratio (width / height)'),
  image: z.string().optional().describe('Image URL to display'),
  alt: z.string().optional().describe('Image alt text'),
  body: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Child components (alternative to image)'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Child components'),
});

/**
 * Page Region Width Schema
 */
export const PageRegionWidthSchema = z.enum(['small', 'medium', 'large', 'full']);

/**
 * Page Region Schema
 */
export const PageRegionSchema = z.object({
  name: z.string().describe('Region name (e.g. "sidebar", "main", "header")'),
  type: z.enum(['header', 'sidebar', 'main', 'footer', 'aside']).optional().describe('Semantic region type'),
  width: z.union([PageRegionWidthSchema, z.string()]).optional().describe('Region width'),
  components: z.array(SchemaNodeSchema).describe('Components in this region'),
  className: z.string().optional().describe('CSS class overrides'),
});

/**
 * Page Variable Schema
 */
export const PageVariableSchema = z.object({
  name: z.string().describe('Variable name'),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']).optional().default('string').describe('Variable type'),
  defaultValue: z.any().optional().describe('Default value'),
});

/**
 * Page Type Schema
 */
export const PageTypeSchema = z.enum(['record', 'home', 'app', 'utility']);

/**
 * Page Schema - Top-level page layout
 * Aligned with @objectstack/spec PageSchema
 */
export const PageSchema = BaseSchema.extend({
  type: z.literal('page'),
  title: z.string().optional().describe('Page title'),
  icon: z.string().optional().describe('Page icon (Lucide icon name)'),
  description: z.string().optional().describe('Page description'),
  pageType: PageTypeSchema.optional().describe('Page type (record, home, app, utility)'),
  object: z.string().optional().describe('Bound object name (for record pages)'),
  template: z.string().optional().default('default').describe('Layout template name'),
  variables: z.array(PageVariableSchema).optional().describe('Local page state variables'),
  regions: z.array(PageRegionSchema).optional().describe('Page layout regions'),
  body: z.array(SchemaNodeSchema).optional().describe('Main content array'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Alternative content prop'),
  isDefault: z.boolean().optional().default(false).describe('Whether this is the default page'),
  assignedProfiles: z.array(z.string()).optional().describe('Profiles that can access this page'),
});

/**
 * Layout Schema Union - All layout component schemas
 */
export const LayoutSchema = z.discriminatedUnion('type', [
  DivSchema,
  SpanSchema,
  TextSchema,
  ImageSchema,
  IconSchema,
  SeparatorSchema,
  ContainerSchema,
  FlexSchema,
  StackSchema,
  GridSchema,
  CardSchema,
  TabsSchema,
  ScrollAreaSchema,
  ResizableSchema,
  AspectRatioSchema,
  PageSchema,
]);
