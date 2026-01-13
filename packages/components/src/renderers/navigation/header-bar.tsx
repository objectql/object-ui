import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import {
  SidebarTrigger,
  Separator,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage
} from '@/ui';

ComponentRegistry.register('header-bar', 
  ({ schema }) => (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {schema.crumbs?.map((crumb: any, idx: number) => (
            <React.Fragment key={idx}>
              <BreadcrumbItem>
                {idx === schema.crumbs.length - 1 ? (
                   <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                   <BreadcrumbLink href={crumb.href || '#'}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {idx < schema.crumbs.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  ),
  {
    label: 'Header Bar',
    inputs: [
       { name: 'crumbs', type: 'array', label: 'Breadcrumbs' }
    ],
    defaultProps: {
      crumbs: [
        { label: 'Home', href: '#' },
        { label: 'Current Page' }
      ]
    }
  }
);
