/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Data Protocol Advanced Types
 * 
 * Phase 3: Complete implementation of QuerySchema, FilterSchema, 
 * ValidationSchema, DriverInterface, and DatasourceSchema.
 * 
 * @module data-protocol
 * @packageDocumentation
 */

// Import existing base types to avoid duplication
import type { SortConfig as BaseSortConfig } from './objectql';
import type { FilterOperator as BaseFilterOperator } from './complex';

/**
 * =============================================================================
 * Phase 3.3: QuerySchema AST Implementation
 * =============================================================================
 */

/**
 * Query AST Node Types
 */
export type QueryASTNodeType =
  | 'select'
  | 'from'
  | 'where'
  | 'join'
  | 'group_by'
  | 'order_by'
  | 'limit'
  | 'offset'
  | 'subquery'
  | 'aggregate'
  | 'window'
  | 'field'
  | 'literal'
  | 'operator'
  | 'function';

/**
 * Base Query AST Node
 */
export interface QueryASTNode {
  type: QueryASTNodeType;
  [key: string]: any;
}

/**
 * SELECT clause node
 */
export interface SelectNode extends QueryASTNode {
  type: 'select';
  fields: (FieldNode | AggregateNode | WindowNode)[];
  distinct?: boolean;
}

/**
 * FROM clause node
 */
export interface FromNode extends QueryASTNode {
  type: 'from';
  table: string;
  alias?: string;
}

/**
 * WHERE clause node
 */
export interface WhereNode extends QueryASTNode {
  type: 'where';
  condition: OperatorNode;
}

/**
 * Join execution strategy hint (ObjectStack Spec v2.0.1)
 */
export type JoinStrategy = 'auto' | 'database' | 'hash' | 'loop';

/**
 * JOIN clause node (Phase 3.3.4)
 */
export interface JoinNode extends QueryASTNode {
  type: 'join';
  join_type: 'inner' | 'left' | 'right' | 'full' | 'cross';
  table: string;
  alias?: string;
  on: OperatorNode;
  strategy?: JoinStrategy; // Execution strategy hint for cross-datasource joins
}

/**
 * GROUP BY clause node
 */
export interface GroupByNode extends QueryASTNode {
  type: 'group_by';
  fields: FieldNode[];
  having?: OperatorNode;
}

/**
 * ORDER BY clause node
 */
export interface OrderByNode extends QueryASTNode {
  type: 'order_by';
  fields: Array<{
    field: FieldNode;
    direction: 'asc' | 'desc';
  }>;
}

/**
 * LIMIT clause node
 */
export interface LimitNode extends QueryASTNode {
  type: 'limit';
  value: number;
}

/**
 * OFFSET clause node
 */
export interface OffsetNode extends QueryASTNode {
  type: 'offset';
  value: number;
}

/**
 * Subquery node (Phase 3.3.3)
 */
export interface SubqueryNode extends QueryASTNode {
  type: 'subquery';
  query: QueryAST;
  alias?: string;
}

/**
 * Aggregate function node (Phase 3.3.5)
 */
export interface AggregateNode extends QueryASTNode {
  type: 'aggregate';
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last' | 'count_distinct' | 'array_agg' | 'string_agg';
  field?: FieldNode;
  alias?: string;
  distinct?: boolean;
  separator?: string; // For string_agg function
}

/**
 * Window function type (ObjectStack Spec v2.0.1)
 */
export type WindowFunction = 
  | 'row_number'
  | 'rank'
  | 'dense_rank'
  | 'percent_rank'
  | 'lag'
  | 'lead'
  | 'first_value'
  | 'last_value'
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max';

/**
 * Window frame unit (ObjectStack Spec v2.0.1)
 */
export type WindowFrameUnit = 'rows' | 'range';

/**
 * Window frame boundary (ObjectStack Spec v2.0.1)
 */
export type WindowFrameBoundary = 
  | 'unbounded_preceding'
  | 'unbounded_following'
  | 'current_row'
  | { type: 'preceding'; offset: number }
  | { type: 'following'; offset: number };

