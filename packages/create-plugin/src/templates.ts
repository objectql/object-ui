/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Every file `create-plugin` writes, as pure data.
 *
 * These builders live outside `index.ts` on purpose: `index.ts` calls
 * `program.parse()` at import time, so nothing can import it to inspect what
 * the generator produces. Moving the templates here makes the ARTIFACTS
 * testable — `src/__tests__/templates.test.ts` asserts the generated
 * `package.json`, `vite.config.ts`, `vitest.setup.ts` and example test are
 * mutually consistent, instead of grepping this source for strings.
 *
 * objectui#3716 is why that matters: the template shipped a `test` script and
 * an example test importing `@testing-library/react` + `toBeInTheDocument()`
 * while declaring neither library, and with no DOM test environment — so
 * `npm test` in a freshly scaffolded plugin was red on the very first run.
 */

/** Values interpolated into the templates for one generated plugin. */
export interface PluginTemplateVars {
  /** Full package name, e.g. `@object-ui/plugin-heatmap`. */
  packageName: string;
  /** Plugin name without the `plugin-` prefix, e.g. `heatmap`. Also the registry key. */
  pluginName: string;
  /** PascalCase component name, e.g. `Heatmap`. */
  pascalName: string;
  description: string;
  author: string;
  version: string;
  year: number;
}

/**
 * The Vitest setup file the generated `vite.config.ts` points `setupFiles` at.
 * Named as a constant because two templates have to agree on it.
 */
export const VITEST_SETUP_FILE = 'vitest.setup.ts';

/**
 * devDependencies written into the generated plugin.
 *
 * EVERY entry is SOURCED, not invented — each copies this monorepo's own range
 * for the same package verbatim, so the repo has one range per dependency
 * rather than one per file. These literals sit in `.ts` source, outside the
 * objectui#3711 version-claims gate's scan face, so `templates.test.ts` pins
 * the parity instead — and it pins the WHOLE map, not a subset, which is what
 * stops a re-anchored entry from silently rotting again (objectui#3742).
 *
 * Two anchors, because not every build dependency exists in the root manifest.
 * `create-plugin` writes into `<cwd>/packages/plugin-<name>`, so a generated
 * plugin is a literal sibling of `packages/plugin-*` — those manifests are the
 * faithful anchor for anything the root does not declare:
 *
 * | dependency                  | range     | anchor                                     |
 * | --------------------------- | --------- | ------------------------------------------ |
 * | `@testing-library/jest-dom` | `^7.0.0`  | repo root package.json (also apps/console) |
 * | `@testing-library/react`    | `^16.3.2` | repo root package.json (also apps/console) |
 * | `@vitejs/plugin-react`      | `^6.0.5`  | every `packages/plugin-*` (not in root)    |
 * | `jsdom`                     | `^30.0.1` | repo root package.json                     |
 * | `typescript`                | `^6.0.3`  | repo root package.json                     |
 * | `vite`                      | `^8.2.0`  | repo root package.json                     |
 * | `vite-plugin-dts`           | `^5.0.3`  | every `packages/plugin-*` (not in root)    |
 * | `vitest`                    | `^4.1.10` | repo root package.json                     |
 *
 * `@testing-library/dom` is deliberately absent: it is a peer of
 * `@testing-library/react` 16 and is installed by the workspace's
 * `auto-install-peers=true`, which is also why `apps/console` declares the
 * same three and not four.
 *
 * The build entries carried pre-anchoring ranges until objectui#3742 — the
 * scaffold handed authors vite 7 / plugin-react 4 / dts 4 / TypeScript 5 while
 * the repo built and tested every in-tree plugin on vite 8 / plugin-react 6 /
 * dts 5 / TypeScript 6. objectui#3716's artifact end-to-end run only ever
 * exercised the in-repo versions, so the declared ranges were never the ones
 * under test. Not a peer conflict: `^4.2.1` resolved to plugin-react 4.7.0,
 * whose vite peer had widened to `^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0` and
 * accepted vite 7 — the cost was a scaffold one to two majors behind its own
 * monorepo, not a failing install.
 */
