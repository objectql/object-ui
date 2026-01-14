#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { serve } from './commands/serve.js';
import { init } from './commands/init.js';
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
  .description('启动开发服务器来渲染您的JSON schema / Start a development server with your JSON schema')
  .argument('[schema]', 'JSON schema文件路径 / Path to JSON schema file', 'app.schema.json')
  .option('-p, --port <port>', '服务器端口 / Port to run the server on', '3000')
  .option('-h, --host <host>', '服务器绑定主机 / Host to bind the server to', 'localhost')
  .action(async (schema, options) => {
    try {
      await serve(schema, options);
    } catch (error) {
      console.error(chalk.red('错误 Error:'), error instanceof Error ? error.message : error);
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

program.parse();
