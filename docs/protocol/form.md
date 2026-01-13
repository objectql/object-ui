# Form Metadata

Form metadata defines the structure, layout, and behavior of data entry forms. Forms are the primary interface for creating and editing records. They are designed to be both functional and AI-understandable for automated form generation.

## 1. Overview

Form metadata provides:

- **Layout definition**: Multi-column layouts, sections, tabs, wizards
- **Field configuration**: Labels, help text, default values, placeholders
- **Conditional logic**: Show/hide fields based on conditions
- **Validation**: Real-time field validation with clear messages
- **Workflow integration**: Multi-step forms, wizards
- **Responsive design**: Mobile-optimized layouts
- **AI assistance**: Smart defaults, auto-complete, validation helpers

**File Naming Convention:** `<form_name>.form.yml`

The filename (without the `.form.yml` extension) automatically becomes the form's identifier. This eliminates the need for a redundant `name` property.

**Examples:**
- `project_form.form.yml` → Form name: `project_form`
- `quick_task.form.yml` → Form name: `quick_task`
- `customer_edit.form.yml` → Form name: `customer_edit`

## 2. Root Structure with AI Context

```yaml
# File: project_form.form.yml
# Form name is inferred from filename!

label: Project Information
type: edit  # create, edit, view
object: projects
description: Form for creating and editing projects

# AI-friendly context
ai_context:
  intent: "Capture essential project information for planning and tracking"
  user_persona: "Project manager or team lead"
  typical_completion_time: "3-5 minutes"
  
  # Help AI understand form flow
  user_journey: |
    1. Enter basic project details (name, description)
    2. Set timeline and budget
    3. Assign team members
    4. Review and submit
  
  # Common issues to prevent
  common_errors:
    - "Forgetting to set realistic deadlines"
    - "Not assigning budget upfront"
    - "Missing team member assignments"
  
  # Quality checks
  quality_guidance: |
    - Name should be descriptive and unique
    - Description should explain problem being solved
    - Budget should align with project scope

# Layout Configuration
layout:
  columns: 2
  sections:
    - name: basic_info
      label: Basic Information
      columns: 2
      
      ai_context:
        intent: "Capture core identifying information"
        user_guidance: "Start with a clear, descriptive project name"
        completion_order: 1
      
      fields:
        - name
        - status
        - priority
        - category
    
    - name: details
      label: Project Details
      columns: 1
      
      ai_context:
        intent: "Document project purpose and scope"
        user_guidance: "Be specific about what problems this project solves"
        completion_order: 2
      
      fields:
        - description
        - objectives
        - deliverables
    
    - name: timeline
      label: Timeline & Budget
      columns: 2
      
      ai_context:
        intent: "Set realistic expectations for duration and cost"
        validation_focus: "Ensure dates are logical and budget is within limits"
        completion_order: 3
      
      fields:
        - start_date
        - end_date
        - budget
        - estimated_hours
    
    - name: assignment
      label: Team Assignment
      columns: 2
      
      ai_context:
        intent: "Assign ownership and build project team"
        user_guidance: "Owner is accountable for project success"
        completion_order: 4
      
      fields:
        - owner
        - team
        - department

# Field Overrides with AI Enhancement
field_config:
  name:
    placeholder: "e.g., 'Q2 Website Redesign'"
    help_text: "Choose a name that clearly identifies the project"
    
    ai_context:
      intent: "Unique project identifier for tracking and reporting"
      
      # Smart suggestions
      suggestions_based_on:
        - "Department name"
        - "Current quarter"
        - "Primary deliverable"
      
      quality_check: "Should be descriptive, not generic like 'Project 1'"
      
      examples:
        good: ["Website Redesign 2026", "Q1 Marketing Campaign"]
        bad: ["Project", "Untitled", "New Project"]
  
  description:
    rows: 5
    placeholder: "What is this project about? What problem does it solve?"
    help_text: "Provide comprehensive project overview"
    
    ai_context:
      intent: "Clear problem statement and expected outcomes"
      quality_check: "Should answer: What, Why, and Expected Outcome"
      min_quality_length: 50  # Characters for meaningful description
      
      ai_assist:
        enabled: true
        feature: "auto_expand"
        prompt: "Expand this brief description into a full project overview"
  
  status:
    default_value: planning
    help_text: "Current project stage"
    
    ai_context:
      intent: "Track project through lifecycle"
      default_rationale: "New projects start in planning phase"
  
  budget:
    prefix: $
    format: currency
    help_text: "Total approved project budget"
    
    ai_context:
      intent: "Financial planning and tracking"
      
      # Smart defaults based on project type
      smart_defaults:
        small_project: 25000
        medium_project: 100000
        large_project: 500000
      
      # Warning thresholds (severity: info, warning, error)
      warning_thresholds:
        - amount: 50000
          message: "Projects over $50K require manager approval"
          severity: warning
        
        - amount: 200000
          message: "Projects over $200K require director approval"
          severity: error
  
  start_date:
    default: "$today"
    
    ai_context:
      intent: "When project work begins"
      smart_default_rationale: "Most projects start immediately or within days"
  
  end_date:
    ai_context:
      intent: "Target completion date"
      
      # AI can suggest realistic timelines
      suggestions:
        - value: "start_date + 30 days"
          label: "1 month project"
        - value: "start_date + 90 days"
          label: "1 quarter project"
        - value: "start_date + 180 days"
          label: "6 month project"
  
  owner:
    default: "$current_user"
    
    ai_context:
      intent: "Person responsible for project success"
      default_rationale: "Usually the person creating the project"
      
      # Smart suggestions
      suggestions_based_on:
        - "Current user's manager"
        - "Department head"
        - "Previous project owners in same category"

# Conditional Display with Business Logic
conditional_logic:
  - name: show_completion_fields
    
    ai_context:
      intent: "Show completion tracking when project is done"
      business_rule: "Completed projects need actual dates and costs"
    
    condition:
      field: status
      operator: "="
      value: completed
    
    actions:
      - show_fields: [completion_date, actual_cost, completion_notes]
      - mark_required: [completion_date, completion_notes]
      - hide_fields: [estimated_hours]
  
  - name: require_approval_info
    
    ai_context:
      intent: "High-value projects need approval tracking"
      business_rule: "Company policy requires approval for projects > $50K"
    
    condition:
      field: budget
      operator: ">"
      value: 50000
    
    actions:
      - show_fields: [approval_required, approver, approval_justification]
      - mark_required: [approver, approval_justification]
      - show_message:
          type: info
          text: "This project requires management approval due to budget amount"
  
  - name: suggest_risk_assessment
    
    ai_context:
      intent: "Large or complex projects should assess risks"
      business_rule: "Projects over 6 months or $200K should document risks"
    
    condition:
      any_of:
        - field: budget
          operator: ">"
          value: 200000
        - field: estimated_hours
          operator: ">"
          value: 1000
    
    actions:
      - show_section: risk_assessment
      - show_message:
          type: warning
          text: "Consider documenting project risks and mitigation strategies"

# AI-Powered Form Features
ai_features:
  # Auto-complete from context
  auto_complete:
    enabled: true
    fields: [description, objectives]
    
    ai_context:
      intent: "Help users write better project descriptions"
      feature: "Expand brief notes into full descriptions"
  
  # Smart validation
  validation_assistant:
    enabled: true
    
    ai_context:
      intent: "Real-time suggestions for improving data quality"
      checks:
        - "Description is too vague"
        - "Budget seems unrealistic for project scope"
        - "Timeline conflicts with resource availability"
  
  # Similar projects
  similar_projects:
    enabled: true
    match_on: [category, department, budget_range]
    
    ai_context:
      intent: "Show similar past projects to help with estimation"
      use: "User can copy timeline and budget estimates from successful projects"

# Actions
actions:
  primary:
    - label: Save
      action: save
      icon: save
    - label: Save & New
      action: save_and_new
      icon: add
  
  secondary:
    - label: Cancel
      action: cancel
      icon: close

# Validation
validation:
  on_change: true
  on_submit: true
  show_errors_inline: true
```

