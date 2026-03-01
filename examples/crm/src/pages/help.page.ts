export const HelpPage = {
  name: 'crm_help',
  label: 'Help & Resources',
  type: 'app' as const,
  regions: [
    {
      name: 'main',
      components: [
        {
          type: 'markdown',
          properties: {
            className: 'max-w-3xl mx-auto p-8',
            content: [
              '# CRM Help Guide',
              '',
              'Welcome to the CRM application. This guide covers the key features available in your sales workspace.',
              '',
              '## Navigation',
              '',
              '- **Dashboard** — KPI metrics, revenue trends, pipeline charts',
              '- **Contacts** — Customer and lead management with map view',
              '- **Accounts** — Company records with geographic map',
              '- **Opportunities** — Sales pipeline with Kanban board',
              '- **Projects** — Task tracking with Gantt and Timeline views',
              '- **Calendar** — Events and meetings',
              '- **Orders & Products** — Sales catalog and order processing',
              '',
              '## View Types',
              '',
              'Each object supports multiple view types. Use the view switcher in the toolbar to change between:',
              '',
              '- **Grid** — Tabular data with sorting and filtering',
              '- **Kanban** — Drag-and-drop board (Opportunities → Pipeline)',
              '- **Calendar** — Date-based event view (Events → Calendar)',
              '- **Gantt** — Project timeline (Projects → Gantt View)',
              '- **Map** — Geographic visualization (Accounts → Map View)',
              '- **Gallery** — Visual cards (Products → Product Gallery)',
              '',
              '## Keyboard Shortcuts',
              '',
              '- **⌘+K** — Open Command Palette for quick navigation',
              '- **⌘+N** — Create new record',
              '- Click any record row to open the detail panel',
            ].join('\n'),
          }
        }
      ]
    }
  ]
};
