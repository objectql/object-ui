import type { Preview } from '@storybook/react-vite'
import '../src/index.css';
import { ComponentRegistry } from '@object-ui/core';
import * as components from '../src/index';

// Register all components for Storybook
Object.values(components);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;