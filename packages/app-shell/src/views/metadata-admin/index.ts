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

export { MetadataDirectoryPage } from './DirectoryPage.js';
export { PackagesPage } from './PackagesPage.js';
export { StudioHomePage } from './StudioHomePage.js';
export { MetadataResourceRouter } from './ResourceRouter.js';
export { MetadataResourceListPage } from './ResourceListPage.js';
export { MetadataResourceEditPage } from './ResourceEditPage.js';
export { RelatedPanel } from './RelatedPanel.js';
export { MetadataDetailDrawer } from './MetadataDetailDrawer.js';
export { MetadataResourceHistoryPage } from './ResourceHistoryPage.js';
export { MetadataDiagnosticsPage } from './DiagnosticsPage.js';
export { MetadataQuickFind } from './QuickFind.js';
export { PageShell as MetadataPageShell } from './PageShell.js';
export { SchemaForm } from './SchemaForm.js';
export { LayeredDiff } from './LayeredDiff.js';
export { PermissionMatrixEditPage } from './PermissionMatrixEditor.js';
export {
  translateMetadataType,
  translateMetadataDomain,
  t as translateMetadataAdmin,
  detectLocale,
} from './i18n.js';
export type { SupportedLocale } from './i18n.js';

export {
  registerMetadataResource,
  getMetadataResource,
  listMetadataResources,
  listAnchorsFor,
  resolveResourceConfig,
  anchorByField,
} from './registry.js';
export type {
  MetadataResourceConfig,
  MetadataDomain,
  MetadataAnchor,
} from './registry.js';

// Side-effect: register the built-in anchor relationships so the Related
// tab works out of the box for objects (hooks, views, pages, …).
import { registerBuiltinAnchors } from './anchors.js';
registerBuiltinAnchors();

// Side-effect: register fallback JSONSchemas for the 12 writable types
// so the generic SchemaForm renders a real form (vs raw-JSON fallback)
// until the framework wires Zod→JSONSchema generation into /meta/types.
import { registerDefaultMetadataSchemas } from './default-schemas.js';
registerDefaultMetadataSchemas();
import { registerDatasourceResource } from './datasource/register.js';
registerDatasourceResource();

// Side-effect: register built-in Preview-tab renderers (page, view,
// dashboard, report, app, object, email_template). Plugins can add or
// override entries via `registerMetadataPreview()`.
import { registerBuiltinPreviews } from './previews/index.js';
registerBuiltinPreviews();

// Side-effect: register built-in scoped inspectors (dashboard widget,
// …). Plugins can add or override entries via
// `registerMetadataInspector()`.
import { registerBuiltinInspectors } from './inspectors/index.js';
registerBuiltinInspectors();

export {
  registerMetadataPreview,
  getMetadataPreview,
  listMetadataPreviewTypes,
} from './preview-registry.js';
export type {
  MetadataPreview,
  MetadataPreviewProps,
  MetadataSelection,
} from './preview-registry.js';

export {
  registerMetadataInspector,
  getMetadataInspector,
  listMetadataInspectorTypes,
} from './inspector-registry.js';
export type {
  MetadataInspector,
  MetadataInspectorProps,
} from './inspector-registry.js';

export {
  useMetadataClient,
  useMetadataTypes,
  useTypesIndex,
  useGlobalDiagnostics,
  matchesQuery,
} from './useMetadata.js';
export type {
  RichMetadataTypeEntry,
  MetadataDiagnosticsEntry,
  MetadataDiagnosticsSummary,
} from './useMetadata.js';
