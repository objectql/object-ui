export const ProductView = {
  listViews: {
    all_products: {
      name: 'all_products',
      label: 'All Products',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'product' },
      columns: ['name', 'sku', 'category', 'price', 'stock', 'is_active'],
      sort: [{ field: 'name', order: 'asc' as const }],
    },
    active_products: {
      name: 'active_products',
      label: 'Active Products',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'product' },
      columns: ['name', 'sku', 'category', 'price', 'stock', 'tags'],
      filter: ['is_active', '=', true],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'product' },
    sections: [
      {
        label: 'Product Details',
        columns: '2' as const,
        fields: ['name', 'sku', 'category', 'manufacturer', 'is_active', 'tags'],
      },
      {
        label: 'Pricing & Inventory',
        columns: '2' as const,
        fields: ['price', 'stock', 'weight'],
      },
      {
        label: 'Media & Description',
        columns: '1' as const,
        collapsible: true,
        fields: ['image', 'description'],
      },
    ],
  },
};
