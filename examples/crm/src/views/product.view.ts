export const ProductView = {
  listViews: {
    all_products: {
      name: 'all_products',
      label: 'All Products',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'product' },
      columns: [
        { field: 'name', label: 'NAME', width: 250 },
        { field: 'sku', label: 'SKU', width: 120 },
        { field: 'category', label: 'CATEGORY', type: 'select' as const, width: 110 },
        { field: 'price', label: 'PRICE', type: 'currency' as const, width: 120, align: 'right' as const },
        { field: 'stock', label: 'STOCK', type: 'number' as const, width: 80, align: 'right' as const },
        { field: 'is_active', label: 'IS ACTIVE', type: 'boolean' as const, width: 90 },
      ],
      sort: [{ field: 'name', order: 'asc' as const }],
      rowHeight: 'short' as const,
      conditionalFormatting: [
        {
          condition: '${data.stock === 0}',
          style: { backgroundColor: '#fee2e2', color: '#991b1b' },
        },
        {
          condition: '${data.stock < 5}',
          style: { backgroundColor: '#fef9c3', color: '#854d0e' },
        },
      ],
    },
    active_products: {
      name: 'active_products',
      label: 'Active Products',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'product' },
      columns: [
        { field: 'name', label: 'NAME', width: 250 },
        { field: 'sku', label: 'SKU', width: 120 },
        { field: 'category', label: 'CATEGORY', type: 'select' as const, width: 110 },
        { field: 'price', label: 'PRICE', type: 'currency' as const, width: 120, align: 'right' as const },
        { field: 'stock', label: 'STOCK', type: 'number' as const, width: 80, align: 'right' as const },
        { field: 'tags', label: 'TAGS', type: 'select' as const, width: 130 },
      ],
      filter: ['is_active', '=', true],
      rowHeight: 'short' as const,
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