/**
 * Window frame specification (ObjectStack Spec v2.0.1)
 */
export interface WindowFrame {
  unit: WindowFrameUnit;
  start: WindowFrameBoundary;
  end?: WindowFrameBoundary; // Defaults to CURRENT ROW if not specified
}

/**
 * Window function node (ObjectStack Spec v2.0.1)
 */
export interface WindowNode extends QueryASTNode {
  type: 'window';
  function: WindowFunction;
  field?: FieldNode; // For aggregate window functions
  alias: string;
  partitionBy?: FieldNode[];
  orderBy?: Array<{
    field: FieldNode;
    direction: 'asc' | 'desc';
  }>;
  frame?: WindowFrame;
  
  // For LAG/LEAD functions
  offset?: number;
  defaultValue?: LiteralNode;
}

/**
 * Field reference node
 */
export interface FieldNode extends QueryASTNode {
  type: 'field';
  table?: string;
  name: string;
  alias?: string;
}

/**
 * Literal value node
 */
export interface LiteralNode extends QueryASTNode {
  type: 'literal';
  value: any;
  data_type?: 'string' | 'number' | 'boolean' | 'date' | 'null';
}

/**
 * Operator node
 */
export interface OperatorNode extends QueryASTNode {
  type: 'operator';
  operator: ComparisonOperator | LogicalOperator;
  operands: (FieldNode | LiteralNode | OperatorNode | FunctionNode)[];
}

/**
 * Function call node
 */
export interface FunctionNode extends QueryASTNode {
  type: 'function';
  name: string;
  arguments: (FieldNode | LiteralNode | FunctionNode)[];
  alias?: string;
}

/**
 * Comparison operators
 */
export type ComparisonOperator =
  | '='
  | '!='
  | '<>'
  | '>'
  | '>='
  | '<'
  | '<='
  | 'like'
  | 'ilike'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'between'
  | 'contains'
  | 'starts_with'
  | 'ends_with';

/**
 * Logical operators
 */
export type LogicalOperator = 'and' | 'or' | 'not';

/**
 * Complete Query AST (Phase 3.3.1)
 */
export interface QueryAST {
  select: SelectNode;
  from: FromNode;
  joins?: JoinNode[];
  where?: WhereNode;
  group_by?: GroupByNode;
  order_by?: OrderByNode;
  limit?: LimitNode;
  offset?: OffsetNode;
}

/**
 * Query Schema - High-level query configuration
 */
export interface QuerySchema {
  /**
   * Target object/table
   */
  object: string;
  
  /**
   * Fields to select
   */
  fields?: string[];
  
  /**
   * Filter conditions
   */
  filter?: AdvancedFilterSchema;
  
  /**
   * Sort configuration
   */
  sort?: QuerySortConfig[];
  
  /**
   * Pagination
   */
  limit?: number;
  offset?: number;
  
  /**
   * Joins (Phase 3.3.4)
   */
  joins?: JoinConfig[];
  
  /**
   * Aggregations (Phase 3.3.5)
   */
  aggregations?: AggregationConfig[];
  
  /**
   * Group by fields
   */
  group_by?: string[];
  
  /**
   * Window functions (ObjectStack Spec v2.0.1)
   */
  windows?: WindowConfig[];
  
  /**
   * Related objects to expand
   */
  expand?: string[];
  
  /**
   * Full-text search
   */
  search?: string;
}

/**
 * Sort configuration (extends base SortConfig)
 */
export interface QuerySortConfig extends BaseSortConfig {
  nulls?: 'first' | 'last';
}

/**
 * Join configuration
 */
export interface JoinConfig {
  type: 'inner' | 'left' | 'right' | 'full';
  object: string;
  on: {
    local_field: string;
    foreign_field: string;
  };
  alias?: string;
}

/**
 * Aggregation configuration
 */
