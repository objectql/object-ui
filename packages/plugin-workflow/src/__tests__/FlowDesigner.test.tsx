import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlowDesigner } from '../FlowDesigner';
import type { FlowDesignerSchema, FlowNode, FlowEdge } from '@object-ui/types';

describe('FlowDesigner', () => {
  it('should render with default nodes (start + end)', () => {
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getByDisplayValue('New Flow')).toBeInTheDocument();
    expect(screen.getAllByText('Start').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('End').length).toBeGreaterThanOrEqual(1);
  });

  it('should render with provided nodes and edges', () => {
    const nodes: FlowNode[] = [
      { id: 'n1', type: 'start', label: 'Begin', position: { x: 0, y: 0 } },
      { id: 'n2', type: 'task', label: 'Process Data', position: { x: 200, y: 0 } },
      { id: 'n3', type: 'end', label: 'Finish', position: { x: 400, y: 0 } },
    ];
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      title: 'My Flow',
      nodes,
      edges,
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getByDisplayValue('My Flow')).toBeInTheDocument();
    expect(screen.getAllByText('Begin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Process Data').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Finish').length).toBeGreaterThanOrEqual(1);
  });

  it('should support v3.0.9 node types: parallel_gateway, join_gateway, boundary_event', () => {
    const nodes: FlowNode[] = [
      { id: 's1', type: 'start', label: 'Start', position: { x: 0, y: 0 } },
      { id: 'p1', type: 'parallel_gateway', label: 'Split', position: { x: 200, y: 0 } },
      { id: 'j1', type: 'join_gateway', label: 'Join', position: { x: 400, y: 0 } },
      { id: 'b1', type: 'boundary_event', label: 'On Error', position: { x: 200, y: 150 } },
      { id: 'e1', type: 'end', label: 'End', position: { x: 600, y: 0 } },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      nodes,
      edges: [],
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getAllByText('Split').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Join').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('On Error').length).toBeGreaterThanOrEqual(1);
  });

  it('should render conditional edges with isDefault flag', () => {
    const nodes: FlowNode[] = [
      { id: 'n1', type: 'condition', label: 'Check Status', position: { x: 0, y: 0 } },
      { id: 'n2', type: 'task', label: 'Approved', position: { x: 200, y: -80 } },
      { id: 'n3', type: 'task', label: 'Rejected', position: { x: 200, y: 80 } },
    ];
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2', type: 'conditional', condition: 'status === "approved"', isDefault: false },
      { id: 'e2', source: 'n1', target: 'n3', type: 'conditional', isDefault: true },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      nodes,
      edges,
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getAllByText('Check Status').length).toBeGreaterThanOrEqual(1);
  });

  it('should render in read-only mode without add node buttons', () => {
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      readOnly: true,
    };
    render(<FlowDesigner schema={schema} />);
    // In read-only mode, the left toolbar (node palette) is hidden
    expect(screen.queryByTitle(/Add Task/i)).toBeNull();
  });

  it('should render node executor config with inputSchema/outputSchema', () => {
    const nodes: FlowNode[] = [
      {
        id: 'n1', type: 'service_task', label: 'Call API', position: { x: 0, y: 0 },
        executor: {
          type: 'http',
          inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { status: { type: 'number' } } },
          timeoutMs: 30000,
          retry: { maxAttempts: 3, backoffMultiplier: 2, jitter: true },
        },
      },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      nodes,
      edges: [],
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getAllByText('Call API').length).toBeGreaterThanOrEqual(1);
  });

  it('should render boundary event with boundaryConfig', () => {
    const nodes: FlowNode[] = [
      { id: 'n1', type: 'task', label: 'Main Task', position: { x: 0, y: 0 } },
      {
        id: 'b1', type: 'boundary_event', label: 'Timeout', position: { x: 0, y: 120 },
        boundaryConfig: {
          attachedToNodeId: 'n1',
          eventType: 'timer',
          cancelActivity: true,
          timer: 'PT30M',
        },
      },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      nodes,
      edges: [],
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getAllByText('Timeout').length).toBeGreaterThanOrEqual(1);
  });

  it('should render version history panel when showVersionHistory is true', () => {
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      showVersionHistory: true,
      versionHistory: [
        { version: 2, createdAt: '2026-02-01T00:00:00Z', author: 'alice', changeNote: 'Added approval', isCurrent: true },
        { version: 1, createdAt: '2026-01-01T00:00:00Z', author: 'bob', changeNote: 'Initial version' },
      ],
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getByText('Version History')).toBeInTheDocument();
    expect(screen.getByText('Added approval')).toBeInTheDocument();
    expect(screen.getByText('Initial version')).toBeInTheDocument();
  });

  it('should render execution overlay with status icons', () => {
    const nodes: FlowNode[] = [
      { id: 'n1', type: 'start', label: 'Start', position: { x: 0, y: 0 } },
      { id: 'n2', type: 'task', label: 'Running Step', position: { x: 200, y: 0 } },
      { id: 'n3', type: 'task', label: 'Completed Step', position: { x: 400, y: 0 } },
      { id: 'n4', type: 'task', label: 'Failed Step', position: { x: 600, y: 0 } },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      nodes,
      edges: [],
      showExecutionOverlay: true,
      executionSteps: [
        { nodeId: 'n2', status: 'running', startedAt: '2026-02-22T10:00:00Z' },
        { nodeId: 'n3', status: 'completed', startedAt: '2026-02-22T09:00:00Z', completedAt: '2026-02-22T09:30:00Z' },
        { nodeId: 'n4', status: 'failed', error: 'Connection timeout' },
      ],
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getAllByText('Running Step').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Completed Step').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Failed Step').length).toBeGreaterThanOrEqual(1);
  });

  it('should render concurrency policy badge', () => {
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      concurrencyPolicy: 'forbid',
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getByText('Forbid (skip new)')).toBeInTheDocument();
  });

  it('should show status badge', () => {
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      status: 'active',
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('should add a node when toolbar button is clicked', () => {
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
    };
    render(<FlowDesigner schema={schema} />);
    const addButton = screen.getByTitle('Add Task');
    fireEvent.click(addButton);
    // The new Task node should appear on the canvas
    expect(screen.getAllByText('Task').length).toBeGreaterThanOrEqual(1);
  });

  it('should call onSave callback when save button is clicked', () => {
    const onSave = vi.fn();
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
    };
    render(<FlowDesigner schema={schema} onSave={onSave} />);
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('should show property panel with node type selector on node selection', () => {
    const nodes: FlowNode[] = [
      { id: 'n1', type: 'task', label: 'My Task', position: { x: 100, y: 100 } },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      nodes,
      edges: [],
    };
    render(<FlowDesigner schema={schema} />);
    // Click the node
    const nodeEl = screen.getAllByText('My Task')[0].closest('[role="group"]');
    if (nodeEl) fireEvent.click(nodeEl);
    // Property panel should show 'Node Properties'
    expect(screen.getByText('Node Properties')).toBeInTheDocument();
  });

  it('should support delay node with wait event configuration', () => {
    const nodes: FlowNode[] = [
      {
        id: 'd1', type: 'delay', label: 'Wait 1 Hour', position: { x: 0, y: 0 },
        executor: {
          type: 'wait',
          waitEventConfig: { eventType: 'timer', timer: 'PT1H' },
          timeoutMs: 3600000,
        },
      },
    ];
    const schema: FlowDesignerSchema = {
      type: 'flow-designer',
      nodes,
      edges: [],
    };
    render(<FlowDesigner schema={schema} />);
    expect(screen.getAllByText('Wait 1 Hour').length).toBeGreaterThanOrEqual(1);
  });
});
