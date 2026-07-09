// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Preview-tab registrations.
 *
 * Each registration is one line; new types are trivially added without
 * touching `ResourceEditPage.tsx`. To opt OUT of a built-in preview in
 * a downstream app, call `registerMetadataPreview(type, MyVersion)`
 * after this module runs — `registerMetadataPreview` is last-write-wins.
 */

import { registerMetadataPreview } from '../preview-registry';
import { PagePreview } from './PagePreview';
import { ViewPreview } from './ViewPreview';
import { DashboardPreview } from './DashboardPreview';
import { ReportPreview } from './ReportPreview';
import { AppPreview } from './AppPreview';
import { ObjectPreview } from './ObjectPreview';
import { EmailTemplatePreview } from './EmailTemplatePreview';
import { FlowPreview } from './FlowPreview';
import { AgentPreview } from './AgentPreview';
import { ToolPreview } from './ToolPreview';
import { PermissionPreview } from './PermissionPreview';
import { ActionPreview } from './ActionPreview';
import { JobPreview } from './JobPreview';
import { TranslationPreview } from './TranslationPreview';
import { RolePreview } from './RolePreview';
import { SkillPreview } from './SkillPreview';
import { DatasourcePreview } from './DatasourcePreview';
import { ValidationPreview } from './ValidationPreview';
import { DatasetPreview } from './DatasetPreview';
import { BookPreview } from './BookPreview';

export function registerBuiltinPreviews(): void {
  // UI surfaces
  registerMetadataPreview('page', PagePreview);
  registerMetadataPreview('view', ViewPreview);
  registerMetadataPreview('dashboard', DashboardPreview);
  registerMetadataPreview('report', ReportPreview);
  registerMetadataPreview('app', AppPreview);
  registerMetadataPreview('action', ActionPreview);
  // Data
  registerMetadataPreview('object', ObjectPreview);
  registerMetadataPreview('datasource', DatasourcePreview);
  registerMetadataPreview('validation', ValidationPreview);
  // Analytics (ADR-0021): live cross-object dataset preview.
  registerMetadataPreview('dataset', DatasetPreview);
  // System
  registerMetadataPreview('email_template', EmailTemplatePreview);
  registerMetadataPreview('translation', TranslationPreview);
  // Documentation navigation spine (ADR-0046 §6): ordered groups with
  // derived membership over docs.
  registerMetadataPreview('book', BookPreview);
  // Automation
  // Approval is a flow node (`type: 'approval'`) since ADR-0019 — it renders on
  // the Flow canvas with its `approve` / `reject` branches; no standalone
  // approval-process preview.
  registerMetadataPreview('flow', FlowPreview);
  // ADR-0020: `workflow` retired as a metadata type — record state machines
  // are now a `state_machine` validation rule (rendered by ValidationPreview)
  // and side-effecting automation is a Flow. No standalone workflow preview.
  registerMetadataPreview('job', JobPreview);
  // AI
  registerMetadataPreview('agent', AgentPreview);
  registerMetadataPreview('tool', ToolPreview);
  registerMetadataPreview('skill', SkillPreview);
  // Security & Identity
  // ADR-0090 D2 removed the Profile concept; the `profile` registration stays
  // only so metadata from pre-v2 backends still renders (inert otherwise).
  registerMetadataPreview('permission', PermissionPreview);
  registerMetadataPreview('profile', PermissionPreview);
  registerMetadataPreview('role', RolePreview);
}
