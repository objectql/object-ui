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
  responsiveStyles?: Record<string, any>;
  className?: string;
  /** Canonical conditional-visibility predicate (ADR-0089). */
  visibleWhen?: string;
  /** @deprecated ADR-0089 → `visibleWhen`. */
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
  // NOTE: blankLayout/recordReview removed — the `blank`/`record_review` page
  // types have no renderer and were dropped from @objectstack/spec (framework#2265).
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
  if (component.style) node.style = component.style;
  // ADR-0065 scoped per-breakpoint styles — declared on the page-spec
  // component (sibling of className/style) but previously dropped here
  // before reaching SchemaRenderer, so a layout override like
  // `{ large: { display: 'grid', gridTemplateColumns: '...' } }` never
  // compiled to CSS and the node fell back to its default layout.
  if (component.responsiveStyles) node.responsiveStyles = component.responsiveStyles;
  if (component.properties) {
    // Avoid overwriting the component dispatch keys (`type`/`id`) with inner
    // renderer-specific props. E.g. PageTabsProps.properties.type is the tab
    // visual style ('line'|'card'|'pill'), NOT the component type.
    for (const [k, v] of Object.entries(component.properties)) {
      if (k === 'type' || k === 'id') continue;
      (node as any)[k] = v;
    }
    // Preserve the original `properties` bag so renderers can still read
    // collision-prone keys via `schema.properties.<key>`.
    (node as any).properties = component.properties;
  }
  if (component.events) node.events = component.events;
  // ADR-0089: `visibleWhen` is the canonical conditional-visibility predicate;
  // the spec folds the deprecated `visibility` alias into it at parse, so prefer
  // it and fall back to `visibility` for raw / un-normalized metadata. SchemaRenderer
  // reads `visibleWhen` first (show-when-truthy).
  const visiblePredicate = component.visibleWhen ?? component.visibility;
  if (visiblePredicate) node.visibleWhen = visiblePredicate;
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

  // Additional page properties (blankLayout/recordReview dropped — their page
  // types have no renderer and were removed from @objectstack/spec, framework#2265)
  if (spec.isDefault != null) node.isDefault = spec.isDefault;
  if (spec.assignedProfiles) node.assignedProfiles = spec.assignedProfiles;
  if (spec.interfaceConfig) node.interfaceConfig = spec.interfaceConfig;

  // P1.6 — i18n & ARIA
  if (spec.aria) node.aria = spec.aria;

  return node;
};
