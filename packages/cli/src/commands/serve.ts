import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';

interface ServeOptions {
  port: string;
  host: string;
}

export async function serve(schemaPath: string, options: ServeOptions) {
  const cwd = process.cwd();
  const fullSchemaPath = resolve(cwd, schemaPath);

  // Check if schema file exists
  if (!existsSync(fullSchemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}\nRun 'objectui init' to create a sample schema.`);
  }

  console.log(chalk.blue('📋 Loading schema:'), chalk.cyan(schemaPath));

  // Read and validate schema
  let schema;
  try {
    const schemaContent = readFileSync(fullSchemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);
  } catch (error) {
    throw new Error(`Invalid JSON in schema file: ${error instanceof Error ? error.message : error}`);
  }

  // Create temporary app directory
  const tmpDir = join(cwd, '.objectui-tmp');
  mkdirSync(tmpDir, { recursive: true });

  // Create temporary app files
  createTempApp(tmpDir, schema);

  // Install dependencies
  console.log(chalk.blue('📦 Installing dependencies...'));
  console.log(chalk.dim('  This may take a moment on first run...'));
  const { execSync } = await import('child_process');
  try {
    execSync('npm install --silent --prefer-offline', { 
      cwd: tmpDir, 
      stdio: 'inherit',
    });
    console.log(chalk.green('✓ Dependencies installed'));
  } catch (error) {
    throw new Error('Failed to install dependencies. Please check your internet connection and try again.');
  }

  console.log(chalk.green('✓ Schema loaded successfully'));
  console.log(chalk.blue('🚀 Starting development server...\n'));

  // Create Vite config
  const viteConfig: any = {
    root: tmpDir,
    server: {
      port: parseInt(options.port),
      host: options.host,
      open: true,
    },
    plugins: [react()],
  };

  // Create Vite server
  const server = await createServer(viteConfig);

  await server.listen();

  const { port, host } = server.config.server;
  const protocol = server.config.server.https ? 'https' : 'http';
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;

  console.log();
  console.log(chalk.green('✓ Server started successfully!'));
  console.log();
  console.log(chalk.bold('  Local:   ') + chalk.cyan(`${protocol}://${displayHost}:${port}`));
  console.log();
  console.log(chalk.dim('  Press Ctrl+C to stop the server'));
  console.log();
}

function createTempApp(tmpDir: string, schema: any) {
  // Create index.html
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Object UI App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

  writeFileSync(join(tmpDir, 'index.html'), html);

  // Create src directory
  const srcDir = join(tmpDir, 'src');
  mkdirSync(srcDir, { recursive: true });

  // Create main.tsx
  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

  writeFileSync(join(srcDir, 'main.tsx'), mainTsx);

  // Create App.tsx
  const appTsx = `import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';

const schema = ${JSON.stringify(schema, null, 2)};

function App() {
  return <SchemaRenderer schema={schema} />;
}

export default App;`;

  writeFileSync(join(srcDir, 'App.tsx'), appTsx);

  // Create index.css
  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

  writeFileSync(join(srcDir, 'index.css'), indexCss);

  // Create tailwind.config.js
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
    },
  },
  plugins: [],
};`;

  writeFileSync(join(tmpDir, 'tailwind.config.js'), tailwindConfig);

  // Create postcss.config.js
  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;
  
  writeFileSync(join(tmpDir, 'postcss.config.js'), postcssConfig);

  // Create package.json
  const packageJson = {
    name: 'objectui-temp-app',
    private: true,
    type: 'module',
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      '@object-ui/react': '^0.1.0',
      '@object-ui/components': '^0.1.0',
    },
    devDependencies: {
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      '@vitejs/plugin-react': '^4.2.1',
      autoprefixer: '^10.4.23',
      postcss: '^8.5.6',
      tailwindcss: '^3.4.19',
      typescript: '~5.7.3',
      vite: '^5.0.0',
    },
  };

  writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(packageJson, null, 2));

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
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ['src'],
  };

  writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
}
