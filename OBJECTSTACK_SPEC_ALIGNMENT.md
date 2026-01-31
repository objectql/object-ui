# ObjectUI Alignment with ObjectStack Spec v0.7.1

## Executive Summary

This document outlines the alignment status between ObjectUI and the ObjectStack Specification v0.7.1, identifies gaps, and provides a comprehensive development plan to achieve full protocol compliance.

**Current Alignment Status: ~80%**

### Key Findings

✅ **Strengths:**
- Core data types and field definitions match well
- Query basics (select, filter, sort, pagination) are aligned
- View architecture (grid, kanban, calendar) matches spec patterns
- Data adapter is functional with ObjectStack client v0.7.1

❌ **Critical Gaps:**
- Window functions (row_number, rank, lag, lead) not implemented
- Comprehensive validation framework (9 validation types) missing
- Action schema significantly simpler than spec
- Async validation support missing

⚠️ **Minor Gaps:**
- Missing aggregation functions: count_distinct, array_agg, string_agg
- Missing view types: spreadsheet, gallery, timeline
- App-level permission declarations missing
- Join execution strategy hints not implemented

---

## Detailed Analysis

### 1. Data Protocol Comparison

#### 1.1 Field Types ✅ **ALIGNED**

| Category | ObjectUI | ObjectStack Spec | Status |
|----------|----------|------------------|--------|
| Basic Fields | text, textarea, number, boolean, date | ✅ Match | Perfect |
| Advanced Fields | lookup, master_detail, formula, summary | ✅ Match | Perfect |
| UI Fields | color, signature, qrcode, rating, slider | ✅ Match | Perfect |
| Enterprise Fields | vector (embeddings), grid (sub-tables) | ✅ ObjectUI Extension | OK (spec supports in v0.7.1) |

**Conclusion:** Field type coverage is excellent. ObjectUI's extensions (vector, grid) are now supported in spec v0.7.1.

---

#### 1.2 Query Schema ⚠️ **PARTIAL**

##### Supported Features ✅

| Feature | ObjectUI | Spec | Implementation |
|---------|----------|------|----------------|
| SELECT fields | ✅ `fields: string[]` | ✅ `fields: string[]` | packages/types/src/data-protocol.ts |
| WHERE filtering | ✅ FilterSchema | ✅ FilterCondition | packages/types/src/data-protocol.ts |
| ORDER BY | ✅ `sort: SortField[]` | ✅ `orderBy: SortNode[]` | packages/types/src/data-protocol.ts |
| Pagination | ✅ limit, offset | ✅ limit, offset | packages/types/src/data-protocol.ts |
| JOIN | ✅ inner/left/right/full | ✅ inner/left/right/full | packages/types/src/data-protocol.ts |
| GROUP BY | ✅ `group_by: string[]` | ✅ `groupBy: string[]` | packages/types/src/data-protocol.ts |
| Basic Aggregations | ✅ count, sum, avg, min, max | ✅ + count_distinct, array_agg, string_agg | **GAP: Missing 3 functions** |

##### Missing Features ❌

1. **Window Functions** (CRITICAL GAP)
   ```typescript
   // Spec v0.7.1 supports:
   type WindowFunction = 
     | 'row_number' | 'rank' | 'dense_rank' | 'percent_rank'
     | 'lag' | 'lead' | 'first_value' | 'last_value'
     | 'sum' | 'avg' | 'count' | 'min' | 'max';
   
   interface WindowNode {
     function: WindowFunction;
     field?: string;
     alias: string;
     partitionBy?: string[];
     orderBy?: SortNode[];
     frame?: WindowFrame;
   }
   ```
   **Impact:** Cannot build analytical queries like rankings, running totals, moving averages.

2. **Join Execution Strategies** (MINOR GAP)
   ```typescript
   // Spec supports strategy hints:
   type JoinStrategy = 'auto' | 'database' | 'hash' | 'loop';
   
   interface JoinNode {
     type: 'inner' | 'left' | 'right' | 'full';
     object: string;
     on: FilterCondition;
     strategy?: JoinStrategy; // ObjectUI missing
   }
   ```
   **Impact:** Query optimizer cannot receive hints for cross-datasource joins.

