import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Object UI",
  description: "The Modular Interface Engine for the Enterprise",
  base: '/',
  ignoreDeadLinks: true,
  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/introduction' },
      { 
        text: 'Documentation',
        items: [
          { text: '📚 Documentation Index', link: '/DOCUMENTATION_INDEX' },
          { text: 'Protocol Specs', link: '/protocol/overview' },
          { text: 'API Reference', link: '/api/core' },
          { text: 'Technical Specs', link: '/spec/architecture' },
          { text: 'Components', link: '/components/form' }
        ]
      },
      { text: 'Roadmap', link: '/ROADMAP' }
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
          text: 'Core Concepts',
          items: [
            { text: 'Schema Rendering', link: '/guide/schema-rendering' },
            { text: 'Components', link: '/guide/components' },
            { text: 'Component Registry', link: '/guide/component-registry' },
            { text: 'Plugins', link: '/guide/plugins' },
            { text: 'Expression System', link: '/guide/expressions' }
          ]
        },
        {
          text: 'Architecture',
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
            { text: '📊 Implementation Status', link: '/protocol/implementation-status' }
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
            { text: 'Architecture', link: '/spec/architecture' },
            { text: 'Project Structure', link: '/spec/project-structure' },
            { text: 'Schema Rendering', link: '/spec/schema-rendering' },
            { text: 'Component System', link: '/spec/component' },
            { text: 'Base Components', link: '/spec/base-components' },
            { text: 'Component Library', link: '/spec/component-library' },
            { text: 'Component Packages', link: '/spec/component-package' }
          ]
        }
      ],
      
      '/components/': [
        {
          text: 'Component Examples',
          items: [
            { text: 'Form Component', link: '/components/form' },
            { text: 'Calendar View', link: '/components/calendar-view' }
          ]
        }
      ],
      
      '/plugins/': [
        {
          text: 'Official Plugins',
          items: [
            { text: 'Plugin Editor', link: '/plugins/plugin-editor' },
            { text: 'Plugin Charts', link: '/plugins/plugin-charts' },
            { text: 'Plugin Kanban', link: '/plugins/plugin-kanban' },
            { text: 'Plugin Markdown', link: '/plugins/plugin-markdown' }
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
