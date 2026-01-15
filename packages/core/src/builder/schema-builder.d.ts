/**
 * @object-ui/core - Schema Builder
 *
 * Fluent API for building schemas programmatically.
 * Provides type-safe builder functions for common schema patterns.
 *
 * @module builder
 * @packageDocumentation
 */
import type { BaseSchema, FormSchema, FormField, CRUDSchema, TableColumn, ActionSchema, ButtonSchema, InputSchema, CardSchema, GridSchema, FlexSchema } from '@object-ui/types';
/**
 * Base builder class
 */
declare class SchemaBuilder<T extends BaseSchema> {
    protected schema: any;
    constructor(type: string);
    /**
     * Set the ID
     */
    id(id: string): this;
    /**
     * Set the className
     */
    className(className: string): this;
    /**
     * Set visibility
     */
    visible(visible: boolean): this;
    /**
     * Set conditional visibility
     */
    visibleOn(expression: string): this;
    /**
     * Set disabled state
     */
    disabled(disabled: boolean): this;
    /**
     * Set test ID
     */
    testId(testId: string): this;
    /**
     * Build the final schema
     */
    build(): T;
}
/**
 * Form builder
 */
export declare class FormBuilder extends SchemaBuilder<FormSchema> {
    constructor();
    /**
     * Add a field to the form
     */
    field(field: FormField): this;
    /**
     * Add multiple fields
     */
    fields(fields: FormField[]): this;
    /**
     * Set default values
     */
    defaultValues(values: Record<string, any>): this;
    /**
     * Set submit label
     */
    submitLabel(label: string): this;
    /**
     * Set form layout
     */
    layout(layout: 'vertical' | 'horizontal'): this;
    /**
     * Set number of columns
     */
    columns(columns: number): this;
    /**
     * Set submit handler
     */
    onSubmit(handler: (data: Record<string, any>) => void | Promise<void>): this;
}
/**
 * CRUD builder
 */
export declare class CRUDBuilder extends SchemaBuilder<CRUDSchema> {
    constructor();
    /**
     * Set resource name
     */
    resource(resource: string): this;
    /**
     * Set API endpoint
     */
    api(api: string): this;
    /**
     * Set title
     */
    title(title: string): this;
    /**
     * Set description
     */
    description(description: string): this;
    /**
     * Add a column
     */
    column(column: TableColumn): this;
    /**
     * Set all columns
     */
    columns(columns: TableColumn[]): this;
    /**
     * Set form fields
     */
    fields(fields: FormField[]): this;
    /**
     * Enable create operation
     */
    enableCreate(label?: string): this;
    /**
     * Enable update operation
     */
    enableUpdate(label?: string): this;
    /**
     * Enable delete operation
     */
    enableDelete(label?: string, confirmText?: string): this;
    /**
     * Set pagination
     */
    pagination(pageSize?: number): this;
    /**
     * Enable row selection
     */
    selectable(mode?: 'single' | 'multiple'): this;
    /**
     * Add a batch action
     */
    batchAction(action: ActionSchema): this;
    /**
     * Add a row action
     */
    rowAction(action: ActionSchema): this;
}
/**
 * Button builder
 */
export declare class ButtonBuilder extends SchemaBuilder<ButtonSchema> {
    constructor();
    /**
     * Set button label
     */
    label(label: string): this;
    /**
     * Set button variant
     */
    variant(variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'): this;
    /**
     * Set button size
     */
    size(size: 'default' | 'sm' | 'lg' | 'icon'): this;
    /**
     * Set button icon
     */
    icon(icon: string): this;
    /**
     * Set click handler
     */
    onClick(handler: () => void | Promise<void>): this;
    /**
     * Set loading state
     */
    loading(loading: boolean): this;
}
/**
 * Input builder
 */
export declare class InputBuilder extends SchemaBuilder<InputSchema> {
    constructor();
    /**
     * Set field name
     */
    name(name: string): this;
    /**
     * Set label
     */
    label(label: string): this;
    /**
     * Set placeholder
     */
    placeholder(placeholder: string): this;
    /**
     * Set input type
     */
    inputType(type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'): this;
    /**
     * Mark as required
     */
    required(required?: boolean): this;
    /**
     * Set default value
     */
    defaultValue(value: string | number): this;
}
/**
 * Card builder
 */
export declare class CardBuilder extends SchemaBuilder<CardSchema> {
    constructor();
    /**
     * Set card title
     */
    title(title: string): this;
    /**
     * Set card description
     */
    description(description: string): this;
    /**
     * Set card content
     */
    content(content: BaseSchema | BaseSchema[]): this;
    /**
     * Set card variant
     */
    variant(variant: 'default' | 'outline' | 'ghost'): this;
    /**
     * Make card hoverable
     */
    hoverable(hoverable?: boolean): this;
}
/**
 * Grid builder
 */
export declare class GridBuilder extends SchemaBuilder<GridSchema> {
    constructor();
    /**
     * Set number of columns
     */
    columns(columns: number): this;
    /**
     * Set gap
     */
    gap(gap: number): this;
    /**
     * Add a child
     */
    child(child: BaseSchema): this;
    /**
     * Set all children
     */
    children(children: BaseSchema[]): this;
}
/**
 * Flex builder
 */
export declare class FlexBuilder extends SchemaBuilder<FlexSchema> {
    constructor();
    /**
     * Set flex direction
     */
    direction(direction: 'row' | 'col' | 'row-reverse' | 'col-reverse'): this;
    /**
     * Set justify content
     */
    justify(justify: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'): this;
    /**
     * Set align items
     */
    align(align: 'start' | 'end' | 'center' | 'baseline' | 'stretch'): this;
    /**
     * Set gap
     */
    gap(gap: number): this;
    /**
     * Add a child
     */
    child(child: BaseSchema): this;
    /**
     * Set all children
     */
    children(children: BaseSchema[]): this;
}
export declare const form: () => FormBuilder;
export declare const crud: () => CRUDBuilder;
export declare const button: () => ButtonBuilder;
export declare const input: () => InputBuilder;
export declare const card: () => CardBuilder;
export declare const grid: () => GridBuilder;
export declare const flex: () => FlexBuilder;
export {};