3. **Enhanced Aggregations** (MINOR GAP)
   - `count_distinct`: Count unique values
   - `array_agg`: Aggregate into array
   - `string_agg`: Concatenate strings
   
   **Impact:** Limited analytical capabilities, workarounds needed.

---

#### 1.3 Filter Schema ✅ **WELL ALIGNED**

ObjectUI filter operators are a **superset** of the spec:

**Spec Base Operators:**
- Equality: `$eq`, `$ne`
- Comparison: `$gt`, `$gte`, `$lt`, `$lte`
- Set: `$in`, `$nin`, `$between`
- String: `$contains`, `$startsWith`, `$endsWith`
- Null: `$null`, `$exist`
- Logical: `$and`, `$or`, `$not`

**ObjectUI Extensions:**
- Date-specific: `date_equals`, `date_after`, `date_before`, `date_this_week`, etc.
- Search: `full_text_search`, `fuzzy_search`
- Lookup: `lookup_in`, `lookup_not_in`

**Recommendation:** ✅ Keep extensions, maintain backward compatibility.

---

#### 1.4 Validation Schema ❌ **MAJOR GAP**

| Validation Type | ObjectUI | Spec v0.7.1 | Priority |
|----------------|----------|-------------|----------|
| **Script/Formula** | Basic expression validation | ✅ ScriptValidationSchema | **HIGH** |
| **Uniqueness** | Field-level unique flag | ✅ UniquenessValidationSchema (multi-field, scope, case-sensitive) | **HIGH** |
| **State Machine** | ❌ Not implemented | ✅ StateMachineValidationSchema | MEDIUM |
| **Format** | Basic pattern matching | ✅ FormatValidationSchema (regex, predefined patterns) | MEDIUM |
| **Cross-Field** | ❌ Limited | ✅ CrossFieldValidationSchema | **HIGH** |
| **JSON Schema** | ❌ Not implemented | ✅ JSONSchemaValidationSchema | MEDIUM |
| **Async/Remote** | ❌ Not implemented | ✅ AsyncValidationSchema | **HIGH** |
| **Custom** | ✅ Custom functions | ✅ CustomValidationSchema | OK |
| **Conditional** | ❌ Not implemented | ✅ ConditionalValidationSchema | MEDIUM |

**Current ObjectUI Implementation:**
```typescript
// packages/types/src/field-types.ts
interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message?: string;
}
```

**Spec v0.7.1 Implementation:**
```typescript
// @objectstack/spec/data/validation.zod.ts
type ValidationRule = 
  | ScriptValidation
  | UniquenessValidation
  | StateMachineValidation
  | FormatValidation
  | CrossFieldValidation
  | JSONSchemaValidation
  | AsyncValidation
  | CustomValidation
  | ConditionalValidation;

interface BaseValidation {
  name: string;
  label?: string;
  description?: string;
  active: boolean;
  events: ('insert' | 'update' | 'delete')[];
  severity: 'error' | 'warning' | 'info';
  message: string;
  tags?: string[];
}
```

**Impact:**
- ❌ Cannot implement enterprise validation patterns (state machines, async validations)
- ❌ Cannot validate across multiple fields with dependencies
- ❌ Cannot use remote validation endpoints
- ❌ Missing severity levels (error/warning/info)
- ❌ Missing event lifecycle hooks (insert/update/delete)

---

### 2. UI Protocol Comparison

#### 2.1 View Schema ✅ **WELL ALIGNED**

| View Type | ObjectUI | Spec v0.7.1 | Status |
|-----------|----------|-------------|--------|
| Grid | ✅ ObjectGridSchema | ✅ ViewSchema (type: 'grid') | Perfect |
| Kanban | ✅ ObjectKanbanSchema | ✅ ViewSchema (type: 'kanban') | Perfect |
| Calendar | ✅ ObjectCalendarSchema | ✅ ViewSchema (type: 'calendar') | Perfect |
| Gantt | ✅ ObjectGanttSchema | ✅ ViewSchema (type: 'gantt') | Perfect |
| Map | ✅ ObjectMapSchema | ✅ ViewSchema (type: 'map') | Perfect |
| Form | ✅ ObjectFormSchema | ❌ Not in spec | OK (ObjectUI extension) |
| Chart | ✅ ObjectChartSchema | ✅ ChartSchema | Perfect |
| Spreadsheet | ❌ Missing | ✅ ViewSchema (type: 'spreadsheet') | **GAP** |
| Gallery | ❌ Missing | ✅ ViewSchema (type: 'gallery') | **GAP** |
| Timeline | ❌ Missing | ✅ ViewSchema (type: 'timeline') | **GAP** |

