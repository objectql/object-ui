// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Registers built-in metadata inspectors. Mirrors `previews/index.ts`.
 * Imported as a side effect from `metadata-admin/index.ts`.
 */

import { registerMetadataInspector } from '../inspector-registry';
import { registerMetadataDefaultInspector } from '../default-inspector-registry';
import { DashboardWidgetInspector } from './DashboardWidgetInspector';
import { FlowInspector } from './FlowInspector';
import { AppNavInspector } from './AppNavInspector';
import { ViewInspector, ViewDefaultInspector } from './ViewInspector';
import { PageBlockInspector } from './PageBlockInspector';
import { ReportColumnInspector } from './ReportColumnInspector';
import { ObjectFieldInspector } from './ObjectFieldInspector';
import { ObjectDefaultInspector } from './ObjectDefaultInspector';

export function registerBuiltinInspectors(): void {
  registerMetadataInspector('dashboard', DashboardWidgetInspector);
  // Approval is authored as a flow node (`type: 'approval'`) since ADR-0019 —
  // edited through FlowInspector, not a standalone step inspector. FlowInspector
  // routes node vs. edge selections to the right scoped editor.
  registerMetadataInspector('flow', FlowInspector);
  // ADR-0020: `workflow` retired as a metadata type — no workflow-action
  // inspector. State machines live on the object as a `state_machine`
  // validation rule.
  registerMetadataInspector('app', AppNavInspector);
  registerMetadataInspector('view', ViewInspector);
  registerMetadataDefaultInspector('view', ViewDefaultInspector);
  registerMetadataInspector('page', PageBlockInspector);
  registerMetadataInspector('report', ReportColumnInspector);
  registerMetadataInspector('object', ObjectFieldInspector);
  registerMetadataDefaultInspector('object', ObjectDefaultInspector);
}
