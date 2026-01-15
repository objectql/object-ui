/**
 * @object-ui/core - Schema Builder
 *
 * Fluent API for building schemas programmatically.
 * Provides type-safe builder functions for common schema patterns.
 *
 * @module builder
 * @packageDocumentation
 */
/**
 * Base builder class
 */
class SchemaBuilder {
    constructor(type) {
        Object.defineProperty(this, "schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.schema = { type };
    }
    /**
     * Set the ID
     */
    id(id) {
        this.schema.id = id;
        return this;
    }
    /**
     * Set the className
     */
    className(className) {
        this.schema.className = className;
        return this;
    }
    /**
     * Set visibility
     */
    visible(visible) {
        this.schema.visible = visible;
        return this;
    }
    /**
     * Set conditional visibility
     */
    visibleOn(expression) {
        this.schema.visibleOn = expression;
        return this;
    }
    /**
     * Set disabled state
     */
    disabled(disabled) {
        this.schema.disabled = disabled;
        return this;
    }
    /**
     * Set test ID
     */
    testId(testId) {
        this.schema.testId = testId;
        return this;
    }
    /**
     * Build the final schema
     */
    build() {
        return this.schema;
    }
}
/**
 * Form builder
 */
export class FormBuilder extends SchemaBuilder {
    constructor() {
        super('form');
        this.schema.fields = [];
    }
    /**
     * Add a field to the form
     */
    field(field) {
        this.schema.fields = [...(this.schema.fields || []), field];
        return this;
    }
    /**
     * Add multiple fields
     */
    fields(fields) {
        this.schema.fields = fields;
        return this;
    }
    /**
     * Set default values
     */
    defaultValues(values) {
        this.schema.defaultValues = values;
        return this;
    }
    /**
     * Set submit label
     */
    submitLabel(label) {
        this.schema.submitLabel = label;
        return this;
    }
    /**
     * Set form layout
     */
    layout(layout) {
        this.schema.layout = layout;
        return this;
    }
    /**
     * Set number of columns
     */
    columns(columns) {
        this.schema.columns = columns;
        return this;
    }
    /**
     * Set submit handler
     */
    onSubmit(handler) {
        this.schema.onSubmit = handler;
        return this;
    }
}
/**
 * CRUD builder
 */
export class CRUDBuilder extends SchemaBuilder {
    constructor() {
        super('crud');
        this.schema.columns = [];
    }
    /**
     * Set resource name
     */
    resource(resource) {
        this.schema.resource = resource;
        return this;
    }
    /**
     * Set API endpoint
     */
    api(api) {
        this.schema.api = api;
        return this;
    }
    /**
     * Set title
     */
    title(title) {
        this.schema.title = title;
        return this;
    }
    /**
     * Set description
     */
    description(description) {
        this.schema.description = description;
        return this;
    }
    /**
     * Add a column
     */
    column(column) {
        this.schema.columns = [...(this.schema.columns || []), column];
        return this;
    }
    /**
     * Set all columns
     */
    columns(columns) {
        this.schema.columns = columns;
        return this;
    }
    /**
     * Set form fields
     */
    fields(fields) {
        this.schema.fields = fields;
        return this;
    }
    /**
     * Enable create operation
     */
    enableCreate(label) {
        if (!this.schema.operations)
            this.schema.operations = {};
        this.schema.operations.create = {
            enabled: true,
            label: label || 'Create',
            api: this.schema.api,
            method: 'POST'
        };
        return this;
    }
    /**
     * Enable update operation
     */
    enableUpdate(label) {
        if (!this.schema.operations)
            this.schema.operations = {};
        this.schema.operations.update = {
            enabled: true,
            label: label || 'Update',
            api: `${this.schema.api}/\${id}`,
            method: 'PUT'
        };
        return this;
    }
    /**
     * Enable delete operation
     */
    enableDelete(label, confirmText) {
        if (!this.schema.operations)
            this.schema.operations = {};
        this.schema.operations.delete = {
            enabled: true,
            label: label || 'Delete',
            api: `${this.schema.api}/\${id}`,
            method: 'DELETE',
            confirmText: confirmText || 'Are you sure?'
        };
        return this;
    }
    /**
     * Set pagination
     */
    pagination(pageSize = 20) {
        this.schema.pagination = {
            enabled: true,
            pageSize,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: true,
            showSizeChanger: true
        };
        return this;
    }
    /**
     * Enable row selection
     */
    selectable(mode = 'multiple') {
        this.schema.selectable = mode;
        return this;
    }
    /**
     * Add a batch action
     */
    batchAction(action) {
        this.schema.batchActions = [...(this.schema.batchActions || []), action];
        return this;
    }
    /**
     * Add a row action
     */
    rowAction(action) {
        this.schema.rowActions = [...(this.schema.rowActions || []), action];
        return this;
    }
}
/**
 * Button builder
 */
export class ButtonBuilder extends SchemaBuilder {
    constructor() {
        super('button');
    }
    /**
     * Set button label
     */
    label(label) {
        this.schema.label = label;
        return this;
    }
    /**
     * Set button variant
     */
    variant(variant) {
        this.schema.variant = variant;
        return this;
    }
    /**
     * Set button size
     */
    size(size) {
        this.schema.size = size;
        return this;
    }
    /**
     * Set button icon
     */
    icon(icon) {
        this.schema.icon = icon;
        return this;
    }
    /**
     * Set click handler
     */
    onClick(handler) {
        this.schema.onClick = handler;
        return this;
    }
    /**
     * Set loading state
     */
    loading(loading) {
        this.schema.loading = loading;
        return this;
    }
}
/**
 * Input builder
 */
export class InputBuilder extends SchemaBuilder {
    constructor() {
        super('input');
    }
    /**
     * Set field name
     */
    name(name) {
        this.schema.name = name;
        return this;
    }
    /**
     * Set label
     */
    label(label) {
        this.schema.label = label;
        return this;
    }
    /**
     * Set placeholder
     */
    placeholder(placeholder) {
        this.schema.placeholder = placeholder;
        return this;
    }
    /**
     * Set input type
     */
    inputType(type) {
        this.schema.inputType = type;
        return this;
    }
    /**
     * Mark as required
     */
    required(required = true) {
        this.schema.required = required;
        return this;
    }
    /**
     * Set default value
     */
    defaultValue(value) {
        this.schema.defaultValue = value;
        return this;
    }
}
/**
 * Card builder
 */
export class CardBuilder extends SchemaBuilder {
    constructor() {
        super('card');
    }
    /**
     * Set card title
     */
    title(title) {
        this.schema.title = title;
        return this;
    }
    /**
     * Set card description
     */
    description(description) {
        this.schema.description = description;
        return this;
    }
    /**
     * Set card content
     */
    content(content) {
        this.schema.content = content;
        return this;
    }
    /**
     * Set card variant
     */
    variant(variant) {
        this.schema.variant = variant;
        return this;
    }
    /**
     * Make card hoverable
     */
    hoverable(hoverable = true) {
        this.schema.hoverable = hoverable;
        return this;
    }
}
/**
 * Grid builder
 */
export class GridBuilder extends SchemaBuilder {
    constructor() {
        super('grid');
        this.schema.children = [];
    }
    /**
     * Set number of columns
     */
    columns(columns) {
        this.schema.columns = columns;
        return this;
    }
    /**
     * Set gap
     */
    gap(gap) {
        this.schema.gap = gap;
        return this;
    }
    /**
     * Add a child
     */
    child(child) {
        const children = Array.isArray(this.schema.children) ? this.schema.children : [];
        this.schema.children = [...children, child];
        return this;
    }
    /**
     * Set all children
     */
    children(children) {
        this.schema.children = children;
        return this;
    }
}
/**
 * Flex builder
 */
export class FlexBuilder extends SchemaBuilder {
    constructor() {
        super('flex');
        this.schema.children = [];
    }
    /**
     * Set flex direction
     */
    direction(direction) {
        this.schema.direction = direction;
        return this;
    }
    /**
     * Set justify content
     */
    justify(justify) {
        this.schema.justify = justify;
        return this;
    }
    /**
     * Set align items
     */
    align(align) {
        this.schema.align = align;
        return this;
    }
    /**
     * Set gap
     */
    gap(gap) {
        this.schema.gap = gap;
        return this;
    }
    /**
     * Add a child
     */
    child(child) {
        const children = Array.isArray(this.schema.children) ? this.schema.children : [];
        this.schema.children = [...children, child];
        return this;
    }
    /**
     * Set all children
     */
    children(children) {
        this.schema.children = children;
        return this;
    }
}
// Export factory functions
export const form = () => new FormBuilder();
export const crud = () => new CRUDBuilder();
export const button = () => new ButtonBuilder();
export const input = () => new InputBuilder();
export const card = () => new CardBuilder();
export const grid = () => new GridBuilder();
export const flex = () => new FlexBuilder();