export interface AggregationConfig {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct' | 'array_agg' | 'string_agg';
  field?: string;
  alias?: string;
  distinct?: boolean;
  separator?: string; // For string_agg function
}

/**
 * Window function configuration (ObjectStack Spec v2.0.1)
 */
export interface WindowConfig {
  /** Window function name */
  function: WindowFunction;
  
  /** Field to operate on (not required for row_number, rank, etc.) */
  field?: string;
  
  /** Result alias */
  alias: string;
  
  /** PARTITION BY fields */
  partitionBy?: string[];
  
  /** ORDER BY clause */
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  
  /** Window frame specification */
  frame?: WindowFrame;
  
  /** Offset for lag/lead functions */
  offset?: number;
  
  /** Default value for lag/lead when no previous/next row */
  defaultValue?: any;
}

/**
 * =============================================================================
 * Phase 3.4: FilterSchema - Advanced Filtering
 * =============================================================================
 */

/**
 * Filter Schema - Complex filtering support (extends base)
 */
export interface AdvancedFilterSchema {
  /**
   * Logical operator for combining conditions
   */
  operator?: 'and' | 'or' | 'not';
  
  /**
   * Filter conditions
   */
  conditions?: AdvancedFilterCondition[];
  
  /**
   * Nested filter groups
   */
  groups?: AdvancedFilterSchema[];
}

/**
 * Individual filter condition (extends base)
 */
export interface AdvancedFilterCondition {
  /**
   * Field to filter on
   */
  field: string;
  
  /**
   * Comparison operator (extended)
   */
  operator: AdvancedFilterOperator;
  
  /**
   * Value to compare against
   */
  value?: any;
  
  /**
   * For BETWEEN and IN operators
   */
  values?: any[];
  
  /**
   * Case sensitivity for string comparisons
   */
  case_sensitive?: boolean;
}

/**
 * Filter operators (Phase 3.4.1-3.4.4) - Extended from base
 */
export type AdvancedFilterOperator =
  | BaseFilterOperator
  // Additional operators
  | 'like'
  | 'ilike'
  | 'is_null'
  | 'is_not_null'
  | 'between'
  | 'not_between'
  // Date-specific (Phase 3.4.2)
  | 'date_equals'
  | 'date_after'
  | 'date_before'
  | 'date_in_range'
  | 'date_today'
  | 'date_yesterday'
  | 'date_tomorrow'
  | 'date_this_week'
  | 'date_last_week'
  | 'date_next_week'
  | 'date_this_month'
  | 'date_last_month'
  | 'date_next_month'
  | 'date_this_year'
  | 'date_last_year'
  | 'date_next_year'
  // Lookup field filters (Phase 3.4.3)
  | 'lookup_equals'
  | 'lookup_contains'
  | 'lookup_starts_with'
  // Full-text search (Phase 3.4.4)
  | 'search'
  | 'search_phrase'
  | 'search_proximity';

/**
 * Date range filter (Phase 3.4.2)
 */
export interface DateRangeFilter {
  start?: Date | string;
  end?: Date | string;
  preset?: DateRangePreset;
}

/**
 * Date range presets
 */
export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'this_week'
  | 'last_week'
  | 'next_week'
  | 'this_month'
  | 'last_month'
  | 'next_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'next_quarter'
  | 'this_year'
  | 'last_year'
  | 'next_year'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'next_7_days'
  | 'next_30_days'
  | 'next_90_days';

/**
 * Filter builder configuration (Phase 3.4.5)
 */
export interface FilterBuilderConfig {
  /**
   * Available fields for filtering
   */
  fields: FilterFieldConfig[];
  
  /**
   * Default operator
   */
  default_operator?: 'and' | 'or';
  
  /**
   * Allow nested groups
   */
  allow_groups?: boolean;
  
  /**
   * Maximum nesting depth
   */
  max_depth?: number;
}

/**
 * Filter field configuration
 */
export interface FilterFieldConfig {
  /**
   * Field name
   */
  name: string;
  
