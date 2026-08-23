/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry, toDomProps } from '@object-ui/core';
import type { TextSchema } from '@object-ui/types';

ComponentRegistry.register('text', 
  ({ schema, ...props }: { schema: TextSchema; [key: string]: any }) => {
    // Text is a special case as it might be rendered as a fragment or span depending on usage.
    // However, to support drag and drop in designer, it MUST be wrapped in an element if props are passed.
    
    // DOM pass-through is a WHITELIST — objectui#3291's discipline, executed by
    // {@link toDomProps}. Mechanism and full argument: `grid.tsx`'s docblock
    // (objectui#4787 / PR #5573) and `packages/core/src/utils/dom-props.ts`.
    //
    // MEASURED (objectui#5574): every `text` node in `examples/schema-catalog`
    // rendered through the real `SchemaRenderer` and read off the DOM — 523
    // illegitimate attributes, the largest single reading in the family, and all
    // but one of them `content` (522; the odd one out is `value`). Those are the
    // two keys this renderer RENDERS AS ITS CHILDREN, so every leaked attribute
    // duplicated the visible text into the markup.
    //
    // The reading also has to be read against its own denominator: 699 `text`
    // nodes rendered, and 176 of them produced NO ELEMENT at all — the fragment
    // return below, taken when a node carries neither designer id nor className.
    // A renderer that renders nothing spreads nothing and reads clean, so those
    // 176 were never evidence of safety; they are the phantom-clean class the
    // sweep's readiness selectors exist to keep honest.
    //
    // `style` is forwarded by name (the objectui#4435 route); `data-obj-*` arrive
    // through the open `data-*` family {@link toDomProps} already forwards, which
    // is why the wrap condition reads `data-obj-id` off `hostProps` rather than
    // destructuring it out.
    const { style, ...hostProps } = props;
    const dataObjId = hostProps['data-obj-id'];
    const className = schema.className || hostProps.className;

    // If we have designer props or className, we must wrap it to make it selectable and styleable
    if (dataObjId || className) {
        return (
            <span 
                {...toDomProps(hostProps)}
                style={style}
                className={className}
            >
                {schema.content || schema.value}
            </span>
        );
    }

    return <>{schema.content || schema.value}</>;
  },
  {
    namespace: 'ui',
    label: 'Text',
    inputs: [
      { name: 'content', type: 'string', label: 'Content', required: true }
    ],
    defaultProps: {
      content: 'Text content'
    }
  }
);
