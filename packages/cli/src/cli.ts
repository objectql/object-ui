#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { serve } from './commands/serve.js';
import { init } from './commands/init.js';
import { dev } from './commands/dev.js';
import { buildApp } from './commands/build.js';
import { start } from './commands/start.js';
import { lint } from './commands/lint.js';
import { test } from './commands/test.js';
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

program.parse();
