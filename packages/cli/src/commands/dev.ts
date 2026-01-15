import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import * as yaml from 'js-yaml';
import { scanPagesDirectory, createTempAppWithRouting, createTempApp, parseSchemaFile } from '../utils/app-generator.js';

interface DevOptions {
  port: string;
  host: string;
  open?: boolean;
}

export async function dev(schemaPath: string, options: DevOptions) {
  const cwd = process.cwd();
  
  // Check if pages directory exists for file-system routing
  const pagesDir = join(cwd, 'pages');
  const hasPagesDir = existsSync(pagesDir);
  
  let routes: any[] = [];
  let schema: any = null;
  let useFileSystemRouting = false;

  if (hasPagesDir) {
    // File-system based routing
    console.log(chalk.blue('📁 Detected pages/ directory - using file-system routing'));
    routes = scanPagesDirectory(pagesDir);
    useFileSystemRouting = true;
    
    if (routes.length === 0) {
      throw new Error('No schema files found in pages/ directory');
    }
    
    console.log(chalk.green(`✓ Found ${routes.length} route(s)`));
    routes.forEach(route => {
      console.log(chalk.dim(`  ${route.path} → ${route.filePath.replace(cwd, '.')}`));
    });
  } else {
    // Single schema file mode
    const fullSchemaPath = resolve(cwd, schemaPath);

    // Check if schema file exists
    if (!existsSync(fullSchemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}\nRun 'objectui init' to create a sample schema.`);
    }

    console.log(chalk.blue('📋 Loading schema:'), chalk.cyan(schemaPath));

    // Read and validate schema
    try {
      schema = parseSchemaFile(fullSchemaPath);
    } catch (error) {
      throw new Error(`Invalid schema file: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Create temporary app directory
  const tmpDir = join(cwd, '.objectui-tmp');
  mkdirSync(tmpDir, { recursive: true });

  // Create temporary app files
  if (useFileSystemRouting) {
    createTempAppWithRouting(tmpDir, routes);
  } else {
    createTempApp(tmpDir, schema);
  }

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
      open: options.open !== false,
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
  console.log(chalk.green('✓ Development server started successfully!'));
  console.log();
  console.log(chalk.bold('  Local:   ') + chalk.cyan(`${protocol}://${displayHost}:${port}`));
  console.log();
  console.log(chalk.dim('  Press Ctrl+C to stop the server'));
  console.log();
}
