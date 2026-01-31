import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';
import { AccountObject } from './src/objects/account.object';
import { ContactObject } from './src/objects/contact.object';
import { OpportunityObject } from './src/objects/opportunity.object';

export default defineStack({
  objects: [
    AccountObject,
    ContactObject,
    OpportunityObject
  ],
  apps: [
    App.create({
      name: 'crm_app',
      label: 'CRM',
      icon: 'users',
      navigation: [
        {
          id: 'nav_contacts',
          type: 'object',
          objectName: 'contact',
          label: 'Contacts'
        },
        {
          id: 'nav_opportunities',
          type: 'object',
          objectName: 'opportunity',
          label: 'Opportunities'
        }
      ]
    })
  ],
  manifest: {
    id: 'com.example.crm',
    version: '1.0.0',
    type: 'app',
    name: 'CRM Example',
    description: 'CRM App Definition',
    data: [
      {
        object: 'contact',
        mode: 'upsert', // upsert based on ID (which is usually _id or id)
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
              account_id: "1", // This would ideally link to an account record
              contact_ids: ["1", "2"], // Corrected IDs
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
      }
    ]
  }
});
