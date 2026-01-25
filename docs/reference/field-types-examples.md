# Field Types Examples

Comprehensive examples demonstrating all ObjectUI field types in ObjectForm and ObjectTable.

## Complete CRM Contact Form

This example shows all field types in a realistic CRM contact management form:

```typescript
import { ObjectForm } from '@object-ui/views';

const contactFormSchema = {
  type: 'object-form',
  objectName: 'contacts',
  mode: 'create',
  title: 'New Contact',
  
  // Define all fields with various types
  customFields: [
    // Basic Information
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      required: true,
      placeholder: 'John',
      max_length: 50
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      required: true,
      placeholder: 'Doe',
      max_length: 50
    },
    {
      name: 'fullName',
      type: 'formula',
      label: 'Full Name',
      formula: 'CONCAT(firstName, " ", lastName)',
      readonly: true
    },
    
    // Contact Information
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      placeholder: 'john.doe@example.com'
    },
    {
      name: 'phone',
      type: 'phone',
      label: 'Phone',
      placeholder: '+1 (555) 123-4567'
    },
    {
      name: 'website',
      type: 'url',
      label: 'Website',
      placeholder: 'https://example.com'
    },
    
    // Company Information
    {
      name: 'company',
      type: 'lookup',
      label: 'Company',
      reference_to: 'accounts',
      searchable: true
    },
    {
      name: 'title',
      type: 'text',
      label: 'Job Title',
      placeholder: 'Senior Manager'
    },
    {
      name: 'department',
      type: 'select',
      label: 'Department',
      options: [
        { value: 'sales', label: 'Sales', color: 'blue' },
        { value: 'marketing', label: 'Marketing', color: 'purple' },
        { value: 'engineering', label: 'Engineering', color: 'green' },
        { value: 'support', label: 'Support', color: 'orange' }
      ]
    },
    
    // Status and Priority
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'inactive', label: 'Inactive', color: 'gray' },
        { value: 'pending', label: 'Pending', color: 'yellow' }
      ],
      defaultValue: 'active'
    },
    {
      name: 'tags',
      type: 'select',
      label: 'Tags',
      multiple: true,
      searchable: true,
      options: [
        { value: 'vip', label: 'VIP', color: 'red' },
        { value: 'partner', label: 'Partner', color: 'blue' },
        { value: 'prospect', label: 'Prospect', color: 'yellow' }
      ]
    },
    
    // Financial
    {
      name: 'lifetimeValue',
      type: 'currency',
      label: 'Lifetime Value',
      currency: 'USD',
      precision: 2,
      min: 0
    },
    {
      name: 'conversionRate',
      type: 'percent',
      label: 'Conversion Rate',
      precision: 2,
      min: 0,
      max: 100
    },
    
    // Assignment
    {
      name: 'owner',
      type: 'owner',
      label: 'Account Owner',
      required: true
    },
    {
      name: 'assignedTo',
      type: 'user',
      label: 'Assigned To',
      multiple: false
    },
    
    // Dates
    {
      name: 'birthDate',
      type: 'date',
      label: 'Birth Date'
    },
    {
      name: 'lastContactDate',
      type: 'datetime',
      label: 'Last Contact',
      readonly: true
    },
    
    // Preferences
    {
      name: 'optInMarketing',
      type: 'boolean',
      label: 'Opt-in to Marketing',
      defaultValue: false
    },
    {
      name: 'preferredContactTime',
      type: 'time',
      label: 'Preferred Contact Time'
    },
    
    // Location
    {
      name: 'address',
      type: 'location',
      label: 'Address'
    },
    
    // Files
    {
      name: 'avatar',
      type: 'image',
      label: 'Profile Photo',
      accept: ['image/jpeg', 'image/png'],
      max_size: 2097152 // 2MB
    },
    {
      name: 'documents',
      type: 'file',
      label: 'Documents',
      multiple: true,
      max_files: 5,
      max_size: 10485760 // 10MB
    },
    
    // Notes
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notes',
      rows: 4,
      placeholder: 'Add internal notes...'
    },
    {
      name: 'bio',
      type: 'markdown',
      label: 'Biography',
      max_length: 5000
    }
  ],
  
  // Group fields for better organization
  groups: [
    {
      title: 'Basic Information',
      fields: ['firstName', 'lastName', 'fullName']
    },
    {
      title: 'Contact Details',
      fields: ['email', 'phone', 'website']
    },
    {
      title: 'Company',
      fields: ['company', 'title', 'department']
    },
    {
      title: 'Status & Classification',
      fields: ['status', 'tags', 'lifetimeValue', 'conversionRate']
    },
    {
      title: 'Assignment',
      fields: ['owner', 'assignedTo']
    },
    {
      title: 'Important Dates',
      fields: ['birthDate', 'lastContactDate', 'preferredContactTime']
    },
    {
      title: 'Preferences',
      fields: ['optInMarketing', 'address']
    },
    {
      title: 'Media',
      fields: ['avatar', 'documents']
    },
    {
      title: 'Additional Information',
      fields: ['notes', 'bio'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  
  layout: 'vertical',
  submitText: 'Create Contact',
  showCancel: true
};

// Usage
<ObjectForm 
  schema={contactFormSchema}
  dataSource={myDataSource}
/>
```

