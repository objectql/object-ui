/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from '../types';

interface PageComponent {
  type: string;
  id?: string;
  label?: string;
  properties?: Record<string, any>;
  events?: Record<string, any>;
  style?: Record<string, any>;
  className?: string;
  visibility?: string;
  dataSource?: any;
  responsive?: any;
  aria?: Record<string, string>;
}

interface PageRegion {
  name?: string;
  width?: string;
  components?: PageComponent[];
}

interface PageVariable {
  name: string;
  type?: string;
  defaultValue?: any;
  source?: string;
}

interface BlankPageLayoutItem {
  componentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageSpec {
  name?: string;
  label?: string;
  description?: string;
  icon?: string;
  type?: string;
  variables?: PageVariable[];
  regions?: PageRegion[];
  template?: string;
  object?: string;
  // P1.4 additions
  blankLayout?: {
    columns?: number;
    rowHeight?: number;
    gap?: number;
    items?: BlankPageLayoutItem[];
  };
  recordReview?: any;
  isDefault?: boolean;
  assignedProfiles?: string[];
  interfaceConfig?: any;
  aria?: { ariaLabel?: string; ariaDescribedBy?: string; role?: string };
}

function mapComponent(component: PageComponent): SchemaNode {
  const node: SchemaNode = {
    type: component.type,
    id: component.id,
  };

  if (component.label) node.label = component.label;
  if (component.className) node.className = component.className;
  if (component.properties) {
    Object.assign(node, component.properties);
  }
  if (component.events) node.events = component.events;
  if (component.visibility) node.visibility = component.visibility;
  if (component.dataSource) node.dataSource = component.dataSource;
  if (component.responsive) node.responsive = component.responsive;
  if (component.aria) node.aria = component.aria;

  return node;
}

function mapRegion(region: PageRegion): SchemaNode {
  const children = (region.components ?? []).map(mapComponent);
  const node: SchemaNode = {
    type: 'page-region',
    id: region.name,
    body: children,
  };
  if (region.width) node.width = region.width;
  return node;
}

/** Transforms a Page spec into a page layout SchemaNode */
export const bridgePage: BridgeFn<PageSpec> = (
  spec: PageSpec,
  _context: BridgeContext,
): SchemaNode => {
  const regions = (spec.regions ?? []).map(mapRegion);

  const node: SchemaNode = {
    type: 'page',
    id: spec.name,
    body: regions,
  };

  if (spec.label) node.label = spec.label;
  if (spec.description) node.description = spec.description;
  if (spec.icon) node.icon = spec.icon;
  if (spec.type) node.pageType = spec.type;
  if (spec.variables) node.variables = spec.variables;
  if (spec.template) node.template = spec.template;
  if (spec.object) node.object = spec.object;

  // P1.4 — Blank page layout
  if (spec.blankLayout) node.blankLayout = spec.blankLayout;

  // P1.4 — Additional page properties
  if (spec.recordReview) node.recordReview = spec.recordReview;
  if (spec.isDefault != null) node.isDefault = spec.isDefault;
  if (spec.assignedProfiles) node.assignedProfiles = spec.assignedProfiles;
  if (spec.interfaceConfig) node.interfaceConfig = spec.interfaceConfig;

  // P1.6 — i18n & ARIA
  if (spec.aria) node.aria = spec.aria;

  return node;
};