const DEV_DEPENDENCIES: Record<string, string> = {
  '@testing-library/jest-dom': '^7.0.0',
  '@testing-library/react': '^16.3.2',
  '@vitejs/plugin-react': '^6.0.5',
  jsdom: '^30.0.1',
  typescript: '^6.0.3',
  vite: '^8.2.0',
  'vite-plugin-dts': '^5.0.3',
  vitest: '^4.1.10'
};

/** The generated plugin's `package.json`, as an object (not yet serialised). */
export function buildPackageJson(vars: PluginTemplateVars): Record<string, unknown> {
  return {
    name: vars.packageName,
    version: vars.version,
    type: 'module',
    license: 'MIT',
    description: vars.description,
    main: 'dist/index.umd.cjs',
    module: 'dist/index.js',
    types: 'dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.umd.cjs'
      }
    },
    scripts: {
      build: 'vite build',
      test: 'vitest run',
      lint: 'eslint .'
    },
    dependencies: {
      '@object-ui/components': 'workspace:*',
      '@object-ui/core': 'workspace:*',
      '@object-ui/react': 'workspace:*',
      '@object-ui/types': 'workspace:*',
      'lucide-react': '^0.563.0'
    },
    peerDependencies: {
      react: '^18.0.0 || ^19.0.0',
      'react-dom': '^18.0.0 || ^19.0.0'
    },
    devDependencies: { ...DEV_DEPENDENCIES }
  };
}

/** The generated plugin's `tsconfig.json`, as an object (not yet serialised). */
export function buildTsconfig(): Record<string, unknown> {
  return {
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
      declaration: true,
      declarationMap: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', '**/*.test.ts', '**/*.test.tsx']
  };
}

/**
 * The generated plugin's `vite.config.ts`.
 *
 * The `test` block is load-bearing, not decoration:
 * - `environment: 'jsdom'` — the example test calls `render()`; the Vitest
 *   default (`node`) has no `document` for React to mount into.
 * - `globals: true` — `@testing-library/react` only registers its automatic
 *   `cleanup()` when `afterEach` exists as a GLOBAL (`dist/index.js`:
 *   `if (typeof afterEach === 'function')`). Without it the DOM leaks between
 *   tests, silently, as soon as the author writes a second one.
 * - `setupFiles` — where the jest-dom matchers get registered; see
 *   {@link buildVitestSetup}.
 *
 * The entry path is resolved from `import.meta.dirname`, not `__dirname`. Vite
 * still defines `__dirname` under its default `configLoader: 'bundle'`, but
 * vite 8 warns on it ("Your Vite config uses features that are unsupported by
 * `configLoader: 'native'`, which is planned to become the default in a future
 * major version of Vite ... Use `import.meta.dirname` instead"), and under
 * `native` — which imports the config with Node's own ESM loader, where no
 * `__dirname` exists — it would fail outright. `apps/console/vite.config.ts`
 * was converted for the same reason (objectui#3384); the generated config now
 * ships already-correct rather than warning on an author's first `pnpm build`.
 * Safe unconditionally here: the repo requires Node >= 22 and vite defines
 * `import.meta.dirname` under the bundle loader too.
 */
export function buildViteConfig(vars: PluginTemplateVars): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/index.tsx'),
      name: '${vars.pascalName}',
      formats: ['es', 'umd'],
      fileName: (format) => \`index.\${format === 'es' ? 'js' : 'umd.cjs'}\`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./${VITEST_SETUP_FILE}'],
  },
});
`;
}

/**
 * The generated plugin's Vitest setup file.
 *
 * Uses the `/vitest` entry point rather than the bare package: that one takes
 * `expect` from `vitest` explicitly, while the bare entry extends a GLOBAL
 * `expect` and therefore breaks the moment an author turns `globals` off.
 */
export function buildVitestSetup(): string {
  return `// Registers @testing-library/jest-dom's matchers (\`toBeInTheDocument\` and
// friends) on Vitest's \`expect\`, which the example test in src/ relies on.
import '@testing-library/jest-dom/vitest';
`;
}

