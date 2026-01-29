
export const ContactObject = {
  name: "contact",
  fields: {
    name: { type: "text", label: "Name" },
    email: { type: "email", label: "Email" },
    phone: { type: "text", label: "Phone" },
    title: { type: "text", label: "Title" },
    company: { type: "text", label: "Company" },
    status: { type: "select", options: ["Active", "Lead", "Customer"], label: "Status" }
  }
};

export const OpportunityObject = {
  name: "opportunity",
  fields: {
    name: { type: "text", label: "Opportunity Name" },
    amount: { type: "currency", label: "Amount" },
    stage: { type: "select", label: "Stage", options: ["Prospecting", "Proposal", "Negotiation", "Closed Won", "Closed Lost"] },
    closeDate: { type: "date", label: "Close Date" },
    accountId: { type: "lookup", reference_to: "account", label: "Account" },
    contactIds: { type: "lookup", reference_to: "contact", multiple: true, label: "Contacts" },
    description: { type: "textarea", label: "Description" }
  }
};

export const AccountObject = {
    name: "account",
    fields: {
        name: { type: "text", label: "Account Name" },
        industry: { type: "text", label: "Industry" }
    }
};

export const UserObject = {
    name: "user",
    fields: {
        name: { type: "text", label: "Name" },
        role: { type: "text", label: "Role" },
        avatar: { type: "text", label: "Avatar" }
    }
};

export default {
    name: "crm_app",
    objects: [ContactObject, OpportunityObject, AccountObject, UserObject]
};
