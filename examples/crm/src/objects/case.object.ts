import { ObjectSchema, Field } from '@objectstack/spec/data';

export const CaseObject = ObjectSchema.create({
  name: 'case',
  label: 'Case',
  icon: 'life-buoy',
  description: 'Customer support cases and service requests',
  fields: {
    subject: Field.text({ label: 'Subject', required: true, searchable: true }),
    status: Field.select([
      { value: 'new', label: 'New', color: 'gray' },
      { value: 'in_progress', label: 'In Progress', color: 'blue' },
      { value: 'waiting_customer', label: 'Waiting on Customer', color: 'yellow' },
      { value: 'escalated', label: 'Escalated', color: 'red' },
      { value: 'resolved', label: 'Resolved', color: 'green' },
      { value: 'closed', label: 'Closed', color: 'gray' },
    ], { label: 'Status', defaultValue: 'new' }),
    priority: Field.select([
      { value: 'low', label: 'Low', color: 'blue' },
      { value: 'medium', label: 'Medium', color: 'yellow' },
      { value: 'high', label: 'High', color: 'orange' },
      { value: 'critical', label: 'Critical', color: 'red' },
    ], { label: 'Priority', defaultValue: 'medium' }),
    origin: Field.select([
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
      { value: 'web', label: 'Web' },
      { value: 'chat', label: 'Chat' },
    ], { label: 'Origin' }),
    account: Field.lookup('account', { label: 'Account' }),
    owner: Field.lookup('user', { label: 'Owner' }),
    is_closed: Field.boolean({ label: 'Is Closed', defaultValue: false }),
    is_sla_violated: Field.boolean({ label: 'SLA Violated', defaultValue: false }),
    resolution_time_hours: Field.number({ label: 'Resolution Time (h)', scale: 1 }),
    created_date: Field.datetime({ label: 'Created Date', readonly: true }),
    closed_date: Field.datetime({ label: 'Closed Date', readonly: true }),
  },
});
