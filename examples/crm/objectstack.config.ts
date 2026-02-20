import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';
import { AccountObject } from './src/objects/account.object';
import { ContactObject } from './src/objects/contact.object';
import { OpportunityObject } from './src/objects/opportunity.object';
import { ProductObject } from './src/objects/product.object';
import { OrderObject } from './src/objects/order.object';
import { UserObject } from './src/objects/user.object';
import { ProjectObject } from './src/objects/project.object';
import { EventObject } from './src/objects/event.object';
import { AccountView } from './src/views/account.view';
import { ContactView } from './src/views/contact.view';
import { OpportunityView } from './src/views/opportunity.view';
import { ProductView } from './src/views/product.view';
import { OrderView } from './src/views/order.view';
import { UserView } from './src/views/user.view';
import { EventView } from './src/views/event.view';
import { ProjectView } from './src/views/project.view';
import { AccountActions } from './src/actions/account.actions';
import { ContactActions } from './src/actions/contact.actions';
import { OpportunityActions } from './src/actions/opportunity.actions';
import { ProductActions } from './src/actions/product.actions';
import { OrderActions } from './src/actions/order.actions';
import { UserActions } from './src/actions/user.actions';
import { ProjectActions } from './src/actions/project.actions';
import { EventActions } from './src/actions/event.actions';

