/**
 * DEV-ONLY sample drafts for the metadata-designer gallery harness.
 * Not shipped in production builds (referenced only by preview-gallery.tsx).
 */

export const SAMPLES: Record<string, Record<string, unknown>> = {
  object: {
    name: 'sales_order',
    label: 'Sales Order',
    description: 'Customer purchase orders and their line items.',
    fields: [
      { name: 'name', label: 'Order Name', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'currency' },
      { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Open', 'Closed'] },
      { name: 'close_date', label: 'Close Date', type: 'date' },
      { name: 'account', label: 'Account', type: 'lookup', reference_to: 'account' },
      { name: 'is_priority', label: 'Priority', type: 'boolean' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  page: {
    name: 'crm_welcome',
    label: 'CRM Welcome',
    regions: [
      {
        name: 'main',
        components: [
          { type: 'heading', props: { level: 1, text: 'Welcome to the CRM' } },
          { type: 'text', props: { text: 'Track accounts, contacts, and deals in one place.' } },
          { type: 'separator' },
          { type: 'heading', props: { level: 3, text: 'Quick links' } },
          { type: 'text', props: { text: 'Open the pipeline, review tasks, or create a new lead.' } },
        ],
      },
    ],
  },

  view: {
    name: 'open_orders',
    label: 'Open Orders',
    object: 'sales_order',
    list: {
      type: 'grid',
      object: 'sales_order',
      columns: ['name', 'amount', 'status', 'close_date'],
    },
  },

  dashboard: {
    name: 'sales_overview',
    label: 'Sales Overview',
    widgets: [
      { id: 'kpi_revenue', type: 'metric', title: 'Revenue', value: 128400, format: 'currency' },
      { id: 'kpi_orders', type: 'metric', title: 'Orders', value: 342 },
      { id: 'chart_trend', type: 'chart', title: 'Monthly Trend' },
    ],
  },

  report: {
    name: 'orders_by_status',
    label: 'Orders by Status',
    object: 'sales_order',
    columns: [
      { field: 'name', label: 'Order' },
      { field: 'status', label: 'Status' },
      { field: 'amount', label: 'Amount' },
    ],
    groupBy: ['status'],
  },

  app: {
    name: 'crm',
    label: 'CRM',
    icon: 'briefcase',
    landing: '/apps/crm/home',
    navigation: [
      { label: 'Home', path: '/apps/crm/home', kind: 'page' },
      { label: 'Accounts', object: 'account', path: '/apps/crm/accounts' },
      { label: 'Sales Orders', object: 'sales_order', path: '/apps/crm/orders' },
      { label: 'Dashboard', dashboard: 'sales_overview', path: '/apps/crm/dashboard' },
      {
        label: 'Admin',
        children: [
          { label: 'Settings', path: '/apps/crm/settings', kind: 'page' },
          { label: 'Docs', path: 'https://docs.example.com' },
        ],
      },
    ],
  },

  action: {
    name: 'close_order',
    label: 'Close Order',
    type: 'server',
    objectName: 'sales_order',
    icon: 'check',
    variant: 'default',
    locations: ['record', 'list'],
    confirmText: 'Close this order? This cannot be undone.',
    successMessage: 'Order closed.',
    bulkEnabled: true,
    refreshAfter: true,
  },

  flow: {
    name: 'renewal_reminder_flow',
    label: 'Renewal Reminder',
    status: 'active',
    version: 2,
    runAs: 'system',
    type: 'scheduled',
    variables: [
      { name: 'daysBefore', type: 'number', isInput: true, description: 'Lead time in days' },
      { name: 'contract', type: 'object', isInput: true },
      { name: 'reminded', type: 'boolean', isOutput: true },
    ],
    nodes: [
      { id: 'start', type: 'start', label: 'Schedule (daily)', config: { triggerType: 'schedule', objectName: 'contract', condition: 'status == "active"', cron: '0 9 * * *' } },
      { id: 'find', type: 'get_record', label: 'Find expiring contracts', config: { objectName: 'contract', filter: { status: 'active' }, outputVariable: 'contracts' } },
      // ADR-0031 structured container: a loop whose `config.body` region is a
      // nested sub-graph. On the designer canvas it expands inline (#2680) and
      // its body nodes are selectable + editable through the same schema-driven
      // inspector as top-level nodes (#2670 Phase 3).
      {
        id: 'each_contract',
        type: 'loop',
        label: 'For each expiring contract',
        config: {
          collection: '{contracts}',
          iteratorVariable: 'contract',
          body: {
            nodes: [
              { id: 'charge_fee', type: 'http_request', label: 'Charge renewal fee', config: { method: 'POST', url: 'https://api.example.com/billing/charge', outputVariable: 'charge' } },
            ],
            edges: [],
          },
        },
      },
      { id: 'fan_out', type: 'parallel', label: 'Notify in parallel', config: { branches: [ { name: 'Email the owner', nodes: [ { id: 'email_owner', type: 'script', label: 'Email Owner', config: { actionType: 'email', template: 'renewal_reminder', recipients: ['owner.email'] } } ], edges: [] }, { name: 'Post to Slack', nodes: [ { id: 'slack_post', type: 'script', label: 'Slack Notify', config: { actionType: 'slack' } } ], edges: [] } ] } },
      { id: 'guard', type: 'try_catch', label: 'Push with retry', config: { errorVariable: '$error', try: { nodes: [ { id: 'push', type: 'http_request', label: 'Push to CRM', config: { method: 'POST', url: 'https://api.example.com/v1/tasks' } } ], edges: [] }, catch: { nodes: [ { id: 'record_failure', type: 'update_record', label: 'Flag Sync Failure', config: { objectName: 'contract', fields: { reminded: false } } } ], edges: [] } } },
      { id: 'check', type: 'decision', label: 'Within reminder window?', config: { conditions: [ { label: 'Within window', expression: 'daysToExpiry <= daysBefore' }, { label: 'Else', expression: 'true' } ] } },
      { id: 'email', type: 'connector_action', label: 'Send renewal email', connectorConfig: { connectorId: 'email', actionId: 'send', input: { to: 'owner.email', template: 'renewal_reminder' } } },
      { id: 'wait', type: 'wait', label: 'Wait 3 days', waitEventConfig: { eventType: 'timer', timerDuration: 'P3D', onTimeout: 'continue' } },
      { id: 'task', type: 'create_record', label: 'Create CSM follow-up', config: { objectName: 'task', fields: { subject: 'Renewal follow-up', priority: 'high' } } },
      { id: 'skip', type: 'update_record', label: 'Mark as not due', config: { objectName: 'contract', filter: { id: '{contractId}' }, fields: { reminded: false } } },
      { id: 'review', type: 'screen', label: 'CSM review', config: { fields: [ { name: 'discount', label: 'Discount %', type: 'number', required: false }, { name: 'note', label: 'Note', type: 'text', required: true, visibleWhen: 'discount > 0' } ] } },
      { id: 'notify', type: 'script', label: 'Email the owner', config: { actionType: 'email', template: 'renewal_reminder', recipients: ['owner.email', 'csm@example.com'], variables: { contractId: '{contractId}' } } },
      { id: 'enrich', type: 'script', label: 'Score (code)', config: { script: "variables.score = 42;\nreturn variables;", outputVariables: ['score'] } },
      { id: 'end', type: 'end', label: 'End', config: { outcome: 'success' } },
    ],
    edges: [
      { source: 'start', target: 'find' },
      { source: 'find', target: 'each_contract' },
      { source: 'each_contract', target: 'fan_out' },
      { source: 'fan_out', target: 'guard' },
      { source: 'guard', target: 'check' },
      { source: 'check', target: 'email', condition: 'daysToExpiry <= daysBefore' },
      { source: 'check', target: 'skip', isDefault: true },
      { source: 'email', target: 'wait' },
      { source: 'wait', target: 'task' },
      { source: 'task', target: 'review' },
      { source: 'review', target: 'notify' },
      { source: 'notify', target: 'enrich' },
      { source: 'enrich', target: 'end' },
      { source: 'skip', target: 'end' },
    ],
  },

  workflow: {
    name: 'on_order_won',
    label: 'On Order Won',
    object: 'sales_order',
    active: true,
    triggerType: 'onUpdate',
    criteria: "status == 'Closed'",
    executionOrder: 1,
    actions: [
      { type: 'fieldUpdate', label: 'Set Won Date', field: 'won_date' },
      { type: 'email', label: 'Notify Owner' },
      { type: 'task', label: 'Create Follow-up Task' },
    ],
    timeTriggers: [{ label: 'Reminder', offset: '2 days' }],
  },

  approval: {
    name: 'expense_approval',
    label: 'Expense Approval',
    object: 'expense',
    active: true,
    entryCriteria: 'amount > 500',
    lockRecord: true,
    approvalStatusField: 'approval_status',
    steps: [
      { label: 'Manager Review', approvers: ['manager'], criteria: 'amount <= 5000' },
      { label: 'Finance Review', approvers: ['finance_team'] },
      { label: 'VP Sign-off', approvers: ['vp'], criteria: 'amount > 20000' },
    ],
    onFinalApprove: [{ type: 'fieldUpdate', label: 'Mark Approved' }],
    onFinalReject: [{ type: 'email', label: 'Notify Submitter' }],
  },

  job: {
    name: 'nightly_sync',
    label: 'Nightly Sync',
    description: 'Sync external orders into the warehouse.',
    enabled: true,
    schedule: { type: 'cron', expression: '0 2 * * *', timezone: 'UTC' },
    handler: 'syncOrders',
    concurrency: 1,
    retryPolicy: { maxRetries: 3 },
    timeoutMs: 600000,
  },

  agent: {
    name: 'sales_copilot',
    label: 'Sales Copilot',
    role: 'Assistant for sales reps',
    active: true,
    model: { provider: 'openai', model: 'gpt-4o', temperature: 0.4, maxTokens: 2048 },
    instructions:
      'You are a helpful sales assistant. Answer questions about accounts and orders, and draft follow-up emails. Always cite the record you used.',
    skills: ['summarize_account', 'draft_email'],
    tools: [
      { type: 'objectql', name: 'query_orders' },
      { type: 'http', name: 'lookup_company' },
    ],
    knowledge: { sources: [{ name: 'sales_playbook', type: 'index' }] },
  },

  tool: {
    name: 'query_orders',
    label: 'Query Orders',
    category: 'data',
    description: 'Run a parameterized ObjectQL query against sales orders.',
    active: true,
    objectName: 'sales_order',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', description: 'Filter by status' },
        limit: { type: 'number', description: 'Max rows' },
      },
    },
    outputSchema: { type: 'array' },
  },

  skill: {
    name: 'draft_email',
    label: 'Draft Email',
    type: 'prompt',
    description: 'Draft a follow-up email from a record context.',
    active: true,
    instructions: 'Write a concise, friendly follow-up email referencing the order.',
    tools: ['lookup_company'],
    triggerPhrases: ['draft an email', 'follow up'],
    triggerConditions: [{ expression: "record.status == 'Open'" }],
  },

  permission: {
    name: 'sales_rep',
    label: 'Sales Rep',
    objects: {
      sales_order: { allowRead: true, allowCreate: true, allowEdit: true, allowDelete: false },
      account: { allowRead: true, allowCreate: false, allowEdit: true, allowDelete: false },
    },
    fields: {
      'sales_order.amount': { readable: true, editable: false },
    },
    systemPermissions: ['runReports', 'exportData'],
    tabPermissions: { crm: 'visible', admin: 'hidden' },
  },

  position: {
    name: 'sales_manager',
    label: 'Sales Manager',
    description: 'Manages the regional sales team.',
  },

  datasource: {
    name: 'warehouse',
    label: 'Analytics Warehouse',
    description: 'Read-only Postgres replica for reporting.',
    driver: 'postgres',
    type: 'sql',
    active: true,
    isDefault: false,
    ssl: true,
    config: { host: 'db.internal', port: 5432, database: 'analytics' },
    pool: { min: 2, max: 10 },
    capabilities: ['read', 'aggregate'],
    healthCheck: { enabled: true, interval: 60 },
  },

  validation: {
    name: 'amount_positive',
    label: 'Amount Must Be Positive',
    object: 'sales_order',
    active: true,
    severity: 'error',
    type: 'script',
    field: 'amount',
    condition: 'amount > 0',
    expression: 'amount > 0',
    message: 'Order amount must be greater than zero.',
    events: ['beforeInsert', 'beforeUpdate'],
    priority: 10,
  },

  email_template: {
    name: 'order_confirmation',
    label: 'Order Confirmation',
    subject: 'Your order ${order.name} is confirmed',
    from: 'sales@example.com',
    to: '${contact.email}',
    bodyHtml:
      '<html><body style="font-family:sans-serif;padding:24px"><h1 style="color:#4f46e5">Thanks for your order!</h1><p>Hi ${contact.name},</p><p>Your order <strong>${order.name}</strong> for <strong>${order.amount}</strong> is confirmed.</p><p>— The Sales Team</p></body></html>',
  },

  translation: {
    name: 'zh_CN',
    label: 'Simplified Chinese',
    locale: 'zh-CN',
    language: 'Chinese',
    description: 'Simplified Chinese bundle for the CRM app.',
    data: {
      objects: {
        sales_order: { label: '销售订单', fields: { amount: '金额' } },
        account: { label: '客户' },
      },
      apps: { crm: { label: 'CRM' } },
      messages: { welcome: '欢迎', saved: '已保存' },
      globalActions: { close_order: '关闭订单' },
    },
  },
};
