/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Schema Builder
 * 
 * Fluent API for building schemas programmatically.
 * Provides type-safe builder functions for common schema patterns.
 * 
 * @module builder
 * @packageDocumentation
 */

import type {
  BaseSchema,
  FormSchema,
  FormField,
  ButtonSchema,
  InputSchema,
  CardSchema,
  GridSchema,
  FlexSchema
} from '@object-ui/types';

/**
 * Base builder class
 */
class SchemaBuilder<T extends BaseSchema> {
  protected schema: any;

  constructor(type: string) {
    this.schema = { type };
  }

  /**
   * Set the ID
   */
  id(id: string): this {
    this.schema.id = id;
    return this;
  }

  /**
   * Set the className
   */
  className(className: string): this {
    this.schema.className = className;
    return this;
  }

  /**
   * Set visibility
   */
  visible(visible: boolean): this {
    this.schema.visible = visible;
    return this;
  }

  /**
   * Set conditional visibility
   */
  visibleOn(expression: string): this {
    this.schema.visibleOn = expression;
    return this;
  }

  /**
   * Set disabled state
   */
  disabled(disabled: boolean): this {
    this.schema.disabled = disabled;
    return this;
  }

  /**
   * Set test ID
   */
  testId(testId: string): this {
    this.schema.testId = testId;
    return this;
  }

  /**
   * Build the final schema
   */
  build(): T {
    return this.schema as T;
  }
}

/**
 * Form builder
 */
export class FormBuilder extends SchemaBuilder<FormSchema> {
  constructor() {
    super('form');
    this.schema.fields = [];
  }

  /**
   * Add a field to the form
   */
  field(field: FormField): this {
    this.schema.fields = [...(this.schema.fields || []), field];
    return this;
  }

  /**
   * Add multiple fields
   */
  fields(fields: FormField[]): this {
    this.schema.fields = fields;
    return this;
  }

  /**
   * Set default values
   */
  defaultValues(values: Record<string, any>): this {
    this.schema.defaultValues = values;
    return this;
  }

  /**
   * Set submit label
   */
  submitLabel(label: string): this {
    this.schema.submitLabel = label;
    return this;
  }

  /**
   * Set form layout
   */
  layout(layout: 'vertical' | 'horizontal'): this {
    this.schema.layout = layout;
    return this;
  }

  /**
   * Set number of columns
   */
  columns(columns: number): this {
    this.schema.columns = columns;
    return this;
  }

  /**
   * Set submit handler
   */
  onSubmit(handler: (data: Record<string, any>) => void | Promise<void>): this {
    this.schema.onSubmit = handler;
    return this;
  }
}

/**
 * Button builder
 */
export class ButtonBuilder extends SchemaBuilder<ButtonSchema> {
  constructor() {
    super('button');
  }

  /**
   * Set button label
   */
  label(label: string): this {
    this.schema.label = label;
    return this;
  }

  /**
   * Set button variant
   */
  variant(variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'): this {
    this.schema.variant = variant;
    return this;
  }

  /**
   * Set button size
   */
  size(size: 'default' | 'sm' | 'lg' | 'icon'): this {
    this.schema.size = size;
    return this;
  }

  /**
   * Set button icon
   */
  icon(icon: string): this {
    this.schema.icon = icon;
    return this;
  }

  /**
   * Set click handler
   */
  onClick(handler: () => void | Promise<void>): this {
    this.schema.onClick = handler;
    return this;
  }

  /**
   * Set loading state
   */
  loading(loading: boolean): this {
    this.schema.loading = loading;
    return this;
  }
}

/**
 * Input builder
 */
export class InputBuilder extends SchemaBuilder<InputSchema> {
  constructor() {
    super('input');
  }

  /**
   * Set field name
   */
  name(name: string): this {
    this.schema.name = name;
    return this;
  }

  /**
   * Set label
   */
  label(label: string): this {
    this.schema.label = label;
    return this;
  }

  /**
   * Set placeholder
   */
  placeholder(placeholder: string): this {
    this.schema.placeholder = placeholder;
    return this;
  }

  /**
   * Set input type
   */
  inputType(type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'): this {
    this.schema.inputType = type;
    return this;
  }

  /**
   * Mark as required
   */
  required(required: boolean = true): this {
    this.schema.required = required;
    return this;
  }

  /**
   * Set default value
   */
  defaultValue(value: string | number): this {
    this.schema.defaultValue = value;
    return this;
  }
}

/**
 * Card builder
 */
export class CardBuilder extends SchemaBuilder<CardSchema> {
  constructor() {
    super('card');
  }

  /**
   * Set card title
   */
  title(title: string): this {
    this.schema.title = title;
    return this;
  }

  /**
   * Set card description
   */
  description(description: string): this {
    this.schema.description = description;
    return this;
  }

  /**
   * Set card content
   */
  content(content: BaseSchema | BaseSchema[]): this {
    this.schema.content = content;
    return this;
  }

  /**
   * Set card variant
   */
  variant(variant: 'default' | 'outline' | 'ghost'): this {
    this.schema.variant = variant;
    return this;
  }

  /**
   * Make card hoverable
   */
  hoverable(hoverable: boolean = true): this {
    this.schema.hoverable = hoverable;
    return this;
  }
}

/**
 * Grid builder
 */
export class GridBuilder extends SchemaBuilder<GridSchema> {
  constructor() {
    super('grid');
    this.schema.children = [];
  }

  /**
   * Set number of columns
   */
  columns(columns: number): this {
    this.schema.columns = columns;
    return this;
  }

  /**
   * Set gap
   */
  gap(gap: number): this {
    this.schema.gap = gap;
    return this;
  }

  /**
   * Add a child
   */
  child(child: BaseSchema): this {
    const children = Array.isArray(this.schema.children) ? this.schema.children : [];
    this.schema.children = [...children, child];
    return this;
  }

  /**
   * Set all children
   */
  children(children: BaseSchema[]): this {
    this.schema.children = children;
    return this;
  }
}

/**
 * Flex builder
 */
export class FlexBuilder extends SchemaBuilder<FlexSchema> {
  constructor() {
    super('flex');
    this.schema.children = [];
  }

  /**
   * Set flex direction
   */
  direction(direction: 'row' | 'col' | 'row-reverse' | 'col-reverse'): this {
    this.schema.direction = direction;
    return this;
  }

  /**
   * Set justify content
   */
  justify(justify: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'): this {
    this.schema.justify = justify;
    return this;
  }

  /**
   * Set align items
   */
  align(align: 'start' | 'end' | 'center' | 'baseline' | 'stretch'): this {
    this.schema.align = align;
    return this;
  }

  /**
   * Set gap
   */
  gap(gap: number): this {
    this.schema.gap = gap;
    return this;
  }

  /**
   * Add a child
   */
  child(child: BaseSchema): this {
    const children = Array.isArray(this.schema.children) ? this.schema.children : [];
    this.schema.children = [...children, child];
    return this;
  }

  /**
   * Set all children
   */
  children(children: BaseSchema[]): this {
    this.schema.children = children;
    return this;
  }
}

// Export factory functions
export const form = () => new FormBuilder();
export const button = () => new ButtonBuilder();
export const input = () => new InputBuilder();
export const card = () => new CardBuilder();
export const grid = () => new GridBuilder();
export const flex = () => new FlexBuilder();
