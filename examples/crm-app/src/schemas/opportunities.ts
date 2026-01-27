import { PageSchema } from "@object-ui/types";

export const opportunityListSchema: PageSchema = {
    type: "page",
    props: { title: "Opportunities" },
    children: [
        {
            type: "page:header",
            props: {
                title: "Opportunities",
                description: "Track your sales pipeline"
            },
            children: [
                {
                    type: "action:button",
                    props: { label: "New Deal", variant: "default" }
                }
            ]
        },
        {
            type: "view:kanban",
            bind: "opportunities",
            props: {
                groupBy: "stage",
                columns: ["Prospecting", "Proposal", "Negotiation", "Closed Won", "Closed Lost"],
                card: {
                    title: "name",
                    subtitle: "amount",
                    footer: "closeDate",
                    onClick: { action: "navigate", params: { url: "/opportunities/${id}" } }
                }
            }
        }
    ]
};
