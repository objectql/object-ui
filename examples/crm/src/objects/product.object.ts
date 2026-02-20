import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ProductObject = ObjectSchema.create({
  name: 'product',
  label: 'Product',
  icon: 'package',
  description: 'Product catalog with pricing, inventory, and categorization',
  fields: {
    name: Field.text({ label: 'Product Name', required: true, searchable: true }),
    sku: Field.text({ label: 'SKU', required: true, searchable: true, unique: true }),
    category: Field.select([
      { value: 'electronics', label: 'Electronics', color: 'blue' },
      { value: 'furniture', label: 'Furniture', color: 'yellow' },
      { value: 'clothing', label: 'Clothing', color: 'pink' },
      { value: 'services', label: 'Services', color: 'green' },
    ], { label: 'Category' }),
    price: Field.currency({ label: 'Price', scale: 2 }),
    stock: Field.number({ label: 'Stock' }),
    weight: Field.number({ label: 'Weight (kg)', scale: 2 }),
    manufacturer: Field.text({ label: 'Manufacturer', searchable: true }),
    is_active: Field.boolean({ label: 'Active', defaultValue: true }),
    tags: Field.select({
      options: [
        { label: 'New Arrival', value: 'new', color: 'green' },
        { label: 'Best Seller', value: 'best_seller', color: 'purple' },
        { label: 'On Sale', value: 'on_sale', color: 'red' },
        { label: 'Clearance', value: 'clearance', color: 'yellow' },
      ],
      multiple: true,
      label: 'Tags',
    }),
    description: Field.richtext({ label: 'Description' }),
    image: Field.url({ label: 'Image URL' })
  }
});
