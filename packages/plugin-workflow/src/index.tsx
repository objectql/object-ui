/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { WorkflowDesigner } from './WorkflowDesigner';
import { ApprovalProcess } from './ApprovalProcess';
import { AutomationBuilder } from './AutomationBuilder';
import { AutomationRunHistory } from './AutomationRunHistory';

export { WorkflowDesigner, ApprovalProcess, AutomationBuilder, AutomationRunHistory };
export type { AutomationDefinition, AutomationBuilderProps, TriggerConfig, ActionConfig } from './AutomationBuilder';
export type { AutomationRun, AutomationRunHistoryProps } from './AutomationRunHistory';

// Register workflow designer component
ComponentRegistry.register(
  'workflow-designer',
  WorkflowDesigner,
  {
    label: 'Workflow Designer',
    category: 'Enterprise',
    inputs: [
      { name: 'workflow', type: 'code', label: 'Initial Workflow Definition' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
      { name: 'showToolbar', type: 'boolean', label: 'Show Toolbar', defaultValue: true },
      { name: 'showMinimap', type: 'boolean', label: 'Show Minimap', defaultValue: false },
    ]
  }
);

// Register approval process component
ComponentRegistry.register(
  'approval-process',
  ApprovalProcess,
  {
    label: 'Approval Process',
    category: 'Enterprise',
    inputs: [
      { name: 'workflowId', type: 'string', label: 'Workflow ID' },
      { name: 'instanceId', type: 'string', label: 'Instance ID' },
      { name: 'currentNodeId', type: 'string', label: 'Current Node ID' },
      { name: 'approvalRule', type: 'code', label: 'Approval Rule' },
      { name: 'history', type: 'code', label: 'History' },
      { name: 'showHistory', type: 'boolean', label: 'Show History', defaultValue: true },
      { name: 'showComments', type: 'boolean', label: 'Show Comments', defaultValue: true },
    ]
  }
);

// Register automation builder component
ComponentRegistry.register(
  'automation-builder',
  AutomationBuilder,
  {
    label: 'Automation Builder',
    category: 'Enterprise',
    inputs: [
      { name: 'automation', type: 'code', label: 'Automation Definition' },
      { name: 'objects', type: 'code', label: 'Available Objects' },
    ]
  }
);

// Register automation run history component
ComponentRegistry.register(
  'automation-run-history',
  AutomationRunHistory,
  {
    label: 'Automation Run History',
    category: 'Enterprise',
    inputs: [
      { name: 'runs', type: 'code', label: 'Run History' },
    ]
  }
);