## 3. Form Types

| Type | Description | Use Case |
|:---|:---|:---|
| `create` | New record creation | Creating new entities |
| `edit` | Record editing | Updating existing records |
| `view` | Read-only display | Viewing record details |
| `wizard` | Multi-step form | Complex data entry workflows |
| `inline` | Inline editing | Quick edits in lists/grids |
| `quick_create` | Minimal quick form | Fast record creation |

## 4. Layout Sections

Organize fields into logical groups:

```yaml
layout:
  # Global layout settings
  columns: 2
  spacing: medium
  
  sections:
    # Basic Section
    - name: personal_info
      label: Personal Information
      description: Employee basic details
      columns: 2
      collapsible: true
      collapsed: false
      fields:
        - first_name
        - last_name
        - email
        - phone
    
    # Full-width Section
    - name: address
      label: Address
      columns: 1
      fields:
        - street
        - city
        - state
        - zip_code
    
    # Nested Sections
    - name: employment
      label: Employment Details
      sections:
        - name: position
          label: Position
          fields:
            - title
            - department
            - manager
        
        - name: compensation
          label: Compensation
          fields:
            - salary
            - bonus
            - stock_options
```

## 5. Field Configuration

Override object-level field definitions:

```yaml
field_config:
  # Text Field
  email:
    label: Email Address
    placeholder: user@example.com
    help_text: Primary contact email
    required: true
    autocomplete: email
    validation:
      format: email
  
  # Number Field
  budget:
    label: Project Budget
    prefix: $
    suffix: USD
    format: currency
    decimal_places: 2
    min: 0
    max: 1000000
    step: 1000
    help_text: Total allocated budget
  
  # Select Field
  status:
    label: Status
    help_text: Current project status
    default_value: draft
    style: dropdown  # dropdown, radio, buttons
  
  # Lookup Field
  owner:
    label: Project Owner
    help_text: Responsible person
    search_fields: [name, email]
    display_format: "{name} ({email})"
    create_new: true  # Allow creating new record
  
  # Date Field
  start_date:
    label: Start Date
    help_text: Project kickoff date
    min_date: today
    max_date: +1 year
    default_value: today
    format: MM/DD/YYYY
  
  # Textarea
  description:
    label: Description
    placeholder: Enter detailed description
    rows: 5
    max_length: 5000
    show_character_count: true
    rich_text: false
  
  # Checkbox
  is_public:
    label: Public Project
    help_text: Visible to all users
    default_value: false
  
  # File Upload
  attachments:
    label: Attachments
    help_text: Upload relevant documents
    multiple: true
    accept: [.pdf, .doc, .docx, .xls, .xlsx]
    max_size: 10MB
    max_files: 5
```

