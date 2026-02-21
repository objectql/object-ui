export const SettingsPage = {
  name: 'crm_settings',
  label: 'Settings',
  type: 'utility',
  regions: [
    {
      name: 'main',
      components: [
        {
          type: 'container',
          properties: {
            className: 'max-w-3xl mx-auto p-8 space-y-8',
            children: [
              { type: 'text', properties: { value: '# Settings', className: 'text-3xl font-bold mb-2 block' } },
              { type: 'text', properties: { value: 'Configure your CRM workspace preferences and integrations.', className: 'text-muted-foreground mb-8 block' } },
              { type: 'text', properties: { value: '## General', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: '- **Company Name** — ObjectStack CRM Demo\n- **Timezone** — America/Los_Angeles (UTC-8)\n- **Date Format** — YYYY-MM-DD\n- **Currency** — USD ($)', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Notifications', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: '- Email notifications for new leads\n- Daily pipeline summary digest\n- Weekly sales performance report\n- Real-time alerts for closed deals', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Integrations', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: '- **Email** — Connected via SMTP\n- **Calendar** — Google Calendar sync enabled\n- **Storage** — S3 bucket for file attachments\n- **Slack** — Notifications channel configured', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Data Management', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: '- Import/Export: CSV, Excel, JSON supported\n- Backup frequency: Daily at 02:00 UTC\n- Data retention: 7 years\n- Audit log: Enabled for all record changes', className: 'whitespace-pre-line block' } },
            ]
          }
        }
      ]
    }
  ]
};
