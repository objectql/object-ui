/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { ReportRenderer } from './ReportRenderer';
import { ReportViewer } from './ReportViewer';
import { ReportBuilder } from './ReportBuilder';

export { ReportRenderer, ReportViewer, ReportBuilder };
export { exportReport, exportAsCSV, exportAsJSON, exportAsHTML, exportAsPDF, exportAsExcel } from './ReportExportEngine';
export { ScheduleConfig } from './ScheduleConfig';

// Register report component
ComponentRegistry.register(
  'report',
  ReportRenderer,
  {
    label: 'Report',
    category: 'Report',
    inputs: [
        { name: 'title', type: 'string', label: 'Title' },
        { name: 'description', type: 'string', label: 'Description' },
        { name: 'chart', type: 'code', label: 'Chart Configuration' },
    ]
  }
);

// Register report viewer component
ComponentRegistry.register(
  'report-viewer',
  ReportViewer,
  {
    label: 'Report Viewer',
    category: 'Report',
    inputs: [
        { name: 'report', type: 'code', label: 'Report Definition' },
        { name: 'showToolbar', type: 'boolean', label: 'Show Toolbar' }
    ]
  }
);

// Register report builder component
ComponentRegistry.register(
  'report-builder',
  ReportBuilder,
  {
    label: 'Report Builder',
    category: 'Report',
    inputs: [
        { name: 'report', type: 'code', label: 'Initial Report' },
    ]
  }
);
