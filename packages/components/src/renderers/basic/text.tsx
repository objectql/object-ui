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

    // If we have designer props, we must wrap it to make it selectable
    if (dataObjId) {
        return (
            <span 
                data-obj-id={dataObjId}
                data-obj-type={dataObjType}
                style={style}
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
