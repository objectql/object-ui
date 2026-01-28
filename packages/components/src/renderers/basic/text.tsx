/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { TextSchema } from '@object-ui/types';

ComponentRegistry.register('text', 
  ({ schema, ...props }: { schema: TextSchema; [key: string]: any }) => {
    // Text is a special case as it might be rendered as a fragment or span depending on usage.
    // However, to support drag and drop in designer, it MUST be wrapped in an element if props are passed.
    
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...rest 
    } = props;

    // If we have designer props or className, we must wrap it to make it selectable and styleable
    if (dataObjId || schema.className || rest.className) {
        return (
            <span 
                data-obj-id={dataObjId}
                data-obj-type={dataObjType}
                style={style}
                className={schema.className || rest.className}
                {...rest}
            >
                {schema.content || schema.value}
            </span>
        );
    }

    return <>{schema.content || schema.value}</>;
  },
  {
    label: 'Text',
    inputs: [
      { name: 'content', type: 'string', label: 'Content', required: true }
    ],
    defaultProps: {
      content: 'Text content'
    }
  }
);
