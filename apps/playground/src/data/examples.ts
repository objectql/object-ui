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
}`
};

export type ExampleKey = keyof typeof examples;

export const exampleCategories = {
  'Primitives': ['simple-page', 'input-states', 'button-variants'],
  'Layouts': ['grid-layout', 'dashboard', 'tabs-demo'],
  'Forms': ['form-demo', 'airtable-form'],
  'Data Display': ['calendar-view']
};
