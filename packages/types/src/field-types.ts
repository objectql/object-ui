/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Field Type Definitions
 * 
 * Comprehensive field type system for ObjectQL protocol.
 * Defines all field types supported in ObjectTable and ObjectForm components.
 * 
 * @module field-types
 * @packageDocumentation
 */

/**
 * Base field metadata interface
 * Common properties shared by all field types
 */
export interface BaseFieldMetadata {
  /**
   * Field name/identifier
   */
  name: string;
  
  /**
   * Display label
   */
  label?: string;
  
  /**
   * Field type identifier
   */
  type: string;
  
  /**
   * Help text or description
   */
  help?: string;
  
  /**
   * Description text
   */
  description?: string;
  
  /**
   * Whether field is required
   */
  required?: boolean;
  
  /**
   * Whether field is read-only
   */
  readonly?: boolean;
  
  /**
   * Placeholder text
   */
  placeholder?: string;
  
  /**
   * Default value
   */
  defaultValue?: any;
  
  /**
   * Field permissions (Phase 3.2.6)
   */
  permissions?: {
    read?: boolean;
    write?: boolean;
    edit?: boolean;
  };
  
  /**
   * Whether field is sortable
   */
  sortable?: boolean;
  
  /**
   * Whether field is filterable
   */
  filterable?: boolean;
  
  /**
   * Conditional visibility expression
   */
  visible_on?: VisibilityCondition;
  
  /**
   * Custom validation function or rules
   */
  validate?: ValidationFunction | ValidationRule;
  
  /**
   * Field dependencies (Phase 3.2.3)
   * List of fields that this field depends on
   */
  depends_on?: string[];
  
  /**
   * Field index for database optimization
   */
  indexed?: boolean;
  
  /**
   * Field is unique constraint
   */
  unique?: boolean;
}

/**
 * Visibility condition type
 */
export type VisibilityCondition = {
  field: string;
  operator?: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in';
  value?: any;
  and?: VisibilityCondition[];
  or?: VisibilityCondition[];
};

/**
 * Validation function type
 */
export type ValidationFunction = (value: any) => boolean | string | Promise<boolean | string>;

/**
 * Validation rule type
 */
export type ValidationRule = {
  required?: boolean | string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string | RegExp;
  custom?: ValidationFunction;
};

/**
 * Text field metadata
 */
export interface TextFieldMetadata extends BaseFieldMetadata {
  type: 'text';
  min_length?: number;
  max_length?: number;
  pattern?: string | RegExp;
  pattern_message?: string;
}

/**
 * Long text/textarea field metadata
 */
export interface TextareaFieldMetadata extends BaseFieldMetadata {
  type: 'textarea';
  min_length?: number;
  max_length?: number;
  rows?: number;
}

/**
 * Markdown field metadata
 */
export interface MarkdownFieldMetadata extends BaseFieldMetadata {
  type: 'markdown';
  max_length?: number;
}

/**
 * HTML/Rich text field metadata
 */
export interface HtmlFieldMetadata extends BaseFieldMetadata {
  type: 'html';
  max_length?: number;
}

/**
 * Number field metadata
 */
export interface NumberFieldMetadata extends BaseFieldMetadata {
  type: 'number';
  min?: number;
  max?: number;
  precision?: number;
  step?: number;
}

/**
 * Currency field metadata
 */
export interface CurrencyFieldMetadata extends BaseFieldMetadata {
  type: 'currency';
  currency?: string;
  precision?: number;
  min?: number;
  max?: number;
}

/**
 * Percent field metadata
 */
export interface PercentFieldMetadata extends BaseFieldMetadata {
  type: 'percent';
  precision?: number;
  min?: number;
  max?: number;
}

/**
 * Boolean field metadata
 */
export interface BooleanFieldMetadata extends BaseFieldMetadata {
  type: 'boolean';
}

/**
 * Date field metadata
 */
export interface DateFieldMetadata extends BaseFieldMetadata {
  type: 'date';
  format?: string;
  min_date?: string | Date;
  max_date?: string | Date;
}

/**
 * DateTime field metadata
 */
export interface DateTimeFieldMetadata extends BaseFieldMetadata {
  type: 'datetime';
  format?: string;
  min_date?: string | Date;
  max_date?: string | Date;
}

