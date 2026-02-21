export const PipelineReport = {
  name: 'pipeline_report',
  label: 'Pipeline Report',
  description: 'Sales pipeline analysis by stage, forecast category, and expected close date',
  objectName: 'opportunity',
  type: 'summary',
  columns: [
    { field: 'name', label: 'Opportunity' },
    { field: 'amount', label: 'Amount', aggregate: 'sum' },
    { field: 'expected_revenue', label: 'Expected Revenue', aggregate: 'sum' },
    { field: 'stage', label: 'Stage' },
    { field: 'probability', label: 'Probability' },
    { field: 'close_date', label: 'Close Date' },
    { field: 'forecast_category', label: 'Forecast' },
  ],
  groupingsDown: [{ field: 'stage', sortOrder: 'asc' }],
  filter: { field: 'stage', op: 'neq', value: 'closed_lost' },
  chart: { type: 'bar', xAxis: 'stage', yAxis: 'amount', groupBy: 'stage' },
};
