import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { scanPagesDirectory, createTempAppWithRouting, createTempApp, parseSchemaFile, type RouteInfo } from '../utils/app-generator.js';

interface DevOptions {
  port: string;
  host: string;
  open?: boolean;
}

export async function dev(schemaPath: string, options: DevOptions) {
  const cwd = process.cwd();
  
  // Resolve the actual project root and schema file
  let _projectRoot = cwd;
  const targetSchemaPath = schemaPath;
  let hasPagesDir = false;
  let pagesDir = '';
  let appConfig: unknown = null;

  // 1. Determine Project Root & Mode
  const absoluteSchemaPath = resolve(cwd, schemaPath);
  
  if (existsSync(absoluteSchemaPath) && statSync(absoluteSchemaPath).isFile()) {
    // If input is a file (e.g. examples/showcase/app.json)
    const fileDir = dirname(absoluteSchemaPath);
    const potentialPagesDir = join(fileDir, 'pages');

    if (existsSync(potentialPagesDir)) {
      console.log(chalk.blue(`📂 Detected project structure at ${fileDir}`));
      _projectRoot = fileDir;
      hasPagesDir = true;
      pagesDir = potentialPagesDir;
      
      // Try to load app.json as config
      try {
        appConfig = parseSchemaFile(absoluteSchemaPath);
        console.log(chalk.blue('⚙️  Loaded App Config from app.json'));
      } catch (_e) {
        console.warn('Failed to parse app config');
      }
    }
  } 
  
  // Fallback: Check detect pages dir in current cwd if not found above
  if (!hasPagesDir) {
     const localPagesDir = join(cwd, 'pages');
     if (existsSync(localPagesDir)) {
        hasPagesDir = true;
        pagesDir = localPagesDir;
        // Try to find app.json in cwd
        // TODO: Load app.json if exists
     }
  }

  const require = createRequire(join(cwd, 'package.json'));
  
  let routes: RouteInfo[] = [];
  let schema: unknown = null;
  let useFileSystemRouting = false;

  if (hasPagesDir) {
    // File-system based routing
    console.log(chalk.blue(`📁 Using file-system routing from ${pagesDir}`));
    routes = scanPagesDirectory(pagesDir);
    useFileSystemRouting = true;
    
    if (routes.length === 0) {
      throw new Error(`No schema files found in ${pagesDir}`);
    }
    
    console.log(chalk.green(`✓ Found ${routes.length} route(s)`));
    routes.forEach(route => {
      console.log(chalk.dim(`  ${route.path} → ${route.filePath.replace(cwd, '.')}`));
    });
  } else {
    // Single schema file mode
    const fullSchemaPath = resolve(cwd, schemaPath);
    // ... (rest of the logic)
    if (!existsSync(fullSchemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}\nRun 'objectui init' to create a sample schema.`);
    }
    console.log(chalk.blue('📋 Loading schema:'), chalk.cyan(schemaPath));
    try {
      schema = parseSchemaFile(fullSchemaPath);
    } catch (error) {
       throw new Error(`Invalid schema file: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Create temporary app directory (always in cwd to keep node_modules access)
  const tmpDir = join(cwd, '.objectui-tmp');
  mkdirSync(tmpDir, { recursive: true });

  // Create temporary app files
  if (useFileSystemRouting) {
    createTempAppWithRouting(tmpDir, routes, appConfig);
  } else {
    createTempApp(tmpDir, schema);
  }


  // Install dependencies
  const isMonorepo = existsSync(join(cwd, 'pnpm-workspace.yaml'));
  
  if (isMonorepo) {
    console.log(chalk.blue('📦 Detected monorepo - using root node_modules'));
  } else {
    console.log(chalk.blue('📦 Installing dependencies...'));
    console.log(chalk.dim('  This may take a moment on first run...'));
    try {
      execSync('npm install --silent --prefer-offline', { 
        cwd: tmpDir, 
        stdio: 'inherit',
      });
      console.log(chalk.green('✓ Dependencies installed'));
    } catch {
      throw new Error('Failed to install dependencies. Please check your internet connection and try again.');
    }
  }

  console.log(chalk.green('✓ Schema loaded successfully'));
  console.log(chalk.blue('🚀 Starting development server...\n'));

  // Create Vite config
  const viteConfig: any = {
    root: tmpDir,
    server: {
      port: parseInt(options.port),
      host: options.host,
      open: options.open !== false,
      fs: {
        // Allow serving files from workspace root
        allow: [cwd],
      }
    },
    resolve: {
      alias: {}
    },
    plugins: [react()],
  };

  if (isMonorepo) {
    console.log(chalk.blue('📦 Detected monorepo - configuring workspace aliases'));
    
    // Remove postcss.config.js to prevent interference with programmatic config
    const postcssPath = join(tmpDir, 'postcss.config.js');
    if (existsSync(postcssPath)) {
      unlinkSync(postcssPath);
    }

    // Add aliases for workspace packages
    viteConfig.resolve.alias = {
      '@object-ui/react': join(cwd, 'packages/react/src/index.ts'),
      '@object-ui/components': join(cwd, 'packages/components/src/index.ts'),
      '@object-ui/core': join(cwd, 'packages/core/src/index.ts'),
      '@object-ui/types': join(cwd, 'packages/types/src/index.ts'),
    };

    // Fix: Resolve lucide-react from components package to avoid "dependency not found" in temp app
    try {
      // Trying to find lucide-react in the components' node_modules or hoist
      // checking specifically in packages/components context
      const lucidePath = require.resolve('lucide-react', { paths: [join(cwd, 'packages/components')] });
      // We might get the cjs entry, but for aliasing usually fine. 
      // Better yet, if we can find the package root, but require.resolve gives file.
      // Let's just use what require.resolve gives.
      // @ts-expect-error - lucidePath is dynamically resolved
      viteConfig.resolve.alias['lucide-react'] = lucidePath;
    } catch (e) {
      console.warn('⚠️ Could not resolve lucide-react automatically:', e);
    }
    
    // Debug aliases
    // console.log('Aliases:', viteConfig.resolve.alias);

    // Configure PostCSS programmatically reusing root dependencies
    try {
      const tailwindcss = require('tailwindcss');
      const autoprefixer = require('autoprefixer');
      
      viteConfig.css = {
        postcss: {
          plugins: [
            tailwindcss(join(tmpDir, 'tailwind.config.js')),
            autoprefixer(),
          ],
        },
      };
    } catch (_e) {
      console.warn(chalk.yellow('⚠️ Failed to load PostCSS plugins from root node_modules. Styles might not work correctly.'));
    }
  }

  // Create Vite server
  const server = await createServer(viteConfig);

  await server.listen();

  const { port, host } = server.config.server;
  const protocol = server.config.server.https ? 'https' : 'http';
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;

  console.log();
  console.log(chalk.green('✓ Development server started successfully!'));
  console.log();
  console.log(chalk.bold('  Local:   ') + chalk.cyan(`${protocol}://${displayHost}:${port}`));
  console.log();
  console.log(chalk.dim('  Press Ctrl+C to stop the server'));
  console.log();
}