  /**
   * Display label
   */
  label: string;
  
  /**
   * Field type
   */
  type: string;
  
  /**
   * Available operators for this field
   */
  operators?: AdvancedFilterOperator[];
  
  /**
   * Options for select fields
   */
  options?: Array<{ label: string; value: any }>;
}

/**
 * =============================================================================
 * Phase 3.5: ValidationSchema - Complete Validation Engine
 * =============================================================================
 */

/**
 * Validation Schema (Phase 3.5)
 */
export interface AdvancedValidationSchema {
  /**
   * Field name to validate
   */
  field?: string;
  
  /**
   * Validation rules
   */
  rules: AdvancedValidationRule[];
  
  /**
   * Custom error messages
   */
  messages?: Record<string, string>;
  
  /**
   * Validation triggers
   */
  on?: ('blur' | 'change' | 'submit')[];
  
  /**
   * Whether validation is async
   */
  async?: boolean;
  
  /**
   * Debounce time for async validation (ms)
   */
  debounce?: number;
}

/**
 * Validation rule (Phase 3.5.1-3.5.4) - Extended
 */
export interface AdvancedValidationRule {
  /**
   * Rule type
   */
  type: ValidationRuleType;
  
  /**
   * Rule parameters
   */
  params?: any;
  
  /**
   * Error message
   */
  message?: string;
  
  /**
   * Custom validation function (Phase 3.5.2)
   */
  validator?: ValidationFunction;
  
  /**
   * Async validation function (Phase 3.5.3)
   */
  async_validator?: AsyncValidationFunction;
  
  /**
   * Cross-field dependencies (Phase 3.5.4)
   */
  depends_on?: string[];
  
  /**
   * Validation severity
   */
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Validation rule types
 */
export type ValidationRuleType =
  // Required
  | 'required'
  // String validations
  | 'min_length'
  | 'max_length'
  | 'pattern'
  | 'email'
  | 'url'
  | 'phone'
  // Number validations
  | 'min'
  | 'max'
  | 'integer'
  | 'positive'
  | 'negative'
  // Date validations
  | 'date_min'
  | 'date_max'
  | 'date_range'
  | 'date_future'
  | 'date_past'
  // Array validations
  | 'min_items'
  | 'max_items'
  | 'unique_items'
  // Object validations
  | 'object_schema'
  // Cross-field validations (Phase 3.5.4)
  | 'field_match'
  | 'field_compare'
  | 'conditional'
  // Custom validations (Phase 3.5.2)
  | 'custom'
  // Async validations (Phase 3.5.3)
  | 'async_custom'
  | 'remote_validation'
  | 'unique_check'
  | 'exists_check';

/**
 * Validation function signature used by AdvancedValidationRule in the data protocol.
 *
 * This type is defined in this module and may differ from similarly named
 * validation function types in other packages (e.g., in `field-types`).
 * 
 * @param value - The value to validate
 * @param context - Optional validation context with access to other field values
 * @returns true if valid, false or error message string if invalid
 */
export type ValidationFunction = (value: any, context?: ValidationContext) => boolean | string;

/**
 * Async validation function (Phase 3.5.3)
 */
export type AsyncValidationFunction = (
  value: any,
  context?: ValidationContext
) => Promise<boolean | string>;

/**
 * Validation context (Phase 3.5.4)
 */
export interface ValidationContext {
  /**
   * All form values
   */
  values?: Record<string, any>;
  
  /**
   * Field metadata
   */
  field?: any;
  
  /**
   * Parent object data
   */
  parent?: any;
  
  /**
   * Current user context
   */
  user?: any;
}

/**
 * Validation result
 */
export interface AdvancedValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;
  
  /**
   * Validation errors
   */
  errors: AdvancedValidationError[];
  
  /**
   * Validation warnings
   */
  warnings?: AdvancedValidationError[];
}

/**
 * Validation error (Phase 3.5.5: Improved error messages)
 */
