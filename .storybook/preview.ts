import type { Preview } from '@storybook/react-vite'
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from './mocks';
import '../packages/components/src/index.css';
import { ComponentRegistry } from '@object-ui/core';
import * as components from '../packages/components/src/index';

// Initialize MSW
initialize({
  onUnhandledRequest: 'bypass'
});

// Register all base components for Storybook
Object.values(components);

// Import and register all plugin components for Storybook
// This ensures plugin components are available for the plugin stories
import '@object-ui/plugin-aggrid';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-chatbot';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-editor';
import '@object-ui/plugin-form';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-map';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-view';
import '@object-ui/layout';

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    msw: {
       handlers: handlers
    },
    options: {
      storySort: {
        method: 'alphabetical',
        order: [
          'Introduction', 
          'Guide', 
          'Primitives', 
          'Schema', 
          ['Actions', 'Inputs', 'Layout', 'Data Display', 'Navigation', 'Feedback', 'Plugins']
        ],
      },
    },
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;