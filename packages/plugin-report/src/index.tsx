/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { ReportRenderer } from './ReportRenderer';
import { LegacyReportRenderer } from './LegacyReportRenderer';
import { ReportViewer } from './ReportViewer';
import { DatasetReportRenderer, isDatasetReport } from './DatasetReportRenderer';

export { ReportRenderer, LegacyReportRenderer, ReportViewer, DatasetReportRenderer, isDatasetReport };
export type { ReportRendererProps, ReportRendererSchema } from './ReportRenderer';
export type { LegacyReportRendererProps } from './LegacyReportRenderer';
export type { DatasetReportRendererProps, DatasetDrillArgs } from './DatasetReportRenderer';
export { formatValue } from './formatValue';
export { exportReport, exportAsCSV, exportAsJSON, exportAsHTML, exportAsPDF, exportAsExcel } from './ReportExportEngine';
export {
  exportWithLiveData,
  exportExcelWithFormulas,
  createScheduleTrigger,
} from './LiveReportExporter';
export type {
  LiveExportOptions,
  LiveExportResult,
  ExcelColumnConfig,
  ScheduleTriggerCallback,
} from './LiveReportExporter';

// `mergeFilters` — the scope-filter combinator shared by the dataset report
// path. The pre-9.0 client-side aggregation pipeline (`useReportData` + its
// `buildAggregateQuery`/`groupAndAggregate`/`pivotRows`/… helpers) was removed
// with ADR-0021: dataset-bound reports aggregate in the semantic layer via
// `queryDataset`, so the client-side path had no remaining consumers.
export { mergeFilters } from './mergeFilters';

// NAMESPACE — `plugin-report`, the spelling this package's consumers declare
// (objectui#6416).
//
// These three registrations used to name namespace `report`, while
// `apps/console/src/register-plugins.ts` declared the lazy stubs for the same
// three short names under `plugin-report` and
// `packages/cli/src/utils/known-schema-types.ts` shipped the `plugin-report:*`
// spellings as renderable. Two things followed from the disagreement:
//
//   * `plugin-report:report` / `:report-viewer` / `:spec-report` could never be
//     satisfied. `register()` clears the lazy stub for the type IT registers,
//     and that type was `report:report`, so the `plugin-report:*` stubs were
//     never cleared and no component was ever stored under them —
//     `get('report', 'plugin-report')` stayed undefined and
//     `hasLazy('report', 'plugin-report')` stayed true forever.
//   * The bare `report` key was claimed twice under two different namespaces
//     (`Registry.register` and `registerLazy` share the `meta?.namespace &&
//     !meta?.skipFallback` branch), so what bare `report` DECLARED depended on
//     whether the chunk had loaded yet — the objectui#6353 shape.
//
// Direction chosen by measurement, not by preference: nothing in this repo or
// the sibling `objectstack` checkout authors a `report:*` spelling (0 hits),
// while the bare spellings are authored in 48 places, so the `report:*` keys
// are retired rather than the consumer-facing ones. Every sibling plugin
// already namespaces by package name.
//
// The bare keys stay claimed here ON PURPOSE and must NOT take `skipFallback`:
// after this change both claimants of each bare key — the console's lazy stub
// and the registration below — name the SAME full type, which is the shape all
// 27 other console-stub/plugin pairs in this repo have. Suppressing either
// claim would strand bare `report`, the only spelling anything authors.
// Pinned by `./__tests__/report-bare-key-ownership.test.ts` and
// `scripts/__tests__/report-namespace-agreement-6416.test.ts`.

// Register report component (dispatches dataset-bound vs legacy automatically)
ComponentRegistry.register(
  'report',
  ReportRenderer,
  {
    namespace: 'plugin-report',
    label: 'Report',
    category: 'Report',
    inputs: [
        { name: 'title', type: 'string', label: 'Title' },
        { name: 'description', type: 'string', label: 'Description' },
        { name: 'chart', type: 'code', label: 'Chart Configuration' },
    ]
  }
);

// Spec-native alias — same dispatcher, explicit name for spec-driven hosts.
ComponentRegistry.register(
  'spec-report',
  ReportRenderer,
  {
    namespace: 'plugin-report',
    label: 'Spec Report',
    category: 'Report',
    inputs: [
        { name: 'dataset', type: 'string', label: 'Dataset' },
        { name: 'type', type: 'string', label: 'Report Type' },
    ]
  }
);

// Register report viewer component
ComponentRegistry.register(
  'report-viewer',
  ReportViewer,
  {
    namespace: 'plugin-report',
    label: 'Report Viewer',
    category: 'Report',
    inputs: [
        { name: 'report', type: 'code', label: 'Report Definition' },
        { name: 'showToolbar', type: 'boolean', label: 'Show Toolbar' }
    ]
  }
);
