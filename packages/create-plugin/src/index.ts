#!/usr/bin/env node
/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

interface PluginOptions {
  name?: string;
  description?: string;
  author?: string;
}

async function createPlugin(pluginName?: string, options: PluginOptions = {}) {
  console.log(chalk.blue('\n🚀 ObjectUI Plugin Generator\n'));

  // Get plugin name if not provided
  if (!pluginName) {
    const response = await prompts({
      type: 'text',
      name: 'name',
      message: 'Plugin name (without prefix):',
      validate: (value) => {
        if (value.length === 0) return 'Plugin name is required';
        // Validate package name format
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Plugin name must contain only lowercase letters, numbers, and hyphens';
        }
        // Prevent path traversal
        if (value.includes('..') || value.includes('/') || value.includes('\\')) {
          return 'Plugin name cannot contain path separators or ".."';
        }
        return true;
      }
    });
    pluginName = response.name;
    
    if (!pluginName) {
      console.log(chalk.red('\n❌ Plugin name is required'));
      process.exit(1);
    }
  }

  // Validate plugin name format and security
  if (!/^[a-z0-9-]+$/.test(pluginName)) {
    console.log(chalk.red('\n❌ Plugin name must contain only lowercase letters, numbers, and hyphens'));
    process.exit(1);
  }
  
  if (pluginName.includes('..') || pluginName.includes('/') || pluginName.includes('\\') || path.isAbsolute(pluginName)) {
    console.log(chalk.red('\n❌ Invalid plugin name: path traversal detected'));
    process.exit(1);
  }

  // Ensure plugin name doesn't include the plugin- prefix
  const cleanName = pluginName.replace(/^plugin-/, '').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  
  if (cleanName.length === 0) {
    console.log(chalk.red('\n❌ Plugin name cannot be empty after sanitization'));
    process.exit(1);
  }
  
  const fullPackageName = `plugin-${cleanName}`;
  const pascalCaseName = cleanName
    .split('-')
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // Get additional info
  const answers = await prompts([
    {
      type: 'text',
      name: 'description',
      message: 'Plugin description:',
      initial: options.description || `${pascalCaseName} plugin for ObjectUI`
    },
    {
      type: 'text',
      name: 'author',
      message: 'Author name:',
      initial: options.author || ''
    }
  ]);

  const targetDir = path.join(process.cwd(), 'packages', fullPackageName);

  // Check if directory exists
  if (fs.existsSync(targetDir)) {
    console.log(chalk.red(`\n❌ Directory already exists: ${targetDir}`));
    process.exit(1);
  }

  console.log(chalk.green(`\n✨ Creating plugin: ${fullPackageName}...\n`));

  // Create directory structure
  fs.mkdirpSync(targetDir);
  fs.mkdirpSync(path.join(targetDir, 'src'));

  // Get template directory
  const templateDir = path.join(__dirname, '..', 'templates', 'plugin');

  // Template variables
  const vars = {
    PACKAGE_NAME: `@object-ui/${fullPackageName}`,
    PLUGIN_NAME: cleanName,
    PASCAL_NAME: pascalCaseName,
    DESCRIPTION: answers.description,
    AUTHOR: answers.author,
    VERSION: '0.1.0',
    YEAR: new Date().getFullYear()
  };

  // Create package.json
  const packageJson = {
    name: vars.PACKAGE_NAME,
    version: vars.VERSION,
    type: 'module',
    license: 'MIT',
    description: vars.DESCRIPTION,
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
    devDependencies: {
      '@vitejs/plugin-react': '^4.2.1',
      typescript: '^5.9.3',
      vite: '^7.3.1',
      'vite-plugin-dts': '^4.5.4',
      vitest: '^4.0.18'
    }
  };

  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create tsconfig.json
  const tsconfig = {
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

  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );

  // Create vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite';
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
      entry: path.resolve(__dirname, 'src/index.tsx'),
      name: '${pascalCaseName}',
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
});
`;

  fs.writeFileSync(path.join(targetDir, 'vite.config.ts'), viteConfig);

  // Create README.md
  const readme = `# ${vars.PACKAGE_NAME}

${vars.DESCRIPTION}

