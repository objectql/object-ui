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
import { resolveKeyedI18nLabel, SchemaRenderer, toRenderableSchema } from '@object-ui/react';
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
// `crumbs` is typed `BreadcrumbItem[]` — the SAME declaration `ui:breadcrumb`'s
// `items` uses — and `BreadcrumbItem.icon` is not merely declared but DESCRIBED
// in the zod mirror (`icon: z.string().optional().describe('Breadcrumb icon')`),
// so an authoring surface that reads `describe` can already offer the key. This
// renderer read `label`, `siblings` and `href` and nothing else, so after
// objectui#5931 repaired the breadcrumb side one declared key behaved
// DIFFERENTLY on its two consumers — a glyph there, nothing here (objectui#6645).
//
// ⛔ Through the SHARED `resolveIcon`, never a local normaliser. objectui#5993
// is the lesson: a local copy is the same algorithm under a different function,
// and the alias later added there to absorb a lucide retirement reached every
// `action:*` site EXCEPT `ui:button`. Routing here means the RECORD surface —
// an unknown or RETIRED spelling renders NOTHING, never `LazyIcon`'s `Database`
// fallback (ruled out for authored icon fields by objectui#5622 / #5633).
import { resolveIcon } from '../action/resolve-icon';

function BreadcrumbLabel({ crumb, isLast }: { crumb: BreadcrumbItemType; isLast: boolean }) {
  const label = resolveKeyedI18nLabel(crumb.label) ?? '';

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
          {schema.crumbs?.map((crumb: BreadcrumbItemType, idx: number) => {
            // Resolved ONCE per crumb and rendered ABOVE `BreadcrumbLabel`, so
            // all THREE of its arms — the siblings dropdown, the last crumb's
            // `BreadcrumbPage` and every earlier `BreadcrumbLink` — carry the
            // glyph by construction. Repairing inside that helper would have had
            // to touch each arm, and missing one is "a narrower version of the
            // same bug" (objectui#5930). Resolved HERE rather than in a
            // `CrumbIcon` helper for the same reason `breadcrumb.tsx` resolves
            // inline: a component value produced during render and rendered from
            // a nested component is what `react-hooks/static-components`
            // refuses, and this is the shape the sibling renderer already uses.
            const Icon = resolveIcon(crumb.icon);
            return (
              <React.Fragment key={idx}>
                <BreadcrumbItem>
                  {Icon && <Icon className="h-4 w-4" />}
                  <BreadcrumbLabel crumb={crumb} isLast={idx === schema.crumbs!.length - 1} />
                </BreadcrumbItem>
                {idx < schema.crumbs!.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })}
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
          <SchemaRenderer key={idx} schema={toRenderableSchema(action)} />
        ))}
        {schema.rightContent && <SchemaRenderer schema={toRenderableSchema(schema.rightContent)} />}
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
