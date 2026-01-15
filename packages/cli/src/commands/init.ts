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

A Object UI application built from JSON schemas.

## Getting Started

1. Install Object UI CLI globally (if you haven't already):
   \`\`\`bash
   npm install -g @object-ui/cli
   \`\`\`

2. Start the development server:
   \`\`\`bash
   objectui serve app.json
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

- \`objectui serve [schema]\` - Start development server
- \`objectui init [name]\` - Create a new application

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

  console.log();
  console.log(chalk.green('✨ Application created successfully!'));
  console.log();
  console.log(chalk.bold('Next steps:'));
  console.log();
  if (name !== '.') {
    console.log(chalk.cyan(`  cd ${name}`));
  }
  console.log(chalk.cyan('  objectui serve app.json'));
  console.log();
  console.log(chalk.dim('  The development server will start on http://localhost:3000'));
  console.log();
}
