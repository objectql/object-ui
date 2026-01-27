import { DashboardSchema } from "@object-ui/types";

export const dashboardSchema: DashboardSchema = {
    type: "dashboard",
    props: { title: "Executive Dashboard" },
    widgets: [
        {
            id: "w1",
            layout: { x: 0, y: 0, w: 1, h: 1 },
            component: {
                type: "card",
                props: { title: "Total Revenue" },
                children: [
                    { type: "widget:metric", props: { value: "$125,000", trend: "+12%", label: "vs last month" } }
                ]
            }
        },
        {
            id: "w2",
            layout: { x: 1, y: 0, w: 1, h: 1 },
            component: {
                type: "card",
                props: { title: "Active Leads" },
                children: [
                    { type: "widget:metric", props: { value: "45", trend: "+5%", label: "vs last week" } }
                ]
            }
        },
        {
            id: "w3",
            layout: { x: 2, y: 0, w: 1, h: 1 },
            component: {
                type: "card",
                props: { title: "Open Deals" },
                children: [
                    { type: "widget:metric", props: { value: "12", trend: "-2%", label: "vs last month" } }
                ]
            }
        },
        {
            id: "w4",
            layout: { x: 0, y: 1, w: 2, h: 2 },
            title: "Sales Pipeline",
            component: {
                type: "widget:bar",
                props: {
                    title: "Revenue by Stage",
                    data: [
                        { name: "Prospecting", value: 4000 },
                        { name: "Proposal", value: 3000 },
                        { name: "Negotiation", value: 2000 },
                        { name: "Closed", value: 2780 },
                    ]
                }
            }
        },
        {
            id: "w5",
            layout: { x: 2, y: 1, w: 1, h: 2 },
            title: "Recent Activity",
            component: {
                type: "widget:text",
                props: { content: "• Call with Alice\n• Email to Bob\n• Proposal sent to Charlie" }
            }
        }
    ]
};
