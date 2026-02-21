export const HelpPage = {
  name: 'crm_help',
  label: 'Help & Resources',
  type: 'app',
  regions: [
    {
      name: 'main',
      components: [
        {
          type: 'container',
          properties: {
            className: 'prose max-w-3xl mx-auto p-8 text-foreground',
            children: [
              { type: 'text', properties: { value: '# CRM Help Guide', className: 'text-3xl font-bold mb-6 block' } },
              { type: 'text', properties: { value: 'Welcome to the CRM application. This guide covers the key features available in your sales workspace.', className: 'text-muted-foreground mb-6 block' } },
              { type: 'text', properties: { value: '## Navigation', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: '- **Dashboard** — KPI metrics, revenue trends, pipeline charts\n- **Contacts** — Customer and lead management with map view\n- **Accounts** — Company records with geographic map\n- **Opportunities** — Sales pipeline with Kanban board\n- **Projects** — Task tracking with Gantt and Timeline views\n- **Calendar** — Events and meetings\n- **Orders & Products** — Sales catalog and order processing', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## View Types', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: 'Each object supports multiple view types. Use the view switcher in the toolbar to change between:\n- **Grid** — Tabular data with sorting and filtering\n- **Kanban** — Drag-and-drop board (Opportunities → Pipeline)\n- **Calendar** — Date-based event view (Events → Calendar)\n- **Gantt** — Project timeline (Projects → Gantt View)\n- **Map** — Geographic visualization (Accounts → Map View)\n- **Gallery** — Visual cards (Products → Product Gallery)', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Keyboard Shortcuts', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: '- **⌘+K** — Open Command Palette for quick navigation\n- **⌘+N** — Create new record\n- Click any record row to open the detail panel', className: 'whitespace-pre-line block' } },
            ]
          }
        }
      ]
    }
  ]
};