**View Data Source:** ✅ Perfect alignment
```typescript
type ViewData = 
  | { provider: 'object'; object: string }
  | { provider: 'api'; read?: HttpRequest; write?: HttpRequest }
  | { provider: 'value'; items: unknown[] };
```

**Recommendation:** Add missing view types (spreadsheet, gallery, timeline) as plugins.

---

#### 2.2 App Schema ⚠️ **MINOR GAPS**

| Property | ObjectUI | Spec v0.7.1 | Gap |
|----------|----------|-------------|-----|
| name, label, icon | ✅ | ✅ | - |
| branding | ✅ | ✅ | - |
| navigation | ✅ MenuItem[] | ✅ NavigationItem[] | - |
| homePageId | ❌ Implicit | ✅ Explicit string | **GAP** |
| requiredPermissions | ❌ Missing | ✅ string[] | **GAP** |
| active, isDefault | ✅ | ✅ | - |

**Impact:** Cannot declare app-level permission requirements in metadata.

---

#### 2.3 Action Schema ❌ **SIGNIFICANT GAP**

**ObjectUI Current Implementation:**
```typescript
// packages/types/src/app.ts
interface AppAction {
  type: 'button' | 'dropdown' | 'user';
  label?: string;
  icon?: string;
  onClick?: string;
  items?: AppAction[]; // For dropdown
  shortcut?: string;
  variant?: string;
  size?: string;
}
```

**Spec v0.7.1 Implementation:**
```typescript
// @objectstack/spec/ui/action.zod.ts
interface ActionSchema {
  name: string; // snake_case identifier
  label: string;
  icon?: string;
  
  // Where to show the action
  locations?: Array<
    | 'list_toolbar'      // Grid toolbar (bulk actions)
    | 'list_item'         // Row-level actions
    | 'record_header'     // Detail page header
    | 'record_more'       // Detail "More" menu
    | 'record_related'    // Related lists
    | 'global_nav'        // Top navigation
  >;
  
  // Visual representation
  component?: 'action:button' | 'action:icon' | 'action:menu' | 'action:group';
  
  // Behavior
  type: 'script' | 'url' | 'modal' | 'flow' | 'api';
  target?: string;
  execute?: string;
  
  // User inputs
  params?: ActionParam[];
  
  // Feedback
  confirmText?: string;
  successMessage?: string;
  refreshAfter?: boolean;
  
  // Conditional visibility
  visible?: string; // Expression
}

interface ActionParam {
  name: string;
  label: string;
  type: FieldType; // Full field type support (40+ types)
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}
```

**Critical Missing Features:**
1. ❌ **locations**: Cannot specify where action appears (toolbar vs row vs header)
2. ❌ **params**: No structured parameter collection before execution
3. ❌ **confirmText**: No built-in confirmation dialogs
4. ❌ **successMessage**: No automatic success feedback
5. ❌ **refreshAfter**: No automatic data refresh
6. ❌ **visible**: No conditional visibility expressions

**Impact:**
- Cannot build declarative action buttons with parameter collection
- Must manually implement confirmation dialogs
- Must manually handle refresh logic
- Cannot conditionally show/hide actions based on data

---

### 3. System Protocol Comparison

#### 3.1 Plugin Schema ✅ **ALIGNED**

ObjectUI's plugin system matches spec patterns:
- ✅ Plugin manifest with capabilities
- ✅ Lifecycle hooks (load, enable, disable)
- ✅ Dependency declarations
- ✅ Version management

**Location:** `packages/types/src/plugin-scope.ts`

