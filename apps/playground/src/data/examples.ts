/**
 * Predefined JSON schema examples for the Object UI Playground
 * Organized by category to showcase different capabilities
 */

export const examples = {
  // A. Basic Primitives - Showcase Shadcn component wrapping
  'input-states': `{
  "type": "div",
  "className": "space-y-6 max-w-md",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "Input Component States",
          "className": "text-2xl font-bold"
        },
        {
          "type": "text",
          "content": "Demonstrates various input states and configurations",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "input",
      "label": "Regular Input",
      "id": "regular",
      "placeholder": "Enter your name"
    },
    {
      "type": "input",
      "label": "Required Field",
      "id": "required",
      "required": true,
      "placeholder": "This field is required"
    },
    {
      "type": "input",
      "label": "Disabled Input",
      "id": "disabled",
      "disabled": true,
      "value": "Cannot edit this"
    },
    {
      "type": "input",
      "label": "Email Input",
      "id": "email",
      "inputType": "email",
      "placeholder": "user@example.com"
    }
  ]
}`,

  'button-variants': `{
  "type": "div",
  "className": "space-y-6 max-w-2xl",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "Button Variants",
          "className": "text-2xl font-bold"
        },
        {
          "type": "text",
          "content": "Different button styles using Shadcn variants",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "div",
      "className": "space-y-4",
      "body": [
        {
          "type": "div",
          "className": "flex flex-wrap gap-2",
          "body": [
            {
              "type": "button",
              "label": "Default"
            },
            {
              "type": "button",
              "label": "Destructive",
              "variant": "destructive"
            },
            {
              "type": "button",
              "label": "Outline",
              "variant": "outline"
            },
            {
              "type": "button",
              "label": "Secondary",
              "variant": "secondary"
            },
            {
              "type": "button",
              "label": "Ghost",
              "variant": "ghost"
            },
            {
              "type": "button",
              "label": "Link",
              "variant": "link"
            }
          ]
        },
        {
          "type": "div",
          "className": "space-y-2",
          "body": [
            {
              "type": "text",
              "content": "Tailwind Native: Custom Styling",
              "className": "text-sm font-semibold"
            },
            {
              "type": "button",
              "label": "Purple Custom Button",
              "className": "bg-purple-500 hover:bg-purple-700 text-white"
            }
          ]
        }
      ]
    }
  ]
}`,

  // B. Complex Layouts - The killer feature
  'grid-layout': `{
  "type": "div",
  "className": "space-y-6",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "Responsive Grid Layout",
          "className": "text-2xl font-bold"
        },
        {
          "type": "text",
          "content": "Complex nested grid with responsive breakpoints",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "div",
      "className": "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
      "body": [
        {
          "type": "card",
          "className": "md:col-span-2",
          "title": "Wide Card",
          "description": "This card spans 2 columns on medium screens",
          "body": {
            "type": "div",
            "className": "p-6 pt-0",
            "body": {
              "type": "text",
              "content": "Try resizing your browser to see the responsive behavior!"
            }
          }
        },
        {
          "type": "card",
          "title": "Regular Card",
          "body": {
            "type": "div",
            "className": "p-6 pt-0",
            "body": {
              "type": "text",
              "content": "Standard card"
            }
          }
        },
        {
          "type": "card",
          "title": "Card 1",
          "body": {
            "type": "div",
            "className": "p-6 pt-0",
            "body": {
              "type": "text",
              "content": "Content 1"
            }
          }
        },
        {
          "type": "card",
          "title": "Card 2",
          "body": {
            "type": "div",
            "className": "p-6 pt-0",
            "body": {
              "type": "text",
              "content": "Content 2"
            }
          }
        },
        {
          "type": "card",
          "title": "Card 3",
          "body": {
            "type": "div",
            "className": "p-6 pt-0",
            "body": {
              "type": "text",
              "content": "Content 3"
            }
          }
        }
      ]
    }
  ]
}`,

  'dashboard': `{
  "type": "div",
  "className": "space-y-6",
  "body": [
    {
      "type": "div",
      "className": "flex items-center justify-between",
      "body": [
        {
          "type": "div",
          "className": "space-y-1",
          "body": [
            {
              "type": "text",
              "content": "Analytics Dashboard",
              "className": "text-2xl font-bold tracking-tight"
            },
            {
              "type": "text",
              "content": "Overview of your project performance and metrics.",
              "className": "text-sm text-muted-foreground"
            }
          ]
        },
        {
          "type": "div",
          "className": "flex items-center gap-2",
          "body": [
            {
              "type": "button",
              "label": "Download",
              "variant": "outline",
              "size": "sm"
            },
            {
              "type": "button",
              "label": "Create Report",
              "size": "sm"
            }
          ]
        }
      ]
    },
    {
      "type": "div",
      "className": "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
      "body": [
        {
          "type": "card",
          "className": "shadow-sm hover:shadow-md transition-shadow",
          "body": [
            {
              "type": "div",
              "className": "p-6 pb-2",
              "body": {
                "type": "text",
                "content": "Total Revenue",
                "className": "text-sm font-medium text-muted-foreground"
              }
            },
            {
              "type": "div",
              "className": "p-6 pt-0",
              "body": [
                {
                  "type": "text",
                  "content": "$45,231.89",
                  "className": "text-2xl font-bold"
                },
                {
                  "type": "text",
                  "content": "+20.1% from last month",
                  "className": "text-xs text-muted-foreground mt-1"
                }
              ]
            }
          ]
        },
        {
          "type": "card",
          "className": "shadow-sm hover:shadow-md transition-shadow",
          "body": [
            {
              "type": "div",
              "className": "p-6 pb-2",
              "body": {
                "type": "text",
                "content": "Subscriptions",
                "className": "text-sm font-medium text-muted-foreground"
              }
            },
            {
              "type": "div",
              "className": "p-6 pt-0",
              "body": [
                {
                  "type": "text",
                  "content": "+2,350",
                  "className": "text-2xl font-bold"
                },
                {
                  "type": "text",
                  "content": "+180.1% from last month",
                  "className": "text-xs text-muted-foreground mt-1"
                }
              ]
            }
          ]
        },
        {
          "type": "card",
          "className": "shadow-sm hover:shadow-md transition-shadow",
          "body": [
            {
              "type": "div",
              "className": "p-6 pb-2",
              "body": {
                "type": "text",
                "content": "Sales",
                "className": "text-sm font-medium text-muted-foreground"
              }
            },
            {
              "type": "div",
              "className": "p-6 pt-0",
              "body": [
                {
                  "type": "text",
                  "content": "+12,234",
                  "className": "text-2xl font-bold"
                },
                {
                  "type": "text",
                  "content": "+19% from last month",
                  "className": "text-xs text-muted-foreground mt-1"
                }
              ]
            }
          ]
        },
        {
          "type": "card",
          "className": "shadow-sm hover:shadow-md transition-shadow",
          "body": [
            {
              "type": "div",
              "className": "p-6 pb-2",
              "body": {
                "type": "text",
                "content": "Active Now",
                "className": "text-sm font-medium text-muted-foreground"
              }
            },
            {
              "type": "div",
              "className": "p-6 pt-0",
              "body": [
                {
                  "type": "text",
                  "content": "+573",
                  "className": "text-2xl font-bold"
                },
                {
                  "type": "text",
                  "content": "+201 since last hour",
                  "className": "text-xs text-muted-foreground mt-1"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "card",
      "className": "shadow-sm",
      "title": "Recent Activity",
      "description": "Your latest component interactions",
      "body": {
        "type": "div",
        "className": "p-6 pt-0 space-y-2",
        "body": [
          {
            "type": "text",
            "content": "Schema updated successfully",
            "className": "text-sm"
          },
          {
            "type": "text",
            "content": "New component rendered at 10:42 AM",
            "className": "text-sm text-muted-foreground"
          }
        ]
      }
    }
  ]
}`,

  'tabs-demo': `{
  "type": "div",
  "className": "space-y-6",
  "body": [
    {
      "type": "text",
      "content": "Tabs Component",
      "className": "text-2xl font-bold"
    },
    {
      "type": "tabs",
      "defaultValue": "account",
      "className": "w-full",
      "items": [
        {
          "value": "account",
          "label": "Account",
          "body": {
            "type": "card",
            "title": "Account Settings",
            "description": "Make changes to your account here.",
            "body": {
              "type": "div",
              "className": "p-6 pt-0 space-y-4",
              "body": [
                {
                  "type": "input",
                  "label": "Name",
                  "id": "name",
                  "value": "Pedro Duarte"
                },
                {
                  "type": "input",
                  "label": "Username",
                  "id": "username",
                  "value": "@peduarte"
                },
                {
                  "type": "button",
                  "label": "Save changes"
                }
              ]
            }
          }
        },
        {
          "value": "password",
          "label": "Password",
          "body": {
            "type": "card",
            "title": "Password",
            "description": "Change your password here.",
            "body": {
              "type": "div",
              "className": "p-6 pt-0 space-y-4",
              "body": [
                {
                  "type": "input",
                  "label": "Current password",
                  "id": "current",
                  "inputType": "password"
                },
                {
                  "type": "input",
                  "label": "New password",
                  "id": "new",
                  "inputType": "password"
                },
                {
                  "type": "button",
                  "label": "Update password"
                }
              ]
            }
          }
        },
        {
          "value": "notifications",
          "label": "Notifications",
          "body": {
            "type": "card",
            "title": "Notifications",
            "description": "Configure how you receive notifications.",
            "body": {
              "type": "div",
              "className": "p-6 pt-0",
              "body": {
                "type": "text",
                "content": "Notification settings will be displayed here."
              }
            }
          }
        }
      ]
    }
  ]
}`,

  // C. Form with simple structure (no data linkage for now as that requires runtime state)
  'form-demo': `{
  "type": "div",
  "className": "max-w-2xl space-y-6",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "User Registration Form",
          "className": "text-2xl font-bold"
        },
        {
          "type": "text",
          "content": "A comprehensive form demonstrating various input types",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "card",
      "className": "shadow-sm",
      "body": {
        "type": "div",
        "className": "p-6 space-y-6",
        "body": [
          {
            "type": "div",
            "className": "grid gap-4 md:grid-cols-2",
            "body": [
              {
                "type": "input",
                "label": "First Name",
                "id": "firstName",
                "required": true,
                "placeholder": "John"
              },
              {
                "type": "input",
                "label": "Last Name",
                "id": "lastName",
                "required": true,
                "placeholder": "Doe"
              }
            ]
          },
          {
            "type": "input",
            "label": "Email Address",
            "id": "email",
            "inputType": "email",
            "required": true,
            "placeholder": "john.doe@example.com"
          },
          {
            "type": "input",
            "label": "Password",
            "id": "password",
            "inputType": "password",
            "required": true,
            "placeholder": "••••••••"
          },
          {
            "type": "div",
            "className": "flex items-center justify-end gap-2",
            "body": [
              {
                "type": "button",
                "label": "Cancel",
                "variant": "outline"
              },
              {
                "type": "button",
                "label": "Create Account"
              }
            ]
          }
        ]
      }
    }
  ]
}`,

  'airtable-form': `{
  "type": "div",
  "className": "max-w-4xl space-y-6",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "Airtable-Style Feature-Complete Form",
          "className": "text-3xl font-bold"
        },
        {
          "type": "text",
          "content": "A comprehensive form component with validation, multi-column layout, and conditional fields",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "card",
      "className": "shadow-sm",
      "body": {
        "type": "form",
        "className": "p-6",
        "submitLabel": "Create Project",
        "cancelLabel": "Reset",
        "showCancel": true,
        "columns": 2,
        "validationMode": "onBlur",
        "resetOnSubmit": false,
        "defaultValues": {
          "projectType": "personal",
          "priority": "medium",
          "notifications": true
        },
        "fields": [
          {
            "name": "projectName",
            "label": "Project Name",
            "type": "input",
            "required": true,
            "placeholder": "Enter project name",
            "validation": {
              "minLength": {
                "value": 3,
                "message": "Project name must be at least 3 characters"
              }
            }
          },
          {
            "name": "projectType",
            "label": "Project Type",
            "type": "select",
            "required": true,
            "options": [
              { "label": "Personal", "value": "personal" },
              { "label": "Team", "value": "team" },
              { "label": "Enterprise", "value": "enterprise" }
            ]
          },
          {
            "name": "teamSize",
            "label": "Team Size",
            "type": "input",
            "inputType": "number",
            "placeholder": "Number of team members",
            "condition": {
              "field": "projectType",
              "in": ["team", "enterprise"]
            },
            "validation": {
              "min": {
                "value": 2,
                "message": "Team must have at least 2 members"
              }
            }
          },
          {
            "name": "budget",
            "label": "Budget",
            "type": "input",
            "inputType": "number",
            "placeholder": "Project budget",
            "condition": {
              "field": "projectType",
              "equals": "enterprise"
            }
          },
          {
            "name": "priority",
            "label": "Priority Level",
            "type": "select",
            "required": true,
            "options": [
              { "label": "Low", "value": "low" },
              { "label": "Medium", "value": "medium" },
              { "label": "High", "value": "high" },
              { "label": "Critical", "value": "critical" }
            ]
          },
          {
            "name": "deadline",
            "label": "Deadline",
            "type": "input",
            "inputType": "date",
            "condition": {
              "field": "priority",
              "in": ["high", "critical"]
            }
          },
          {
            "name": "description",
            "label": "Project Description",
            "type": "textarea",
            "placeholder": "Describe your project goals and objectives",
            "validation": {
              "maxLength": {
                "value": 500,
                "message": "Description must not exceed 500 characters"
              }
            }
          },
          {
            "name": "notifications",
            "label": "Enable Notifications",
            "type": "checkbox",
            "description": "Receive updates about project progress"
          }
        ]
      }
    }
  ]
}`,

  'simple-page': `{
  "type": "div",
  "className": "space-y-4",
  "body": [
    {
      "type": "text",
      "content": "Welcome to Object UI",
      "className": "text-3xl font-bold"
    },
    {
      "type": "text",
      "content": "The Universal, Schema-Driven Rendering Engine",
      "className": "text-xl text-muted-foreground"
    },
    {
      "type": "div",
      "className": "flex gap-2 mt-4",
      "body": [
        {
          "type": "button",
          "label": "Get Started"
        },
        {
          "type": "button",
          "label": "Learn More",
          "variant": "outline"
        }
      ]
    }
  ]
}`,

  // Calendar View - Airtable-style calendar
  'calendar-view': `{
  "type": "div",
  "className": "space-y-4",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "Calendar View",
          "className": "text-2xl font-bold"
        },
        {
          "type": "text",
          "content": "Airtable-style calendar for displaying records as events",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "calendar-view",
      "className": "h-[600px] border rounded-lg",
      "view": "month",
      "titleField": "title",
      "startDateField": "start",
      "endDateField": "end",
      "colorField": "type",
      "colorMapping": {
        "meeting": "#3b82f6",
        "deadline": "#ef4444",
        "event": "#10b981",
        "holiday": "#8b5cf6"
      },
      "data": [
        {
          "id": 1,
          "title": "Team Standup",
          "start": "${new Date(new Date().setHours(9, 0, 0, 0)).toISOString()}",
          "end": "${new Date(new Date().setHours(9, 30, 0, 0)).toISOString()}",
          "type": "meeting",
          "allDay": false
        },
        {
          "id": 2,
          "title": "Project Launch",
          "start": "${new Date(new Date().setDate(new Date().getDate() + 3)).toISOString()}",
          "type": "deadline",
          "allDay": true
        },
        {
          "id": 3,
          "title": "Client Meeting",
          "start": "${new Date(new Date().setDate(new Date().getDate() + 5)).toISOString()}",
          "end": "${new Date(new Date(new Date().setDate(new Date().getDate() + 5)).setHours(14, 0, 0, 0)).toISOString()}",
          "type": "meeting",
          "allDay": false
        },
        {
          "id": 4,
          "title": "Team Building Event",
          "start": "${new Date(new Date().setDate(new Date().getDate() + 7)).toISOString()}",
          "end": "${new Date(new Date().setDate(new Date().getDate() + 9)).toISOString()}",
          "type": "event",
          "allDay": true
        },
        {
          "id": 5,
          "title": "Code Review",
          "start": "${new Date(new Date().setDate(new Date().getDate() + 1)).toISOString()}",
          "end": "${new Date(new Date(new Date().setDate(new Date().getDate() + 1)).setHours(15, 0, 0, 0)).toISOString()}",
          "type": "meeting",
          "allDay": false
        },
        {
          "id": 6,
          "title": "National Holiday",
          "start": "${new Date(new Date().setDate(new Date().getDate() + 10)).toISOString()}",
          "type": "holiday",
          "allDay": true
        }
      ]
    }
  ]
}`,

  'kanban-board': `{
  "type": "kanban",
  "className": "w-full h-[600px]",
  "columns": [
    {
      "id": "backlog",
      "title": "📋 Backlog",
      "cards": [
        {
          "id": "card-1",
          "title": "User Authentication",
          "description": "Implement user login and registration flow",
          "badges": [
            { "label": "Feature", "variant": "default" },
            { "label": "High Priority", "variant": "destructive" }
          ]
        },
        {
          "id": "card-2",
          "title": "API Documentation",
          "description": "Write comprehensive API docs",
          "badges": [
            { "label": "Documentation", "variant": "outline" }
          ]
        },
        {
          "id": "card-3",
          "title": "Database Optimization",
          "description": "Improve query performance",
          "badges": [
            { "label": "Performance", "variant": "secondary" }
          ]
        }
      ]
    },
    {
      "id": "todo",
      "title": "📝 To Do",
      "cards": [
        {
          "id": "card-4",
          "title": "Design Landing Page",
          "description": "Create wireframes and mockups",
          "badges": [
            { "label": "Design", "variant": "default" }
          ]
        },
        {
          "id": "card-5",
          "title": "Setup CI/CD Pipeline",
          "description": "Configure GitHub Actions",
          "badges": [
            { "label": "DevOps", "variant": "secondary" }
          ]
        }
      ]
    },
    {
      "id": "in-progress",
      "title": "⚙️ In Progress",
      "limit": 3,
      "cards": [
        {
          "id": "card-6",
          "title": "Payment Integration",
          "description": "Integrate Stripe payment gateway",
          "badges": [
            { "label": "Feature", "variant": "default" },
            { "label": "In Progress", "variant": "secondary" }
          ]
        },
        {
          "id": "card-7",
          "title": "Bug Fix: Login Issue",
          "description": "Fix session timeout bug",
          "badges": [
            { "label": "Bug", "variant": "destructive" }
          ]
        }
      ]
    },
    {
      "id": "review",
      "title": "👀 Review",
      "cards": [
        {
          "id": "card-8",
          "title": "Dashboard Analytics",
          "description": "Add charts and metrics",
          "badges": [
            { "label": "Feature", "variant": "default" },
            { "label": "Needs Review", "variant": "outline" }
          ]
        }
      ]
    },
    {
      "id": "done",
      "title": "✅ Done",
      "cards": [
        {
          "id": "card-9",
          "title": "Project Setup",
          "description": "Initialize repository and dependencies",
          "badges": [
            { "label": "Completed", "variant": "outline" }
          ]
        },
        {
          "id": "card-10",
          "title": "Basic Layout",
          "description": "Create header and navigation",
          "badges": [
            { "label": "Completed", "variant": "outline" }
          ]
        }
      ]
    }
  ]
}`,

  // Enterprise Data Table - Airtable-like functionality
  'enterprise-table': `{
  "type": "div",
  "className": "space-y-6",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "Enterprise Data Table",
          "className": "text-2xl font-bold"
        },
        {
          "type": "text",
          "content": "Full-featured data table with sorting, filtering, pagination, row selection, export, column resizing, and column reordering - similar to Airtable",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "data-table",
      "caption": "User Management Table",
      "pagination": true,
      "pageSize": 10,
      "searchable": true,
      "selectable": true,
      "sortable": true,
      "exportable": true,
      "rowActions": true,
      "resizableColumns": true,
      "reorderableColumns": true,
      "columns": [
        { 
          "header": "ID", 
          "accessorKey": "id", 
          "width": "80px",
          "sortable": true
        },
        { 
          "header": "Name", 
          "accessorKey": "name",
          "sortable": true
        },
        { 
          "header": "Email", 
          "accessorKey": "email",
          "sortable": true
        },
        { 
          "header": "Department", 
          "accessorKey": "department",
          "sortable": true
        },
        { 
          "header": "Status", 
          "accessorKey": "status",
          "width": "100px",
          "sortable": true
        },
        { 
          "header": "Role", 
          "accessorKey": "role",
          "sortable": true
        },
        { 
          "header": "Join Date", 
          "accessorKey": "joinDate",
          "sortable": true
        }
      ],
      "data": [
        { 
          "id": 1, 
          "name": "John Doe", 
          "email": "john.doe@company.com", 
          "department": "Engineering",
          "status": "Active", 
          "role": "Senior Developer",
          "joinDate": "2022-01-15"
        },
        { 
          "id": 2, 
          "name": "Jane Smith", 
          "email": "jane.smith@company.com", 
          "department": "Product",
          "status": "Active", 
          "role": "Product Manager",
          "joinDate": "2021-11-20"
        },
        { 
          "id": 3, 
          "name": "Bob Johnson", 
          "email": "bob.johnson@company.com", 
          "department": "Sales",
          "status": "Inactive", 
          "role": "Sales Representative",
          "joinDate": "2020-05-10"
        },
        { 
          "id": 4, 
          "name": "Alice Williams", 
          "email": "alice.williams@company.com", 
          "department": "Engineering",
          "status": "Active", 
          "role": "Tech Lead",
          "joinDate": "2019-08-22"
        },
        { 
          "id": 5, 
          "name": "Charlie Brown", 
          "email": "charlie.brown@company.com", 
          "department": "Marketing",
          "status": "Active", 
          "role": "Marketing Manager",
          "joinDate": "2021-03-14"
        },
        { 
          "id": 6, 
          "name": "Diana Prince", 
          "email": "diana.prince@company.com", 
          "department": "HR",
          "status": "Active", 
          "role": "HR Director",
          "joinDate": "2018-12-01"
        },
        { 
          "id": 7, 
          "name": "Ethan Hunt", 
          "email": "ethan.hunt@company.com", 
          "department": "Operations",
          "status": "Inactive", 
          "role": "Operations Coordinator",
          "joinDate": "2022-06-30"
        },
        { 
          "id": 8, 
          "name": "Fiona Gallagher", 
          "email": "fiona.gallagher@company.com", 
          "department": "Finance",
          "status": "Active", 
          "role": "Financial Analyst",
          "joinDate": "2020-09-18"
        },
        { 
          "id": 9, 
          "name": "George Wilson", 
          "email": "george.wilson@company.com", 
          "department": "Engineering",
          "status": "Active", 
          "role": "DevOps Engineer",
          "joinDate": "2021-04-25"
        },
        { 
          "id": 10, 
          "name": "Hannah Montana", 
          "email": "hannah.montana@company.com", 
          "department": "Product",
          "status": "Active", 
          "role": "Product Designer",
          "joinDate": "2022-02-10"
        },
        { 
          "id": 11, 
          "name": "Ivan Drago", 
          "email": "ivan.drago@company.com", 
          "department": "Engineering",
          "status": "Inactive", 
          "role": "Backend Developer",
          "joinDate": "2020-07-12"
        },
        { 
          "id": 12, 
          "name": "Julia Roberts", 
          "email": "julia.roberts@company.com", 
          "department": "Marketing",
          "status": "Active", 
          "role": "Content Strategist",
          "joinDate": "2021-10-05"
        },
        { 
          "id": 13, 
          "name": "Kevin Hart", 
          "email": "kevin.hart@company.com", 
          "department": "Sales",
          "status": "Active", 
          "role": "Sales Director",
          "joinDate": "2019-03-20"
        },
        { 
          "id": 14, 
          "name": "Laura Croft", 
          "email": "laura.croft@company.com", 
          "department": "Operations",
          "status": "Active", 
          "role": "Operations Analyst",
          "joinDate": "2021-12-08"
        },
        { 
          "id": 15, 
          "name": "Mike Tyson", 
          "email": "mike.tyson@company.com", 
          "department": "Operations",
          "status": "Active", 
          "role": "Operations Manager",
          "joinDate": "2021-07-05"
        }
      ]
    }
  ]
}`,

  'data-table-simple': `{
  "type": "div",
  "className": "space-y-6",
  "body": [
    {
      "type": "div",
      "className": "space-y-2",
      "body": [
        {
          "type": "text",
          "content": "Simple Data Table",
          "className": "text-2xl font-bold"
        },
        {
          "type": "text",
          "content": "Minimal configuration with essential features only",
          "className": "text-muted-foreground"
        }
      ]
    },
    {
      "type": "data-table",
      "pagination": false,
      "searchable": false,
      "selectable": false,
      "sortable": true,
      "exportable": false,
      "rowActions": false,
      "columns": [
        { "header": "Product", "accessorKey": "product" },
        { "header": "Price", "accessorKey": "price" },
        { "header": "Stock", "accessorKey": "stock" },
        { "header": "Category", "accessorKey": "category" }
      ],
      "data": [
        { "product": "Laptop", "price": "$999", "stock": "45", "category": "Electronics" },
        { "product": "Mouse", "price": "$29", "stock": "150", "category": "Accessories" },
        { "product": "Keyboard", "price": "$79", "stock": "89", "category": "Accessories" },
        { "product": "Monitor", "price": "$299", "stock": "32", "category": "Electronics" },
        { "product": "Desk Chair", "price": "$199", "stock": "18", "category": "Furniture" }
      ]
    }
  ]
}`
};

export type ExampleKey = keyof typeof examples;

export const exampleCategories = {
  'Primitives': ['simple-page', 'input-states', 'button-variants'],
  'Layouts': ['grid-layout', 'dashboard', 'tabs-demo'],
  'Data Display': ['calendar-view', 'enterprise-table', 'data-table-simple'],
  'Forms': ['form-demo', 'airtable-form'],
  'Complex': ['kanban-board']
};
