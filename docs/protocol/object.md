# Object Definition

> **Implementation Status**: 📝 **Planned** - Object protocol specification is complete but implementation is planned for Q2 2026.
> 
> See [Implementation Status](./implementation-status.md#object-protocol) for detailed status.

Object files define business entities or database tables in YAML (or JSON). They are the foundation of your application's data model and are designed to be both human-readable and AI-friendly for automated code generation.

**File Naming Convention:** `<object_name>.object.yml`

The filename (without the `.object.yml` extension) automatically becomes the object's API name. This eliminates the need for a redundant `name` property inside the file.

**Examples:**
- `project.object.yml` → Object API name: `project`
- `task.object.yml` → Object API name: `task`
- `customer_order.object.yml` → Object API name: `customer_order`

Files should use **snake_case** for multi-word names (e.g., `project_tasks.object.yml`).

## 1. Root Properties

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | Recommended | Human-readable label (e.g., "Project Task"). Defaults to capitalized filename if omitted. |
| `icon` | `string` | Optional | SLDS icon string (e.g., `standard:task`). |
| `description` | `string` | Optional | Internal description of the object. |
| `fields` | `Map` | **Required** | Dictionary of field definitions. |
| `actions` | `Map` | Optional | Dictionary of custom action definitions. |
| `ai_context` | `object` | Optional | AI-friendly context for code generation and understanding. |

**Note:** The `name` property is **no longer needed** - it's automatically inferred from the filename.

### 1.1 AI Context (Optional)

The `ai_context` block provides semantic information to help AI tools understand the business purpose and usage patterns of your object. This improves code generation accuracy and enables intelligent suggestions.

```yaml
# File: project.object.yml

label: Project

# AI-friendly context
ai_context:
  # Business intent - helps AI understand the purpose
  intent: "Manage projects with timeline, budget, and team tracking"
  
  # Business domain classification
  domain: project_management
  
  # Natural language aliases for queries
  aliases:
    - project
    - initiative
    - program
  
  # Example records for AI to understand data patterns
  examples:
    - name: "Website Redesign 2026"
      status: active
      budget: 50000
    - name: "Q1 Marketing Campaign"
      status: planning
      budget: 25000
  
  # Common queries users might ask
  common_queries:
    - "Find all active projects"
    - "Show projects over budget"
    - "List my projects due this week"

fields:
  # ... field definitions
```

| Property | Type | Description |
| :--- | :--- | :--- |
| `intent` | `string` | Brief description of the object's business purpose. |
| `domain` | `string` | Business domain (e.g., `sales`, `project_management`, `hr`). |
| `aliases` | `string[]` | Natural language terms users might use to refer to this object. |
| `examples` | `object[]` | Sample records showing typical data patterns. |
| `common_queries` | `string[]` | Typical questions or searches users perform. |

## 2. Field Definitions

Fields are defined under the `fields` key. The key for each entry corresponds to the field's API name.

```yaml
fields:
  field_name:
    type: text
    label: Field Label
```

### 2.1 Common Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `type` | `string` | **Required.** Data type of the field. |
| `label` | `string` | Display label for UI validation messages. |
| `required` | `boolean` | If `true`, the field cannot be null/undefined. Default: `false`. |
| `unique` | `boolean` | If `true`, enforces unique values in the database. Default: `false`. |
| `defaultValue` | `any` | Default value if not provided during creation. |
| `index` | `boolean` | Creates a database index for this field. |
| `searchable` | `boolean` | Enables traditional keyword-based search (e.g., exact match, SQL LIKE). |
| `sortable` | `boolean` | Hint that this field can be used for sorting in UI. |
| `description` | `string` | Help text or documentation for the field. |
| `ai_context` | `object` | **Optional.** AI-friendly context for this specific field. |

#### Field-Level AI Context

Each field can include an `ai_context` block to help AI understand its purpose and usage:

```yaml
fields:
  name:
    type: text
    required: true
    label: Project Name
    
    # AI-friendly context for this field
    ai_context:
      intent: "Human-readable project identifier"
      
      # Example values help AI generate realistic data
      examples:
        - "Website Redesign 2026"
        - "Q1 Marketing Campaign"
        - "Mobile App Launch"
      
      # Pattern guidance for generation
      pattern: "[Department/Category] [Description] [Optional: Year/Quarter]"
      
      # Validation hints
      avoid_patterns:
        - "Untitled"
        - "Project 1"
        - "Project 2"
        - "New Project"  # Too generic
  
  status:
    type: select
    required: true
    options:
      - value: planning
        label: Planning
      - value: active
        label: Active
      - value: completed
        label: Completed
    
    ai_context:
      intent: "Current lifecycle stage of the project"
      
      # State machine information
      is_state_machine: true
      transitions:
        planning: [active, cancelled]
        active: [on_hold, completed, cancelled]
        on_hold: [active, cancelled]
        completed: []  # Terminal state
        cancelled: []  # Terminal state
```

### 2.2 Supported Field Types

| Type | Description | Specific Properties |
| :--- | :--- | :--- |
| **Basic Types** | | |
| `text` | Single line text. | `min_length`, `max_length`, `regex` |
| `textarea` | Multiline text. | `rows`, `min_length`, `max_length` |
| `markdown` | Markdown formatted text. | |
| `html` | Rich text content (HTML). | |
| `number` | Numeric value (integer or float). | `precision`, `min`, `max` |
| `currency` | Monetary value. | `scale`, `min`, `max` |
| `percent` | Percentage value (0-1). | `scale`, `min`, `max` |
| `boolean` | `true` or `false`. | |
| **System/Format Types** | | |
| `email` | Email address with validation. | |
| `phone` | Phone number formatting. | |
| `url` | Web URL validation. | |
| `password` | Encrypted or masked string. | |
| **Date & Time** | | |
| `date` | Date only (YYYY-MM-DD). | |
| `datetime` | Date and time (ISO string). | |
| `time` | Time only (HH:mm:ss). | |
| **Complex/Media** | | |
| `file` | File attachment (stored as JSON). See [Attachment API](../api/attachments.md). | `multiple`, `accept`, `max_size` |
| `image` | Image attachment (stored as JSON). Supports avatars, photos, galleries. See [Attachment API](../api/attachments.md). | `multiple`, `accept`, `max_size`, `max_width`, `max_height` |
| `location` | Geolocation (lat/lng JSON). | |
| **Relationships** | | |
| `select` | Selection from a list. | `options`, `multiple` |
| `lookup` | Reference to another object. | `reference_to`, `multiple` |
| `master_detail` | Strong ownership relationship. | `reference_to` (Required) |
| **Advanced** | | |
| `formula` | Read-only calculated field. | `expression`, `data_type` |
| `summary` | Roll-up summary of child records. | `summary_object`, `summary_type`, `summary_field`, `summary_filters` |
| `auto_number` | Auto-incrementing unique identifier. | `auto_number_format` |
| `object` | JSON object structure. | |
| `grid` | Array of objects/rows. | |
| `vector` | Vector embedding for AI search. | `dimension` |

### 2.3 Relationship Fields

Relationship fields (`lookup`, `master_detail`) connect objects together. For AI-friendly metadata, consider adding semantic context about the relationship's meaning.

**Basic Relationship:**

```yaml
owner:
  type: lookup
  reference_to: users
  label: Owner
```

**AI-Enhanced Relationship:**

```yaml
owner:
  type: lookup
  reference_to: users
  label: Owner
  
  ai_context:
    intent: "The person responsible for project success"
    semantic_type: ownership  # ownership, hierarchy, association, aggregation
    
    # Help AI suggest appropriate values
    selection_guidance: "Usually a manager or senior team member"
    
    # Common filters for selection
    typical_filters:
      - field: is_active
        value: true
      - field: role
        operator: in
        values: [manager, director]

project_manager:
  type: lookup
  reference_to: users
  label: Project Manager
  
  ai_context:
    intent: "Person managing day-to-day project execution"
    semantic_type: hierarchy
    differs_from: owner  # Helps AI understand subtle differences
```

**Master-Detail Relationship:**

```yaml
account:
  type: master_detail
  reference_to: accounts
  label: Account
  
  ai_context:
    intent: "Parent account owning this opportunity"
    semantic_type: ownership
    cascade_behavior: "Deleting account deletes all opportunities"
```

| Property | Type | Description |
| :--- | :--- | :--- |
| `reference_to` | `string` | **Required.** The `name` of the target object. |
| `multiple` | `boolean` | If `true`, allows multiple selections (one-to-many). Default: `false`. |
| `ai_context.intent` | `string` | Business purpose of this relationship. |
| `ai_context.semantic_type` | `string` | Type: `ownership`, `hierarchy`, `association`, `aggregation`. |
| `ai_context.selection_guidance` | `string` | Hints for selecting appropriate related records. |

### 2.4 Select Options

Options for `select` can be a simple list or label/value pairs. For AI-friendly metadata, you can add context to each option to explain its meaning and when it should be used.

**Simple Options:**
```yaml
priority:
  type: select
  options:
    - label: Low
      value: low
    - label: Medium
      value: medium
    - label: High
      value: high
```

**AI-Enhanced Options with State Machine:**
```yaml
status:
  type: select
  options:
    - value: planning
      label: Planning
      ai_context:
        intent: "Initial stage - defining scope and requirements"
        typical_duration_days: 14
        next_states: [active, cancelled]
        entry_requirements:
          - "Project name must be set"
          - "Owner must be assigned"
    
    - value: active
      label: Active
      ai_context:
        intent: "Work is being performed"
        next_states: [on_hold, completed, cancelled]
        entry_requirements:
          - "Start date must be set"
          - "Budget must be approved"
    
    - value: on_hold
      label: On Hold
      ai_context:
        intent: "Temporarily paused"
        next_states: [active, cancelled]
        requires_reason: true
    
    - value: completed
      label: Completed
      ai_context:
        intent: "All deliverables finished"
        is_terminal: true  # Cannot transition from this state
        next_states: []
    
    - value: cancelled
      label: Cancelled
      ai_context:
        intent: "Project discontinued"
        is_terminal: true
        next_states: []
  
  # Overall field AI context
  ai_context:
    intent: "Track project through its lifecycle"
    is_state_machine: true
    enforce_transitions: true  # Only allow valid state changes
```

This state machine information enables:
- **Validation**: Prevent invalid state transitions
- **UI**: Show only valid next states in dropdowns
- **Automation**: Trigger workflows on state changes
- **AI Generation**: Generate realistic test data following proper state flow

## 3. Indexes

Indexes improve query performance. You can add AI context to explain the purpose of each index, helping future developers and AI tools understand optimization decisions.

### 3.1 Field-Level Indexes

You can define simple indexes directly on the field:

```yaml
fields:
  email:
    type: email
    index: true   # Creates a standard index
    unique: true  # Creates a unique index (constraint)
    
    ai_context:
      intent: "User's primary email for login and notifications"
      index_rationale: "Frequently queried for user lookup and authentication"
```

### 3.2 Object-Level Indexes

For composite indexes (spanning multiple fields), define them under the `indexes` key at the root of the file.

```yaml
indexes:
  # Composite Index
  project_status_idx:
    fields: [project_id, status]
    ai_context:
      intent: "Optimize queries filtering by project and status"
      common_query: "SELECT * FROM tasks WHERE project_id = ? AND status = ?"
      performance_note: "Supports project task lists grouped by status"
  
  # Unique Composite Index
  unique_task_name:
    fields: [project_id, name]
    unique: true
    ai_context:
      intent: "Prevent duplicate task names within a project"
      business_rule: "Task names must be unique per project"
```

| Property | Type | Description |
| :--- | :--- | :--- |
| `fields` | `string[]` | **Required.** List of field names to include in the index. |
| `unique` | `boolean` | If `true`, requires values to be unique combination. Default: `false`. |
| `ai_context.intent` | `string` | Why this index exists. |
| `ai_context.common_query` | `string` | Typical query this index optimizes. |

## 4. AI & Vector Search

ObjectQL supports AI-native features like semantic search and vector embeddings directly in the schema definition.

### 4.1 AI Configuration

You can enable semantic search and other AI capabilities using the `ai` property at the root of the file.

```yaml
# Enable Semantic Search for this object
ai:
  search:
    enabled: true
    # Fields to generate embeddings from
    fields: [title, description, content]
    # Optional: Specify embedding model
    model: text-embedding-3-small
```

| Property | Type | Description |
| :--- | :--- | :--- |
| `search.enabled` | `boolean` | Enables semantic search. System will automatically manage vector storage. |
| `search.fields` | `string[]` | List of text fields to concatenate and embed. |
| `search.model` | `string` | Model ID (e.g. `openai/text-embedding-3-small`). Defaults to system setting. |
| `search.target_field` | `string` | Optional. The name of a manual `vector` field to store embeddings in. |

### 4.2 Vector Fields

For more granular control, you can define explicit `vector` fields. This is useful if you want to store embeddings from external sources or multiple embeddings per record.

```yaml
fields:
  # Metadata
  title:
    type: text

  # Explicit Vector Storage
  content_embedding:
    type: vector
    dimension: 1536  # Required: Dimension of the vector
    index: true      # Creates a vector index (IVFFlat / HNSW)
```

## 5. Internationalization (i18n)

ObjectQL is built to support creating global applications. The philosophy is to **keep the core schema clean** and manage translations separately.

### 5.1 Metadata Translation (UI)

All user-facing text defined in `*.object.yml` (Object Labels, Field Labels, Help Text, Select Options) should be translated via external JSON files. This separation allows AI agents to translate the entire UI in one go without touching the schema logic.

**Directory Structure:**
```
src/
  objects/
    project.object.yml  # Source of Truth (Default Language, usually English)
  i18n/
    zh-CN/
      project.json      # Chinese Translation
    es-ES/
      project.json      # Spanish Translation
```

**Translation File Format (`project.json`):**
The structure mirrors the object definition but only contains translatable strings.

```json
{
  "label": "项目",
  "description": "项目管理核心对象",
  "fields": {
    "status": {
      "label": "状态",
      "help_text": "项目的当前进展阶段",
      "options": {
        "planned": "计划中",
        "in_progress": "进行中",
        "completed": "已完成"
      }
    }
  },
  "actions": {
    "approve": {
      "label": "审批",
      "confirm_text": "确认审批通过吗？"
    }
  }
}
```

### 5.2 Data Content

ObjectQL does **not** enforce a specific "multi-language column" format (like JSON fields) in the core spec, as this often complicates indexing and reporting.

Recommended strategies for content translation:
1.  **Separate Record Strategy**: Store different language versions as separate records with a `locale` field and a `master_id`.
2.  **Translation Tables**: Use a standard relational design (e.g., `Product` -> `ProductTranslation`).





## 6. Type Generation (CLI)

To achieve strict type safety in your Hooks and Actions, you should use the Code Generation tool.

### 6.1 Usage

```bash
# Generate types from *.object.yml to src/generated/
npx objectql generate --source ./src --output ./src/generated
```

### 6.2 Using Generated Types

Once generated, you can import the Interfaces directly. This ensures that your code is always in sync with your metadata.

```typescript
import { Todo } from './generated';

const myTask: Todo = {
    title: "Finish documentation", // Type-checked!
    completed: false
};
```

## 7. Complete AI-Enhanced Example

Here's a complete example showing how to leverage AI context throughout your object definition:

```yaml
# File: project.object.yml
# Object name "project" is automatically inferred from filename

label: Project
icon: standard:project
description: Core object for project management

# Object-level AI context
ai_context:
  intent: "Manage projects with timeline, budget, and team tracking"
  domain: project_management
  aliases: [project, initiative, program]
  
  examples:
    - name: "Website Redesign 2026"
      status: active
      budget: 50000
      owner_id: user_001
    - name: "Q1 Marketing Campaign"
      status: planning
      budget: 25000
      owner_id: user_002
  
  common_queries:
    - "Find all active projects"
    - "Show projects over budget"
    - "List my projects due this week"

fields:
  name:
    type: text
    required: true
    label: Project Name
    ai_context:
      intent: "Human-readable project identifier"
      examples:
        - "Website Redesign 2026"
        - "Mobile App Launch Q2"
      pattern: "[Category] [Description] [Optional: Year/Quarter]"
  
  status:
    type: select
    required: true
    default: planning
    options:
      - value: planning
        label: Planning
        ai_context:
          intent: "Defining scope and requirements"
          typical_duration_days: 14
          next_states: [active, cancelled]
      
      - value: active
        label: Active
        ai_context:
          intent: "Work in progress"
          next_states: [on_hold, completed, cancelled]
      
      - value: completed
        label: Completed
        ai_context:
          intent: "All deliverables finished"
          is_terminal: true
          next_states: []
    
    ai_context:
      intent: "Track project lifecycle"
      is_state_machine: true
      enforce_transitions: true
  
  budget:
    type: currency
    required: false
    label: Budget
    ai_context:
      intent: "Total approved budget in USD"
      examples: [25000, 150000, 500000]
      business_rules:
        - "Budget > $50K requires manager approval"
        - "Cannot exceed department annual budget"
  
  owner:
    type: lookup
    reference_to: users
    required: true
    label: Owner
    ai_context:
      intent: "Person responsible for project success"
      semantic_type: ownership
      selection_guidance: "Usually a manager or team lead"
      typical_filters:
        - field: is_active
          value: true
        - field: role
          operator: in
          values: [manager, director]
  
  start_date:
    type: date
    label: Start Date
    ai_context:
      intent: "When project work begins"
      validation_hint: "Must be before end_date"
  
  end_date:
    type: date
    label: End Date
    ai_context:
      intent: "Target completion date"
      validation_hint: "Must be after start_date"

indexes:
  status_owner_idx:
    fields: [status, owner_id]
    ai_context:
      intent: "Optimize 'my active projects' queries"
      common_query: "status = 'active' AND owner_id = current_user"

# AI-powered semantic search
ai:
  search:
    enabled: true
    fields: [name, description]
    model: text-embedding-3-small
```

This AI-enhanced metadata enables:
- **Better Code Generation**: AI tools understand intent and generate correct code
- **Intelligent Validation**: AI can suggest validation rules based on business rules
- **Realistic Test Data**: AI generates test data following proper patterns
- **Documentation**: AI can auto-generate comprehensive documentation
- **Query Optimization**: AI understands common access patterns for indexing