export interface AdvancedValidationError {
  /**
   * Field path
   */
  field: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error code
   */
  code?: string;
  
  /**
   * Rule type that failed
   */
  rule?: ValidationRuleType;
  
  /**
   * Error severity
   */
  severity?: 'error' | 'warning' | 'info';
  
  /**
   * Additional context
   */
  context?: Record<string, any>;
}

/**
 * =============================================================================
 * ObjectStack Spec v2.0.1: Object-Level Validation Framework
 * =============================================================================
 */

/**
 * Base validation interface (ObjectStack Spec v2.0.1)
 */
export interface BaseValidation {
  /** Unique validation name (snake_case) */
  name: string;
  
  /** Display label for the validation */
  label?: string;
  
  /** Description of what this validation does */
  description?: string;
  
  /** Whether this validation is currently active */
  active: boolean;
  
  /** When this validation should run */
  events: Array<'insert' | 'update' | 'delete'>;
  
  /** Severity of validation failure */
  severity: 'error' | 'warning' | 'info';
  
  /** Error message to display on failure */
  message: string;
  
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Script-based validation (ObjectStack Spec v2.0.1)
 * Uses expression language to define conditions
 */
export interface ScriptValidation extends BaseValidation {
  type: 'script';
  
  /** Expression that must evaluate to true */
  condition: string;
}

/**
 * Uniqueness validation (ObjectStack Spec v2.0.1)
 * Ensures field combinations are unique
 */
export interface UniquenessValidation extends BaseValidation {
  type: 'unique';
  
  /** Fields that must be unique together */
  fields: string[];
  
  /** Optional scope expression (e.g., "tenant_id = ${current_tenant}") */
  scope?: string;
  
  /** Whether comparison is case-sensitive */
  caseSensitive?: boolean;
}

/**
 * State machine validation (ObjectStack Spec v2.0.1)
 * Enforces valid state transitions
 */
export interface StateMachineValidation extends BaseValidation {
  type: 'state_machine';
  
  /** Field containing the state */
  stateField: string;
  
  /** Allowed state transitions */
  transitions: Array<{
    /** Source state(s) */
    from: string | string[];
    
    /** Target state */
    to: string;
    
    /** Optional condition that must be true */
    condition?: string;
  }>;
}

/**
 * Cross-field validation (ObjectStack Spec v2.0.1)
 * Validates relationships between multiple fields
 */
export interface CrossFieldValidation extends BaseValidation {
  type: 'cross_field';
  
  /** Fields involved in the validation */
  fields: string[];
  
  /** Condition expression involving multiple fields */
  condition: string;
}

/**
 * Async/remote validation (ObjectStack Spec v2.0.1)
 * Calls external endpoint for validation
 */
export interface AsyncValidation extends BaseValidation {
  type: 'async';
  
  /** API endpoint to call */
  endpoint: string;
  
  /** HTTP method */
  method?: 'GET' | 'POST';
  
  /** Debounce delay in milliseconds */
  debounce?: number;
  
  /** Cache configuration */
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live in seconds
  };
}

/**
 * Conditional validation (ObjectStack Spec v2.0.1)
 * Applies nested rules only when condition is met
 */
export interface ConditionalValidation extends BaseValidation {
  type: 'conditional';
  
  /** Condition that determines if rules should apply */
  condition: string;
  
  /** Nested validation rules to apply when condition is true */
  rules: ObjectValidationRule[];
}

/**
 * Format validation (ObjectStack Spec v2.0.1)
 * Validates field format using regex or predefined patterns
 */
export interface FormatValidation extends BaseValidation {
  type: 'format';
  
  /** Field to validate */
  field: string;
  
  /** Regex pattern or predefined format name */
  pattern: string | RegExp;
  
  /** Predefined format (email, url, phone, etc.) */
  format?: 'email' | 'url' | 'phone' | 'ipv4' | 'ipv6' | 'uuid' | 'iso_date' | 'credit_card';
  