## 6. Conditional Logic

Show/hide fields and control behavior based on conditions:

```yaml
conditional_logic:
  # Show/Hide Fields
  - name: show_international_fields
    condition:
      field: country
      operator: "!="
      value: US
    actions:
      - show_fields: [passport_number, visa_status]
      - hide_fields: [ssn]
  
  # Make Fields Required
  - name: require_reason_for_delay
    condition:
      field: status
      operator: "="
      value: delayed
    actions:
      - mark_required: [delay_reason, estimated_recovery_date]
  
  # Change Field Properties
  - name: readonly_after_approval
    condition:
      field: approval_status
      operator: "="
      value: approved
    actions:
      - readonly_fields: [budget, scope, timeline]
  
  # Multiple Conditions (AND)
  - name: high_value_approval
    condition:
      type: and
      conditions:
        - field: amount
          operator: ">"
          value: 10000
        - field: department
          operator: "="
          value: finance
    actions:
      - show_fields: [cfo_approval]
      - mark_required: [cfo_approval]
  
  # Multiple Conditions (OR)
  - name: special_handling
    condition:
      type: or
      conditions:
        - field: priority
          operator: "="
          value: urgent
        - field: vip_customer
          operator: "="
          value: true
    actions:
      - show_section: special_instructions
      - set_field_value:
          field: requires_review
          value: true
```

## 7. Tabs Layout

Organize complex forms into tabs:

```yaml
layout:
  type: tabs
  tabs:
    # Tab 1: Basic Info
    - name: basic
      label: Basic Information
      icon: info
      sections:
        - name: details
          fields:
            - name
            - description
            - status
    
    # Tab 2: Advanced
    - name: advanced
      label: Advanced Settings
      icon: settings
      sections:
        - name: configuration
          fields:
            - priority
            - tags
            - custom_fields
    
    # Tab 3: Related Records
    - name: related
      label: Related Items
      icon: link
      sections:
        - name: tasks
          type: related_list
          object: tasks
          relation: project_id
          
        - name: documents
          type: related_list
          object: documents
          relation: project_id
```