## ObjectTable with All Field Types

Display contacts in a table with type-aware cell rendering:

```typescript
import { ObjectTable } from '@object-ui/views';

const contactTableSchema = {
  type: 'object-grid',
  objectName: 'contacts',
  title: 'Contacts',
  
  // Select which fields to display
  fields: [
    'avatar',
    'fullName',
    'email',
    'phone',
    'company',
    'status',
    'tags',
    'lifetimeValue',
    'owner',
    'lastContactDate',
    'optInMarketing'
  ],
  
  // Enable features
  selectable: 'multiple',
  showSearch: true,
  showFilters: true,
  showPagination: true,
  pageSize: 25,
  
  // Default sorting
  defaultSort: {
    field: 'lastContactDate',
    order: 'desc'
  },
  
  // Enable operations
  operations: {
    create: true,
    read: true,
    update: true,
    delete: true
  }
};

// Usage
<ObjectTable
  schema={contactTableSchema}
  dataSource={myDataSource}
  onEdit={(record) => console.log('Edit:', record)}
  onDelete={(record) => console.log('Delete:', record)}
/>
```

## Inline Data Example (No DataSource Required)

For demos and documentation, you can provide inline data:

```typescript
const demoTableSchema = {
  type: 'object-grid',
  objectName: 'contacts',
  
  // Provide inline data
  data: [
    {
      id: 1,
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      status: 'active',
      tags: ['vip', 'partner'],
      lifetimeValue: 125000,
      optInMarketing: true
    },
    {
      id: 2,
      fullName: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+1 (555) 987-6543',
      status: 'active',
      tags: ['prospect'],
      lifetimeValue: 45000,
      optInMarketing: false
    }
  ],
  
  // Define custom columns with field metadata
  columns: [
    {
      header: 'Name',
      accessorKey: 'fullName'
    },
    {
      header: 'Email',
      accessorKey: 'email'
    },
    {
      header: 'Status',
      accessorKey: 'status'
    },
    {
      header: 'Value',
      accessorKey: 'lifetimeValue'
    }
  ]
};

// No dataSource needed for inline data
<ObjectTable schema={demoTableSchema} />
```

## Individual Field Renderer Usage

You can also use field renderers directly in custom components:

