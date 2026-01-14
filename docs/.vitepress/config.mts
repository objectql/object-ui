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
      { text: 'Studio', link: '/studio/', target: '_self' },
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Protocol', link: '/protocol/overview' },
      { text: 'API', link: '/api/core' }
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
            { text: 'Component Registry', link: '/guide/component-registry' },
            { text: 'Expression System', link: '/guide/expressions' }
          ]
        }
      ],
      
      '/protocol/': [
        {
          text: 'Protocol Specifications',
          items: [
            { text: 'Overview', link: '/protocol/overview' },
            { text: 'Object', link: '/protocol/object' },
            { text: 'View', link: '/protocol/view' },
            { text: 'Page', link: '/protocol/page' },
            { text: 'Form', link: '/protocol/form' },
            { text: 'Menu', link: '/protocol/menu' },
            { text: 'App', link: '/protocol/app' },
            { text: 'Report', link: '/protocol/report' }
          ]
        }
      ],
      
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Core', link: '/api/core' },
            { text: 'React', link: '/api/react' },
            { text: 'Components', link: '/api/components' },
            { text: 'Designer', link: '/api/designer' }
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