## 8. Wizard Forms

Multi-step forms for complex workflows:

```yaml
name: project_wizard
type: wizard
object: projects

steps:
  # Step 1: Basic Info
  - name: basic
    label: Basic Information
    description: Enter project fundamentals
    fields:
      - name
      - description
      - category
    validation:
      required: [name, category]
    
    # Show only if validation passes
    allow_next: true
  
  # Step 2: Team
  - name: team
    label: Team Assignment
    description: Assign team members
    fields:
      - owner
      - team_members
      - department
    
    # Skip if single-person project
    skip_if:
      field: project_type
      operator: "="
      value: individual
  
  # Step 3: Timeline
  - name: timeline
    label: Timeline & Budget
    description: Set schedule and budget
    fields:
      - start_date
      - end_date
      - budget
      - milestones
  
  # Step 4: Review
  - name: review
    label: Review & Submit
    description: Review all information
    type: summary
    
    # Show summary of all fields
    summary_sections:
      - label: Basic Information
        fields: [name, description, category]
      - label: Team
        fields: [owner, team_members]
      - label: Timeline
        fields: [start_date, end_date, budget]

# Wizard Navigation
wizard_config:
  allow_back: true
  allow_skip: false
  show_progress: true
  save_draft: true
  
  buttons:
    back: Previous
    next: Next
    finish: Create Project
```

## 9. Field Groups

Group related fields visually:

```yaml
layout:
  sections:
    - name: contact
      label: Contact Information
      
      # Field Groups within Section
      field_groups:
        # Primary Contact
        - label: Primary Contact
          columns: 2
          fields:
            - primary_email
            - primary_phone
        
        # Secondary Contact
        - label: Secondary Contact
          columns: 2
          collapsible: true
          collapsed: true
          fields:
            - secondary_email
            - secondary_phone
```

## 10. Inline Editing

Quick edit configuration:

```yaml
name: task_inline_edit
type: inline
object: tasks

# Fields available for inline edit
editable_fields:
  - status
  - priority
  - assignee
  - due_date

# Quick action buttons
quick_actions:
  - label: Complete
    action: update
    values:
      status: completed
      completed_date: $current_date
  
  - label: Reassign
    action: show_field
    field: assignee
```

## 11. Quick Create Form

Minimal form for fast data entry:

```yaml
name: task_quick_create
type: quick_create
object: tasks
label: Quick Add Task

# Minimal required fields
fields:
  - name
  - assignee
  - due_date

# Auto-fill fields
defaults:
  status: open
  priority: medium
  created_by: $current_user

# After creation
after_create:
  action: close  # or 'stay', 'redirect'
  message: Task created successfully
```

## 12. Dynamic Fields

Add/remove field groups dynamically:

```yaml
layout:
  sections:
    - name: contacts
      label: Contact Persons
      type: repeatable
      
      # Field group that can be repeated
      field_group:
        - name
        - email
        - phone
        - role
      
      # Configuration
      min_items: 1
      max_items: 10
      add_button_label: Add Contact
      remove_button_label: Remove
```

## 13. Form Actions

Define available actions on the form:

```yaml
actions:
  # Primary Actions (prominent buttons)
  primary:
    - label: Save
      action: save
      icon: save
      hotkey: Ctrl+S
      
    - label: Save & Close
      action: save_and_close
      icon: save_close
  
  # Secondary Actions (less prominent)
  secondary:
    - label: Save as Draft
      action: save
      values:
        status: draft
      icon: draft
    
    - label: Cancel
      action: cancel
      icon: close
      confirm: Discard changes?
  
  # Custom Actions
  custom:
    - label: Send for Approval
      action: custom
      handler: send_for_approval
      icon: send
      
      # Only show when ready
      visible_when:
        field: status
        operator: "="
        value: ready_for_approval
```

## 14. Form Validation

