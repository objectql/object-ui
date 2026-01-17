/**
 * @object-ui/types
 * 
 * Pure TypeScript type definitions for Object UI - The Protocol Layer.
 * 
 * This package contains ZERO runtime dependencies and defines the complete
 * JSON schema protocol for the Object UI ecosystem.
 * 
 * ## Philosophy
 * 
 * Object UI follows a "Schema First" approach where:
 * 1. Types define the protocol (this package)
 * 2. Core implements the engine (@object-ui/core)
 * 3. React provides the framework bindings (@object-ui/react)
 * 4. Components provide the UI implementation (@object-ui/components)
 * 
 * ## Design Principles
 * 
 * - **Protocol Agnostic**: Works with any backend (REST, GraphQL, ObjectQL)
 * - **Framework Agnostic**: Types can be used with React, Vue, or vanilla JS
 * - **Zero Dependencies**: Pure TypeScript with no runtime dependencies
 * - **Tailwind Native**: Designed for Tailwind CSS styling via className
 * - **Type Safe**: Full TypeScript support with strict typing
 * 
 * ## Usage
 * 
 * ```typescript
 * import type { InputSchema, FormSchema, ButtonSchema } from '@object-ui/types';
 * 
 * const loginForm: FormSchema = {
 *   type: 'form',
 *   fields: [
 *     { name: 'email', type: 'input', inputType: 'email', required: true },
 *     { name: 'password', type: 'input', inputType: 'password', required: true }
 *   ]
 * };
 * ```
 * 
 * @packageDocumentation
 */

// ============================================================================
// Application - Global Configuration
// ============================================================================
export type {
  AppSchema,
  AppAction,
  MenuItem as AppMenuItem
} from './app';

// ============================================================================
// Base Types - The Foundation
// ============================================================================
export type {
  BaseSchema,
  SchemaNode,
  ComponentRendererProps,
  ComponentInput,
  ComponentMeta,
  ComponentConfig,
  HTMLAttributes,
  EventHandlers,
  StyleProps,
} from './base';

// ============================================================================
// Layout Components - Structure & Organization
// ============================================================================
export type {
  DivSchema,
  SpanSchema,
  TextSchema,
  ImageSchema,
  IconSchema,
  SeparatorSchema,
  ContainerSchema,
  FlexSchema,
  GridSchema,
  CardSchema,
  TabsSchema,
  TabItem,
  ScrollAreaSchema,
  ResizableSchema,
  ResizablePanel,
  LayoutSchema,
  PageSchema,
} from './layout';

// ============================================================================
// Form Components - User Input & Interaction
// ============================================================================
export type {
  ButtonSchema,
  InputSchema,
  TextareaSchema,
  SelectSchema,
  SelectOption,
  CheckboxSchema,
  RadioGroupSchema,
  RadioOption,
  SwitchSchema,
  ToggleSchema,
  SliderSchema,
  FileUploadSchema,
  DatePickerSchema,
  CalendarSchema,
  InputOTPSchema,
  ValidationRule,
  FieldCondition,
  FormField,
  FormSchema,
  LabelSchema,
  FormComponentSchema,
} from './form';

// ============================================================================
// Data Display Components - Information Presentation
// ============================================================================
export type {
  AlertSchema,
  BadgeSchema,
  AvatarSchema,
  ListSchema,
  ListItem,
  TableColumn,
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeNode,
  TreeViewSchema,
  ChartType,
  ChartSeries,
  ChartSchema,
  TimelineEvent,
  TimelineSchema,
  HtmlSchema,
  StatisticSchema,
  DataDisplaySchema,
} from './data-display';

// ============================================================================
// Feedback Components - Status & Progress Indication
// ============================================================================
export type {
  LoadingSchema,
  ProgressSchema,
  SkeletonSchema,
  ToastSchema,
  ToasterSchema,
  FeedbackSchema,
} from './feedback';

// ============================================================================
// Disclosure Components - Collapsible Content
// ============================================================================
export type {
  AccordionItem,
  AccordionSchema,
  CollapsibleSchema,
  DisclosureSchema,
} from './disclosure';

// ============================================================================
// Overlay Components - Modals & Popovers
// ============================================================================
export type {
  OverlayPosition,
  OverlayAlignment,
  DialogSchema,
  AlertDialogSchema,
  SheetSchema,
  DrawerSchema,
  PopoverSchema,
  TooltipSchema,
  HoverCardSchema,
  MenuItem,
  DropdownMenuSchema,
  ContextMenuSchema,
  OverlaySchema,
} from './overlay';

