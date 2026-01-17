import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Object UI",
  // Updated to match System Prompt identity
  description: "A Universal, Schema-Driven UI Engine built on React, Tailwind, and Shadcn UI.",
  base: '/',
  ignoreDeadLinks: true,
  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Showcase', link: '/guide/showcase' },
      { text: 'Components', link: '/components/' },
      { 
        text: 'Reference',
        items: [
          { text: 'Protocol Specs (@object-ui/types)', link: '/protocol/overview' },
          { text: 'API Reference', link: '/api/core' },
          { text: 'Architecture', link: '/spec/architecture' }
        ]
      },
      { text: 'GitHub', link: 'https://github.com/objectql/objectui' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Visual Studio', link: '/guide/studio' }
          ]
        },
        {
          text: 'Try & Explore',
          items: [
            { text: 'Showcase', link: '/guide/showcase' },
            { text: 'Try It Online', link: '/guide/try-it-online' },
            { text: 'Interactive Documentation', link: '/guide/interactive-showcase' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Schema Rendering', link: '/guide/schema-rendering' },
            { text: 'Component Registry', link: '/guide/component-registry' },
            { text: 'Data Connectivity', link: '/guide/data-source' },
            { text: 'Plugin System', link: '/guide/plugins' },
            { text: 'Expression Engine', link: '/guide/expressions' }
          ]
        },
        {
          text: 'Architecture & Performance',
          items: [
            { text: 'Architecture Overview', link: '/spec/architecture' },
            { text: 'Project Structure', link: '/spec/project-structure' },
            { text: 'Lazy-Loaded Plugins', link: '/lazy-loaded-plugins' }
          ]
        }
      ],
      
      '/protocol/': [
        {
          text: 'Protocol Specifications',
          items: [
            { text: 'Overview', link: '/protocol/overview' },
            { text: 'Implementation Status', link: '/protocol/implementation-status' }
          ]
        },
        {
          text: 'Core Protocols',
          items: [
            { text: 'Object Protocol', link: '/protocol/object' },
            { text: 'View Protocol', link: '/protocol/view' },
            { text: 'Page Protocol', link: '/protocol/page' },
            { text: 'Form Protocol', link: '/protocol/form' }
          ]
        },
        {
          text: 'Advanced Protocols',
          items: [
            { text: 'Menu Protocol', link: '/protocol/menu' },
            { text: 'App Protocol', link: '/protocol/app' },
            { text: 'Report Protocol', link: '/protocol/report' }
          ]
        }
      ],
      
      '/api/': [
        {
          text: 'Package API Reference',
          items: [
            { text: '@object-ui/core', link: '/api/core' },
            { text: '@object-ui/react', link: '/api/react' },
            { text: '@object-ui/components', link: '/api/components' },
            { text: '@object-ui/designer', link: '/api/designer' }
          ]
        }
      ],
      
      '/spec/': [
        {
          text: 'Technical Specifications',
          items: [
            { text: 'Architecture Overview', link: '/spec/architecture' },
            { text: 'Project Structure', link: '/spec/project-structure' },
            { text: 'Schema Rendering Flow', link: '/spec/schema-rendering' },
            { text: 'Component System', link: '/spec/component' }
          ]
        },
        {
          text: 'Component Implementation',
          items: [
            { text: 'Base Components', link: '/spec/base-components' },
            { text: 'Component Library', link: '/spec/component-library' },
            { text: 'Component Packages', link: '/spec/component-package' }
          ]
        }
      ],
      
      '/components/': [
        {
          text: 'Overview',
          items: [
            { text: 'Component Index', link: '/components/' }
          ]
        },
        {
          text: 'General',
          items: [
            { text: 'Basic Components', link: '/components/basic' },
            { text: 'Layout Components', link: '/components/layout' }
          ]
        },
        {
          text: 'Data Entry',
          items: [
            { text: 'Form Components', link: '/components/form' }
          ]
        },
        {
          text: 'Data Display',
          items: [
            { text: 'Data Display', link: '/components/data-display' },
            { text: 'Charts', link: '/components/charts' },
            { text: 'Kanban', link: '/components/kanban' },
            { text: 'Calendar View', link: '/components/calendar-view' }
          ]
        },
        {
          text: 'Interaction',
          items: [
            { text: 'Navigation', link: '/components/navigation' },
            { text: 'Feedback', link: '/components/feedback' },
            { text: 'Overlay', link: '/components/overlay' },
            { text: 'Markdown', link: '/components/markdown' }
          ]
        }
      ],
      
      '/plugins/': [
        {
          text: 'Official Plugins',
          items: [
            { text: 'Plugin: Editor', link: '/plugins/plugin-editor' },
            { text: 'Plugin: Charts', link: '/plugins/plugin-charts' },
            { text: 'Plugin: Kanban', link: '/plugins/plugin-kanban' },
            { text: 'Plugin: Markdown', link: '/plugins/plugin-markdown' }
          ]
        }
      ],
      
      '/deployment/': [
        {
          text: 'Deployment Guides',
          items: [
            { text: 'Showcase Deployment', link: '/deployment/showcase-deployment' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/objectql/objectui' }
    ],
    
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present ObjectQL'
    },
    
    search: {
      provider: 'local'
    }
  }
})
