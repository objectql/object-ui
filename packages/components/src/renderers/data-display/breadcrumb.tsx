/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { BreadcrumbSchema } from '@object-ui/types';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../../ui/breadcrumb';
import { renderChildren } from '../../lib/utils';
import { resolveKeyedI18nLabel } from '@object-ui/react';

ComponentRegistry.register('breadcrumb', 
  ({ schema, ...props }: { schema: BreadcrumbSchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...breadcrumbProps
    } = props;
    
    return (
      <Breadcrumb 
        className={schema.className} 
        {...breadcrumbProps}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        <BreadcrumbList>
          {schema.items?.map((item, idx) => (
            <div key={idx} className="flex items-center">
              <BreadcrumbItem>
                {idx === (schema.items?.length || 0) - 1 ? (
                  <BreadcrumbPage>{resolveKeyedI18nLabel(item.label) ?? ''}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>{resolveKeyedI18nLabel(item.label) ?? ''}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {idx < (schema.items?.length || 0) - 1 && <BreadcrumbSeparator />}
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  },
  {
    namespace: 'ui',
    label: 'Breadcrumb',
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Product' }
      ]
    }
  }
);