---

#### 3.2 Auth & Permissions ⚠️ **PARTIAL**

| Feature | ObjectUI | Spec | Status |
|---------|----------|------|--------|
| Field-level permissions | ✅ | ✅ | OK |
| Object-level permissions | ✅ | ✅ | OK |
| App-level permissions | ❌ | ✅ | **GAP** |
| Role-based access | ⚠️ Partial | ✅ | **GAP** |
| Record-level security | ⚠️ Partial | ✅ | **GAP** |

---

## Development Plan

### Priority Matrix

| Priority | Task | Impact | Effort | Packages Affected |
|----------|------|--------|--------|-------------------|
| **P0** | Window Functions | Enterprise Analytics | High | types, core |
| **P0** | Validation Framework | Data Integrity | High | types, core, react |
| **P0** | Action Schema Enhancement | User Experience | Medium | types, react, components |
| **P1** | Async Validation | Remote Validation | Medium | core, react |
| **P1** | Enhanced Aggregations | Analytics | Low | types, core |
| **P2** | View Types (spreadsheet, gallery, timeline) | UI Completeness | Medium | types, plugins |
| **P2** | App Permissions | Security | Low | types, react |
| **P3** | Join Strategies | Performance | Low | types, core |

---

### Phase 1: Critical Gaps (Weeks 1-2)

#### Task 1.1: Window Functions Support
**Files to modify:**
- `packages/types/src/data-protocol.ts`
- `packages/core/src/query/query-ast.ts`

**Implementation:**
```typescript
// Add to data-protocol.ts
export type WindowFunction = 
  | 'row_number' | 'rank' | 'dense_rank' | 'percent_rank'
  | 'lag' | 'lead' | 'first_value' | 'last_value'
  | 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface WindowFrame {
  type: 'rows' | 'range' | 'groups';
  start: { type: 'unbounded' | 'current' | 'offset'; offset?: number };
  end?: { type: 'unbounded' | 'current' | 'offset'; offset?: number };
}

export interface WindowNode {
  function: WindowFunction;
  field?: string;
  alias: string;
  partitionBy?: string[];
  orderBy?: SortField[];
  frame?: WindowFrame;
}

export interface QuerySchema {
  // ... existing fields
  windows?: WindowNode[];
}
```

**Tests:**
```typescript
// packages/core/src/query/__tests__/window-functions.test.ts
describe('Window Functions', () => {
  it('should build row_number window', () => {
    const query: QuerySchema = {
      object: 'orders',
      fields: ['customer_id', 'amount', 'order_date'],
      windows: [{
        function: 'row_number',
        alias: 'row_num',
        partitionBy: ['customer_id'],
        orderBy: [{ field: 'amount', order: 'desc' }]
      }]
    };
    // Test AST builder
  });
});
```

---

#### Task 1.2: Comprehensive Validation Framework
**Files to modify:**
- `packages/types/src/data-protocol.ts`
- `packages/core/src/validation/validation-engine.ts`
- `packages/core/src/validation/validators/` (new directory)

**Implementation:**
```typescript
// Add to data-protocol.ts
export interface BaseValidation {
  name: string;
  label?: string;
  description?: string;
  active: boolean;
  events: Array<'insert' | 'update' | 'delete'>;
  severity: 'error' | 'warning' | 'info';
  message: string;
  tags?: string[];
}

export interface ScriptValidation extends BaseValidation {
  type: 'script';
  condition: string; // Expression
}

export interface UniquenessValidation extends BaseValidation {
  type: 'unique';
  fields: string[];
  scope?: string; // Expression for scoping (e.g., "tenant_id")
  caseSensitive?: boolean;
}

export interface StateMachineValidation extends BaseValidation {
  type: 'state_machine';
  stateField: string;
  transitions: Array<{
    from: string | string[];
    to: string;
    condition?: string;
  }>;
}

export interface CrossFieldValidation extends BaseValidation {
  type: 'cross_field';
  fields: string[];
  condition: string;
}

export interface AsyncValidation extends BaseValidation {
  type: 'async';
  endpoint: string;
  method?: 'GET' | 'POST';
  debounce?: number;
  cache?: { enabled: boolean; ttl?: number };
}

export interface ConditionalValidation extends BaseValidation {
  type: 'conditional';
  condition: string; // When to apply
  rules: ValidationRule[]; // Nested rules
}

export type ValidationRule = 
  | ScriptValidation
  | UniquenessValidation
  | StateMachineValidation
  | CrossFieldValidation
  | AsyncValidation
  | ConditionalValidation;

export interface ObjectSchemaMetadata {
  // ... existing fields
  validations?: ValidationRule[];
}
```