```typescript
import { 
  getCellRenderer,
  CurrencyCellRenderer,
  UserCellRenderer 
} from '@object-ui/views';

// Get renderer by type
const CurrencyRenderer = getCellRenderer('currency');

// Use specific renderer
function MyCustomCell({ value, field }) {
  return (
    <div className="custom-wrapper">
      <CurrencyCellRenderer 
        value={value} 
        field={field}
      />
    </div>
  );
}

// Use in custom table
function CustomTable({ data }) {
  return (
    <table>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>
              <UserCellRenderer 
                value={row.owner} 
                field={{ type: 'user', name: 'owner' }}
              />
            </td>
            <td>
              <CurrencyCellRenderer
                value={row.amount}
                field={{ 
                  type: 'currency', 
                  name: 'amount',
                  currency: 'USD'
                }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Additional Field Type Examples

### HTML Rich Text Field

```typescript
{
  name: 'content',
  type: 'html',
  label: 'Article Content',
  max_length: 50000,
  placeholder: 'Enter rich HTML content...'
}
```

### Number Field

```typescript
{
  name: 'quantity',
  type: 'number',
  label: 'Quantity',
  min: 0,
  max: 9999,
  step: 1,
  precision: 0,
  required: true
}
```

### Password Field

```typescript
{
  name: 'password',
  type: 'password',
  label: 'Password',
  required: true,
  min_length: 8,
  max_length: 128,
  placeholder: 'Enter secure password'
}
```

### Master-Detail Relationship

```typescript
{
  name: 'parentAccount',
  type: 'master_detail',
  label: 'Parent Account',
  reference_to: 'accounts',
  reference_field: 'name',
  searchable: true,
  required: true
}
```

### Summary/Rollup Field

```typescript
{
  name: 'totalOrders',
  type: 'summary',
  label: 'Total Orders',
  summary_object: 'orders',
  summary_field: 'amount',
  summary_type: 'sum',
  readonly: true
}
```

### Auto Number Field

```typescript
{
  name: 'invoiceNumber',
  type: 'auto_number',
  label: 'Invoice #',
  format: 'INV-{YYYY}-{0000}',
  starting_number: 1,
  readonly: true
}
```

### Object (JSON) Field

```typescript
{
  name: 'settings',
  type: 'object',
  label: 'Settings',
  schema: {
    theme: { type: 'string', enum: ['light', 'dark'] },
    notifications: { type: 'boolean' },
    language: { type: 'string' }
  }
}
```

### Vector (Embedding) Field

```typescript
{
  name: 'textEmbedding',
  type: 'vector',
  label: 'Text Embedding',
  dimensions: 1536,
  readonly: true,
  description: 'AI-generated text embedding for similarity search'
}
```

### Grid (Sub-table) Field

```typescript
{
  name: 'orderItems',
  type: 'grid',
  label: 'Order Items',
  columns: [
    {
      name: 'product',
      type: 'lookup',
      label: 'Product',
      reference_to: 'products',
      required: true
    },
    {
      name: 'quantity',
      type: 'number',
      label: 'Quantity',
      min: 1,
      step: 1
    },
    {
      name: 'unitPrice',
      type: 'currency',
      label: 'Unit Price',
      currency: 'USD',
      readonly: true
    },
    {
      name: 'total',
      type: 'currency',
      label: 'Total',
      currency: 'USD',
      formula: 'quantity * unitPrice',
      readonly: true
    }
  ]
}
```

## Advanced Form Examples

### User Registration Form

```typescript
const registrationFormSchema = {
  type: 'object-form',
  objectName: 'users',
  mode: 'create',
  title: 'Create Account',
  
  customFields: [
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      placeholder: 'you@example.com'
    },
    {
      name: 'password',
      type: 'password',
      label: 'Password',
      required: true,
      min_length: 8,
      placeholder: 'Min 8 characters'
    },
    {
      name: 'confirmPassword',
      type: 'password',
      label: 'Confirm Password',
      required: true,
      placeholder: 'Re-enter password'
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      required: true,
      max_length: 50
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      required: true,
      max_length: 50
    },
    {
      name: 'phone',
      type: 'phone',
      label: 'Phone Number',
      placeholder: '+1 (555) 123-4567'
    },
    {
      name: 'acceptTerms',
      type: 'boolean',
      label: 'I accept the terms and conditions',
      required: true
    }
  ],
  
  // Note: Field-level validation should be defined within customFields
  // using the validate property on each FormField
  
  layout: 'vertical',
  submitText: 'Sign Up',
  // Note: In JSON schemas, onSuccess uses action objects
  // In TypeScript, use a callback function: onSuccess: (data) => { ... }
  onSuccess: {
    type: 'navigate',
    path: '/welcome'
  }
};
```

### Product Management Form

```typescript
const productFormSchema = {
  type: 'object-form',
  objectName: 'products',
  mode: 'create',
  title: 'New Product',
  
  customFields: [
    {
      name: 'sku',
      type: 'auto_number',
      label: 'SKU',
      format: 'PRD-{0000}',
      readonly: true
    },
    {
      name: 'name',
      type: 'text',
      label: 'Product Name',
      required: true,
      max_length: 200
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      label: 'Short Description',
      rows: 2,
      max_length: 200
    },
    {
      name: 'fullDescription',
      type: 'html',
      label: 'Full Description',
      max_length: 10000
    },
    {
      name: 'category',
      type: 'lookup',
      label: 'Category',
      reference_to: 'categories',
      searchable: true,
      required: true
    },
    {
      name: 'price',
      type: 'currency',
      label: 'Price',
      currency: 'USD',
      precision: 2,
      min: 0,
      required: true
    },
    {
      name: 'comparePrice',
      type: 'currency',
      label: 'Compare at Price',
      currency: 'USD',
      precision: 2,
      min: 0
    },
    {
      name: 'costPrice',
      type: 'currency',
      label: 'Cost per Item',
      currency: 'USD',
      precision: 2,
      min: 0
    },
    {
      name: 'profitMargin',
      type: 'formula',
      label: 'Profit Margin %',
      formula: '((price - costPrice) / price) * 100',
      readonly: true
    },
    {
      name: 'stock',
      type: 'number',
      label: 'Stock Quantity',
      min: 0,
      step: 1,
      required: true
    },
    {
      name: 'weight',
      type: 'number',
      label: 'Weight (kg)',
      precision: 2,
      min: 0
    },
    {
      name: 'isPublished',
      type: 'boolean',
      label: 'Published',
      defaultValue: false
    },
    {
      name: 'isFeatured',
      type: 'boolean',
      label: 'Featured',
      defaultValue: false
    },
    {
      name: 'releaseDate',
      type: 'date',
      label: 'Release Date'
    },
    {
      name: 'tags',
      type: 'select',
      label: 'Tags',
      multiple: true,
      searchable: true,
      options: [
        { value: 'new', label: 'New', color: 'green' },
        { value: 'sale', label: 'Sale', color: 'red' },
        { value: 'bestseller', label: 'Best Seller', color: 'blue' }
      ]
    },
    {
      name: 'images',
      type: 'image',
      label: 'Product Images',
      multiple: true,
      max_files: 6,
      max_size: 5242880,
      accept: ['image/jpeg', 'image/png', 'image/webp']
    },
    {
      name: 'variants',
      type: 'grid',
      label: 'Product Variants',
      columns: [
        { 
          name: 'size', 
          type: 'select', 
          label: 'Size', 
          options: [
            { label: 'S', value: 'S' },
            { label: 'M', value: 'M' },
            { label: 'L', value: 'L' },
            { label: 'XL', value: 'XL' }
          ]
        },
        { 
          name: 'color', 
          type: 'select', 
          label: 'Color', 
          options: [
            { label: 'Red', value: 'Red' },
            { label: 'Blue', value: 'Blue' },
            { label: 'Green', value: 'Green' }
          ]
        },
        { name: 'sku', type: 'text', label: 'SKU' },
        { name: 'stock', type: 'number', label: 'Stock', min: 0 },
        { name: 'price', type: 'currency', label: 'Price', currency: 'USD' }
      ]
    },
    {
      name: 'metadata',
      type: 'object',
      label: 'Custom Metadata'
    }
  ],
  
  groups: [
    {
      title: 'Basic Information',
      fields: ['sku', 'name', 'shortDescription', 'fullDescription', 'category']
    },
    {
      title: 'Pricing',
      fields: ['price', 'comparePrice', 'costPrice', 'profitMargin']
    },
    {
      title: 'Inventory',
      fields: ['stock', 'weight']
    },
    {
      title: 'Publishing',
      fields: ['isPublished', 'isFeatured', 'releaseDate', 'tags']
    },
    {
      title: 'Media',
      fields: ['images']
    },
    {
      title: 'Variants',
      fields: ['variants'],
      collapsible: true
    },
    {
      title: 'Advanced',
      fields: ['metadata'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  
  layout: 'vertical',
  submitText: 'Create Product',
  showCancel: true
};
```

### Settings Form with Conditional Fields

```typescript
const settingsFormSchema = {
  type: 'object-form',
  objectName: 'settings',
  mode: 'edit',
  recordId: 'current',
  title: 'Account Settings',
  
  customFields: [
    {
      name: 'displayName',
      type: 'text',
      label: 'Display Name',
      required: true,
      max_length: 100
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      readonly: true
    },
    {
      name: 'phone',
      type: 'phone',
      label: 'Phone Number'
    },
    {
      name: 'avatar',
      type: 'image',
      label: 'Profile Picture',
      max_size: 2097152,
      accept: ['image/jpeg', 'image/png']
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Bio',
      rows: 4,
      max_length: 500
    },
    {
      name: 'website',
      type: 'url',
      label: 'Website'
    },
    {
      name: 'location',
      type: 'location',
      label: 'Location'
    },
    {
      name: 'emailNotifications',
      type: 'boolean',
      label: 'Email Notifications',
      defaultValue: true
    },
    {
      name: 'notificationEmail',
      type: 'email',
      label: 'Notification Email',
      visible_on: {
        field: 'emailNotifications',
        operator: '=',
        value: true
      }
    },
    {
      name: 'pushNotifications',
      type: 'boolean',
      label: 'Push Notifications',
      defaultValue: false
    },
    {
      name: 'language',
      type: 'select',
      label: 'Language',
      options: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Español' },
        { value: 'fr', label: 'Français' },
        { value: 'de', label: 'Deutsch' },
        { value: 'zh', label: '中文' }
      ],
      defaultValue: 'en'
    },
    {
      name: 'timezone',
      type: 'select',
      label: 'Timezone',
      searchable: true,
      options: [
        { value: 'UTC', label: 'UTC' },
        { value: 'America/New_York', label: 'Eastern Time' },
        { value: 'America/Chicago', label: 'Central Time' },
        { value: 'America/Denver', label: 'Mountain Time' },
        { value: 'America/Los_Angeles', label: 'Pacific Time' }
      ]
    },
    {
      name: 'preferences',
      type: 'object',
      label: 'Additional Preferences',
      schema: {
        theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
        compactMode: { type: 'boolean' },
        showTips: { type: 'boolean' }
      }
    }
  ],
  
  groups: [
    {
      title: 'Profile',
      fields: ['displayName', 'email', 'phone', 'avatar', 'bio', 'website', 'location']
    },
    {
      title: 'Notifications',
      fields: ['emailNotifications', 'notificationEmail', 'pushNotifications']
    },
    {
      title: 'Localization',
      fields: ['language', 'timezone']
    },
    {
      title: 'Advanced',
      fields: ['preferences'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  
  layout: 'vertical',
  submitText: 'Save Settings'
};
```

## Field Type Feature Matrix

| Field Type | Cell View | Form Control | Sortable | Filterable | Searchable |
|------------|-----------|--------------|----------|------------|------------|
| text | ✓ | ✓ | ✓ | ✓ | ✓ |
| textarea | ✓ | ✓ | ✓ | ✓ | ✓ |
| markdown | ✓ | ✓ | ✓ | ✓ | ✓ |
| html | ✓ | ✓ | - | - | ✓ |
| number | ✓ | ✓ | ✓ | ✓ | ✓ |
| currency | ✓ | ✓ | ✓ | ✓ | - |
| percent | ✓ | ✓ | ✓ | ✓ | - |
| boolean | ✓ | ✓ | ✓ | ✓ | - |
| date | ✓ | ✓ | ✓ | ✓ | - |
| datetime | ✓ | ✓ | ✓ | ✓ | - |
| time | ✓ | ✓ | ✓ | ✓ | - |
| select | ✓ | ✓ | ✓ | ✓ | ✓ |
| email | ✓ | ✓ | ✓ | ✓ | ✓ |
| phone | ✓ | ✓ | ✓ | ✓ | ✓ |
| url | ✓ | ✓ | ✓ | ✓ | ✓ |
| password | Masked | ✓ | - | - | - |
| file | ✓ | ✓ | - | - | - |
| image | ✓ | ✓ | - | - | - |
| location | ✓ | ✓ | - | ✓ | - |
| lookup | ✓ | ✓ | ✓ | ✓ | ✓ |
| master_detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| formula | ✓ | Read-only | ✓ | - | - |
| summary | ✓ | Read-only | ✓ | - | - |
| auto_number | ✓ | Read-only | ✓ | ✓ | ✓ |
| user | ✓ | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ | ✓ |
| object | ✓ | ✓ | - | - | - |
| vector | ✓ | Read-only | - | - | - |
| grid | ✓ | ✓ | - | - | - |

✓ = Supported | - = Not applicable
