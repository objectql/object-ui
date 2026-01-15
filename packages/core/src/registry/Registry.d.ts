import type { SchemaNode } from '../types';
export type ComponentRenderer<T = any> = T;
export type ComponentInput = {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'color' | 'date' | 'code' | 'file' | 'slot';
    label?: string;
    defaultValue?: any;
    required?: boolean;
    enum?: string[] | {
        label: string;
        value: any;
    }[];
    description?: string;
    advanced?: boolean;
    inputType?: string;
};
export type ComponentMeta = {
    label?: string;
    icon?: string;
    category?: string;
    inputs?: ComponentInput[];
    defaultProps?: Record<string, any>;
    defaultChildren?: SchemaNode[];
    examples?: Record<string, any>;
    isContainer?: boolean;
    resizable?: boolean;
    resizeConstraints?: {
        width?: boolean;
        height?: boolean;
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
    };
};
export type ComponentConfig<T = any> = ComponentMeta & {
    type: string;
    component: ComponentRenderer<T>;
};
export declare class Registry<T = any> {
    private components;
    register(type: string, component: ComponentRenderer<T>, meta?: ComponentMeta): void;
    get(type: string): ComponentRenderer<T> | undefined;
    getConfig(type: string): ComponentConfig<T> | undefined;
    has(type: string): boolean;
    getAllTypes(): string[];
    getAllConfigs(): ComponentConfig<T>[];
}
export declare const ComponentRegistry: Registry<any>;