**Tests:**
```typescript
// packages/core/src/validation/__tests__/validation-types.test.ts
describe('Validation Framework', () => {
  describe('UniquenessValidation', () => {
    it('should validate multi-field uniqueness', async () => {
      const validation: UniquenessValidation = {
        name: 'unique_email_per_tenant',
        type: 'unique',
        fields: ['email', 'tenant_id'],
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Email must be unique within tenant'
      };
      // Test implementation
    });
  });

  describe('AsyncValidation', () => {
    it('should call remote endpoint', async () => {
      const validation: AsyncValidation = {
        name: 'check_username_available',
        type: 'async',
        endpoint: '/api/validate/username',
        method: 'POST',
        debounce: 300,
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Username is already taken'
      };
      // Test with mock endpoint
    });
  });
});
```

---

#### Task 1.3: Action Schema Enhancement
**Files to modify:**
- `packages/types/src/base.ts` (rename ActionSchema to LegacyActionSchema)
- `packages/types/src/ui-action.ts` (new file)
- `packages/react/src/components/actions/ActionButton.tsx`

**Implementation:**
```typescript
// packages/types/src/ui-action.ts
export type ActionLocation = 
  | 'list_toolbar'
  | 'list_item'
  | 'record_header'
  | 'record_more'
  | 'record_related'
  | 'global_nav';

export type ActionComponent = 
  | 'action:button'
  | 'action:icon'
  | 'action:menu'
  | 'action:group';

export type ActionType = 
  | 'script'
  | 'url'
  | 'modal'
  | 'flow'
  | 'api';

export interface ActionParam {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
}

export interface ActionSchema {
  /** snake_case identifier */
  name: string;
  label: string;
  icon?: string;
  
  /** Where to show */
  locations?: ActionLocation[];
  
  /** Visual type */
  component?: ActionComponent;
  
  /** Behavior */
  type: ActionType;
  target?: string;
  execute?: string;
  
  /** Input parameters */
  params?: ActionParam[];
  
  /** Feedback */
  confirmText?: string;
  successMessage?: string;
  errorMessage?: string;
  refreshAfter?: boolean;
  
  /** Conditional */
  visible?: string; // Expression
  enabled?: string; // Expression
  
  /** Styling */
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}
```

**React Component:**
```typescript
// packages/react/src/components/actions/ActionButton.tsx
export function ActionButton({ 
  action, 
  context, 
  onExecute 
}: ActionButtonProps) {
  const [showParams, setShowParams] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleClick = async () => {
    // 1. Check visible condition
    if (action.visible && !evaluateExpression(action.visible, context)) {
      return;
    }
    
    // 2. Show confirmation if needed
    if (action.confirmText && !await confirm(action.confirmText)) {
      return;
    }
    
    // 3. Collect parameters if needed
    let params = {};
    if (action.params?.length) {
      params = await collectParams(action.params);
    }
    
    // 4. Execute action
    setLoading(true);
    try {
      await onExecute(action, params);
      
      // 5. Show success message
      if (action.successMessage) {
        toast.success(action.successMessage);
      }
      
      // 6. Refresh if needed
      if (action.refreshAfter) {
        // Trigger data refresh
      }
    } catch (error) {
      toast.error(action.errorMessage || 'Action failed');
    } finally {
      setLoading(false);
    }
  };
  
  return <Button onClick={handleClick} loading={loading} />;
}
```

---

### Phase 2: High Priority (Weeks 3-4)

#### Task 2.1: Enhanced Aggregation Functions
**Files:**
- `packages/types/src/data-protocol.ts`
- `packages/core/src/query/query-ast.ts`