/** The generated plugin's `README.md`. */
export function buildReadme(vars: PluginTemplateVars): string {
  return `# ${vars.packageName}

${vars.description}

## Installation

\`\`\`bash
pnpm add ${vars.packageName}
\`\`\`

## Usage

\`\`\`tsx
import { ${vars.pascalName} } from '${vars.packageName}';

// Use the component
<${vars.pascalName} />
\`\`\`

## Development

\`\`\`bash
# Build the plugin
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
\`\`\`

## License

MIT © ${vars.author}
`;
}

/** The generated plugin's `src/index.tsx` (entry point + registry registration). */
export function buildIndexFile(vars: PluginTemplateVars): string {
  return `/**
 * ObjectUI
 * Copyright (c) ${vars.year}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ${vars.pascalName} } from './${vars.pascalName}Impl';

export { ${vars.pascalName} };
export type { ${vars.pascalName}Props } from './${vars.pascalName}Impl';

// Register component with ComponentRegistry
const ${vars.pascalName}Renderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <${vars.pascalName} {...schema} />;
};

ComponentRegistry.register('${vars.pluginName}', ${vars.pascalName}Renderer, {
  label: '${vars.pascalName}',
  category: 'plugin',
  inputs: [
    // Define your component inputs here
  ],
  defaultProps: {
    // Define default props here
  }
});
`;
}

/** The generated plugin's `src/<Pascal>Impl.tsx`. */
export function buildImplFile(vars: PluginTemplateVars): string {
  return `/**
 * ObjectUI
 * Copyright (c) ${vars.year}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

export interface ${vars.pascalName}Props {
  // Define your props here
  className?: string;
}

/**
 * ${vars.pascalName} component
 */
export const ${vars.pascalName}: React.FC<${vars.pascalName}Props> = ({ className }) => {
  return (
    <div className={className}>
      <h2>${vars.pascalName} Plugin</h2>
      <p>Implement your plugin logic here.</p>
    </div>
  );
};
`;
}

/** The generated plugin's `src/types.ts`. */
export function buildTypesFile(vars: PluginTemplateVars): string {
  return `/**
 * ObjectUI
 * Copyright (c) ${vars.year}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Schema definition for ${vars.pascalName}
 */
export interface ${vars.pascalName}Schema {
  type: '${vars.pluginName}';
  id?: string;
  className?: string;
  // Add schema properties here
}
`;
}

/** The generated plugin's example test, `src/<Pascal>Impl.test.tsx`. */
export function buildTestFile(vars: PluginTemplateVars): string {
  return `/**
 * ObjectUI
 * Copyright (c) ${vars.year}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ${vars.pascalName} } from './${vars.pascalName}Impl';

describe('${vars.pascalName}', () => {
  it('should render', () => {
    render(<${vars.pascalName} />);
    expect(screen.getByText('${vars.pascalName} Plugin')).toBeInTheDocument();
  });
});
`;
}

/**
 * The whole generated plugin as `relative path -> file contents`.
 *
 * Single source of truth for what a scaffolded plugin contains, so the writer
 * in `index.ts` stays a loop and the pin test can assert over the same map the
 * CLI writes.
 */
export function buildPluginFiles(vars: PluginTemplateVars): Record<string, string> {
  return {
    'package.json': `${JSON.stringify(buildPackageJson(vars), null, 2)}`,
    'tsconfig.json': `${JSON.stringify(buildTsconfig(), null, 2)}`,
    'vite.config.ts': buildViteConfig(vars),
    [VITEST_SETUP_FILE]: buildVitestSetup(),
    'README.md': buildReadme(vars),
    'src/index.tsx': buildIndexFile(vars),
    [`src/${vars.pascalName}Impl.tsx`]: buildImplFile(vars),
    'src/types.ts': buildTypesFile(vars),
    [`src/${vars.pascalName}Impl.test.tsx`]: buildTestFile(vars)
  };
}
