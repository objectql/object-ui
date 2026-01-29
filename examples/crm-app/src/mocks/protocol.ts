// examples/crm-app/src/mocks/protocol.ts

export const protocol = {
  objects: [
    {
      name: "contact",
      fields: {
        name: { type: "text" },
        email: { type: "email" },
        phone: { type: "text" },
        title: { type: "text" },
        company: { type: "text" },
        status: { type: "select", options: ["Active", "Lead", "Customer"] }
      }
    },
    {
      name: "opportunity",
      fields: {
        name: { type: "text" },
        amount: { type: "currency" },
        stage: { type: "select" },
        closeDate: { type: "date" },
        accountId: { type: "lookup", reference_to: "account" },
        contactIds: { type: "lookup", reference_to: "contact", multiple: true },
        description: { type: "textarea" }
      }
    },
    {
      name: "account",
      fields: {
        name: { type: "text" },
        industry: { type: "text" }
      }
    },
    {
        name: "user",
        fields: {
            name: { type: "text" },
            role: { type: "text" }
        }
    }
  ]
};