// ============================================================================
// Navigation Components - Menus & Navigation
// ============================================================================
export type {
  NavLink,
  HeaderBarSchema,
  SidebarSchema,
  BreadcrumbItem,
  BreadcrumbSchema,
  PaginationSchema,
  NavigationSchema,
} from './navigation';

// ============================================================================
// Complex Components - Advanced/Composite Components
// ============================================================================
export type {
  KanbanColumn,
  KanbanCard,
  KanbanSchema,
  CalendarViewMode,
  CalendarEvent,
  CalendarViewSchema,
  FilterOperator,
  FilterCondition,
  FilterGroup,
  FilterBuilderSchema,
  FilterField,
  CarouselItem,
  CarouselSchema,
  ChatMessage,
  ChatbotSchema,
  ComplexSchema,
} from './complex';

// ============================================================================
// Data Management - Backend Integration
// ============================================================================
export type {
  QueryParams,
  QueryResult,
  DataSource,
  DataScope,
  DataContext,
  DataBinding,
  ValidationError,
  APIError,
} from './data';

// ============================================================================
// CRUD Components - Create, Read, Update, Delete Operations
// ============================================================================
export type {
  ActionSchema,
  CRUDOperation,
  CRUDFilter,
  CRUDToolbar,
  CRUDPagination,
  CRUDSchema,
  DetailSchema,
  CRUDDialogSchema,
  CRUDComponentSchema,
} from './crud';

// ============================================================================
// ObjectQL Components - ObjectQL-specific components
// ============================================================================
export type {
  ObjectTableSchema,
  ObjectFormSchema,
  ObjectQLComponentSchema,
} from './objectql';

// ============================================================================
// API and Events - API Integration and Event Handling
// ============================================================================
export type {
  HTTPMethod,
  APIRequest,
  APIConfig,
  EventHandler,
  EventableSchema,
  DataFetchConfig,
  DataFetchableSchema,
  ExpressionContext,
  ExpressionSchema,
  APISchema,
} from './api-types';

// ============================================================================
// Union Types - Discriminated Unions for All Schemas
// ============================================================================

import type { BaseSchema, SchemaNode } from './base';
import type { LayoutSchema } from './layout';
import type { FormComponentSchema } from './form';
import type { DataDisplaySchema } from './data-display';
import type { FeedbackSchema } from './feedback';
import type { DisclosureSchema } from './disclosure';
import type { OverlaySchema } from './overlay';
import type { NavigationSchema } from './navigation';
import type { ComplexSchema } from './complex';
import type { CRUDComponentSchema } from './crud';
import type { ObjectQLComponentSchema } from './objectql';
import type { AppSchema } from './app';

/**
 * Union of all component schemas.
 * Use this for generic component rendering where the type is determined at runtime.
 */
export type AnySchema =
  | AppSchema 
  | BaseSchema
  | LayoutSchema
  | FormComponentSchema
  | DataDisplaySchema
  | FeedbackSchema
  | DisclosureSchema
  | OverlaySchema
  | NavigationSchema
  | ComplexSchema
  | CRUDComponentSchema
  | ObjectQLComponentSchema;

/**
 * Utility type to extract the schema type from a type string.
 * Useful for type narrowing in renderers.
 * 
 * @example
 * ```typescript
 * function renderComponent<T extends string>(schema: SchemaByType<T>) {
 *   // schema is now typed based on the type string
 * }
 * ```
 */
export type SchemaByType<T extends string> = Extract<AnySchema, { type: T }>;

/**
 * Utility type to make all properties optional except the type.
 * Useful for partial schema definitions in editors.
 */
export type PartialSchema<T extends BaseSchema> = {
  type: T['type'];
} & Partial<Omit<T, 'type'>>;

/**
 * Schema with required children (for container components).
 */
export type ContainerSchemaWithChildren = BaseSchema & {
  children: SchemaNode | SchemaNode[];
};

/**
 * Version information
 */
export const VERSION = '0.1.0';

/**
 * Schema version for compatibility checking
 */
export const SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Schema Registry - The Type Map
// ============================================================================
export type {
  SchemaRegistry,
  ComponentType,
} from './registry';
