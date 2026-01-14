/**
 * @object-ui/types - Base Schema Types
 * 
 * The foundational type definitions for the Object UI schema protocol.
 * These types define the universal interface for all UI components.
 * 
 * @module base
 * @packageDocumentation
 */

/**
 * Base schema interface that all component schemas extend.
 * This is the fundamental building block of the Object UI protocol.
 * 
 * @example
 * ```typescript
 * const schema: BaseSchema = {
 *   type: 'text',
 *   id: 'greeting',
 *   className: 'text-lg font-bold',
 *   data: { message: 'Hello World' }
 * }
 * ```
 */
export interface BaseSchema {
  /**
   * Component type identifier. Determines which renderer to use.
   * @example 'input', 'button', 'form', 'grid'
   */
  type: string;

  /**
   * Unique identifier for the component instance.
   * Used for state management, event handling, and React keys.
   */
  id?: string;

  /**
   * Tailwind CSS classes to apply to the component.
   * This is the primary styling mechanism in Object UI.
   * @example 'bg-blue-500 text-white p-4 rounded-lg'
   */
  className?: string;

  /**
   * Arbitrary data attached to the component.
   * Can be used for custom properties, state, or context.
   */
  data?: any;

  /**
   * Child components or content.
   * Can be a single component, array of components, or primitive values.
   */
  body?: SchemaNode | SchemaNode[];

  /**
   * Alternative name for children (React-style).
   * Some components use 'children' instead of 'body'.
   */
  children?: SchemaNode | SchemaNode[];

  /**
   * Additional properties specific to the component type.
   * This index signature allows type-specific extensions.
   */
  [key: string]: any;
}

/**
 * A schema node can be a full schema object or a primitive value.
 * This union type supports both structured components and simple content.
 * 
 * @example
 * ```typescript
 * const nodes: SchemaNode[] = [
 *   { type: 'text', value: 'Hello' },
 *   'Plain string',
 *   { type: 'button', label: 'Click' }
 * ]
 * ```
 */
export type SchemaNode = BaseSchema | string | number | boolean | null | undefined;

/**
 * Component renderer function type.
 * Accepts a schema and returns a rendered component.
 * Framework-agnostic - can be React, Vue, or any other renderer.
 */
export interface ComponentRendererProps<TSchema extends BaseSchema = BaseSchema> {
  /**
   * The schema object to render
   */
  schema: TSchema;

  /**
   * Additional properties passed to the renderer
   */
  [key: string]: any;
}

/**
 * Input field configuration for component metadata.
 * Describes what properties a component accepts in the designer/editor.
 */
export interface ComponentInput {
  /**
   * Property name (must match schema property)
   */
  name: string;

  /**
   * Input control type
   */
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'color' | 'date' | 'code' | 'file' | 'slot';

  /**
   * Display label in the editor
   */
  label?: string;

  /**
   * Default value for new instances
   */
  defaultValue?: any;

  /**
   * Whether this property is required
   */
  required?: boolean;

  /**
   * Enum options (for type='enum')
   */
  enum?: string[] | { label: string; value: any }[];

  /**
   * Help text or description
   */
  description?: string;

  /**
   * Whether this is an advanced/expert option
   */
  advanced?: boolean;

  /**
   * Specific input type (e.g., 'email', 'password' for string)
   */
  inputType?: string;

  /**
   * Minimum value (for number/date)
   */
  min?: number;

  /**
   * Maximum value (for number/date)
   */
  max?: number;

  /**
   * Step value (for number)
   */
  step?: number;

  /**
   * Placeholder text
   */
  placeholder?: string;
}

/**
 * Component metadata for registration and designer integration.
 * Describes the component's capabilities, defaults, and documentation.
 */
export interface ComponentMeta {
  /**
   * Display name in designer/palette
   */
  label?: string;

  /**
   * Icon name or SVG string
   */
  icon?: string;

  /**
   * Category for grouping (e.g., 'Layout', 'Form', 'Data Display')
   */
  category?: string;

  /**
   * Configurable properties
   */
  inputs?: ComponentInput[];

  /**
   * Default property values for new instances
   */
  defaultProps?: Record<string, any>;

  /**
   * Default children for container components
   */
  defaultChildren?: SchemaNode[];

  /**
   * Example configurations for documentation
   */
  examples?: Record<string, any>;

  /**
   * Whether the component can have children
   */
  isContainer?: boolean;

  /**
   * Whether the component can be resized in the designer
   */
  resizable?: boolean;

  /**
   * Resize constraints (which dimensions can be resized)
   */
  resizeConstraints?: {
    width?: boolean;
    height?: boolean;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };

  /**
   * Tags for search/filtering
   */
  tags?: string[];

  /**
   * Description for documentation
   */
  description?: string;
}

/**
 * Complete component configuration combining renderer and metadata.
 */
export interface ComponentConfig extends ComponentMeta {
  /**
   * Unique component type identifier
   */
  type: string;

  /**
   * The component renderer (framework-specific)
   */
  component: any;
}

/**
 * Common HTML attributes that can be applied to components
 */
export interface HTMLAttributes {
  id?: string;
  className?: string;
  style?: Record<string, any>;
  title?: string;
  role?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'data-testid'?: string;
}

/**
 * Event handler types
 */
export interface EventHandlers {
  onClick?: (event?: any) => void | Promise<void>;
  onChange?: (value: any, event?: any) => void | Promise<void>;
  onSubmit?: (data: any, event?: any) => void | Promise<void>;
  onFocus?: (event?: any) => void;
  onBlur?: (event?: any) => void;
  onKeyDown?: (event?: any) => void;
  onKeyUp?: (event?: any) => void;
  onMouseEnter?: (event?: any) => void;
  onMouseLeave?: (event?: any) => void;
}

/**
 * Common style properties using Tailwind's semantic naming
 */
export interface StyleProps {
  /**
   * Padding (Tailwind scale: 0-96)
   */
  padding?: number | string;

  /**
   * Margin (Tailwind scale: 0-96)
   */
  margin?: number | string;

  /**
   * Gap between flex/grid items (Tailwind scale: 0-96)
   */
  gap?: number | string;

  /**
   * Background color
   */
  backgroundColor?: string;

  /**
   * Text color
   */
  textColor?: string;

  /**
   * Border width
   */
  borderWidth?: number | string;

  /**
   * Border color
   */
  borderColor?: string;

  /**
   * Border radius
   */
  borderRadius?: number | string;
}
