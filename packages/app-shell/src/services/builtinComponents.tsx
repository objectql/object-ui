// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in component registrations — Phase 3b + 3c.
 *
 * Side-effect module imported by `index.ts` to ensure the platform's
 * own admin UI is registered with the ComponentRegistry before
 * AppContent mounts the first `<Route path="component/...">`.
 *
 * Registers the generic metadata admin engine and a specialised
 * permission-matrix editor for `permission`. The previous View /
 * Dashboard / Page bespoke "designer" tabs were removed: they never
 * produced usable output and confused authors. Those types now use the
 * same JSONSchema-driven Form + Preview experience as every other
 * metadata type.
 */

import { registerAppComponent } from './componentRegistry';
import {
  MetadataDirectoryPage,
  MetadataResourceRouter,
  registerMetadataResource,
} from '../views/metadata-admin';
import { PermissionMatrixEditPage } from '../views/metadata-admin/PermissionMatrixEditor';
import { PackagesPage } from '../views/metadata-admin/PackagesPage';
import {
  isAggregatedViewContainer,
  viewDisplayType,
} from '../views/metadata-admin/view-item-normalize';

/* -------------------------------------------------------------------------- */
/* 1) Top-level admin pages — bound to `metadata:directory` + `metadata:resource` */
/* -------------------------------------------------------------------------- */

registerAppComponent({
  ref: 'metadata:directory',
  label: 'All Metadata Types',
  source: '@object-ui/app-shell',
  component: MetadataDirectoryPage,
});

registerAppComponent({
  ref: 'metadata:resource',
  label: 'Metadata Resource',
  source: '@object-ui/app-shell',
  component: MetadataResourceRouter,
});

registerAppComponent({
  ref: 'developer:packages',
  label: 'Packages',
  source: '@object-ui/app-shell',
  component: PackagesPage,
});

/* -------------------------------------------------------------------------- */
/* 2) Generic resources — list + JSONSchema-driven form for every type.       */
/* -------------------------------------------------------------------------- */

registerMetadataResource({
  type: 'object',
  label: 'Objects',
  description: 'Domain entities — tables in the data model. Each object owns its fields, relationships, validations, and lifecycle hooks.',
  domain: 'data',
  searchableFields: ['name', 'label', 'description'],
  listColumns: [
    { key: 'name', label: 'Name', width: '25%' },
    { key: 'label', label: 'Label', width: '25%' },
    { key: 'description', label: 'Description' },
  ],
});

registerMetadataResource({
  type: 'field',
  label: 'Fields',
  description: 'Columns attached to objects — name, type, validation, and storage settings.',
  domain: 'data',
  searchableFields: ['name', 'label', 'object', 'type'],
  listColumns: [
    { key: 'name', label: 'Name', width: '25%' },
    { key: 'object', label: 'Object', width: '20%' },
    { key: 'type', label: 'Type', width: '15%' },
    { key: 'label', label: 'Label' },
  ],
});

/* -------------------------------------------------------------------------- */
/* 3) Permission matrix editor — replaces the generic AutoForm for           */
/*    `type=permission` with a Salesforce-style grid (Phase 3e).             */
/* -------------------------------------------------------------------------- */

registerMetadataResource({
  type: 'permission',
  label: 'Permission sets',
  description: 'Object-level CRUD + VAMA + lifecycle permissions, and field-level R/W. The only capability container (ADR-0090); distributed to users via positions.',
  domain: 'security',
  EditPage: PermissionMatrixEditPage,
  searchableFields: ['name', 'label'],
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    {
      key: 'managedBy',
      label: 'Source',
      width: '15%',
      render: (v) => (v === 'package' ? 'Package' : 'Custom'),
    },
  ],
});

/* -------------------------------------------------------------------------- */
/* 4) UI metadata types — list + form. No bespoke visual designers: views,   */
/*    dashboards and pages are authored as JSON metadata; the Preview tab    */
/*    renders them live for verification.                                    */
/* -------------------------------------------------------------------------- */

registerMetadataResource({
  type: 'view',
  label: 'Views',
  description: 'Saved list / kanban / calendar / gantt configurations on top of an object.',
  domain: 'ui',
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'object', label: 'Object', width: '20%' },
    {
      key: 'type',
      label: 'Type',
      width: '15%',
      // Expanded ViewItems keep their display type under `config.type`
      // and only the list/form family at the top level — derive it so the
      // column shows "calendar" / "grid" / "form" instead of "—".
      render: (_v, item) => viewDisplayType(item) ?? '—',
    },
    { key: 'label', label: 'Label' },
  ],
  // ADR-0017 — the framework exposes each view as a canonical first-class
  // ViewItem ({ name, object, viewKind, label, config }). The inspector and
  // preview read that shape directly (`draft.config`), so NO toDraft/fromDraft
  // adapter is wired here — the canonical shape round-trips untouched.
  // Hide the bare aggregated container the framework keeps for runtime
  // dual-read — its views are already listed as expanded ViewItems.
  listFilter: (item) => !isAggregatedViewContainer(item),
});

registerMetadataResource({
  type: 'dashboard',
  label: 'Dashboards',
  description: 'Composed dashboards with charts, KPIs, and tables.',
  domain: 'ui',
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'description', label: 'Description' },
  ],
});

registerMetadataResource({
  type: 'page',
  label: 'Pages',
  description: 'Visual page layouts authored as JSON metadata.',
  domain: 'ui',
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'route', label: 'Route' },
  ],
});

/* -------------------------------------------------------------------------- */
/* 5) Documentation — the `book` navigation spine (ADR-0046 §6). A book is an  */
/*    ordered set of groups whose membership over docs is DERIVED from each    */
/*    group's include rule; the Preview tab renders that spine for authoring.  */
/* -------------------------------------------------------------------------- */

registerMetadataResource({
  type: 'book',
  label: 'Documentation Books',
  description: 'Documentation navigation spine — ordered groups with membership derived over docs (glob/tag rules), plus an explicit pages override for curated order.',
  domain: 'system',
  searchableFields: ['name', 'label', 'description', 'slug'],
  listColumns: [
    { key: 'name', label: 'Name', width: '25%' },
    { key: 'label', label: 'Label', width: '25%' },
    {
      key: 'audience',
      label: 'Audience',
      width: '12%',
      render: (v) =>
        v == null
          ? 'org'
          : typeof v === 'object' && v && 'permissionSet' in (v as Record<string, unknown>)
            ? `permission set: ${(v as { permissionSet: string }).permissionSet}`
            : String(v),
    },
    {
      key: 'groups',
      label: 'Groups',
      width: '10%',
      render: (v) => (Array.isArray(v) ? String(v.length) : '0'),
    },
    { key: 'description', label: 'Description' },
  ],
});