## Installation

\`\`\`bash
pnpm add ${vars.PACKAGE_NAME}
\`\`\`

## Usage

\`\`\`tsx
import { ${pascalCaseName} } from '${vars.PACKAGE_NAME}';

// Use the component
<${pascalCaseName} />
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

MIT © ${vars.AUTHOR}
`;

  fs.writeFileSync(path.join(targetDir, 'README.md'), readme);

  // Create src/index.tsx
  const indexFile = `/**
 * ObjectUI
 * Copyright (c) ${vars.YEAR}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ${pascalCaseName} } from './${pascalCaseName}Impl';

export { ${pascalCaseName} };
export type { ${pascalCaseName}Props } from './${pascalCaseName}Impl';

// Register component with ComponentRegistry
const ${pascalCaseName}Renderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <${pascalCaseName} {...schema} />;
};

ComponentRegistry.register('${cleanName}', ${pascalCaseName}Renderer, {
  label: '${pascalCaseName}',
  category: 'plugin',
  inputs: [
    // Define your component inputs here
  ],
  defaultProps: {
    // Define default props here
  }
});
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'index.tsx'), indexFile);

  // Create src/[Name]Impl.tsx
  const implFile = `/**
 * ObjectUI
 * Copyright (c) ${vars.YEAR}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

export interface ${pascalCaseName}Props {
  // Define your props here
  className?: string;
}

/**
 * ${pascalCaseName} component
 */
export const ${pascalCaseName}: React.FC<${pascalCaseName}Props> = ({ className }) => {
  return (
    <div className={className}>
      <h2>${pascalCaseName} Plugin</h2>
      <p>Implement your plugin logic here.</p>
    </div>
  );
};
`;

  fs.writeFileSync(
    path.join(targetDir, 'src', `${pascalCaseName}Impl.tsx`),
    implFile
  );

  // Create src/types.ts
  const typesFile = `/**
 * ObjectUI
 * Copyright (c) ${vars.YEAR}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Schema definition for ${pascalCaseName}
 */
export interface ${pascalCaseName}Schema {
  type: '${cleanName}';
  id?: string;
  className?: string;
  // Add schema properties here
}
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'types.ts'), typesFile);

  // Create src/[Name]Impl.test.tsx
  const testFile = `/**
 * ObjectUI
 * Copyright (c) ${vars.YEAR}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ${pascalCaseName} } from './${pascalCaseName}Impl';

describe('${pascalCaseName}', () => {
  it('should render', () => {
    render(<${pascalCaseName} />);
    expect(screen.getByText('${pascalCaseName} Plugin')).toBeInTheDocument();
  });
});
`;

  fs.writeFileSync(
    path.join(targetDir, 'src', `${pascalCaseName}Impl.test.tsx`),
    testFile
  );

  // Create src/[Name].stories.tsx
  const storyFile = `/**
 * ObjectUI
 * Copyright (c) ${vars.YEAR}-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ${pascalCaseName} } from './${pascalCaseName}Impl';

const meta = {
  title: 'Plugins/${pascalCaseName}',
  component: ${pascalCaseName},
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ${pascalCaseName}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithClassName: Story = {
  args: {
    className: 'p-4 border rounded',
  },
};
`;

  fs.writeFileSync(
    path.join(targetDir, 'src', `${pascalCaseName}.stories.tsx`),
    storyFile
  );

  console.log(chalk.green('✅ Plugin created successfully!\n'));
  console.log(chalk.blue('Next steps:\n'));
  console.log(chalk.gray(`  cd packages/${fullPackageName}`));
  console.log(chalk.gray('  pnpm install'));
  console.log(chalk.gray('  pnpm build\n'));
  console.log(chalk.blue('To use the plugin:\n'));
  console.log(chalk.gray(`  import { ${pascalCaseName} } from '${vars.PACKAGE_NAME}';\n`));
}

program
  .name('create-plugin')
  .description('Create a new ObjectUI plugin')
  .argument('[plugin-name]', 'Name of the plugin (without plugin- prefix)')
  .option('-d, --description <description>', 'Plugin description')
  .option('-a, --author <author>', 'Author name')
  .action(createPlugin);

program.parse();
