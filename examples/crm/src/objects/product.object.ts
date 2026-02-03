import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ProductObject = ObjectSchema.create({
  name: 'product',
  label: 'Product',
  icon: 'package',
  fields: {
    name: Field.text({ label: 'Product Name', required: true, searchable: true }),
    sku: Field.text({ label: 'SKU', required: true, searchable: true }),
    category: Field.select(['Electronics', 'Furniture', 'Clothing', 'Services'], { label: 'Category', filterable: true }),
    price: Field.currency({ label: 'Price', sortable: true }),
    stock: Field.number({ label: 'Stock', sortable: true }),
    description: Field.textarea({ label: 'Description' }),
    image: Field.url({ label: 'Image URL' })
  },
  list_views: {
    all: {
      label: 'All Products',
      columns: ['name', 'sku', 'category', 'price', 'stock']
    },
    low_stock: {
      label: 'Low Stock',
      columns: ['name', 'stock', 'price'],
      filter: [['stock', '<', 10]]
    }
  }
});
