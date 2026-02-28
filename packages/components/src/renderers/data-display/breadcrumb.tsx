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

/** Resolve a label that may be a plain string or an I18nLabel object */
function resolveItemLabel(label: string | { key?: string; defaultValue?: string } | undefined): string {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label.defaultValue || label.key || '';
}

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
                  <BreadcrumbPage>{resolveItemLabel(item.label)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>{resolveItemLabel(item.label)}</BreadcrumbLink>
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
