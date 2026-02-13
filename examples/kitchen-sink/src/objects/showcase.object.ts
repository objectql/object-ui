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
  }
});