/**
 * Time field metadata
 */
export interface TimeFieldMetadata extends BaseFieldMetadata {
  type: 'time';
  format?: string;
}

/**
 * Select option
 */
export interface SelectOptionMetadata {
  label: string;
  value: string;
  color?: string;
  icon?: string;
  disabled?: boolean;
}

/**
 * Select field metadata
 */
export interface SelectFieldMetadata extends BaseFieldMetadata {
  type: 'select';
  options?: SelectOptionMetadata[];
  multiple?: boolean;
  searchable?: boolean;
}

/**
 * Email field metadata
 */
export interface EmailFieldMetadata extends BaseFieldMetadata {
  type: 'email';
  max_length?: number;
}

/**
 * Phone field metadata
 */
export interface PhoneFieldMetadata extends BaseFieldMetadata {
  type: 'phone';
  format?: string;
}

/**
 * URL field metadata
 */
export interface UrlFieldMetadata extends BaseFieldMetadata {
  type: 'url';
  max_length?: number;
}

/**
 * Password field metadata
 */
export interface PasswordFieldMetadata extends BaseFieldMetadata {
  type: 'password';
  min_length?: number;
  max_length?: number;
}

/**
 * File metadata
 */
export interface FileMetadata {
  name: string;
  original_name?: string;
  size?: number;
  mime_type?: string;
  url?: string;
}

/**
 * File field metadata
 */
export interface FileFieldMetadata extends BaseFieldMetadata {
  type: 'file';
  multiple?: boolean;
  accept?: string[];
  max_size?: number;
  max_files?: number;
}

/**
 * Image field metadata
 */
export interface ImageFieldMetadata extends BaseFieldMetadata {
  type: 'image';
  multiple?: boolean;
  accept?: string[];
  max_size?: number;
  max_files?: number;
  max_width?: number;
  max_height?: number;
}

/**
 * Location field metadata
 */
export interface LocationFieldMetadata extends BaseFieldMetadata {
  type: 'location';
  default_zoom?: number;
}

/**
 * Lookup/Master-Detail field metadata
 */
export interface LookupFieldMetadata extends BaseFieldMetadata {
  type: 'lookup' | 'master_detail';
  reference_to?: string;
  reference_field?: string;
  multiple?: boolean;
  searchable?: boolean;
  options?: SelectOptionMetadata[];
}

/**
 * Formula field metadata (read-only computed field)
 * Phase 3.2.4: Enhanced formula field with real-time computation
 */
export interface FormulaFieldMetadata extends BaseFieldMetadata {
  type: 'formula';
  /**
   * Formula expression
   * Supports JavaScript-like expressions with field references
   * @example "${amount} * ${tax_rate}"
   * @example "${firstName} + ' ' + ${lastName}"
   */
  formula?: string;
  /**
   * Return type of the formula
   */
  return_type?: 'text' | 'number' | 'boolean' | 'date' | 'datetime';
  /**
   * Whether to recompute on dependency changes
   */
  auto_compute?: boolean;
}

/**
 * Summary/Rollup field metadata (aggregation)
 * Phase 3.2.5: Enhanced summary field implementation
 */
export interface SummaryFieldMetadata extends BaseFieldMetadata {
  type: 'summary';
  /**
   * Related object to summarize from
   */
  summary_object?: string;
  /**
   * Field to aggregate in the related object
   */
  summary_field?: string;
  /**
   * Aggregation type
   */
  summary_type?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last';
  /**
   * Filter condition for summarized records
   */
  summary_filter?: Record<string, any>;
  /**
   * Whether to auto-update on related record changes
   */
  auto_update?: boolean;
}

/**
 * Auto-number field metadata
 */
export interface AutoNumberFieldMetadata extends BaseFieldMetadata {
  type: 'auto_number';
  format?: string;
  starting_number?: number;
}

/**
 * User/Owner field metadata
 */
export interface UserFieldMetadata extends BaseFieldMetadata {
  type: 'user' | 'owner';
  multiple?: boolean;
}

/**
 * Object field metadata (JSON object)
 */