  /** Validation flags for regex (i, g, m, etc.) */
  flags?: string;
}

/**
 * Range validation (ObjectStack Spec v2.0.1)
 * Validates numeric or date ranges
 */
export interface RangeValidation extends BaseValidation {
  type: 'range';
  
  /** Field to validate */
  field: string;
  
  /** Minimum value (inclusive) */
  min?: number | string | Date;
  
  /** Maximum value (inclusive) */
  max?: number | string | Date;
  
  /** Whether min is exclusive */
  minExclusive?: boolean;
  
  /** Whether max is exclusive */
  maxExclusive?: boolean;
}

/**
 * Union type for all validation rules (ObjectStack Spec v2.0.1)
 */
export type ObjectValidationRule = 
  | ScriptValidation
  | UniquenessValidation
  | StateMachineValidation
  | CrossFieldValidation
  | AsyncValidation
  | ConditionalValidation
  | FormatValidation
  | RangeValidation;

/**
 * =============================================================================
 * Phase 3.6: DriverInterface - Database Driver Abstraction
 * =============================================================================
 */

/**
 * Database Driver Interface (Phase 3.6)
 */
export interface DriverInterface {
  /**
   * Driver name
   */
  name: string;
  
  /**
   * Driver version
   */
  version?: string;
  
  /**
   * Connect to database
   */
  connect(config: ConnectionConfig): Promise<void>;
  
  /**
   * Disconnect from database
   */
  disconnect(): Promise<void>;
  
  /**
   * Execute query
   */
  query<T = any>(sql: string, params?: any[]): Promise<DriverQueryResult<T>>;
  
  /**
   * Execute query from AST
   */
  executeAST<T = any>(ast: QueryAST): Promise<DriverQueryResult<T>>;
  
  /**
   * Find records
   */
  find<T = any>(table: string, query: QuerySchema): Promise<DriverQueryResult<T>>;
  
  /**
   * Find one record
   */
  findOne<T = any>(table: string, id: any): Promise<T | null>;
  
  /**
   * Insert record
   */
  insert<T = any>(table: string, data: Partial<T>): Promise<T>;
  
  /**
   * Update record
   */
  update<T = any>(table: string, id: any, data: Partial<T>): Promise<T>;
  
  /**
   * Delete record
   */
  delete(table: string, id: any): Promise<boolean>;
  
  /**
   * Batch operations (Phase 3.6.2)
   */
  batch<T = any>(operations: BatchOperation[]): Promise<BatchResult<T>>;
  
  /**
   * Transaction support (Phase 3.6.1)
   */
  transaction<T = any>(
    callback: (trx: TransactionContext) => Promise<T>
  ): Promise<T>;
  
  /**
   * Get object schema
   */
  getSchema(objectName: string): Promise<any>;
  
  /**
   * Cache management (Phase 3.6.4)
   */
  cache?: CacheManager;
  
  /**
   * Connection pool (Phase 3.6.3)
   */
  pool?: ConnectionPool;
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  /**
   * Database host
   */
  host?: string;
  
  /**
   * Database port
   */
  port?: number;
  
  /**
   * Database name
   */
  database?: string;
  
  /**
   * Username
   */
  username?: string;
  
  /**
   * Password
   */
  password?: string;
  
  /**
   * Connection URL
   */
  url?: string;
  
  /**
   * SSL configuration
   */
  ssl?: boolean | object;
  
  /**
   * Pool configuration (Phase 3.6.3)
   */
  pool?: {
    min?: number;
    max?: number;
    idle_timeout?: number;
    connection_timeout?: number;
  };
  
  /**
   * Additional driver-specific options
   */
  options?: Record<string, any>;
}

/**
 * Query result with metadata (extends base QueryResult from data.ts)
 */
export interface DriverQueryResult<T = any> {
  /**
   * Result data
   */
  data: T[];
  
  /**
   * Total count
   */
  total?: number;
  
  /**
   * Current page number (1-indexed)
   */
  page?: number;
  
