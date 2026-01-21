/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
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