**Changes:**
```typescript
export type AggregationFunction = 
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count_distinct'  // NEW
  | 'array_agg'       // NEW
  | 'string_agg';     // NEW

export interface AggregationConfig {
  function: AggregationFunction;
  field?: string;
  alias: string;
  distinct?: boolean;
  separator?: string; // For string_agg
}
```

---

#### Task 2.2: App-Level Permissions
**Files:**
- `packages/types/src/app.ts`

**Changes:**
```typescript
export interface AppSchema {
  // ... existing fields
  homePageId?: string;
  requiredPermissions?: string[];
}
```

---

### Phase 3: Medium Priority (Weeks 5-6)

#### Task 3.1: Missing View Types
**New Packages:**
- `packages/plugin-spreadsheet/`
- `packages/plugin-gallery/`
- `packages/plugin-timeline/`

**Implementation:** Follow existing plugin patterns (plugin-grid, plugin-kanban)

---

#### Task 3.2: Join Execution Strategies
**Files:**
- `packages/types/src/data-protocol.ts`

**Changes:**
```typescript
export type JoinStrategy = 'auto' | 'database' | 'hash' | 'loop';

export interface JoinConfig {
  // ... existing fields
  strategy?: JoinStrategy;
}
```

---

## Testing Strategy

### Unit Tests
- [ ] Window function AST building
- [ ] All 9 validation types
- [ ] Action parameter collection
- [ ] Aggregation functions (count_distinct, array_agg, string_agg)

### Integration Tests
- [ ] ValidationEngine with ObjectStack backend
- [ ] Action execution with parameter collection
- [ ] Window functions in actual queries

### E2E Tests
- [ ] Full CRUD with validation
- [ ] Action flows with confirmations
- [ ] Window functions in reports

---

## Migration Guide

### For Existing Users

#### Actions
```typescript
// OLD (v0.3.x)
const action: AppAction = {
  type: 'button',
  label: 'Approve',
  onClick: 'approveRecord'
};

// NEW (v0.4.x)
const action: ActionSchema = {
  name: 'approve_record',
  label: 'Approve',
  type: 'script',
  execute: 'approveRecord',
  locations: ['record_header'],
  confirmText: 'Are you sure?',
  successMessage: 'Record approved',
  refreshAfter: true
};
```

#### Validation
```typescript
// OLD (Field-level only)
const field: FieldMetadata = {
  name: 'email',
  type: 'email',
  required: true,
  unique: true
};

// NEW (Object-level validation rules)
const object: ObjectSchemaMetadata = {
  fields: {
    email: { name: 'email', type: 'email' }
  },
  validations: [
    {
      name: 'email_required',
      type: 'script',
      condition: 'email != null && email.length > 0',
      message: 'Email is required',
      events: ['insert', 'update'],
      severity: 'error'
    },
    {
      name: 'unique_email',
      type: 'unique',
      fields: ['email'],
      message: 'Email must be unique',
      events: ['insert', 'update'],
      severity: 'error'
    }
  ]
};
```

---

## Version Compatibility

| ObjectUI Version | ObjectStack Spec | Status |
|------------------|------------------|--------|
| v0.3.x | v0.7.1 | ⚠️ Partial (80%) |
| v0.4.x (Target) | v0.7.1 | ✅ Full (95%+) |

---

## Success Metrics

After full alignment:
- ✅ 100% type compatibility with @objectstack/spec v0.7.1
- ✅ All 9 validation types supported
- ✅ Window functions for analytics
- ✅ Declarative action system with parameters
- ✅ Enhanced aggregation functions
- ✅ Missing view types (spreadsheet, gallery, timeline)
- ✅ 90%+ test coverage for new features

---

## References

- ObjectStack Spec: https://www.npmjs.com/package/@objectstack/spec
- ObjectStack Client: https://www.npmjs.com/package/@objectstack/client
- ObjectUI Repository: https://github.com/objectstack-ai/objectui
- Phase 3 Implementation: [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md)

---

**Last Updated:** 2026-01-31  
**Status:** Ready for Implementation  
**Estimated Completion:** 6 weeks
