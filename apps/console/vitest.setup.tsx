import '@testing-library/jest-dom';
import React from 'react';
import '@object-ui/fields'; // Import fields first
import '@object-ui/plugin-dashboard'; // Import to register dashboard components
import '@object-ui/plugin-grid'; // Import to register grid components
import '@object-ui/components'; // Imports @object-ui/components for types

// Manually re-register basic text component to override field widget
// This is necessary because @object-ui/fields has @object-ui/components as a dependency,
// so components gets loaded BEFORE fields registers its widgets, causing fields to overwrite.
import { ComponentRegistry } from '@object-ui/core';
import type { TextSchema } from '@object-ui/types';

ComponentRegistry.register('text', 
  ({ schema, ...props }: { schema: TextSchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...rest 
    } = props;

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
    namespace: 'ui',
    label: 'Text',
  }
);