```yaml
validation:
  # When to validate
  on_change: true        # Validate as user types
  on_blur: true          # Validate when field loses focus
  on_submit: true        # Validate before submit
  
  # How to show errors
  show_errors_inline: true
  show_error_summary: true
  error_summary_position: top
  
  # Validation rules
  rules:
    - fields: [start_date, end_date]
      validator: |
        function validate(values) {
          return values.end_date > values.start_date;
        }
      message: End date must be after start date
```

## 15. Responsive Design

Mobile-optimized layouts:

```yaml
layout:
  # Desktop layout
  desktop:
    columns: 2
    sections: [...]
  
  # Tablet layout
  tablet:
    columns: 1
    compact_sections: true
  
  # Mobile layout
  mobile:
    columns: 1
    stack_fields: true
    hide_labels: false
    
    # Show only essential fields
    visible_fields:
      - name
      - status
      - priority
      - due_date
```

## 16. Field Dependencies

Load field options based on other field values:

```yaml
field_config:
  state:
    type: select
    label: State
  
  city:
    type: select
    label: City
    depends_on: state
    
    # Load cities based on selected state
    options_query:
      object: cities
      filters:
        - field: state
          operator: "="
          value: $state
      fields: [name]
      sort:
        - field: name
          direction: asc
```

## 17. Auto-save

Automatically save form progress:

```yaml
auto_save:
  enabled: true
  interval: 30000  # 30 seconds
  mode: draft      # Save as draft
  
  # Show indicator
  show_indicator: true
  indicator_position: top-right
  
  # Recovery
  enable_recovery: true
  recovery_prompt: You have unsaved changes. Restore?
```

## 18. Form Events & Hooks

Execute logic on form events:

```yaml
events:
  # Before form loads
  on_load: |
    async function onLoad(context) {
      // Pre-populate fields
      if (context.user.department) {
        context.setFieldValue('department', context.user.department);
      }
    }
  
  # When field changes
  on_field_change:
    budget:
      handler: |
        function onChange(value, context) {
          // Auto-calculate tax
          const tax = value * 0.1;
          context.setFieldValue('estimated_tax', tax);
        }
  
  # Before submit
  on_before_submit: |
    async function beforeSubmit(values, context) {
      // Final validation
      if (values.amount > 10000 && !values.approval) {
        context.showError('High-value orders require approval');
        return false;
      }
      return true;
    }
  
  # After successful submit
  on_success: |
    function onSuccess(result, context) {
      context.showMessage('Record saved successfully');
      context.redirect(`/projects/${result.id}`);
    }
  
  # On error
  on_error: |
    function onError(error, context) {
      context.showError(`Failed to save: ${error.message}`);
    }
```

## 19. Form Modes

Different modes for different contexts:

```yaml
modes:
  # Create mode
  create:
    title: New Project
    show_fields: [name, description, owner, start_date]
    defaults:
      status: draft
      created_by: $current_user
  
  # Edit mode
  edit:
    title: Edit Project
    show_fields: [name, description, status, owner, start_date, end_date]
    readonly_fields: [created_by, created_at]
  
  # Clone mode
  clone:
    title: Clone Project
    show_fields: [name, description, owner]
    exclude_fields: [id, created_at, created_by]
    field_overrides:
      name:
        default_value: "Copy of {original_name}"
```

## 20. Implementation Example

```typescript
// src/forms/project.form.yml
import { FormDefinition } from '@objectql/types';

export const project_form: FormDefinition = {
  name: 'project_form',
  type: 'edit',
  object: 'projects',
  layout: {
    columns: 2,
    sections: [
      {
        name: 'basic',
        label: 'Basic Information',
        fields: ['name', 'description', 'status']
      }
    ]
  },
  field_config: {
    status: {
      default_value: 'draft'
    }
  }
};
```

## 21. Best Practices

1. **User Experience**: Group related fields logically
2. **Progressive Disclosure**: Show advanced fields only when needed
3. **Clear Labels**: Use descriptive labels and help text
4. **Validation**: Validate early and provide clear error messages
5. **Performance**: Lazy-load heavy components
6. **Accessibility**: Support keyboard navigation and screen readers
7. **Mobile**: Design for mobile-first
8. **Defaults**: Set sensible default values

## 22. Related Specifications

- [Objects & Fields](./object.md) - Data model
- [Views](./view.md) - Display layouts
- [Validation](./validation.md) - Validation rules
- [Actions](./action.md) - Form actions