export interface ObjectFieldMetadata extends BaseFieldMetadata {
  type: 'object';
  schema?: Record<string, any>;
}

/**
 * Vector field metadata (embeddings)
 * Phase 3.2.1: Complete vector field implementation
 */
export interface VectorFieldMetadata extends BaseFieldMetadata {
  type: 'vector';
  /**
   * Vector dimensions (e.g., 768 for BERT, 1536 for OpenAI)
   */
  dimensions?: number;
  /**
   * Distance metric for similarity search
   */
  distance_metric?: 'cosine' | 'euclidean' | 'dot_product';
  /**
   * Whether to index for similarity search
   */
  indexed?: boolean;
  /**
   * Normalization strategy
   */
  normalize?: boolean;
}

/**
 * Grid field metadata (sub-table)
 * Phase 3.2.2: Complete grid field implementation
 */
export interface GridFieldMetadata extends BaseFieldMetadata {
  type: 'grid';
  /**
   * Column definitions for the grid
   */
  columns?: GridColumnDefinition[];
  /**
   * Minimum number of rows
   */
  min_rows?: number;
  /**
   * Maximum number of rows
   */
  max_rows?: number;
  /**
   * Whether to allow adding rows
   */
  allow_add?: boolean;
  /**
   * Whether to allow deleting rows
   */
  allow_delete?: boolean;
  /**
   * Whether to allow reordering rows
   */
  allow_reorder?: boolean;
}

/**
 * Grid column definition
 */
export interface GridColumnDefinition {
  /**
   * Column field name
   */
  name: string;
  /**
   * Column label
   */
  label?: string;
  /**
   * Field type
   */
  type: string;
  /**
   * Whether column is required
   */
  required?: boolean;
  /**
   * Default value for new rows
   */
  defaultValue?: any;
  /**
   * Column width
   */
  width?: number;
  /**
   * Validation rules
   */
  validate?: ValidationRule;
}

export interface ColorFieldMetadata extends BaseFieldMetadata {
  type: 'color';
}

export interface CodeFieldMetadata extends BaseFieldMetadata {
  type: 'code';
}

export interface AvatarFieldMetadata extends BaseFieldMetadata {
  type: 'avatar';
}

export interface SignatureFieldMetadata extends BaseFieldMetadata {
  type: 'signature';
}

export interface QRCodeFieldMetadata extends BaseFieldMetadata {
  type: 'qrcode';
}

export interface AddressFieldMetadata extends BaseFieldMetadata {
  type: 'address';
}

export interface GeolocationFieldMetadata extends BaseFieldMetadata {
  type: 'geolocation';
}

export interface SliderFieldMetadata extends BaseFieldMetadata {
  type: 'slider';
  min?: number;
  max?: number;
}

export interface RatingFieldMetadata extends BaseFieldMetadata {
  type: 'rating';
  max?: number;
}

export interface MasterDetailFieldMetadata extends BaseFieldMetadata {
  type: 'master_detail';
  reference_to?: string;
}

/**
 * Union type of all field metadata types
 */
export type FieldMetadata =
  | TextFieldMetadata
  | TextareaFieldMetadata
  | MarkdownFieldMetadata
  | HtmlFieldMetadata
  | NumberFieldMetadata
  | CurrencyFieldMetadata
  | PercentFieldMetadata
  | BooleanFieldMetadata
  | DateFieldMetadata
  | DateTimeFieldMetadata
  | TimeFieldMetadata
  | SelectFieldMetadata
  | EmailFieldMetadata
  | PhoneFieldMetadata
  | UrlFieldMetadata
  | PasswordFieldMetadata
  | FileFieldMetadata
  | ImageFieldMetadata
  | LocationFieldMetadata
  | LookupFieldMetadata
  | FormulaFieldMetadata
  | SummaryFieldMetadata
  | AutoNumberFieldMetadata
  | UserFieldMetadata
  | ObjectFieldMetadata
  | VectorFieldMetadata
  | GridFieldMetadata
  | ColorFieldMetadata
  | CodeFieldMetadata
  | AvatarFieldMetadata
  | SignatureFieldMetadata
  | QRCodeFieldMetadata
  | AddressFieldMetadata
  | GeolocationFieldMetadata
  | SliderFieldMetadata
  | RatingFieldMetadata
  | MasterDetailFieldMetadata;

