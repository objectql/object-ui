/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve, relative } from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { scanPagesDirectory, createTempAppWithRouting, createTempApp, parseSchemaFile, type RouteInfo } from '../utils/app-generator.js';

interface ServeOptions {
  port: string;
  host: string;
}

export async function serve(schemaPath: string, options: ServeOptions) {
  const cwd = process.cwd();
  
  // Check if pages directory exists for file-system routing
  const pagesDir = join(cwd, 'pages');
  const hasPagesDir = existsSync(pagesDir);
  
  let routes: RouteInfo[] = [];
  let schema: unknown = null;
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
      console.log(chalk.dim(`  ${route.path} → ${relative(cwd, route.filePath)}`));
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
      // The caught error's message is inlined below. We can't pass it as the
      // `Error` `cause` option because this package targets ES2020, whose lib
      // types the 1-arg `Error` constructor only; hence the scoped disable.
      // eslint-disable-next-line preserve-caught-error
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
  try {
    execSync('npm install --silent --prefer-offline', { 
      cwd: tmpDir, 
      stdio: 'inherit',
    });
    console.log(chalk.green('✓ Dependencies installed'));
  } catch {
    throw new Error('Failed to install dependencies. Please check your internet connection and try again.');
  }

  console.log(chalk.green('✓ Schema loaded successfully'));
  console.log(chalk.blue('🚀 Starting development server...\n'));

  // Create Vite config
  const viteConfig = {
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
