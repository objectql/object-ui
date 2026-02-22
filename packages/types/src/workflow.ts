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

// ============================================================================
// Flow Designer — spec v3.0.9 enhanced flow editor
// ============================================================================

/**
 * Flow node types — includes v3.0.9 gateway/boundary additions
 */
export type FlowNodeType =
  | 'start'
  | 'end'
  | 'task'
  | 'user_task'
  | 'service_task'
  | 'script_task'
  | 'approval'
  | 'condition'
  | 'parallel_gateway'
  | 'join_gateway'
  | 'boundary_event'
  | 'delay'
  | 'notification'
  | 'webhook';

/**
 * Wait event type for boundary/delay nodes (spec v3.0.9 WaitEventType)
 */
export type FlowWaitEventType = 'condition' | 'manual' | 'webhook' | 'timer' | 'signal';

/**
 * Execution status for a flow node
 */
export type FlowNodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Node executor descriptor (spec v3.0.9 NodeExecutorDescriptor)
 */
export interface FlowNodeExecutorDescriptor {
  /** Executor type identifier */
  type: string;
  /** Human-readable label */
  label?: string;
  /** Input schema (JSON Schema) */
  inputSchema?: Record<string, unknown>;
  /** Output schema (JSON Schema) */
  outputSchema?: Record<string, unknown>;
  /** Wait event configuration for wait/timer executors */
  waitEventConfig?: {
    eventType: FlowWaitEventType;
    /** Timer duration expression (ISO 8601 or expression) */
    timer?: string;
    /** Condition expression */
    condition?: string;
    /** Webhook URL */
    webhookUrl?: string;
    /** Signal name */
    signalName?: string;
  };
  /** Timeout behavior */
  timeoutMs?: number;
  /** Retry configuration (spec v3.0.9 enhanced retry) */
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    maxRetryDelayMs?: number;
    jitter?: boolean;
  };
}

/**
 * Boundary configuration for boundary event nodes (spec v3.0.9)
 */
export interface FlowBoundaryConfig {
  /** The host node this boundary event is attached to */
  attachedToNodeId: string;
  /** Boundary event sub-type */
  eventType: 'error' | 'timer' | 'message' | 'signal' | 'compensation';
  /** Whether the boundary event is interrupting */
  cancelActivity?: boolean;
  /** Timer expression (ISO 8601) for timer boundary events */
  timer?: string;
  /** Error code pattern for error boundary events */
  errorCode?: string;
}

/**
 * A node in the flow graph
 */
export interface FlowNode {
  /** Unique node identifier */
  id: string;
  /** Node type */
  type: FlowNodeType;
  /** Display label */
  label: string;
  /** Node description */
  description?: string;
  /** Canvas position */
  position: { x: number; y: number };
  /** Node executor configuration (spec v3.0.9) */
  executor?: FlowNodeExecutorDescriptor;
  /** Boundary event configuration (spec v3.0.9, only for boundary_event nodes) */
  boundaryConfig?: FlowBoundaryConfig;
  /** Runtime execution status (used in monitoring view) */
  executionStatus?: FlowNodeExecutionStatus;
  /** Node-specific properties */
  properties?: Record<string, unknown>;
}

/**
 * Flow edge types — includes v3.0.9 conditional edges
 */
export type FlowEdgeType = 'default' | 'conditional' | 'timeout';

/**
 * An edge connecting two flow nodes
 */
export interface FlowEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node identifier */
  source: string;
  /** Target node identifier */
  target: string;
  /** Edge type */
  type?: FlowEdgeType;
  /** Display label */
  label?: string;
  /** Condition expression (for conditional edges) */
  condition?: string;
  /** Whether this is the default/fallthrough edge (spec v3.0.9 isDefault flag) */
  isDefault?: boolean;
}

/**
 * Flow version entry (spec v3.0.9 FlowVersionHistory)
 */
export interface FlowVersionEntry {
  /** Version number */
  version: number;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** Author identifier */
  author?: string;
  /** Change description */
  changeNote?: string;
  /** Whether this version is currently active */
  isCurrent?: boolean;
}

/**
 * Concurrency policy (spec v3.0.9 ConcurrencyPolicy)
 */
export type FlowConcurrencyPolicy = 'allow' | 'forbid' | 'replace' | 'queue';

/**
 * BPMN interop result (spec v3.0.9 BpmnInteropResult)
 */
export interface FlowBpmnInteropResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Number of nodes mapped */
  nodeCount?: number;
  /** Number of edges mapped */
  edgeCount?: number;
  /** Warnings produced during mapping */
  warnings?: string[];
  /** Errors produced during mapping */
  errors?: string[];
  /** Raw BPMN XML string (for export) */
  bpmnXml?: string;
}

/**
 * Execution log step (spec v3.0.9 ExecutionStepLog)
 */
export interface FlowExecutionStep {
  /** Node identifier */
  nodeId: string;
  /** Step status */
  status: FlowNodeExecutionStatus;
  /** ISO 8601 start timestamp */
  startedAt?: string;
  /** ISO 8601 end timestamp */
  completedAt?: string;
  /** Error message (if failed) */
  error?: string;
  /** Step output data */
  output?: Record<string, unknown>;
}

/**
 * Flow Designer Schema — canvas-based flow editor component
 */
export interface FlowDesignerSchema extends BaseSchema {
  type: 'flow-designer';
  /** Flow nodes */
  nodes?: FlowNode[];
  /** Flow edges */
  edges?: FlowEdge[];
  /** Flow title */
  title?: string;
  /** Flow description */
  description?: string;
  /** Flow lifecycle status */
  status?: WorkflowStatus;
  /** Concurrency policy (spec v3.0.9) */
  concurrencyPolicy?: FlowConcurrencyPolicy;
  /** Version history */
  versionHistory?: FlowVersionEntry[];
  /** Execution steps (for monitoring overlay) */
  executionSteps?: FlowExecutionStep[];
  /** Whether the designer is read-only */
  readOnly?: boolean;
  /** Show minimap */
  showMinimap?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Show version history panel */
  showVersionHistory?: boolean;
  /** Show execution monitoring overlay */
  showExecutionOverlay?: boolean;
  /** Callback action name for save */
  onSave?: string;
}
