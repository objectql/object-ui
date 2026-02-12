/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface InitOptions {
  template: string;
}

const templates = {
  simple: {
    type: 'div',
    className: 'min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100',
    body: {
      type: 'card',
      className: 'w-full max-w-md shadow-lg',
      title: 'Welcome to Object UI',
      description: 'Start building your application with JSON schemas',
      body: {
        type: 'div',
        className: 'p-6 space-y-4',
        body: [
          {
            type: 'text',
            content: 'This is a simple example. Edit app.json to customize your application.',
            className: 'text-sm text-muted-foreground',
          },
          {
            type: 'button',
            label: 'Get Started',
            className: 'w-full',
          },
        ],
      },
    },
  },
  form: {
    type: 'div',
    className: 'min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 p-4',
    body: {
      type: 'card',
      className: 'w-full max-w-2xl shadow-xl',
      title: 'Contact Form',
      description: 'Fill out the form below to get in touch',
      body: {
        type: 'div',
        className: 'p-6 space-y-6',
        body: [
          {
            type: 'div',
            className: 'grid grid-cols-2 gap-4',
            body: [
              {
                type: 'input',
                label: 'First Name',
                placeholder: 'John',
                required: true,
              },
              {
                type: 'input',
                label: 'Last Name',
                placeholder: 'Doe',
                required: true,
              },
            ],
          },
          {
            type: 'input',
            label: 'Email Address',
            inputType: 'email',
            placeholder: 'john.doe@example.com',
            required: true,
          },
          {
            type: 'input',
            label: 'Phone Number',
            inputType: 'tel',
            placeholder: '+1 (555) 000-0000',
          },
          {
            type: 'textarea',
            label: 'Message',
            placeholder: 'Tell us what you need...',
            rows: 4,
          },
          {
            type: 'div',
            className: 'flex gap-3',
            body: [
              {
                type: 'button',
                label: 'Submit',
                className: 'flex-1',
              },
              {
                type: 'button',
                label: 'Reset',
                variant: 'outline',
                className: 'flex-1',
              },
            ],
          },
        ],
      },
    },
  },
  dashboard: {
    type: 'div',
    className: 'min-h-screen bg-muted/10',
    body: [
      {
        type: 'div',
        className: 'border-b bg-background',
        body: {
          type: 'div',
          className: 'container mx-auto px-6 py-4',
          body: {
            type: 'div',
            className: 'flex items-center justify-between',
            body: [
              {
                type: 'div',
                className: 'text-2xl font-bold',
                body: { type: 'text', content: 'Dashboard' },
              },
              {
                type: 'button',
                label: 'New Item',
                size: 'sm',
              },
            ],
          },
        },
      },
      {
        type: 'div',
        className: 'container mx-auto p-6 space-y-6',
        body: [
          {
            type: 'div',
            className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-4',
            body: [
              {
                type: 'card',
                className: 'shadow-sm',
                body: [
                  {
                    type: 'div',
                    className: 'p-6 pb-2',
                    body: {
                      type: 'div',
                      className: 'text-sm font-medium text-muted-foreground',
                      body: { type: 'text', content: 'Total Revenue' },
                    },
                  },
                  {
                    type: 'div',
                    className: 'p-6 pt-0',
                    body: [
                      {
                        type: 'div',
                        className: 'text-2xl font-bold',
                        body: { type: 'text', content: '$45,231.89' },
                      },
                      {
                        type: 'div',
                        className: 'text-xs text-muted-foreground mt-1',
                        body: { type: 'text', content: '+20.1% from last month' },
                      },
                    ],
                  },
                ],
              },
              {
                type: 'card',
                className: 'shadow-sm',
                body: [
                  {
                    type: 'div',
                    className: 'p-6 pb-2',
                    body: {
                      type: 'div',
                      className: 'text-sm font-medium text-muted-foreground',
                      body: { type: 'text', content: 'Active Users' },
                    },
                  },
                  {
                    type: 'div',
                    className: 'p-6 pt-0',
                    body: [
                      {
                        type: 'div',
                        className: 'text-2xl font-bold',
                        body: { type: 'text', content: '+2,350' },
                      },
                      {
                        type: 'div',
                        className: 'text-xs text-muted-foreground mt-1',
                        body: { type: 'text', content: '+180.1% from last month' },
                      },
                    ],
                  },
                ],
              },
              {
                type: 'card',
                className: 'shadow-sm',
                body: [
                  {
                    type: 'div',
                    className: 'p-6 pb-2',
                    body: {
                      type: 'div',
                      className: 'text-sm font-medium text-muted-foreground',
                      body: { type: 'text', content: 'Sales' },
                    },
                  },
                  {
                    type: 'div',
                    className: 'p-6 pt-0',
                    body: [
                      {
                        type: 'div',
                        className: 'text-2xl font-bold',
                        body: { type: 'text', content: '+12,234' },
                      },
                      {
                        type: 'div',
                        className: 'text-xs text-muted-foreground mt-1',
                        body: { type: 'text', content: '+19% from last month' },
                      },
                    ],
                  },
                ],
              },
              {
                type: 'card',
                className: 'shadow-sm',
                body: [
                  {
                    type: 'div',
                    className: 'p-6 pb-2',
                    body: {
                      type: 'div',
                      className: 'text-sm font-medium text-muted-foreground',
                      body: { type: 'text', content: 'Active Now' },
                    },
                  },
                  {
                    type: 'div',
                    className: 'p-6 pt-0',
                    body: [
                      {
                        type: 'div',
                        className: 'text-2xl font-bold',
                        body: { type: 'text', content: '+573' },
                      },
                      {
                        type: 'div',
                        className: 'text-xs text-muted-foreground mt-1',
                        body: { type: 'text', content: '+201 since last hour' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'card',
            className: 'shadow-sm',
            title: 'Recent Activity',
            description: 'Your latest updates and notifications',
            body: {
              type: 'div',
              className: 'p-6 pt-0 space-y-4',
              body: [
                {
                  type: 'div',
                  className: 'flex items-center gap-4 border-b pb-4',
                  body: [
                    {
                      type: 'div',
                      className: 'flex-1',
                      body: [
                        {
                          type: 'div',
                          className: 'font-medium',
                          body: { type: 'text', content: 'New user registration' },
                        },
                        {
                          type: 'div',
                          className: 'text-sm text-muted-foreground',
                          body: { type: 'text', content: '2 minutes ago' },
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'div',
                  className: 'flex items-center gap-4 border-b pb-4',
                  body: [
                    {
                      type: 'div',
                      className: 'flex-1',
                      body: [
                        {
                          type: 'div',
                          className: 'font-medium',
                          body: { type: 'text', content: 'Payment received' },
                        },
                        {
                          type: 'div',
                          className: 'text-sm text-muted-foreground',
                          body: { type: 'text', content: '15 minutes ago' },
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'div',
                  className: 'flex items-center gap-4',
                  body: [
                    {
                      type: 'div',
                      className: 'flex-1',
                      body: [
                        {
                          type: 'div',
                          className: 'font-medium',
                          body: { type: 'text', content: 'New order placed' },
                        },
                        {
                          type: 'div',
                          className: 'text-sm text-muted-foreground',
                          body: { type: 'text', content: '1 hour ago' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

export async function init(name: string, options: InitOptions) {
  const cwd = process.cwd();
  const projectDir = join(cwd, name);

  // Check if directory already exists
  if (existsSync(projectDir) && name !== '.') {
    throw new Error(`Directory "${name}" already exists. Please choose a different name.`);
  }

  const targetDir = name === '.' ? cwd : projectDir;

  // Create project directory if needed
  if (name !== '.') {
    mkdirSync(projectDir, { recursive: true });
  }

  console.log(chalk.blue('🎨 Creating Object UI application...'));
  console.log(chalk.dim(`   Template: ${options.template}`));
  console.log();

  // Get template
  const template = templates[options.template as keyof typeof templates];
  if (!template) {
    throw new Error(
      `Unknown template: ${options.template}\nAvailable templates: ${Object.keys(templates).join(', ')}`
    );
  }

  // Create schema file
  const schemaPath = join(targetDir, 'app.json');
  writeFileSync(schemaPath, JSON.stringify(template, null, 2));

  console.log(chalk.green('✓ Created app.json'));

  // Create README
  const readme = `# ${name}

An Object UI application built from JSON schemas.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open your browser and visit http://localhost:3000

## Customize Your App

Edit \`app.json\` to customize your application. The dev server will automatically reload when you save changes.

## Available Templates

- **simple**: A minimal getting started template
- **form**: A contact form example
- **dashboard**: A full dashboard with metrics and activity feed

## Learn More

- [Object UI Documentation](https://www.objectui.org)
- [Schema Reference](https://www.objectui.org/docs/protocol/overview)
- [Component Library](https://www.objectui.org/docs/api/components)

## Commands

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build

Built with ❤️ using [Object UI](https://www.objectui.org)
`;

  writeFileSync(join(targetDir, 'README.md'), readme);
  console.log(chalk.green('✓ Created README.md'));

  // Create .gitignore
  const gitignore = `.objectui-tmp
node_modules
dist
.DS_Store
*.log
`;

  writeFileSync(join(targetDir, '.gitignore'), gitignore);
  console.log(chalk.green('✓ Created .gitignore'));

  // Create package.json
  const packageJson = {
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc && vite build',
      preview: 'vite preview',
    },
    dependencies: {
      '@object-ui/components': '^2.0.0',
      '@object-ui/react': '^2.0.0',
      react: '^19.2.0',
      'react-dom': '^19.2.0',
    },
    devDependencies: {
      '@tailwindcss/postcss': '^4.1.18',
      '@types/react': '^19.2.13',
      '@types/react-dom': '^19.2.6',
      '@vitejs/plugin-react': '^5.1.3',
      autoprefixer: '^10.4.23',
      postcss: '^8.5.6',
      tailwindcss: '^4.1.18',
      typescript: '^5.9.3',
      vite: '^7.3.1',
    },
  };

  writeFileSync(join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  console.log(chalk.green('✓ Created package.json'));

  // Create vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
});
`;

  writeFileSync(join(targetDir, 'vite.config.ts'), viteConfig);
  console.log(chalk.green('✓ Created vite.config.ts'));

  // Create tailwind.config.js
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
`;

  writeFileSync(join(targetDir, 'tailwind.config.js'), tailwindConfig);
  console.log(chalk.green('✓ Created tailwind.config.js'));

  // Create postcss.config.js
  const postcssConfig = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
`;

  writeFileSync(join(targetDir, 'postcss.config.js'), postcssConfig);
  console.log(chalk.green('✓ Created postcss.config.js'));

  // Create index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  writeFileSync(join(targetDir, 'index.html'), indexHtml);
  console.log(chalk.green('✓ Created index.html'));

  // Create src directory and source files
  const srcDir = join(targetDir, 'src');
  mkdirSync(srcDir, { recursive: true });

  // Create src/index.css
  const indexCss = `@import 'tailwindcss';
`;

  writeFileSync(join(srcDir, 'index.css'), indexCss);
  console.log(chalk.green('✓ Created src/index.css'));

  // Create src/main.tsx
  const mainTsx = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

  writeFileSync(join(srcDir, 'main.tsx'), mainTsx);
  console.log(chalk.green('✓ Created src/main.tsx'));

  // Create src/App.tsx
  const appTsx = `import { SchemaRenderer } from '@object-ui/react';
import schema from '../app.json';

export default function App() {
  return <SchemaRenderer schema={schema} />;
}
`;

  writeFileSync(join(srcDir, 'App.tsx'), appTsx);
  console.log(chalk.green('✓ Created src/App.tsx'));

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      useDefineForClassFields: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      isolatedModules: true,
      moduleDetection: 'force',
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
      resolveJsonModule: true,
    },
    include: ['src'],
  };

  writeFileSync(join(targetDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  console.log(chalk.green('✓ Created tsconfig.json'));

  console.log();
  console.log(chalk.green('✨ Application created successfully!'));
  console.log();
  console.log(chalk.bold('Next steps:'));
  console.log();
  if (name !== '.') {
    console.log(chalk.cyan(`  cd ${name}`));
  }
  console.log(chalk.cyan('  npm install'));
  console.log(chalk.cyan('  npm run dev'));
  console.log();
  console.log(chalk.dim('  The development server will start on http://localhost:3000'));
  console.log();
}
