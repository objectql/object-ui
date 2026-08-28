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
// `BreadcrumbItem.icon` is an authored lucide NAME that this renderer never
// read — the catalog fixture literally named `with-icons.json` drew no icons
// at all (objectui#5931).
//
// Routed through the RECORD surface (`icons` from 'lucide-react', reached via
// the shared `resolveIcon`), which is what `ui:button`, `action:*`,
// `ui:dropdown-menu` and `ui:context-menu` resolve against, so an unknown or
// RETIRED spelling renders NOTHING. The dynamic surface (`LazyIcon`) is
// deliberately NOT used: it degrades an unknown name to the `Database` glyph,
// trading a no-icon failure for a WRONG-icon one, recorded as ruled out for
// authored icon fields by objectui#5622 and #5633.
import { resolveIcon } from '../action/resolve-icon';

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
          {schema.items?.map((item, idx) => {
            const isLast = idx === (schema.items?.length || 0) - 1;
            // Resolved ONCE per item and rendered ABOVE the page/link split, so
            // BOTH arms carry it by construction. Repairing only the leaf arm
            // would be "a narrower version of the same bug" (objectui#5930) —
            // here the last crumb is a `BreadcrumbPage` and every earlier one a
            // `BreadcrumbLink`, and the fixture exercises both.
            const Icon = resolveIcon(item.icon);
            return (
              <div key={idx} className="flex items-center">
                <BreadcrumbItem>
                  {Icon && <Icon className="h-4 w-4" />}
                  {isLast ? (
                    <BreadcrumbPage>{resolveKeyedI18nLabel(item.label) ?? ''}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={item.href}>{resolveKeyedI18nLabel(item.label) ?? ''}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </div>
            );
          })}
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