export default defineStack({
  objects: [
    AccountObject,
    ContactObject,
    OpportunityObject,
    ProductObject,
    OrderObject,
    UserObject,
    ProjectObject,
    EventObject
  ],
  views: [
    AccountView,
    ContactView,
    OpportunityView,
    ProductView,
    OrderView,
    UserView,
    EventView,
    ProjectView,
  ],
  reports: [],
  actions: [
    ...AccountActions,
    ...ContactActions,
    ...OpportunityActions,
    ...ProductActions,
    ...OrderActions,
    ...UserActions,
    ...ProjectActions,
    ...EventActions,
  ],
  pages: [
    {
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
    }
  ],
  apps: [
    App.create({
      name: 'crm_app',
      label: 'CRM',
      icon: 'briefcase',
      description: 'Sales pipeline, accounts, and customer management',
      branding: {
        primaryColor: '#3B82F6',
      },
      navigation: [
        {
          id: 'nav_dashboard',
          type: 'dashboard',
          dashboardName: 'crm_dashboard',
          label: 'Dashboard',
          icon: 'layout-dashboard'
        },
        {
          id: 'nav_contacts',
          type: 'object',
          objectName: 'contact',
          label: 'Contacts',
          icon: 'users'
        },
        {
          id: 'nav_accounts',
          type: 'object',
          objectName: 'account',
          label: 'Accounts',
          icon: 'building-2'
        },
        {
          id: 'nav_opportunities',
          type: 'object',
          objectName: 'opportunity',
          label: 'Opportunities',
          icon: 'trending-up'
        },
        {
          id: 'nav_pipeline',
          type: 'object',
          objectName: 'opportunity',
          viewName: 'pipeline',
          label: 'Pipeline',
          icon: 'kanban-square'
        },
        {
          id: 'nav_projects',
          type: 'object',
          objectName: 'project_task',
          label: 'Projects',
          icon: 'kanban-square'
        },
        {
          id: 'nav_events',
          type: 'object',
          objectName: 'event',
          viewName: 'calendar',
          label: 'Calendar',
          icon: 'calendar'
        },
        {
          id: 'nav_sales',
          type: 'group',
          label: 'Sales',
          icon: 'banknote',
          children: [
             {
                id: 'nav_orders',
                type: 'object',
                objectName: 'order',
                label: 'Orders',
                icon: 'shopping-cart'
             },
             {
                id: 'nav_products',
                type: 'object',
                objectName: 'product',
                label: 'Products',
                icon: 'package'
             }
          ]
        },
        {
          id: 'nav_help',
          type: 'page',
          pageName: 'crm_help',
          label: 'Help',
          icon: 'help-circle'
        }
      ]
    })
  ],
  dashboards: [
    {
      name: 'crm_dashboard',
      label: 'CRM Overview',
      widgets: [
        // --- KPI Row ---
        {
          type: 'metric',
          layout: { x: 0, y: 0, w: 1, h: 1 },
          options: {
            label: 'Total Revenue',
            value: '$652,000',
            trend: { value: 12.5, direction: 'up', label: 'vs last month' },
            icon: 'DollarSign'
          }
        },
        {
          type: 'metric',
          layout: { x: 1, y: 0, w: 1, h: 1 },
          options: {
            label: 'Active Deals',
            value: '5',
            trend: { value: 2.1, direction: 'down', label: 'vs last month' },
            icon: 'Briefcase'
          }
        },
        {
          type: 'metric',
          layout: { x: 2, y: 0, w: 1, h: 1 },
          options: {
            label: 'Win Rate',
            value: '42%',
            trend: { value: 4.3, direction: 'up', label: 'vs last month' },
            icon: 'Trophy'
          }
        },
        {
          type: 'metric',
          layout: { x: 3, y: 0, w: 1, h: 1 },
          options: {
            label: 'Avg Deal Size',
            value: '$93,000',
            trend: { value: 1.2, direction: 'up', label: 'vs last month' },
            icon: 'BarChart3'
          }
        },

        // --- Row 2: Charts ---
        {
            title: 'Revenue Trends',
            type: 'area', 
            layout: { x: 0, y: 1, w: 3, h: 2 },
            options: {
                xField: 'month',
                yField: 'revenue',
                data: {
                    provider: 'value',
                    items: [
                       { month: 'Jan', revenue: 155000 },
                       { month: 'Feb', revenue: 87000 },
                       { month: 'Mar', revenue: 48000 },
                       { month: 'Apr', revenue: 61000 },
                       { month: 'May', revenue: 55000 },
                       { month: 'Jun', revenue: 67000 },
                       { month: 'Jul', revenue: 72000 }
                    ]
                }
            },
        },
        {
            title: 'Lead Source',
            type: 'donut',
            layout: { x: 3, y: 1, w: 1, h: 2 },
            options: {
                xField: 'source',
                yField: 'value',
                data: {
                    provider: 'value',
                    items: [
                        { source: 'Web', value: 2 },
                        { source: 'Referral', value: 1 },
                        { source: 'Partner', value: 1 },
                        { source: 'Existing Business', value: 3 }
                    ]
                }
            },
        },

        // --- Row 3: More Charts ---
        {
            title: 'Pipeline by Stage',
            type: 'bar',
            layout: { x: 0, y: 3, w: 2, h: 2 },
            options: {
                xField: 'stage',
                yField: 'amount',
                data: {
                    provider: 'value',
                    items: [
                        { stage: 'Prospecting', amount: 250000 },
                        { stage: 'Qualification', amount: 35000 },
                        { stage: 'Proposal', amount: 85000 },
                        { stage: 'Negotiation', amount: 45000 },
                        { stage: 'Closed Won', amount: 225000 }
                    ]
                }
            },
        },
        {
            title: 'Top Products',
            type: 'bar',
            layout: { x: 2, y: 3, w: 2, h: 2 },
            options: {
                xField: 'name',
                yField: 'sales',
                data: {
                    provider: 'value',
                    items: [
                        { name: 'Workstation Pro Laptop', sales: 45000 },
                        { name: 'Implementation Service', sales: 32000 },
                        { name: 'Premium Support', sales: 21000 },
                        { name: 'Executive Mesh Chair', sales: 15000 }
                    ]
                }
            },
        },

        // --- Row 4: Table ---
        {
            title: 'Recent Opportunities',
            type: 'table',
            layout: { x: 0, y: 5, w: 4, h: 2 },
            options: {
                columns: [
                    { header: 'Opportunity Name', accessorKey: 'name' }, 
                    { header: 'Amount', accessorKey: 'amount' }, 
                    { header: 'Stage', accessorKey: 'stage' },
                    { header: 'Close Date', accessorKey: 'date' }
                ],
                data: {
                    provider: 'value',
                    items: [
                       { name: 'Berlin Automation Project', amount: '$250,000', stage: 'Prospecting', date: '2024-09-01' },
                       { name: 'ObjectStack Enterprise License', amount: '$150,000', stage: 'Closed Won', date: '2024-01-15' },
                       { name: 'London Annual Renewal', amount: '$85,000', stage: 'Proposal', date: '2024-05-15' },
                       { name: 'SF Tower Expansion', amount: '$75,000', stage: 'Closed Won', date: '2024-02-28' },
                       { name: 'Global Fin Q1 Upsell', amount: '$45,000', stage: 'Negotiation', date: '2024-03-30' }
                    ]
                }
            },
        }
      ]
    }
  ],
  manifest: {
    id: 'com.example.crm',
    version: '1.0.0',
    type: 'app',
    name: 'CRM Example',
    description: 'CRM App Definition',
    data: [
      {
        object: 'account',
        mode: 'upsert',
        records: [
          { 
            _id: "1", 
            name: "ObjectStack HQ", 
            industry: "Technology", 
            type: "Partner", 
            employees: 120,
            billing_address: "44 Tehama St, San Francisco, CA 94105",
            shipping_address: "44 Tehama St, San Francisco, CA 94105",
            latitude: 37.7879,
            longitude: -122.3961,
            website: "https://objectstack.com",
            phone: "415-555-0101",
            linkedin_url: "https://linkedin.com/company/objectstack",
            tags: ['enterprise', 'strategic'],
            rating: "hot",
            founded_date: new Date("2020-06-01"),
            owner: "1",
            created_at: new Date("2023-01-15")
          },
          { 
            _id: "2", 
            name: "Salesforce Tower", 
            industry: "Technology", 
            type: "Customer", 
            employees: 35000,
            billing_address: "415 Mission St, San Francisco, CA 94105",
            latitude: 37.7897,
            longitude: -122.3972,
            website: "https://salesforce.com",
            phone: "415-555-0102",
            linkedin_url: "https://linkedin.com/company/salesforce",
            tags: ['enterprise'],
            rating: "hot",
            annual_revenue: 26000000,
            owner: "1",
            created_at: new Date("2023-02-20")
          },
          { 
            _id: "3", 
            name: "Global Financial Services", 
            industry: "Finance", 
            type: "Customer", 
            employees: 5000,
            billing_address: "100 Wall St, New York, NY 10005",
            latitude: 40.7056,
            longitude: -74.0084,
            website: "https://globalfin.example.com",
            phone: "212-555-0103",
            tags: ['enterprise'],
            rating: "warm",
            annual_revenue: 8500000,
            owner: "2",
            created_at: new Date("2023-03-10")
          },
          { 
            _id: "4",
            name: "London Consulting Grp", 
            industry: "Services", 
            type: "Partner", 
            employees: 250,
            billing_address: "10 Downing St, London, UK",
            latitude: 51.5034,
            longitude: -0.1276,
            website: "https://lcg.example.co.uk",
            phone: "+44-555-0104",
            tags: ['smb'],
            rating: "warm",
            owner: "2",
            created_at: new Date("2023-04-05")
          },
           { 
            _id: "5",
            name: "Tokyo E-Commerce", 
            industry: "Retail", 
            type: "Vendor", 
            employees: 80,
            billing_address: "Shibuya Crossing, Tokyo, Japan",
            latitude: 35.6595,
            longitude: 139.7004,
            website: "https://tokyoshop.example.jp",
            phone: "+81-555-0105",
            tags: ['startup'],
            rating: "cold",
            owner: "1",
            created_at: new Date("2023-05-20")
          },
          { 
            _id: "6",
            name: "Berlin AutoWorks", 
            industry: "Manufacturing", 
            type: "Customer", 
            employees: 1200,
            billing_address: "Berlin, Germany",
            shipping_address: "Industriepark 12, Berlin, Germany",
            latitude: 52.5200,
            longitude: 13.4050,
            website: "https://berlinauto.example.de",
            phone: "+49-555-0106",
            tags: ['enterprise', 'strategic'],
            rating: "hot",
            annual_revenue: 42000000,
            owner: "1",
            created_at: new Date("2023-06-15")
          },
          { 
            _id: "7",
            name: "Paris Fashion House", 
            industry: "Retail", 
            type: "Customer", 
            employees: 450,
            billing_address: "Champs-Élysées, Paris, France",
            latitude: 48.8698,
            longitude: 2.3075,
            website: "https://mode.example.fr",
            phone: "+33-555-0107",
            tags: ['smb'],
            rating: "warm",
            annual_revenue: 3200000,
            owner: "2",
            created_at: new Date("2023-07-01")
          }
        ]
      },
      {
        object: 'contact',
        mode: 'upsert',
        records: [
          { 
            _id: "1", 
            name: "Alice Johnson", 
            email: "alice@objectstack.com", 
            phone: "415-555-1001", 
            title: "VP Sales", 
            department: "Sales",
            account: "1",
            status: "active",
            priority: "high",
            lead_source: "Partner",
            linkedin: "https://linkedin.com/in/alicejohnson",
            birthdate: new Date("1985-04-12"),
            latitude: 37.7879,
            longitude: -122.3961,
            address: "San Francisco, CA"
          },
          { 
            _id: "2", 
            name: "Bob Smith", 
            email: "bob@salesforce.com", 
            phone: "415-555-1002", 
            title: "CTO", 
            department: "Engineering",
            account: "2",
            status: "active",
            priority: "high",
            lead_source: "Referral",
            linkedin: "https://linkedin.com/in/bobsmith",
            birthdate: new Date("1980-08-23"),
            latitude: 37.7897,
            longitude: -122.3972,
            address: "San Francisco, CA"
          },
          { 
            _id: "3", 
            name: "Charlie Brown", 
            email: "charlie@globalfin.com", 
            phone: "212-555-1003", 
            title: "Procurement Manager", 
            department: "Purchasing",
            account: "3",
            status: "customer",
            priority: "medium",
            lead_source: "Web",
            birthdate: new Date("1990-01-15"),
            latitude: 40.7056,
            longitude: -74.0084,
            address: "New York, NY"
          },
          { 
            _id: "4", 
            name: "Diana Prince", 
            email: "diana@lcg.co.uk", 
            phone: "+44-555-1004", 
            title: "Director", 
            department: "Management",
            account: "4",
            status: "active",
            priority: "high",
            lead_source: "Referral",
            birthdate: new Date("1988-06-05"),
            latitude: 51.5034,
            longitude: -0.1276,
            address: "London, UK",
            do_not_call: true
          },
          { 
            _id: "5", 
            name: "Evan Wright", 
            email: "evan@berlinauto.de", 
            phone: "+49-555-1005", 
            title: "Head of Operations", 
            department: "Operations",
            account: "6",
            status: "lead",
            priority: "high",
            lead_source: "Web",
            birthdate: new Date("1975-11-30"),
            latitude: 52.5200,
            longitude: 13.4050,
            address: "Berlin, DE"
          },
          { 
            _id: "6", 
            name: "Fiona Gallagher", 
            email: "fiona@mode.fr", 
            phone: "+33-555-1006", 
            title: "Creative Director", 
            department: "Design",
            account: "7",
            status: "customer",
            priority: "low",
            lead_source: "Trade Show",
            birthdate: new Date("1992-03-18"),
            latitude: 48.8698,
            longitude: 2.3075,
            address: "Paris, FR"
          },
          { 
            _id: "7", 
            name: "George Martin", 
            email: "george@salesforce.com", 
            phone: "415-555-1007", 
            title: "Senior Developer", 
            department: "Engineering",
            account: "2",
            status: "active",
            priority: "low",
            lead_source: "Phone",
            birthdate: new Date("1995-12-12"),
            latitude: 37.7897,
            longitude: -122.3972,
            address: "San Francisco, CA"
          }
        ]
      },
      {
        object: 'opportunity',
        mode: 'upsert',
        records: [
          { 
              _id: "101", 
              name: "ObjectStack Enterprise License", 
              amount: 150000, 
              expected_revenue: 150000,
              stage: "closed_won", 
              forecast_category: "commit",
              close_date: new Date("2024-01-15"), 
              account: "2", 
              contacts: ["2", "7"], 
              probability: 100,
              type: "New Business",
              lead_source: "Partner",
              next_step: "Onboarding",
              description: "Enterprise software license for 500 users. Includes premium support and training." 
          },
          { 
              _id: "102", 
              name: "Global Fin Q1 Upsell", 
              amount: 45000,
              expected_revenue: 36000,
              stage: "negotiation", 
              forecast_category: "best_case",
              close_date: new Date("2024-03-30"), 
              account: "3",
              contacts: ["3"],
              probability: 80,
              type: "Upgrade",
              lead_source: "Web",
              next_step: "Review Contract",
              description: "Adding 50 more seats to the existing contract." 
          },
          { 
              _id: "103", 
              name: "London Annual Renewal", 
              amount: 85000,
              expected_revenue: 51000,
              stage: "proposal", 
              forecast_category: "pipeline",
              close_date: new Date("2024-05-15"), 
              account: "4",
              contacts: ["4"],
              probability: 60,
              type: "Renewal",
              lead_source: "Referral",
              next_step: "Send Quote",
              description: "Annual renewal for continuous integration services." 
          },
          { 
              _id: "104", 
              name: "Berlin Automation Project", 
              amount: 250000,
              expected_revenue: 50000,
              stage: "prospecting", 
              forecast_category: "pipeline",
              close_date: new Date("2024-09-01"), 
              account: "6",
              contacts: ["5"],
              probability: 20,
              type: "New Business",
              lead_source: "Web",
              campaign_source: "Q1-2024-Manufacturing-Webinar",
              next_step: "Initial Discovery Call",
              description: "Full factory automation software suite." 
          },
          { 
              _id: "105", 
              name: "Paris Store POS System", 
              amount: 35000,
              expected_revenue: 14000,
              stage: "qualification", 
              forecast_category: "pipeline",
              close_date: new Date("2024-07-20"), 
              account: "7",
              contacts: ["6"],
              probability: 40,
              type: "New Business",
              lead_source: "Referral",
              next_step: "Demo",
              description: "POS system for the flagship store on Champs-Élysées." 
          },
          { 
              _id: "106", 
              name: "Tokyo E-Com Integration", 
              amount: 12000,
              expected_revenue: 0,
              stage: "closed_lost", 
              forecast_category: "omitted",
              close_date: new Date("2024-02-10"), 
              account: "5",
              contacts: [],
              probability: 0,
              type: "New Business",
              lead_source: "Web",
              next_step: "N/A",
              description: "Client chose a competitor." 
          },
          { 
              _id: "107", 
              name: "SF Tower Expansion", 
              amount: 75000,
              expected_revenue: 75000,
              stage: "closed_won", 
              forecast_category: "commit",
              close_date: new Date("2024-02-28"), 
              account: "2", 
              contacts: ["2"], 
              probability: 100,
              type: "Upgrade",
              lead_source: "Phone",
              next_step: "Implement",
              description: "Additional storage modules." 
          }
        ]
      },
      {
        object: 'user',
        mode: 'upsert',
        records: [
             { _id: "1", name: 'Martin CEO', email: 'martin@example.com', username: 'martin', role: 'admin', title: 'Chief Executive Officer', department: 'Executive', phone: '415-555-2001', active: true },
             { _id: "2", name: 'Sarah Sales', email: 'sarah@example.com', username: 'sarah', role: 'user', title: 'Sales Manager', department: 'Sales', phone: '415-555-2002', active: true }
        ]
      },
      {
          object: 'product',
          mode: 'upsert',
          records: [
              { _id: "p1", sku: 'HW-LAP-001', name: 'Workstation Pro Laptop', category: 'electronics', price: 2499.99, stock: 15, is_active: true, manufacturer: 'TechPro', weight: 2.1, tags: ['best_seller'], image: 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=600&q=80' },
              { _id: "p2", sku: 'HW-ACC-002', name: 'Wireless Ergonomic Mouse', category: 'electronics', price: 89.99, stock: 120, is_active: true, manufacturer: 'ErgoTech', weight: 0.12, tags: ['new'], image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80' },
              { _id: "p3", sku: 'FUR-CHR-003', name: 'Executive Mesh Chair', category: 'furniture', price: 549.99, stock: 8, is_active: true, manufacturer: 'SitWell', weight: 15.5, image: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=600&q=80' },
              { _id: "p4", sku: 'FUR-DSK-004', name: 'Adjustable Standing Desk', category: 'furniture', price: 799.99, stock: 20, is_active: true, manufacturer: 'StandUp Co', weight: 32.0, tags: ['best_seller'], image: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=600&q=80' },
              { _id: "p5", sku: 'HW-AUD-005', name: 'Studio Noise Cancelling Headphones', category: 'electronics', price: 349.99, stock: 45, is_active: true, manufacturer: 'SoundPro', weight: 0.35, tags: ['new', 'best_seller'], image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80' },
              { _id: "p6", sku: 'HW-MON-006', name: '4K UltraWide Monitor', category: 'electronics', price: 899.99, stock: 30, is_active: true, manufacturer: 'ViewMax', weight: 8.5, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&q=80' },
              { _id: "p7", sku: 'SVC-CNS-007', name: 'Implementation Service (Hourly)', category: 'services', price: 250.00, stock: 1000, is_active: true, image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=80' },
              { _id: "p8", sku: 'SVC-SUP-008', name: 'Premium Support (Annual)', category: 'services', price: 5000.00, stock: 1000, is_active: true, tags: ['on_sale'], image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600&q=80' }
          ]
      },
      {
          object: 'order',
          mode: 'upsert',
          records: [
              { _id: "o1", name: 'ORD-2024-001', customer: "2", account: "2", order_date: new Date('2024-01-15'), amount: 15459.99, status: 'paid', payment_method: 'Wire Transfer', shipping_address: '415 Mission St, San Francisco, CA 94105', tracking_number: '1Z999AA10123456784' },
              { _id: "o2", name: 'ORD-2024-002', customer: "3", account: "3", order_date: new Date('2024-01-18'), amount: 289.50, status: 'pending', payment_method: 'Credit Card', discount: 5 }
          ]
      },
      {
          object: 'project_task',
          mode: 'upsert',
          records: [
              { _id: "t1", name: "Requirements Gathering", start_date: new Date("2024-02-01"), end_date: new Date("2024-02-14"), progress: 100, estimated_hours: 40, actual_hours: 38, status: 'completed', color: '#10b981', priority: 'high', manager: "1", assignee: "2" },
              { _id: "t2", name: "Architecture Design", start_date: new Date("2024-02-15"), end_date: new Date("2024-03-01"), progress: 100, estimated_hours: 60, actual_hours: 55, status: 'completed', color: '#3b82f6', priority: 'high', dependencies: 't1', manager: "1", assignee: "1" },
              { _id: "t3", name: "Frontend Development", start_date: new Date("2024-03-02"), end_date: new Date("2024-04-15"), progress: 75, estimated_hours: 120, actual_hours: 90, status: 'in_progress', color: '#8b5cf6', priority: 'high', dependencies: 't2', manager: "2", assignee: "2" },
              { _id: "t4", name: "Backend API Integration", start_date: new Date("2024-03-02"), end_date: new Date("2024-04-10"), progress: 80, estimated_hours: 100, actual_hours: 80, status: 'in_progress', color: '#6366f1', priority: 'high', dependencies: 't2', manager: "2", assignee: "1" },
              { _id: "t5", name: "QA & Testing", start_date: new Date("2024-04-16"), end_date: new Date("2024-05-01"), progress: 0, estimated_hours: 50, status: 'planned', color: '#f59e0b', priority: 'medium', dependencies: 't3,t4', manager: "1" },
              { _id: "t6", name: "UAT", start_date: new Date("2024-05-02"), end_date: new Date("2024-05-15"), progress: 0, estimated_hours: 30, status: 'planned', color: '#f43f5e', priority: 'medium', dependencies: 't5', manager: "1" },
              { _id: "t7", name: "Go Live & Launch", start_date: new Date("2024-05-20"), end_date: new Date("2024-05-20"), progress: 0, estimated_hours: 8, status: 'planned', color: '#ef4444', priority: 'critical', dependencies: 't6', manager: "1" }
          ]
      },
      {
          object: 'event',
          mode: 'upsert',
          records: [
              { _id: "e1", subject: "Weekly Standup", start: new Date("2024-02-05T09:00:00"), end: new Date("2024-02-05T10:00:00"), location: "Conference Room A", type: "meeting", status: "completed", organizer: "1", reminder: "min_15", description: "Team synchronization regarding Project Alpha" },
              { _id: "e2", subject: "Client Call - TechCorp", start: new Date("2024-02-06T14:00:00"), end: new Date("2024-02-06T15:00:00"), location: "Zoom", type: "call", status: "completed", organizer: "2", reminder: "min_5", description: "Reviewing Q1 Goals and Roadblocks" },
              { _id: "e3", subject: "Project Review", start: new Date("2024-02-08T10:00:00"), end: new Date("2024-02-08T11:30:00"), location: "Board Room", type: "meeting", status: "completed", organizer: "1", reminder: "min_30", description: "Milestone review with stakeholders" },
              { _id: "e4", subject: "Lunch with Partners", start: new Date("2024-02-09T12:00:00"), end: new Date("2024-02-09T13:30:00"), location: "Downtown Cafe", type: "other", status: "completed", organizer: "2", description: "Networking event" },
              { _id: "e5", subject: "Product Demo - Berlin Auto", start: new Date("2024-03-10T11:00:00"), end: new Date("2024-03-10T12:30:00"), location: "Online", type: "meeting", status: "scheduled", organizer: "1", reminder: "hour_1", is_private: false, description: "Showcasing the new automation suite capabilities" },
              { _id: "e6", subject: "Internal Training", start: new Date("2024-03-15T09:00:00"), end: new Date("2024-03-15T16:00:00"), location: "Training Center", type: "other", status: "scheduled", organizer: "1", is_all_day: true, reminder: "day_1", description: "Security compliance training for all staff" }
          ]
      }
    ]

  },
  plugins: [],
}, { strict: false }); // Defer validation to `objectstack compile` CLI to avoid Zod double-parse transform bug on form.sections.columns
