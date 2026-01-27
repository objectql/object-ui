// examples/crm-app/src/schema.ts
import { 
  PageSchema, 
  ObjectSchemaMetadata
} from '@object-ui/types';

// 1. Define Contact Object
export const ContactObject: ObjectSchemaMetadata = {
  name: 'contact',
  label: 'Contact',
  fields: {
    first_name: {
      name: 'first_name',
      label: 'First Name',
      type: 'text',
      required: true
    },
    last_name: {
      name: 'last_name',
      label: 'Last Name',
      type: 'text',
      required: true
    },
    email: {
      name: 'email',
      label: 'Email',
      type: 'text' // Should beemail
    },
    phone: {
      name: 'phone',
      label: 'Phone',
      type: 'text' // Should be phone
    },
    lead_source: {
      name: 'lead_source',
      label: 'Lead Source',
      type: 'select',
      options: [
        { label: 'Web', value: 'web' },
        { label: 'Referral', value: 'referral' },
        { label: 'Partner', value: 'partner' },
        { label: 'Other', value: 'other' }
      ]
    },
    active: {
      name: 'active',
      label: 'Active',
      type: 'boolean',
      // widget: 'switch', // Removed to satisfy strict typing
      defaultValue: true
    },
    birthdate: {
      name: 'birthdate',
      label: 'Birthdate',
      type: 'date'
    },
    description: {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 4
    },
    annual_revenue: {
      name: 'annual_revenue',
      label: 'Annual Revenue',
      type: 'number',
      precision: 2
    }
  }
};

// 2. Define Sample Data
export const contactData = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  phone: '555-123-4567',
  lead_source: 'web',
  active: true,
  birthdate: '1985-04-12',
  description: 'A valuable customer interested in enterprise solutions.',
  annual_revenue: 500000.00
};

// 3. Define Page Schema (The UI to render)
export const ContactFormPage: PageSchema = {
  type: 'page',
  title: 'Edit Contact',
  layout: 'single-column',
  children: [
    {
      type: 'form',
      id: 'contact_form',
      object: 'contact',
      props: {
        className: 'space-y-6',
        layout: 'grid', // Suggestion for future implementation
        cols: 2
      },
      children: [
        {
          type: 'field',
          name: 'first_name',
          bind: 'first_name',
          props: { className: 'col-span-1' }
        },
        {
          type: 'field',
          name: 'last_name',
          bind: 'last_name',
          props: { className: 'col-span-1' }
        },
        {
          type: 'field',
          name: 'email',
          bind: 'email',
          props: { className: 'col-span-1' }
        },
         {
          type: 'field',
          name: 'phone',
          bind: 'phone',
          props: { className: 'col-span-1' }
        },
        {
          type: 'field',
          name: 'lead_source',
          bind: 'lead_source',
          props: { className: 'col-span-1' }
        },
        {
          type: 'field',
          name: 'active',
          bind: 'active',
          props: { className: 'col-span-1' }
        },
        {
          type: 'field',
          name: 'annual_revenue',
          bind: 'annual_revenue',
          props: { className: 'col-span-1' }
        },
        {
          type: 'field',
          name: 'birthdate',
          bind: 'birthdate',
          props: { className: 'col-span-1' }
        },
        {
          type: 'field',
          name: 'description',
          bind: 'description',
          props: { className: 'col-span-2' }
        }
      ]
    }
  ]
};
