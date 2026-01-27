// Mock Data mimicking a relational database response
export const mockData = {
    user: { name: "Demo User", role: "admin", avatar: "" },
    stats: { revenue: 125000, leads: 45, deals: 12 },
    contacts: [
      { id: "1", name: "Alice Johnson", email: "alice@example.com", phone: "555-0101", title: "VP Sales", company: "TechCorp", status: "Active" },
      { id: "2", name: "Bob Smith", email: "bob@tech.com", phone: "555-0102", title: "Developer", company: "Software Inc", status: "Lead" },
      { id: "3", name: "Charlie Brown", email: "charlie@peanuts.com", phone: "555-0103", title: "Manager", company: "Good Grief LLC", status: "Customer" }
    ],
    opportunities: [
        { 
            id: "101", 
            name: "TechCorp Enterprise License", 
            amount: 50000, 
            stage: "Proposal", 
            closeDate: "2024-06-30", 
            accountId: "1",
            contactIds: ["c1", "c2"],
            description: "Enterprise software license for 500 users. Includes premium support and training." 
        },
        { 
            id: "102", 
            name: "Software Inc Pilot", 
            amount: 5000, 
            stage: "Closed Won", 
            closeDate: "2024-01-15", 
            accountId: "2",
            contactIds: ["c2"],
            description: "Pilot program for 50 users." 
        },
        { 
            id: "103", 
            name: "Good Grief Consultant", 
            amount: 12000, 
            stage: "Negotiation", 
            closeDate: "2024-05-20", 
            accountId: "3",
            contactIds: ["c3"],
            description: "Consulting services for Q2 implementation." 
        }
    ]
  };
  
export const getContact = (id: string) => mockData.contacts.find(c => c.id === id);
export const getOpportunity = (id: string) => mockData.opportunities.find(o => o.id === id);
