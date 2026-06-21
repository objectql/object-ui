// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Public surface for the metadata-admin engine (Phase 3c).
 *
 * Pages are registered with the ComponentRegistry in
 * `../../services/builtinComponents.ts`; consumers (and plugins) can
 * still import directly to compose custom shells.
 *
 * The Registry export lets plugin authors opt their bespoke editors
 * into the generic shell:
 *
 *   import { registerMetadataResource } from '@object-ui/app-shell';
 *   registerMetadataResource({ type: 'view', EditPage: MyViewEditor });
 */

export { MetadataDirectoryPage } from './DirectoryPage';
export { PackagesPage } from './PackagesPage';
export { StudioHomePage } from './StudioHomePage';
export { MetadataResourceRouter } from './ResourceRouter';
export { MetadataResourceListPage } from './ResourceListPage';
export { MetadataResourceEditPage } from './ResourceEditPage';
export { RelatedPanel } from './RelatedPanel';
export { MetadataDetailDrawer } from './MetadataDetailDrawer';
export { MetadataResourceHistoryPage } from './ResourceHistoryPage';
export { MetadataDiagnosticsPage } from './DiagnosticsPage';
export { MetadataQuickFind } from './QuickFind';
export { PageShell as MetadataPageShell } from './PageShell';
export { SchemaForm } from './SchemaForm';
export { LayeredDiff } from './LayeredDiff';
export { PermissionMatrixEditPage } from './PermissionMatrixEditor';
export {
  translateMetadataType,
  translateMetadataDomain,
  t as translateMetadataAdmin,
  detectLocale,
} from './i18n';
export type { SupportedLocale } from './i18n';

export {
  registerMetadataResource,
  getMetadataResource,
  listMetadataResources,
  listAnchorsFor,
  resolveResourceConfig,
  anchorByField,
} from './registry';
export type {
  MetadataResourceConfig,
  MetadataDomain,
  MetadataAnchor,
} from './registry';

// Side-effect: register the built-in anchor relationships so the Related
// tab works out of the box for objects (hooks, views, pages, …).
import { registerBuiltinAnchors } from './anchors';
registerBuiltinAnchors();

// Side-effect: register fallback JSONSchemas for the 12 writable types
// so the generic SchemaForm renders a real form (vs raw-JSON fallback)
// until the framework wires Zod→JSONSchema generation into /meta/types.
import { registerDefaultMetadataSchemas } from './default-schemas';
registerDefaultMetadataSchemas();
import { registerDatasourceResource } from './datasource/register';
registerDatasourceResource();

// Side-effect: register built-in Preview-tab renderers (page, view,
// dashboard, report, app, object, email_template). Plugins can add or
// override entries via `registerMetadataPreview()`.
import { registerBuiltinPreviews } from './previews';
registerBuiltinPreviews();

// Side-effect: register built-in scoped inspectors (dashboard widget,
// …). Plugins can add or override entries via
// `registerMetadataInspector()`.
import { registerBuiltinInspectors } from './inspectors';
registerBuiltinInspectors();

export {
  registerMetadataPreview,
  getMetadataPreview,
  listMetadataPreviewTypes,
} from './preview-registry';
export type {
  MetadataPreview,
  MetadataPreviewProps,
  MetadataSelection,
} from './preview-registry';

export {
  registerMetadataInspector,
  getMetadataInspector,
  listMetadataInspectorTypes,
} from './inspector-registry';
export type {
  MetadataInspector,
  MetadataInspectorProps,
} from './inspector-registry';

export {
  useMetadataClient,
  useMetadataTypes,
  useTypesIndex,
  useGlobalDiagnostics,
  matchesQuery,
} from './useMetadata';
export type {
  RichMetadataTypeEntry,
  MetadataDiagnosticsEntry,
  MetadataDiagnosticsSummary,
} from './useMetadata';
