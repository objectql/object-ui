import path from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.mts';
import viteConfig from './vite.config';

export default mergeConfig(
  mergeConfig(rootConfig, viteConfig),
  defineConfig({
    test: {
      // The root config no longer sets global setupFiles (they moved into the
      // per-project `unit`/`dom` split). Console tests render components, so
      // they need the DOM setup explicitly.
      setupFiles: [path.resolve(__dirname, '../../vitest.setup.dom.tsx')],
    },
  })
);