  /**
   * Page size
   */
  pageSize?: number;
  
  /**
   * Whether there are more records
   */
  hasMore?: boolean;
  
  /**
   * Cursor for cursor-based pagination
   */
  cursor?: string;
  
  /**
   * Execution metadata
   */
  metadata?: {
    /**
     * Execution time in ms
     */
    execution_time?: number;
    
    /**
     * Whether result was cached
     */
    from_cache?: boolean;
    
    /**
     * Number of rows affected
     */
    rows_affected?: number;
  };
}

/**
 * Batch operation (Phase 3.6.2)
 */
export interface BatchOperation {
  /**
   * Operation type
   */
  type: 'insert' | 'update' | 'delete';
  
  /**
   * Target table
   */
  table: string;
  
  /**
   * Operation data
   */
  data?: any;
  
  /**
   * Record ID (for update/delete)
   */
  id?: any;
}

/**
 * Batch operation result
 */
export interface BatchResult<T = any> {
  /**
   * Successful operations
   */
  success: T[];
  
  /**
   * Failed operations
   */
  failed: Array<{
    operation: BatchOperation;
    error: Error;
  }>;
  
  /**
   * Total operations
   */
  total: number;
  
  /**
   * Success count
   */
  success_count: number;
  
  /**
   * Failure count
   */
  failure_count: number;
}

/**
 * Transaction context (Phase 3.6.1)
 */
export interface TransactionContext {
  /**
   * Execute query within transaction
   */
  query<T = any>(sql: string, params?: any[]): Promise<DriverQueryResult<T>>;
  
  /**
   * Insert within transaction
   */
  insert<T = any>(table: string, data: Partial<T>): Promise<T>;
  
  /**
   * Update within transaction
   */
  update<T = any>(table: string, id: any, data: Partial<T>): Promise<T>;
  
  /**
   * Delete within transaction
   */
  delete(table: string, id: any): Promise<boolean>;
  
  /**
   * Commit transaction
   */
  commit(): Promise<void>;
  
  /**
   * Rollback transaction
   */
  rollback(): Promise<void>;
}

/**
 * Cache manager (Phase 3.6.4)
 */
export interface CacheManager {
  /**
   * Get cached value
   */
  get<T = any>(key: string): Promise<T | null>;
  
  /**
   * Set cached value
   */
  set<T = any>(key: string, value: T, ttl?: number): Promise<void>;
  
  /**
   * Delete cached value
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear all cache
   */
  clear(): Promise<void>;
  
  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;
}

/**
 * Connection pool (Phase 3.6.3)
 */
export interface ConnectionPool {
  /**
   * Get connection from pool
   */
  acquire(): Promise<any>;
  
  /**
   * Release connection back to pool
   */
  release(connection: any): Promise<void>;
  
  /**
   * Pool statistics
   */
  stats(): {
    total: number;
    idle: number;
    active: number;
    waiting: number;
  };
  
  /**
   * Close all connections
   */
  close(): Promise<void>;
}

/**
 * =============================================================================
 * Phase 3.7: DatasourceSchema - Multi-Datasource Management
 * =============================================================================
 */

/**
 * Datasource Schema (Phase 3.7)
 */
export interface DatasourceSchema {
  /**
   * Datasource name
   */
  name: string;
  
  /**
   * Datasource type
   */
  type: DatasourceType;
  
  /**
   * Display label
   */
  label?: string;
  
  /**
   * Connection configuration
   */
  connection: ConnectionConfig;
  
  /**
   * Driver interface
   */
  driver?: DriverInterface;
  
  /**
   * Whether datasource is default
   */
  is_default?: boolean;
  
  /**
   * Health check configuration (Phase 3.7.4)
   */
  health_check?: {
    /**
     * Enable health checks
     */
    enabled?: boolean;
    
    /**
     * Check interval in seconds
     */
    interval?: number;
    
    /**
     * Timeout in milliseconds
     */
    timeout?: number;
    
    /**
     * Health check query
     */
    query?: string;
  };
  
