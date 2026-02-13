import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ProductObject = ObjectSchema.create({
  name: 'product',
  label: 'Product',
  icon: 'package',
  fields: {
    name: Field.text({ label: 'Product Name', required: true, searchable: true }),
    sku: Field.text({ label: 'SKU', required: true, searchable: true }),
    category: Field.select(['Electronics', 'Furniture', 'Clothing', 'Services'], { label: 'Category' }),
    price: Field.currency({ label: 'Price' }),
    stock: Field.number({ label: 'Stock' }),
    description: Field.textarea({ label: 'Description' }),
    image: Field.url({ label: 'Image URL' })
  }
});
