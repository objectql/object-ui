/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { scanPagesDirectory, createTempAppWithRouting, createTempApp, parseSchemaFile, type RouteInfo } from '../utils/app-generator.js';

interface BuildOptions {
  outDir?: string;
  clean?: boolean;
}

export async function buildApp(schemaPath: string, options: BuildOptions) {
  const cwd = process.cwd();
  const outDir = options.outDir || 'dist';
  const outputPath = resolve(cwd, outDir);
  
  console.log(chalk.blue('🔨 Building application for production...'));
  console.log();
  
  // Check if pages directory exists for file-system routing
  const pagesDir = join(cwd, 'pages');
  const hasPagesDir = existsSync(pagesDir);
  
  let routes: RouteInfo[] = [];
  let schema: unknown = null;
  let useFileSystemRouting = false;

  if (hasPagesDir) {
    // File-system based routing
    console.log(chalk.blue('📁 Using file-system routing'));
    routes = scanPagesDirectory(pagesDir);
    useFileSystemRouting = true;
    
    if (routes.length === 0) {
      throw new Error('No schema files found in pages/ directory');
    }
    
    console.log(chalk.green(`✓ Found ${routes.length} route(s)`));
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
  try {
    execSync('npm install --silent --prefer-offline', { 
      cwd: tmpDir, 
      stdio: 'pipe',
    });
    console.log(chalk.green('✓ Dependencies installed'));
  } catch {
    throw new Error('Failed to install dependencies. Please check your internet connection and try again.');
  }

  console.log(chalk.blue('⚙️  Building with Vite...'));
  console.log();

  // Clean output directory if requested
  if (options.clean && existsSync(outputPath)) {
    console.log(chalk.dim(`  Cleaning ${outDir}/ directory...`));
    rmSync(outputPath, { recursive: true, force: true });
  }

  // Build with Vite
  try {
    await viteBuild({
      root: tmpDir,
      build: {
        outDir: join(tmpDir, 'dist'),
        emptyOutDir: true,
        reportCompressedSize: true,
      },
      plugins: [react()],
      logLevel: 'info',
    });

    // Copy built files to output directory
    mkdirSync(outputPath, { recursive: true });
    cpSync(join(tmpDir, 'dist'), outputPath, { recursive: true });

    console.log();
    console.log(chalk.green('✓ Build completed successfully!'));
    console.log();
    console.log(chalk.bold('  Output: ') + chalk.cyan(outDir + '/'));
    console.log();
    console.log(chalk.dim('  To serve the production build, run:'));
    console.log(chalk.cyan(`  objectui start --dir ${outDir}`));
    console.log();
  } catch (error) {
    // The caught error's message is inlined below. We can't pass it as the
    // `Error` `cause` option because this package targets ES2020, whose lib
    // types the 1-arg `Error` constructor only; hence the scoped disable.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Build failed: ${error instanceof Error ? error.message : error}`);
  }
}