  /**
   * Monitoring configuration (Phase 3.7.5)
   */
  monitoring?: {
    /**
     * Enable monitoring
     */
    enabled?: boolean;
    
    /**
     * Metrics to collect
     */
    metrics?: DatasourceMetric[];
    
    /**
     * Alert thresholds
     */
    alerts?: DatasourceAlert[];
  };
  
  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Max retry attempts
     */
    max_attempts?: number;
    
    /**
     * Retry delay in milliseconds
     */
    delay?: number;
    
    /**
     * Exponential backoff
     */
    backoff?: boolean;
  };
  
  /**
   * Metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Datasource types
 */
export type DatasourceType =
  | 'postgres'
  | 'mysql'
  | 'mongodb'
  | 'sqlite'
  | 'mssql'
  | 'oracle'
  | 'rest'
  | 'graphql'
  | 'objectql'
  | 'custom';

/**
 * Datasource metric types (Phase 3.7.5)
 */
export type DatasourceMetric =
  | 'query_count'
  | 'query_duration'
  | 'error_rate'
  | 'connection_count'
  | 'cache_hit_rate'
  | 'throughput';

/**
 * Datasource alert configuration (Phase 3.7.5)
 */
export interface DatasourceAlert {
  /**
   * Alert name
   */
  name: string;
  
  /**
   * Metric to monitor
   */
  metric: DatasourceMetric;
  
  /**
   * Threshold value
   */
  threshold: number;
  
  /**
   * Comparison operator
   */
  operator: '>' | '<' | '>=' | '<=' | '=';
  
  /**
   * Alert severity
   */
  severity: 'info' | 'warning' | 'error' | 'critical';
  
  /**
   * Alert actions
   */
  actions?: Array<'log' | 'email' | 'slack' | 'webhook'>;
}

/**
 * Multi-datasource manager (Phase 3.7.2)
 */
export interface DatasourceManager {
  /**
   * Register a datasource
   */
  register(datasource: DatasourceSchema): void;
  
  /**
   * Unregister a datasource
   */
  unregister(name: string): void;
  
  /**
   * Get datasource by name
   */
  get(name: string): DatasourceSchema | undefined;
  
  /**
   * Get default datasource
   */
  getDefault(): DatasourceSchema | undefined;
  
  /**
   * Switch active datasource (Phase 3.7.3)
   */
  switch(name: string): void;
  
  /**
   * Get active datasource
   */
  getActive(): DatasourceSchema | undefined;
  
  /**
   * List all datasources
   */
  list(): DatasourceSchema[];
  
  /**
   * Check datasource health (Phase 3.7.4)
   */
  checkHealth(name: string): Promise<HealthCheckResult>;
  
  /**
   * Get datasource metrics (Phase 3.7.5)
   */
  getMetrics(name: string): Promise<DatasourceMetrics>;
}

/**
 * Health check result (Phase 3.7.4)
 */
export interface HealthCheckResult {
  /**
   * Datasource name
   */
  datasource: string;
  
  /**
   * Health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /**
   * Response time in ms
   */
  response_time?: number;
  
  /**
   * Error message if unhealthy
   */
  error?: string;
  
  /**
   * Timestamp
   */
  timestamp: Date;
  
  /**
   * Additional details
   */
  details?: Record<string, any>;
}

/**
 * Datasource metrics (Phase 3.7.5)
 */
export interface DatasourceMetrics {
  /**
   * Datasource name
   */
  datasource: string;
  
  /**
   * Query metrics
   */
  queries: {
    total: number;
    success: number;
    failed: number;
    avg_duration: number;
  };
  
  /**
   * Connection metrics
   */
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  
  /**
   * Cache metrics
   */
  cache?: {
    hits: number;
    misses: number;
    hit_rate: number;
  };
  
  /**
   * Error rate
   */
  error_rate: number;
  
  /**
   * Timestamp
   */
  timestamp: Date;
}
