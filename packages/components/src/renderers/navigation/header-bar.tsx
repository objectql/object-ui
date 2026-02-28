/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { HeaderBarSchema, BreadcrumbItem as BreadcrumbItemType } from '@object-ui/types';
import { resolveI18nLabel, SchemaRenderer } from '@object-ui/react';
import {
  SidebarTrigger,
  Separator,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Input,
} from '../../ui';
import { ChevronDown, Search } from 'lucide-react';

function BreadcrumbLabel({ crumb, isLast }: { crumb: BreadcrumbItemType; isLast: boolean }) {
  const label = resolveI18nLabel(crumb.label) ?? '';

  if (crumb.siblings && crumb.siblings.length > 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1">
          {isLast ? (
            <span className="font-semibold">{label}</span>
          ) : (
            <span>{label}</span>
          )}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {crumb.siblings.map((sibling, i) => (
            <DropdownMenuItem key={i} asChild>
              <a href={sibling.href}>{sibling.label}</a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (isLast) {
    return <BreadcrumbPage>{label}</BreadcrumbPage>;
  }
  return <BreadcrumbLink href={crumb.href || '#'}>{label}</BreadcrumbLink>;
}

ComponentRegistry.register('header-bar', 
  ({ schema }: { schema: HeaderBarSchema }) => (
    <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {schema.crumbs?.map((crumb: BreadcrumbItemType, idx: number) => (
            <React.Fragment key={idx}>
              <BreadcrumbItem>
                <BreadcrumbLabel crumb={crumb} isLast={idx === schema.crumbs!.length - 1} />
              </BreadcrumbItem>
              {idx < schema.crumbs!.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {schema.search?.enabled && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={schema.search.placeholder}
              className="pl-8 w-[200px] lg:w-[300px]"
            />
            {schema.search.shortcut && (
              <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                {schema.search.shortcut}
              </kbd>
            )}
          </div>
        )}
        {schema.actions?.map((action, idx) => (
          <SchemaRenderer key={idx} schema={action} />
        ))}
        {schema.rightContent && <SchemaRenderer schema={schema.rightContent} />}
      </div>
    </header>
  ),
  {
    namespace: 'ui',
    label: 'Header Bar',
    inputs: [
       { name: 'crumbs', type: 'array', label: 'Breadcrumbs' },
       { name: 'search', type: 'object', label: 'Search Configuration' },
       { name: 'actions', type: 'array', label: 'Action Slots' },
       { name: 'rightContent', type: 'object', label: 'Right Content' },
    ],
    defaultProps: {
      crumbs: [
        { label: 'Home', href: '#' },
        { label: 'Current Page' }
      ]
    }
  }
);
