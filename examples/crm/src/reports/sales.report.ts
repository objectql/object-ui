export const SalesReport = {
  name: 'sales_report',
  label: 'Sales Report',
  description: 'Monthly sales performance breakdown by account and product category',
  objectName: 'order',
  type: 'summary',
  columns: [
    { field: 'name', label: 'Order Number' },
    { field: 'account', label: 'Account' },
    { field: 'amount', label: 'Amount', aggregate: 'sum' },
    { field: 'status', label: 'Status' },
    { field: 'order_date', label: 'Order Date' },
    { field: 'payment_method', label: 'Payment Method' },
  ],
  groupingsDown: [{ field: 'status', sortOrder: 'asc' }],
  chart: { type: 'bar', xAxis: 'status', yAxis: 'amount', groupBy: 'status' },
};
