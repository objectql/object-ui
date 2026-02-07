/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { LayoutTemplateSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { forwardRef } from 'react';

// ─── Arrangement layouts ─────────────────────────────────────────────────────
// Each arrangement defines CSS grid classes and which slots map to which areas.

interface ArrangementDef {
  containerClass: string;
  slotAreaMap: Record<string, string>;
}

const ARRANGEMENTS: Record<string, ArrangementDef> = {
  'header-main': {
    containerClass: 'grid grid-cols-1 grid-rows-[auto_1fr] min-h-screen',
    slotAreaMap: {
      header: '[grid-area:header]',
      main: '[grid-area:main]',
    },
  },
  'header-sidebar-main': {
    containerClass: 'grid grid-cols-1 md:grid-cols-[250px_1fr] grid-rows-[auto_1fr] min-h-screen',
    slotAreaMap: {
      header: 'col-span-full',
      sidebar: '',
      main: '',
    },
  },
  'sidebar-main': {
    containerClass: 'grid grid-cols-1 md:grid-cols-[250px_1fr] min-h-screen',
    slotAreaMap: {
      sidebar: '',
      main: '',
    },
  },
  'sidebar-main-aside': {
    containerClass: 'grid grid-cols-1 md:grid-cols-[200px_1fr_200px] min-h-screen',
    slotAreaMap: {
      sidebar: '',
      main: '',
      aside: '',
    },
  },
  full: {
    containerClass: 'min-h-screen',
    slotAreaMap: {
      main: 'w-full',
    },
  },
};

// Slot ordering per arrangement (controls render order)
const SLOT_ORDER: Record<string, string[]> = {
  'header-main': ['header', 'main'],
  'header-sidebar-main': ['header', 'sidebar', 'main'],
  'sidebar-main': ['sidebar', 'main'],
  'sidebar-main-aside': ['sidebar', 'main', 'aside'],
  full: ['main'],
};

// ─── Renderer ────────────────────────────────────────────────────────────────

const LayoutTemplateRenderer = forwardRef<
  HTMLDivElement,
  { schema: LayoutTemplateSchema; className?: string; [key: string]: any }
>(({ schema, className, ...props }, ref) => {
  const arrangement = schema.arrangement || 'header-main';
  const arrangementDef = ARRANGEMENTS[arrangement];
  const slotOrder = SLOT_ORDER[arrangement] || Object.keys(schema.slots);

  // For custom arrangement, use gridTemplate if provided
  const isCustom = arrangement === 'custom';
  const customStyle: React.CSSProperties = isCustom && schema.gridTemplate
    ? { display: 'grid', gridTemplate: schema.gridTemplate, minHeight: '100vh' }
    : {};

  const containerClass = cn(
    isCustom ? '' : arrangementDef?.containerClass || '',
    className,
  );

  const { 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style, ...rest } = props;

  return (
    <div
      ref={ref}
      className={containerClass}
      style={isCustom ? { ...customStyle, ...style } : style}
      {...rest}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
    >
      {slotOrder.map((slotName) => {
        const content = schema.slots[slotName];
        if (!content || content.length === 0) return null;
        const areaClass = arrangementDef?.slotAreaMap[slotName] || '';
        return (
          <div key={slotName} className={cn(areaClass)} data-slot={slotName}>
            {renderChildren(content)}
          </div>
        );
      })}
    </div>
  );
});

LayoutTemplateRenderer.displayName = 'LayoutTemplateRenderer';

// ─── Register ────────────────────────────────────────────────────────────────

ComponentRegistry.register('layout-template', LayoutTemplateRenderer, {
  namespace: 'ui',
  label: 'Layout Template',
  category: 'Layout',
  isContainer: true,
  inputs: [
    {
      name: 'name',
      type: 'string',
      label: 'Template Name',
      description: 'Unique template identifier',
    },
    {
      name: 'arrangement',
      type: 'string',
      label: 'Arrangement',
      defaultValue: 'header-main',
      description: 'Layout arrangement pattern',
    },
    {
      name: 'gridTemplate',
      type: 'string',
      label: 'Custom Grid Template',
      description: 'CSS grid-template value (only for custom arrangement)',
    },
    { name: 'className', type: 'string', label: 'CSS Class' },
  ],
  defaultProps: {
    name: 'default-template',
    arrangement: 'header-sidebar-main',
    slots: {
      header: [{ type: 'text', value: 'Header', variant: 'h3' }],
      sidebar: [{ type: 'text', value: 'Sidebar', variant: 'body' }],
      main: [{ type: 'text', value: 'Main Content', variant: 'body' }],
    },
  },
});
