# @object-ui/plugin-workflow

Workflow and approval components for Object UI — visual workflow designer and approval process handler.

## Features

- 🔀 **Workflow Designer** - Visual workflow builder with drag-and-drop nodes and edges
- ✅ **Approval Process** - Multi-step approval handling with history and comments
- 🗺️ **Minimap** - Overview minimap for complex workflows
- 🛠️ **Toolbar** - Built-in toolbar for node creation and editing
- 📜 **Approval History** - View full approval chain and decision history
- 💬 **Comments** - Add comments to approval steps
- 📦 **Auto-registered** - Components register with `ComponentRegistry` on import

## Installation

```bash
npm install @object-ui/plugin-workflow
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `@object-ui/core`

## Quick Start

```tsx
import { WorkflowDesigner, ApprovalProcess } from '@object-ui/plugin-workflow';

function WorkflowEditor() {
  return (
    <WorkflowDesigner
      workflow={workflowDefinition}
      showToolbar
      showMinimap
      readOnly={false}
    />
  );
}

function ApprovalView() {
  return (
    <ApprovalProcess
      workflowId="wf-001"
      instanceId="inst-001"
      currentNodeId="review-step"
      showHistory
      showComments
    />
  );
}
```

## API

### WorkflowDesigner

Visual workflow builder with nodes, edges, and conditions:

```tsx
<WorkflowDesigner
  workflow={workflowDefinition}
  readOnly={false}
  showToolbar
  showMinimap={false}
/>
```

### ApprovalProcess

Approval process handler with history and actions:

```tsx
<ApprovalProcess
  workflowId="wf-001"
  instanceId="inst-001"
  currentNodeId="manager-approval"
  approvalRule={approvalRuleConfig}
  history={approvalHistory}
  showHistory
  showComments
/>
```

### Schema-Driven Usage

Components auto-register with `ComponentRegistry`:

```json
{
  "type": "workflow-designer",
  "workflow": { "nodes": [], "edges": [] },
  "showToolbar": true,
  "showMinimap": false
}
```

```json
{
  "type": "approval-process",
  "workflowId": "wf-001",
  "instanceId": "inst-001",
  "currentNodeId": "review-step",
  "showHistory": true,
  "showComments": true
}
```

## License

MIT
