import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Feature Showcase Object — demonstrates conditional fields (dependsOn, visibleOn),
 * actions with parameters, and various form configurations.
 */
export const ShowcaseObject = ObjectSchema.create({
  name: 'showcase',
  label: 'Feature Showcase',
  icon: 'sparkles',
  description: 'Demonstrates dependsOn, visibleOn, actions with params, and page templates',
  fields: {
    // Basic info
    title: Field.text({ label: 'Title', required: true, searchable: true }),
    description: Field.textarea({ label: 'Description' }),

    // Category field — other fields depend on this
    category: Field.select({
      options: [
        { label: 'Software', value: 'software' },
        { label: 'Hardware', value: 'hardware' },
        { label: 'Service', value: 'service' },
      ],
      label: 'Category',
    }),

    // Sub-category depends on category selection
    sub_category: Field.select({
      options: [
        { label: 'Web App', value: 'web_app' },
        { label: 'Mobile App', value: 'mobile_app' },
        { label: 'Desktop App', value: 'desktop_app' },
        { label: 'Server', value: 'server' },
        { label: 'Laptop', value: 'laptop' },
        { label: 'Peripheral', value: 'peripheral' },
        { label: 'Consulting', value: 'consulting' },
        { label: 'Support', value: 'support' },
        { label: 'Training', value: 'training' },
      ],
      label: 'Sub-Category',
    }),

    // Priority
    priority: Field.select({
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
      label: 'Priority',
    }),

    // Status
    status: Field.select({
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Review', value: 'review' },
        { label: 'Completed', value: 'completed' },
        { label: 'Archived', value: 'archived' },
      ],
      label: 'Status',
      defaultValue: 'draft',
    }),

    // Pricing - visible only when status is active
    price: Field.currency({ label: 'Price', scale: 2 }),
    discount_percent: Field.percent({ label: 'Discount %', scale: 1 }),

    // Date fields
    start_date: Field.date({ label: 'Start Date' }),
    end_date: Field.date({ label: 'End Date' }),

    // Contact
    owner_email: Field.email({ label: 'Owner Email' }),
    is_featured: Field.boolean({ label: 'Featured', defaultValue: false }),

    // Tags
    tags: Field.select({
      options: [
        { label: 'New', value: 'new' },
        { label: 'Popular', value: 'popular' },
        { label: 'Sale', value: 'sale' },
        { label: 'Premium', value: 'premium' },
      ],
      multiple: true,
      label: 'Tags',
    }),

    // Notes — rich text
    notes: Field.richtext({ label: 'Notes' }),
  },

  list_views: {
    all: {
      label: 'All Items',
      columns: ['title', 'category', 'sub_category', 'priority', 'status', 'price', 'start_date'],
    },
    active: {
      label: 'Active Items',
      columns: ['title', 'category', 'priority', 'price', 'owner_email'],
      filter: [['status', '=', 'active']],
    },
    featured: {
      label: 'Featured',
      columns: ['title', 'category', 'price', 'tags'],
      filter: [['is_featured', '=', true]],
    },
  },

  form_views: {
    default: {
      label: 'Default Form',
      type: 'simple',
      sections: [
        {
          label: 'Basic Information',
          columns: 2,
          fields: [
            { field: 'title', colSpan: 2 },
            { field: 'description', colSpan: 2 },
            { field: 'category' },
            // sub_category depends on category being selected
            { field: 'sub_category', dependsOn: 'category' },
            { field: 'priority' },
            { field: 'status' },
          ],
        },
        {
          label: 'Pricing',
          columns: 2,
          fields: [
            // Price fields only visible when status is 'active' or 'review'
            { field: 'price', visibleOn: "${data.status === 'active' || data.status === 'review'}" },
            { field: 'discount_percent', visibleOn: "${data.status === 'active' || data.status === 'review'}" },
          ],
        },
        {
          label: 'Schedule & Contact',
          columns: 2,
          fields: [
            { field: 'start_date' },
            { field: 'end_date', dependsOn: 'start_date' },
            { field: 'owner_email' },
            { field: 'is_featured' },
          ],
        },
        {
          label: 'Additional',
          fields: [
            { field: 'tags' },
            { field: 'notes', colSpan: 2 },
          ],
        },
      ],
    },
  },

  actions: [
    {
      name: 'assign_owner',
      label: 'Assign Owner',
      icon: 'user-plus',
      type: 'api',
      locations: ['list_toolbar', 'record_header'],
      params: [
        {
          name: 'owner_email',
          label: 'Owner Email',
          type: 'text',
          required: true,
          placeholder: 'owner@example.com',
          helpText: 'Email address of the new owner',
        },
        {
          name: 'notify',
          label: 'Send Notification',
          type: 'boolean',
          defaultValue: true,
          helpText: 'Send an email notification to the new owner',
        },
      ],
      successMessage: 'Owner assigned successfully',
      refreshAfter: true,
    },
    {
      name: 'change_status',
      label: 'Change Status',
      icon: 'arrow-right-circle',
      type: 'api',
      locations: ['list_item', 'record_header'],
      params: [
        {
          name: 'new_status',
          label: 'New Status',
          type: 'select',
          required: true,
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Active', value: 'active' },
            { label: 'Review', value: 'review' },
            { label: 'Completed', value: 'completed' },
            { label: 'Archived', value: 'archived' },
          ],
        },
        {
          name: 'reason',
          label: 'Reason for Change',
          type: 'textarea',
          placeholder: 'Describe why the status is changing...',
        },
      ],
      confirmText: 'Are you sure you want to change the status?',
      successMessage: 'Status updated successfully',
      refreshAfter: true,
    },
    {
      name: 'export_report',
      label: 'Export Report',
      icon: 'download',
      type: 'api',
      locations: ['list_toolbar'],
      params: [
        {
          name: 'format',
          label: 'Export Format',
          type: 'select',
          required: true,
          options: [
            { label: 'CSV', value: 'csv' },
            { label: 'Excel', value: 'xlsx' },
            { label: 'PDF', value: 'pdf' },
          ],
          defaultValue: 'csv',
        },
        {
          name: 'include_archived',
          label: 'Include Archived',
          type: 'boolean',
          defaultValue: false,
        },
        {
          name: 'date_range_start',
          label: 'From Date',
          type: 'date',
        },
        {
          name: 'date_range_end',
          label: 'To Date',
          type: 'date',
        },
      ],
      successMessage: 'Report exported successfully',
    },
  ],
});
