export const GettingStartedPage = {
  name: 'crm_getting_started',
  label: 'Getting Started',
  type: 'app',
  regions: [
    {
      name: 'main',
      components: [
        {
          type: 'container',
          properties: {
            className: 'max-w-3xl mx-auto p-8 space-y-8',
            children: [
              { type: 'text', properties: { value: '# Getting Started with CRM', className: 'text-3xl font-bold mb-2 block' } },
              { type: 'text', properties: { value: 'Follow these steps to set up your sales workspace and start closing deals.', className: 'text-muted-foreground mb-8 block' } },
              { type: 'text', properties: { value: '## Step 1: Set Up Your Team', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: 'Navigate to **Users** and invite your sales team members. Assign roles:\n- **Admin** — Full system access and configuration\n- **Manager** — Team oversight and reporting\n- **User** — Standard CRM access\n- **Viewer** — Read-only access to dashboards and reports', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Step 2: Import Your Data', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: 'Bring your existing data into the CRM:\n1. **Accounts** — Import your company records\n2. **Contacts** — Add customer and lead contacts\n3. **Products** — Set up your product catalog\n4. **Opportunities** — Migrate your active deals', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Step 3: Configure Your Pipeline', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: 'Customize the sales pipeline stages to match your process:\n- Prospecting → Qualification → Proposal → Negotiation → Closed\n- Use the **Pipeline** Kanban view to visualize deal flow\n- Set probability percentages for accurate forecasting', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Step 4: Explore Reports & Dashboards', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: 'Monitor your team\'s performance:\n- **Dashboard** — Real-time KPIs and charts\n- **Sales Report** — Monthly revenue breakdown\n- **Pipeline Report** — Deal stage analysis and forecasting', className: 'whitespace-pre-line mb-6 block' } },
              { type: 'text', properties: { value: '## Need Help?', className: 'text-xl font-semibold mb-3 block' } },
              { type: 'text', properties: { value: 'Visit the **Help** page from the sidebar for keyboard shortcuts, view types, and feature documentation.', className: 'whitespace-pre-line block' } },
            ]
          }
        }
      ]
    }
  ]
};
