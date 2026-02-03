import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';
import { AccountObject } from './src/objects/account.object';
import { ContactObject } from './src/objects/contact.object';
import { OpportunityObject } from './src/objects/opportunity.object';
import { ProductObject } from './src/objects/product.object';
import { OrderObject } from './src/objects/order.object';
import { UserObject } from './src/objects/user.object';
import { ProjectObject } from './src/objects/project.object';

export default defineStack({
  objects: [
    AccountObject,
    ContactObject,
    OpportunityObject,
    ProductObject,
    OrderObject,
    UserObject,
    ProjectObject
  ],
  apps: [
    App.create({
      name: 'crm_app',
      label: 'CRM',
      icon: 'users',
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
          label: 'Contacts'
        },
        {
          id: 'nav_accounts',
          type: 'object',
          objectName: 'account',
          label: 'Accounts'
        },
        {
          id: 'nav_opportunities',
          type: 'object',
          objectName: 'opportunity',
          label: 'Opportunities'
        },
        {
          id: 'nav_projects',
          type: 'object',
          objectName: 'project_task',
          label: 'Projects'
        },
        {
          id: 'nav_sales',
          type: 'group',
          label: 'Sales',
          children: [
             {
                id: 'nav_orders',
                type: 'object',
                objectName: 'order',
                label: 'Orders'
             },
             {
                id: 'nav_products',
                type: 'object',
                objectName: 'product',
                label: 'Products'
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
        {
            title: 'Pipeline by Stage',
            type: 'bar',
            layout: { x: 0, y: 0, w: 2, h: 2 },
            options: {
                xField: 'stage',
                yField: 'amount'
            },
            // @ts-ignore
            data: {
                object: 'opportunity',
                aggregate: [
                    { $group: { _id: '$stage', amount: { $sum: '$amount' } } }
                ]
            }
        },
        {
            title: 'Recent Opportunities',
            type: 'table',
            layout: { x: 2, y: 0, w: 2, h: 2 },
            options: {
                columns: ['name', 'amount', 'stage']
            },
            // @ts-ignore
            data: {
                object: 'opportunity',
                limit: 5,
                sort: [['created_date', 'desc']]
            }
        },
        {
            title: 'Revenue Trends',
            type: 'line',
            layout: { x: 0, y: 2, w: 4, h: 2 },
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
                   { month: 'Apr', revenue: 61000 }
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
          { _id: "1", name: "TechCorp" },
          { _id: "2", name: "Software Inc" },
          { _id: "3", name: "Good Grief LLC" }
        ]
      },
      {
        object: 'contact',
        mode: 'upsert',
        records: [
          { _id: "1", name: "Alice Johnson", email: "alice@example.com", phone: "555-0101", title: "VP Sales", company: "TechCorp", status: "Active" },
          { _id: "2", name: "Bob Smith", email: "bob@tech.com", phone: "555-0102", title: "Developer", company: "Software Inc", status: "Lead" },
          { _id: "3", name: "Charlie Brown", email: "charlie@peanuts.com", phone: "555-0103", title: "Manager", company: "Good Grief LLC", status: "Customer" }
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
              { _id: "p1", sku: 'PROD-001', name: 'Laptop', category: 'Electronics', price: 1299.99, stock: 15 },
              { _id: "p2", sku: 'PROD-002', name: 'Mouse', category: 'Electronics', price: 29.99, stock: 120 },
              { _id: "p3", sku: 'PROD-003', name: 'Desk Chair', category: 'Furniture', price: 249.99, stock: 8 }
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
              { _id: "t1", name: "Requirements Gathering", start_date: new Date("2024-01-01"), end_date: new Date("2024-01-14"), progress: 100, status: 'Completed', color: '#10b981' },
              { _id: "t2", name: "System Design", start_date: new Date("2024-01-15"), end_date: new Date("2024-02-15"), progress: 100, status: 'Completed', color: '#3b82f6' },
              { _id: "t3", name: "Implementation", start_date: new Date("2024-02-16"), end_date: new Date("2024-04-30"), progress: 65, status: 'In Progress', color: '#8b5cf6' },
              { _id: "t4", name: "Quality Assurance", start_date: new Date("2024-05-01"), end_date: new Date("2024-05-30"), progress: 0, status: 'Planned', color: '#f59e0b' },
              { _id: "t5", name: "User Acceptance", start_date: new Date("2024-06-01"), end_date: new Date("2024-06-15"), progress: 0, status: 'Planned', color: '#f43f5e' },
              { _id: "t6", name: "Go Live", start_date: new Date("2024-06-20"), end_date: new Date("2024-06-20"), progress: 0, status: 'Planned', color: '#ef4444' }
          ]
      }
    ]
  }
});
