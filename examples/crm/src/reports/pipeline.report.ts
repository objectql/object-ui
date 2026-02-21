export const PipelineReport = {
  name: 'pipeline_report',
  label: 'Pipeline Report',
  description: 'Sales pipeline analysis by stage, forecast category, and expected close date',
  objectName: 'opportunity',
  type: 'summary' as const,
  columns: [
    { field: 'name', label: 'Opportunity' },
    { field: 'amount', label: 'Amount', aggregate: 'sum' as const },
    { field: 'expected_revenue', label: 'Expected Revenue', aggregate: 'sum' as const },
    { field: 'stage', label: 'Stage' },
    { field: 'probability', label: 'Probability' },
    { field: 'close_date', label: 'Close Date' },
    { field: 'forecast_category', label: 'Forecast' },
  ],
  groupingsDown: [{ field: 'stage', sortOrder: 'asc' as const }],
  filter: { field: 'stage', op: 'neq', value: 'closed_lost' },
  chart: { type: 'bar' as const, xAxis: 'stage', yAxis: 'amount', groupBy: 'stage' },
};
