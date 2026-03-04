import { ObjectSchema, Field } from '@objectstack/spec/data';

export const KitchenSinkObject = ObjectSchema.create({
  name: 'kitchen_sink',
  label: 'Kitchen Sink',
  icon: 'utensils',
  description: 'Shows all available field types for testing',
  fields: {
    // Basic Text
    name: Field.text({ label: 'Text (Name)', required: true, searchable: true }),
    description: Field.textarea({ label: 'Text Area' }),
    code: Field.code('json', { label: 'Code' }), 
    password: Field.password({ label: 'Password' }),
    
    // Numbers
    amount: Field.number({ label: 'Number (Int)', scale: 0 }),
    price: Field.currency({ label: 'Currency', scale: 2 }),
    percent: Field.percent({ label: 'Percentage', scale: 2 }),
    rating: Field.rating(5, { label: 'Rating' }),

    // Date & Time
    due_date: Field.date({ label: 'Date' }),
    event_time: Field.datetime({ label: 'Date Time' }),
    
    // Boolean
    is_active: Field.boolean({ label: 'Boolean (Switch)', defaultValue: true }),
    
    // Selection
    category: Field.select({
      options: [
        { label: 'Option A', value: 'opt_a' },
        { label: 'Option B', value: 'opt_b' },
        { label: 'Option C', value: 'opt_c' }
      ],
      label: 'Select (Dropdown)'
    }),
    tags: Field.select({
        options: [
          { label: 'Red', value: 'col_red' },
          { label: 'Green', value: 'col_green' },
          { label: 'Blue', value: 'col_blue' }
        ],
        multiple: true,
        label: 'Multi Select'
    }),

    // Contact & specialized
    email: Field.email({ label: 'Email' }),
    url: Field.url({ label: 'URL' }),
    phone: Field.phone({ label: 'Phone' }),
    avatar: Field.avatar({ label: 'Avatar' }),
    color: Field.color({ label: 'Color Picker' }),
    
    // Rich Content
    rich_text: Field.richtext({ label: 'Rich Text' }),
    image: Field.image({ label: 'Image Upload' }),
    file: Field.file({ label: 'File Upload' }),
    signature: Field.signature({ label: 'Signature' }),
    
    // Relationships
    // ks_account is a minimal account object scoped to the kitchen-sink plugin
    // to avoid name conflicts with CRM's account object.
    account: Field.lookup('ks_account', { label: 'Lookup (Account)' }),
    
    // Location
    location: Field.location({ label: 'Location' }),
    
    // System/Readonly
    formula_field: Field.formula({ 
        expression: '{amount} * {price}', 
        label: 'Formula (Amount * Price)' 
    }),
    auto_number: Field.autonumber({ label: 'Auto Number' }),
  }
});
