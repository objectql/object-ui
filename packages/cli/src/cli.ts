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
import { serve } from './commands/serve.js';
import { init } from './commands/init.js';
import { dev } from './commands/dev.js';
import { buildApp } from './commands/build.js';
import { start } from './commands/start.js';
import { lint } from './commands/lint.js';
import { test } from './commands/test.js';
import { generate } from './commands/generate.js';
import { doctor } from './commands/doctor.js';
import { add } from './commands/add.js';
import { studio } from './commands/studio.js';
import { check } from './commands/check.js';
import { validate } from './commands/validate.js';
import { createPlugin } from './commands/create-plugin.js';
import { analyze } from './commands/analyze.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('objectui')
  .description('CLI tool for Object UI - Build applications from JSON schemas')
  .version(packageJson.version);

program
  .command('serve')
  .description('Start a development server with your JSON/YAML schema')
  .argument('[schema]', 'Path to JSON/YAML schema file', 'app.json')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
  .action(async (schema, options) => {
    try {
      await serve(schema, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('dev')
  .description('Start development server (alias for serve)')
  .argument('[schema]', 'Path to JSON/YAML schema file', 'app.json')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (schema, options) => {
    try {
      await dev(schema, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('build')
  .description('Build application for production')
  .argument('[schema]', 'Path to JSON/YAML schema file', 'app.json')
  .option('-o, --out-dir <dir>', 'Output directory', 'dist')
  .option('--clean', 'Clean output directory before build', false)
  .action(async (schema, options) => {
    try {
      await buildApp(schema, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start production server')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('-h, --host <host>', 'Host to bind the server to', '0.0.0.0')
  .option('-d, --dir <dir>', 'Directory to serve', 'dist')
  .action(async (options) => {
    try {
      await start(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('初始化新的Object UI应用 / Initialize a new Object UI application with sample schema')
  .argument('[name]', '应用名称 / Application name', 'my-app')
  .option('-t, --template <template>', '使用的模板 / Template to use (dashboard, form, simple)', 'dashboard')
  .action(async (name, options) => {
    try {
      await init(name, options);
    } catch (error) {
      console.error(chalk.red('错误 Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('lint')
  .description('Lint the generated application code')
  .option('--fix', 'Automatically fix linting issues')
  .action(async (options) => {
    try {
      await lint(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Run tests for the application')
  .option('-w, --watch', 'Run tests in watch mode')
  .option('-c, --coverage', 'Generate test coverage report')
  .option('--ui', 'Run tests with Vitest UI')
  .action(async (options) => {
    try {
      await test(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('generate')
  .alias('g')
  .description('Generate new resources (objects, pages, plugins)')
  .argument('<type>', 'Type of resource to generate (resource/object, page, plugin)')
  .argument('<name>', 'Name of the resource')
  .option('--from <source>', 'Generate schema from external source (openapi.yaml, prisma.schema)')
  .option('--output <dir>', 'Output directory for generated schemas', 'schemas/')
  .action(async (type, name, options) => {
    try {
      // Handle schema generation from external sources
      if (options.from) {
        console.log(chalk.yellow('\n⚠ Schema generation from external sources (OpenAPI/Prisma) is not yet implemented.'));
        console.log(chalk.gray('This feature will be available in a future release.\n'));
        process.exit(0);
      }
      
      await generate(type, name);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Diagnose and fix common issues')
  .action(async () => {
    try {
      await doctor();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('add')
  .description('Add a new component renderer to your project')
  .argument('<component>', 'Component name (e.g. Input, Grid)')
  .action(async (component) => {
    try {
      await add(component);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('studio')
  .description('Start the visual designer')
  .action(async () => {
    try {
      await studio();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Validate schema files')
  .action(async () => {
    try {
      await check();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate a schema file against ObjectUI specifications')
  .argument('[schema]', 'Path to schema file (JSON or YAML)', 'app.json')
  .action(async (schema) => {
    try {
      await validate(schema);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('create')
  .description('Create new resources')
  .argument('<type>', 'Type of resource to create (plugin)')
  .argument('<name>', 'Name of the resource')
  .action(async (type, name) => {
    try {
      if (type === 'plugin') {
        await createPlugin(name);
      } else {
        console.error(chalk.red(`Unknown resource type: ${type}`));
        console.log(chalk.gray('Available types: plugin'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze application performance')
  .option('--bundle-size', 'Analyze bundle size')
  .option('--render-performance', 'Analyze render performance')
  .action(async (options) => {
    try {
      await analyze(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });


program.parse();
