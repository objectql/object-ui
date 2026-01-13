import { SchemaRenderer } from '@object-ui/react';

const schema = {
  type: 'sidebar-provider',
  body: [
    {
      type: 'sidebar',
      body: [
        {
          type: 'sidebar-header',
          body: [
            { 
              type: 'div', 
              className: 'px-4 py-2 font-bold text-xl',
              body: { type: 'text', content: 'Object UI' }
            }
          ]
        },
        {
          type: 'sidebar-content',
          body: [
            {
              type: 'sidebar-group',
              label: 'Platform',
              body: [
                {
                  type: 'sidebar-menu',
                  body: [
                    {
                      type: 'sidebar-menu-item',
                      body: {
                        type: 'sidebar-menu-button',
                        active: true,
                        body: { type: 'span', body: { type: 'text', content: 'Dashboard' } }
                      }
                    },
                    {
                      type: 'sidebar-menu-item',
                      body: {
                        type: 'sidebar-menu-button',
                        body: { type: 'span', body: { type: 'text', content: 'Objects' } }
                      }
                    },
                    {
                      type: 'sidebar-menu-item',
                      body: {
                        type: 'sidebar-menu-button',
                        body: { type: 'span', body: { type: 'text', content: 'Apps' } }
                      }
                    }
                  ]
                }
              ]
            },
            {
              type: 'sidebar-group',
              label: 'Settings',
              body: [
                {
                  type: 'sidebar-menu',
                  body: [
                    {
                      type: 'sidebar-menu-item',
                      body: {
                        type: 'sidebar-menu-button',
                        body: { type: 'span', body: { type: 'text', content: 'Profile' } }
                      }
                    },
                    {
                      type: 'sidebar-menu-item',
                      body: {
                        type: 'sidebar-menu-button',
                        body: { type: 'span', body: { type: 'text', content: 'Billing' } }
                      }
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: 'sidebar-footer',
          body: {
            type: 'div',
            className: 'p-4 text-xs text-muted-foreground',
            body: { type: 'text', content: 'v1.0.0' }
          }
        }
      ]
    },
    {
      type: 'sidebar-inset',
      body: [
        {
          type: 'header-bar',
          crumbs: [
            { label: 'Platform', href: '#' },
            { label: 'Dashboard' }
          ]
        },
        {
          type: 'div',
          className: 'flex flex-1 flex-col gap-4 p-4 md:p-8',
          body: [
            {
              type: 'div',
              className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-4',
              body: [
                {
                  type: 'card',
                  title: 'Total Revenue',
                  body: [
                    { 
                      type: 'div', 
                      className: 'text-2xl font-bold', 
                      body: { type: 'text', content: '$45,231.89' } 
                    },
                    { 
                      type: 'div', 
                      className: 'text-xs text-muted-foreground', 
                      body: { type: 'text', content: '+20.1% from last month' } 
                    }
                  ]
                },
                {
                  type: 'card',
                  title: 'Subscriptions',
                  body: [
                    { 
                      type: 'div', 
                      className: 'text-2xl font-bold', 
                      body: { type: 'text', content: '+2350' } 
                    },
                    { 
                      type: 'div', 
                      className: 'text-xs text-muted-foreground', 
                      body: { type: 'text', content: '+180.1% from last month' } 
                    }
                  ]
                },
                {
                  type: 'card',
                  title: 'Sales',
                  body: [
                    { 
                      type: 'div', 
                      className: 'text-2xl font-bold', 
                      body: { type: 'text', content: '+12,234' } 
                    },
                    { 
                      type: 'div', 
                      className: 'text-xs text-muted-foreground', 
                      body: { type: 'text', content: '+19% from last month' } 
                    }
                  ]
                },
                {
                  type: 'card',
                  title: 'Active Now',
                  body: [
                    { 
                      type: 'div', 
                      className: 'text-2xl font-bold', 
                      body: { type: 'text', content: '+573' } 
                    },
                    { 
                      type: 'div', 
                      className: 'text-xs text-muted-foreground', 
                      body: { type: 'text', content: '+201 since last hour' } 
                    }
                  ]
                }
              ]
            },
            {
              type: 'tabs',
              defaultValue: 'overview',
              className: 'space-y-4',
              items: [
                {
                  value: 'overview',
                  label: 'Overview',
                  body: [
                    {
                      type: 'card',
                      title: 'Overview',
                      description: 'View your dashboard overview here.',
                      className: 'mb-4',
                      body: [
                        { type: 'div', className: 'mb-4', body: { type: 'text', content: 'This is a demonstration of the Object UI components rendered from JSON schema.' } },
                        {
                          type: 'div',
                          className: 'flex gap-2 flex-wrap',
                          body: [
                            { type: 'button', label: 'Primary Action' },
                            { type: 'button', label: 'Secondary', variant: 'secondary' },
                            { type: 'button', label: 'Outline', variant: 'outline' },
                            { type: 'button', label: 'Destructive', variant: 'destructive' },
                            { type: 'button', label: 'Ghost', variant: 'ghost' },
                            { type: 'button', label: 'Link', variant: 'link' }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'div',
                      className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-7',
                      body: [
                        {
                           type: 'card',
                           className: 'col-span-4',
                           title: 'Interactive Chart',
                           body: { 
                             type: 'div', 
                             className: 'h-[200px] flex items-center justify-center bg-gray-50 rounded border border-dashed text-muted-foreground',
                             body: { type: 'text', content: 'Chart Area Placeholder' }
                           }
                        },
                        {
                          type: 'card',
                          className: 'col-span-3',
                          title: 'Form Example',
                          description: 'A simple form layout using Input components.',
                          body: [
                            { type: 'input', label: 'Email', id: 'email', inputType: 'email', placeholder: 'm@example.com', wrapperClass: 'mb-2' },
                            { type: 'input', label: 'Username', id: 'username', placeholder: 'jdoe', wrapperClass: 'mb-4' },
                            { type: 'button', label: 'Save Changes', className: 'w-full' }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  value: 'analytics',
                  label: 'Analytics',
                  body: { type: 'text', content: 'Analytics Content' }
                },
                {
                  value: 'reports',
                  label: 'Reports',
                  body: { type: 'text', content: 'Reports Content' }
                },
                {
                  value: 'notifications',
                  label: 'Notifications',
                  body: { type: 'text', content: 'Notifications Content' }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

function App() {
  return (
    <SchemaRenderer schema={schema} />
  )
}

export default App
