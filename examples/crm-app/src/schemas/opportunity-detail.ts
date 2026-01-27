import { PageSchema } from "@object-ui/types";

/**
 * Opportunity Detail Schema
 * Demonstrates the new field widgets: CurrencyField, LookupField, and action execution
 */
export const opportunityDetailSchema: PageSchema = {
    type: "page",
    props: { title: "Opportunity Details" },
    children: [
        {
            type: "page:header",
            props: {
                title: "${data.name}",
                description: "Deal Amount: ${data.amount}"
            },
            children: [
                {
                    type: "action:button",
                    props: { label: "Edit", variant: "outline" }
                },
                {
                    type: "action:button",
                    props: { 
                        label: "Mark as Won", 
                        variant: "default",
                        confirmText: "Are you sure you want to mark this as won?",
                        successMessage: "Opportunity marked as won!",
                        api: "/api/opportunities/${data.id}/win",
                        reload: true
                    }
                }
            ]
        },
        {
            type: "page:card",
            className: "mt-6",
            props: { title: "Deal Information" },
            children: [
                {
                    type: "view:simple",
                    props: { columns: 2 },
                    children: [
                        { 
                            type: "field:text", 
                            bind: "name", 
                            props: { label: "Opportunity Name" } 
                        },
                        { 
                            type: "field:select", 
                            bind: "stage", 
                            props: { 
                                label: "Stage",
                                options: [
                                    { value: "Prospecting", label: "Prospecting" },
                                    { value: "Proposal", label: "Proposal" },
                                    { value: "Negotiation", label: "Negotiation" },
                                    { value: "Closed Won", label: "Closed Won" },
                                    { value: "Closed Lost", label: "Closed Lost" }
                                ]
                            } 
                        },
                        { 
                            type: "field:currency", 
                            bind: "amount", 
                            props: { 
                                label: "Amount",
                                currency: "USD",
                                precision: 2
                            } 
                        },
                        { 
                            type: "field:date", 
                            bind: "closeDate", 
                            props: { label: "Close Date" } 
                        },
                        { 
                            type: "field:lookup", 
                            bind: "accountId", 
                            props: { 
                                label: "Account",
                                options: [
                                    { value: "1", label: "Acme Corp" },
                                    { value: "2", label: "TechStart Inc" },
                                    { value: "3", label: "Global Solutions" }
                                ],
                                display_field: "label"
                            } 
                        },
                        { 
                            type: "field:lookup", 
                            bind: "contactIds", 
                            props: { 
                                label: "Contacts",
                                multiple: true,
                                options: [
                                    { value: "c1", label: "John Doe" },
                                    { value: "c2", label: "Jane Smith" },
                                    { value: "c3", label: "Bob Johnson" }
                                ]
                            } 
                        }
                    ]
                }
            ]
        },
        {
            type: "page:card",
            className: "mt-6",
            props: { title: "Description" },
            children: [
                { 
                    type: "field:textarea", 
                    bind: "description", 
                    props: { 
                        label: "Notes",
                        rows: 6,
                        placeholder: "Enter opportunity notes..."
                    } 
                }
            ]
        }
    ]
};
