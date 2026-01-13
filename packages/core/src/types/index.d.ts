export interface SchemaNode {
    type: string;
    id?: string;
    className?: string;
    data?: any;
    body?: SchemaNode | SchemaNode[];
    [key: string]: any;
}
export interface ComponentRendererProps {
    schema: SchemaNode;
    [key: string]: any;
}
