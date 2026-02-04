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
  apps: [
    App.create({
      name: 'crm_app',
      label: 'CRM',
      icon: 'briefcase',
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
            value: '$1,245,000',
            trend: { value: 12.5, direction: 'up', label: 'vs last month' },
            icon: 'DollarSign'
          }
        },
        {
          type: 'metric',
          layout: { x: 1, y: 0, w: 1, h: 1 },
          options: {
            label: 'Active Deals',
            value: '45',
            trend: { value: 2.1, direction: 'down', label: 'vs last month' },
            icon: 'Briefcase'
          }
        },
        {
          type: 'metric',
          layout: { x: 2, y: 0, w: 1, h: 1 },
          options: {
            label: 'Win Rate',
            value: '68%',
            trend: { value: 4.3, direction: 'up', label: 'vs last month' },
            icon: 'Trophy'
          }
        },
        {
          type: 'metric',
          layout: { x: 3, y: 0, w: 1, h: 1 },
          options: {
            label: 'Avg Deal Size',
            value: '$24,000',
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
                yField: 'revenue'
            },
            // @ts-ignore
            data: {
                provider: 'value',
                items: [
                   { month: 'Jan', revenue: 45000 },
                   { month: 'Feb', revenue: 52000 },
                   { month: 'Mar', revenue: 48000 },
                   { month: 'Apr', revenue: 61000 },
                   { month: 'May', revenue: 55000 },
                   { month: 'Jun', revenue: 67000 },
                   { month: 'Jul', revenue: 72000 }
                ]
            }
        },
        {
            title: 'Lead Source',
            type: 'donut',
            layout: { x: 3, y: 1, w: 1, h: 2 },
            options: {
                xField: 'source',
                yField: 'value'
            },
            // @ts-ignore
            data: {
                provider: 'value',
                items: [
                    { source: 'Website', value: 45 },
                    { source: 'Referral', value: 25 },
                    { source: 'Partner', value: 20 },
                    { source: 'Ads', value: 10 }
                ]
            }
        },

        // --- Row 3: More Charts ---
        {
            title: 'Pipeline by Stage',
            type: 'bar',
            layout: { x: 0, y: 3, w: 2, h: 2 },
            options: {
                xField: 'stage',
                yField: 'amount'
            },
            // @ts-ignore
            data: {
                provider: 'value',
                items: [
                    { stage: 'Prospecting', amount: 120000 },
                    { stage: 'Qualification', amount: 85000 },
                    { stage: 'Proposal', amount: 50000 },
                    { stage: 'Negotiation', amount: 35000 },
                    { stage: 'Closed Won', amount: 150000 }
                ]
            }
        },
        {
            title: 'Top Products',
            type: 'bar',
            layout: { x: 2, y: 3, w: 2, h: 2 },
            options: {
                xField: 'name',
                yField: 'sales'
            },
            // @ts-ignore
            data: {
                provider: 'value',
                items: [
                    { name: 'Enterprise License', sales: 450 },
                    { name: 'Pro Subscription', sales: 320 },
                    { name: 'Basic Plan', sales: 210 },
                    { name: 'Consulting Hours', sales: 150 }
                ]
            }
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
                ]
            },
            // @ts-ignore
            data: {
                provider: 'value',
                items: [
                   { name: 'TechCorp License', amount: '$50,000', stage: 'Proposal', date: '2024-06-30' },
                   { name: 'Software Inc Pilot', amount: '$5,000', stage: 'Closed Won', date: '2024-01-15' },
                   { name: 'Consulting Q2', amount: '$12,000', stage: 'Negotiation', date: '2024-05-20' },
                   { name: 'Global Widget Deal', amount: '$85,000', stage: 'Qualification', date: '2024-07-10' },
                   { name: 'Startup Bundle', amount: '$2,500', stage: 'Prospecting', date: '2024-08-01' }
                ]
            }
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
            billing_address: "44 Tehama St, San Francisco, CA 94105", 
            latitude: 37.7879,
            longitude: -122.3961,
            website: "https://objectstack.com", 
            phone: "555-0101" 
          },
          { 
            _id: "2", 
            name: "Salesforce Tower", 
            industry: "Technology", 
            type: "Customer", 
            billing_address: "415 Mission St, San Francisco, CA 94105", 
            latitude: 37.7897,
            longitude: -122.3972,
            website: "https://salesforce.com", 
            phone: "555-0102" 
          },
          { 
            _id: "3", 
            name: "Central Park Office", 
            industry: "Finance", 
            type: "Customer", 
            billing_address: "New York, NY", 
            latitude: 40.7829,
            longitude: -73.9654,
            website: "https://finance.example.com", 
            phone: "555-0103" 
          },
          { 
            _id: "4",
            name: "London Branch", 
            industry: "Finance", 
            type: "Partner", 
            billing_address: "London, UK", 
            latitude: 51.5074,
            longitude: -0.1278,
            website: "https://uk.example.com", 
            phone: "555-0104"
          },
           { 
            _id: "5",
            name: "Tokyo Innovation Center", 
            industry: "Technology", 
            type: "Vendor", 
            billing_address: "Tokyo, Japan", 
            latitude: 35.6762,
            longitude: 139.6503,
            website: "https://jp.example.com", 
            phone: "555-0105"
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
            email: "alice@example.com", 
            phone: "555-0101", 
            title: "VP Sales", 
            company: "TechCorp", 
            status: "Active",
            latitude: 40.7128,
            longitude: -74.0060, // NYC
            address: "New York, NY"
          },
          { 
            _id: "2", 
            name: "Bob Smith", 
            email: "bob@tech.com", 
            phone: "555-0102", 
            title: "Developer", 
            company: "Software Inc", 
            status: "Lead",
            latitude: 47.6062,
            longitude: -122.3321, // Seattle
            address: "Seattle, WA"
          },
          { 
            _id: "3", 
            name: "Charlie Brown", 
            email: "charlie@peanuts.com", 
            phone: "555-0103", 
            title: "Manager", 
            company: "Good Grief LLC", 
            status: "Customer",
            latitude: 44.9778,
            longitude: -93.2650, // Minneapolis
            address: "Minneapolis, MN"
          }
        ]
      },
      {
        object: 'opportunity',
        mode: 'upsert',
        records: [
          { 
              _id: "101", 
              name: "TechCorp Enterprise License", 
              amount: 50000, 
              stage: "Proposal", 
              close_date: new Date("2024-06-30"), 
              account_id: "1", 
              contact_ids: ["1", "2"], 
              description: "Enterprise software license for 500 users. Includes premium support and training." 
          },
          { 
              _id: "102", 
              name: "Software Inc Pilot", 
              amount: 5000, 
              stage: "Closed Won", 
              close_date: new Date("2024-01-15"), 
              account_id: "2",
              contact_ids: ["2"],
              description: "Pilot program for 50 users." 
          },
          { 
              _id: "103", 
              name: "Good Grief Consultant", 
              amount: 12000, 
              stage: "Negotiation", 
              close_date: new Date("2024-05-20"), 
              account_id: "3",
              contact_ids: ["3"],
              description: "Consulting services for Q2 implementation." 
          }
        ]
      },
      {
        object: 'user',
        mode: 'upsert',
        records: [
             { _id: "1", name: 'John Doe', email: 'john@example.com', username: 'jdoe', role: 'admin', active: true },
             { _id: "2", name: 'Jane Smith', email: 'jane@example.com', username: 'jsmith', role: 'user', active: true }
        ]
      },
      {
          object: 'product',
          mode: 'upsert',
          records: [
              { _id: "p1", sku: 'PROD-001', name: 'Laptop', category: 'Electronics', price: 1299.99, stock: 15, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&q=80' },
              { _id: "p2", sku: 'PROD-002', name: 'Wireless Mouse', category: 'Electronics', price: 29.99, stock: 120, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300&q=80' },
              { _id: "p3", sku: 'PROD-003', name: 'Ergonomic Chair', category: 'Furniture', price: 249.99, stock: 8, image: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=300&q=80' },
              { _id: "p4", sku: 'PROD-004', name: 'Standing Desk', category: 'Furniture', price: 499.99, stock: 20, image: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=300&q=80' },
              { _id: "p5", sku: 'PROD-005', name: 'Noise Cancelling Headphones', category: 'Electronics', price: 199.99, stock: 45, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80' }
          ]
      },
      {
          object: 'order',
          mode: 'upsert',
          records: [
              { _id: "o1", name: 'ORD-1001', customer: "1", order_date: new Date('2024-01-15'), amount: 159.99, status: 'Draft' },
              { _id: "o2", name: 'ORD-1002', customer: "2", order_date: new Date('2024-01-18'), amount: 89.50, status: 'Pending' }
          ]
      },
      {
          object: 'project_task',
          mode: 'upsert',
          records: [
              { _id: "t1", name: "Requirements Gathering", start_date: new Date("2024-01-01"), end_date: new Date("2024-01-14"), progress: 100, status: 'Completed', color: '#10b981', priority: 'High' },
              { _id: "t2", name: "System Design", start_date: new Date("2024-01-15"), end_date: new Date("2024-02-15"), progress: 100, status: 'Completed', color: '#3b82f6', priority: 'High', dependencies: 't1' },
              { _id: "t3", name: "Implementation", start_date: new Date("2024-02-16"), end_date: new Date("2024-04-30"), progress: 65, status: 'In Progress', color: '#8b5cf6', priority: 'High', dependencies: 't2' },
              { _id: "t4", name: "Quality Assurance", start_date: new Date("2024-05-01"), end_date: new Date("2024-05-30"), progress: 0, status: 'Planned', color: '#f59e0b', priority: 'Medium', dependencies: 't3' },
              { _id: "t5", name: "User Acceptance", start_date: new Date("2024-06-01"), end_date: new Date("2024-06-15"), progress: 0, status: 'Planned', color: '#f43f5e', priority: 'Medium', dependencies: 't4' },
              { _id: "t6", name: "Go Live", start_date: new Date("2024-06-20"), end_date: new Date("2024-06-20"), progress: 0, status: 'Planned', color: '#ef4444', priority: 'Critical', dependencies: 't5' }
          ]
      },
      {
          object: 'event',
          mode: 'upsert',
          records: [
              { _id: "e1", subject: "Weekly Standup", start: new Date("2024-02-05T09:00:00"), end: new Date("2024-02-05T10:00:00"), location: "Conference Room A", type: "Meeting", description: "Team synchronization" },
              { _id: "e2", subject: "Client Call - TechCorp", start: new Date("2024-02-06T14:00:00"), end: new Date("2024-02-06T15:00:00"), location: "Zoom", type: "Call", description: "Project update" },
              { _id: "e3", subject: "Project Review", start: new Date("2024-02-08T10:00:00"), end: new Date("2024-02-08T11:30:00"), location: "Board Room", type: "Meeting", description: "Milestone review" },
              { _id: "e4", subject: "Lunch with Partners", start: new Date("2024-02-09T12:00:00"), end: new Date("2024-02-09T13:30:00"), location: "Downtown Cafe", type: "Other", description: "Networking" }
          ]
      }
    ]
  }
});
