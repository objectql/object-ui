/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Workflow Schema
 * 
 * Defines workflow UI types for visual workflow design, approval processes,
 * and workflow instance tracking.
 */

import type { BaseSchema } from './base';

/**
 * Workflow lifecycle status
 */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

/**
 * Types of nodes available in the workflow designer
 */
export type WorkflowNodeType = 'start' | 'end' | 'task' | 'approval' | 'condition' | 'parallel' | 'delay' | 'notification' | 'script';

/**
 * Types of edges connecting workflow nodes
 */
export type WorkflowEdgeType = 'default' | 'conditional' | 'timeout';

/**
 * Action that can be performed on a workflow node
 */
export interface WorkflowNodeAction {
  /**
   * Action type
   */
  type: 'approve' | 'reject' | 'reassign' | 'comment' | 'escalate' | 'custom';

  /**
   * Display label for the action
   */
  label: string;

  /**
   * Target node to transition to after action
   */
  nextNodeId?: string;

  /**
   * Condition expression for action availability
   */
  condition?: string;
}

/**
 * A node in the workflow graph
 */
export interface WorkflowNode {
  /**
   * Unique node identifier
   */
  id: string;

  /**
   * Node type
   */
  type: WorkflowNodeType;

  /**
   * Display label
   */
  label: string;

  /**
   * Node description
   */
  description?: string;

  /**
   * Position in the workflow canvas
   */
  position?: { x: number; y: number };

  /**
   * Node-specific configuration
   */
  config?: Record<string, any>;

  /**
   * Assignee identifier
   */
  assignee?: string;

  /**
   * How the assignee is resolved
   */
  assigneeType?: 'user' | 'role' | 'group' | 'expression';

  /**
   * Timeout duration in minutes
   */
  timeout?: number;

  /**
   * Available actions for this node
   */
  actions?: WorkflowNodeAction[];
}

/**
 * An edge connecting two workflow nodes
 */
export interface WorkflowEdge {
  /**
   * Unique edge identifier
   */
  id: string;

  /**
   * Source node identifier
   */
  source: string;

  /**
   * Target node identifier
   */
  target: string;

  /**
   * Edge type
   */
  type?: WorkflowEdgeType;

  /**
   * Display label
   */
  label?: string;

  /**
   * Condition expression for conditional edges
   */
  condition?: string;
}

/**
 * Rule governing how approvals are processed
 */
export interface ApprovalRule {
  /**
   * Approval strategy type
   */
  type: 'any' | 'all' | 'majority' | 'sequential';

  /**
   * Minimum number of approvals required
   */
  minApprovals?: number;

  /**
   * Timeout duration in minutes
   */
  timeout?: number;

  /**
   * Identifier to escalate to on timeout
   */
  escalateTo?: string;

  /**
   * Expression that triggers automatic approval
   */
  autoApproveCondition?: string;
}

/**
 * Variable definition for workflow context
 */
export interface WorkflowVariable {
  /**
   * Variable name
   */
  name: string;

  /**
   * Variable data type
   */
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';

  /**
   * Default value
   */
  defaultValue?: any;

  /**
   * Whether the variable is required
   */
  required?: boolean;
}

/**
 * Workflow Schema - Main workflow definition
 */
export interface WorkflowSchema extends BaseSchema {
  type: 'workflow';

  /**
   * Workflow title
   */
  title?: string;

  /**
   * Workflow description
   */
  description?: string;

  /**
   * Current workflow status
   */
  status?: WorkflowStatus;

  /**
   * Workflow nodes
   */
  nodes: WorkflowNode[];

  /**
   * Workflow edges
   */
  edges: WorkflowEdge[];

  /**
   * Workflow variables
   */
  variables?: WorkflowVariable[];

  /**
   * Workflow version number
   */
  version?: number;
}

/**
 * Workflow Designer Schema - Visual workflow editor component
 */
export interface WorkflowDesignerSchema extends BaseSchema {
  type: 'workflow-designer';

  /**
   * Workflow to edit
   */
  workflow?: WorkflowSchema;

  /**
   * Whether the designer is in read-only mode
   */
  readOnly?: boolean;

  /**
   * Show minimap navigation panel
   */
  showMinimap?: boolean;

  /**
   * Show designer toolbar
   */
  showToolbar?: boolean;

  /**
   * Save callback action
   */
  onSave?: string;

  /**
   * Publish callback action
   */
  onPublish?: string;
}

/**
 * A single entry in the approval history
 */
export interface ApprovalHistoryItem {
  /**
   * Node where the action was taken
   */
  nodeId: string;

  /**
   * Action that was performed
   */
  action: string;

  /**
   * Actor identifier
   */
  actor: string;

  /**
   * Display name of the actor
   */
  actorName?: string;

  /**
   * ISO 8601 timestamp of the action
   */
  timestamp: string;

  /**
   * Optional comment
   */
  comment?: string;
}

/**
 * Approval Process Schema - Approval workflow UI component
 */
export interface ApprovalProcessSchema extends BaseSchema {
  type: 'approval-process';

  /**
   * Associated workflow identifier
   */
  workflowId?: string;

  /**
   * Workflow instance identifier
   */
  instanceId?: string;

  /**
   * Current active node identifier
   */
  currentNodeId?: string;

  /**
   * Approval rule configuration
   */
  approvalRule?: ApprovalRule;

  /**
   * Approval history entries
   */
  history?: ApprovalHistoryItem[];

  /**
   * Approval process data
   */
  data?: Record<string, any>;

  /**
   * Show approval history timeline
   */
  showHistory?: boolean;

  /**
   * Show comments section
   */
  showComments?: boolean;
}

/**
 * Workflow Instance Schema - Runtime state of a workflow execution
 */
export interface WorkflowInstanceSchema extends BaseSchema {
  type: 'workflow-instance';

  /**
   * Associated workflow definition identifier
   */
  workflowId: string;

  /**
   * Unique instance identifier
   */
  instanceId: string;

  /**
   * Current instance status
   */
  status: WorkflowStatus;

  /**
   * Currently active node identifiers
   */
  currentNodes: string[];

  /**
   * Runtime variable values
   */
  variables?: Record<string, any>;

  /**
   * ISO 8601 timestamp when the instance started
   */
  startedAt?: string;

  /**
   * ISO 8601 timestamp when the instance completed
   */
  completedAt?: string;

  /**
   * Instance data payload
   */
  data?: Record<string, any>;
}
