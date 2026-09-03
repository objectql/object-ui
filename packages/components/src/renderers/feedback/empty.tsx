/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { CSSProperties } from 'react';
import type { EmptySchema, BaseSchema } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';
import { DataEmptyState } from '../../custom/view-states';

ComponentRegistry.register('empty', 
  ({ schema, ...props }: { schema: EmptySchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        // Strip schema-shaped props that would otherwise leak through and
        // be rendered as a React child (the SDUI runtime spreads every
        // non-metadata schema key onto the component, but `action` here is
        // a child schema, not a DOM attribute or React node).
        action: _ignoredAction,
        icon: _ignoredIcon,
        ...emptyProps
    } = props as Record<string, unknown>;

    // `BaseSchema`, not the retired block-family `ComponentSchema` (objectui#4895):
    // `action` is any renderable node handed to `SchemaRenderer`, never the
    // `type: 'component'` kind the old annotation named. NOT `SchemaNode` —
    // objectui#7082 recorded that this cast needs the OBJECT half, since the
    // guard below rejects the `string | number | boolean` members `SchemaNode`
    // also admits.
    const actionSchema = (schema as any).action as BaseSchema | undefined;
    const actionNode = actionSchema && typeof actionSchema === 'object'
      ? <SchemaRenderer schema={actionSchema as any} />
      : undefined;

    return (
      <DataEmptyState
        title={schema.title || 'No data'}
        description={schema.description}
        className={schema.className}
        action={actionNode}
        {...emptyProps}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style: style as CSSProperties | undefined }}
      />
    );
  },
  {
    namespace: 'ui',
    label: 'Empty',
    inputs: [
      { name: 'title', type: 'string', label: 'Title', defaultValue: 'No data' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      title: 'No data'
    }
  }
);