/**
 * Object trigger configuration (Phase 3.1.3)
 */
export interface ObjectTrigger {
  /**
   * Trigger name
   */
  name: string;
  /**
   * When to execute the trigger
   */
  when: 'before' | 'after';
  /**
   * Which operation triggers this
   */
  on: 'create' | 'update' | 'delete' | 'read';
  /**
   * Trigger condition (optional)
   */
  condition?: string;
  /**
   * Action to execute
   */
  action: 'validation' | 'workflow' | 'notification' | 'calculation' | 'custom';
  /**
   * Action configuration
   */
  config?: Record<string, any>;
}

/**
 * Object permission configuration (Phase 3.1.4)
 */
export interface ObjectPermission {
  /**
   * Permission profile name
   */
  profile?: string;
  /**
   * Role-based permissions
   */
  roles?: string[];
  /**
   * CRUD permissions
   */
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
  /**
   * Record-level permissions
   */
  record_level?: {
    /**
     * User can only access own records
     */
    own_records_only?: boolean;
    /**
     * Sharing rules
     */
    sharing_rules?: SharingRule[];
  };
  /**
   * Field-level permissions
   */
  field_permissions?: Record<string, {
    read?: boolean;
    edit?: boolean;
  }>;
}

/**
 * Sharing rule configuration
 */
export interface SharingRule {
  /**
   * Rule name
   */
  name: string;
  /**
   * Criteria for sharing
   */
  criteria?: Record<string, any>;
  /**
   * Access level granted
   */
  access_level: 'read' | 'edit' | 'full';
  /**
   * Share with users/roles
   */
  share_with?: {
    users?: string[];
    roles?: string[];
    groups?: string[];
  };
}

/**
 * Object schema definition
 * Phase 3.1: Enhanced with inheritance, triggers, permissions, and caching
 */
export interface ObjectSchemaMetadata {
  /**
   * Object name
   */
  name: string;
  
  /**
   * Display label
   */
  label?: string;
  
  /**
   * Object description
   */
  description?: string;
  
  /**
   * Fields definition
   */
  fields: Record<string, FieldMetadata>;
  
  /**
   * Permissions (Phase 3.1.4: Enhanced permissions)
   */
  permissions?: ObjectPermission;
  
  /**
   * Parent object to inherit from (Phase 3.1.2)
   */
  extends?: string;
  
  /**
   * Triggers configuration (Phase 3.1.3)
   */
  triggers?: ObjectTrigger[];
  
  /**
   * Primary key field
   */
  primary_key?: string;
  
  /**
   * Indexes for optimization
   */
  indexes?: ObjectIndex[];
  
  /**
   * Relationships with other objects
   */
  relationships?: ObjectRelationship[];
  
  /**
   * Record naming pattern
   */
  name_field?: string;
  
  /**
   * Soft delete configuration
   */
  soft_delete?: boolean;
  
  /**
   * Audit trail configuration
   */
  audit_trail?: boolean;
  
  /**
   * Schema version
   */
  version?: string;
  
  /**
   * Cache configuration (Phase 3.1.5)
   */
  cache?: {
    /**
     * Enable metadata caching
     */
    enabled?: boolean;
    /**
     * Cache TTL in seconds
     */
    ttl?: number;
    /**
     * Cache invalidation strategy
     */
    invalidation?: 'time' | 'event' | 'manual';
  };
}

/**
 * Object index configuration
 */
export interface ObjectIndex {
  /**
   * Index name
   */
  name: string;
  /**
   * Fields to index
   */
  fields: string[];
  /**
   * Whether index is unique
   */
  unique?: boolean;
  /**
   * Index type
   */
  type?: 'btree' | 'hash' | 'gist' | 'gin';
}

/**
 * Object relationship configuration
 */
export interface ObjectRelationship {
  /**
   * Relationship name
   */
  name: string;
  /**
   * Related object
   */
  object: string;
  /**
   * Relationship type
   */
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  /**
   * Foreign key field
   */
  foreign_key?: string;
  /**
   * Cascade delete
   */
  cascade_delete?: boolean;
}
