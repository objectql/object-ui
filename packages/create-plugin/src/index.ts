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
import prompts from 'prompts';
import * as path from 'path';
import fs from 'fs-extra';
import { buildPluginFiles, type PluginTemplateVars } from './templates';

const program = new Command();

interface PluginOptions {
  name?: string;
  description?: string;
  author?: string;
}

async function createPlugin(pluginName?: string, options: PluginOptions = {}) {
  console.log(chalk.blue('\n🚀 ObjectUI Plugin Generator\n'));

  // Get plugin name if not provided
  if (!pluginName) {
    const response = await prompts({
      type: 'text',
      name: 'name',
      message: 'Plugin name (without prefix):',
      validate: (value) => {
        if (value.length === 0) return 'Plugin name is required';
        // Validate package name format
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Plugin name must contain only lowercase letters, numbers, and hyphens';
        }
        // Prevent path traversal
        if (value.includes('..') || value.includes('/') || value.includes('\\')) {
          return 'Plugin name cannot contain path separators or ".."';
        }
        return true;
      }
    });
    pluginName = response.name;
    
    if (!pluginName) {
      console.log(chalk.red('\n❌ Plugin name is required'));
      process.exit(1);
    }
  }

  // Validate plugin name format and security
  if (!/^[a-z0-9-]+$/.test(pluginName)) {
    console.log(chalk.red('\n❌ Plugin name must contain only lowercase letters, numbers, and hyphens'));
    process.exit(1);
  }
  
  if (pluginName.includes('..') || pluginName.includes('/') || pluginName.includes('\\') || path.isAbsolute(pluginName)) {
    console.log(chalk.red('\n❌ Invalid plugin name: path traversal detected'));
    process.exit(1);
  }

  // Ensure plugin name doesn't include the plugin- prefix
  const cleanName = pluginName.replace(/^plugin-/, '').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  
  if (cleanName.length === 0) {
    console.log(chalk.red('\n❌ Plugin name cannot be empty after sanitization'));
    process.exit(1);
  }
  
  const fullPackageName = `plugin-${cleanName}`;
  const pascalCaseName = cleanName
    .split('-')
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // Get additional info
  const answers = await prompts([
    {
      type: 'text',
      name: 'description',
      message: 'Plugin description:',
      initial: options.description || `${pascalCaseName} plugin for ObjectUI`
    },
    {
      type: 'text',
      name: 'author',
      message: 'Author name:',
      initial: options.author || ''
    }
  ]);

  const targetDir = path.join(process.cwd(), 'packages', fullPackageName);

  // Check if directory exists
  if (fs.existsSync(targetDir)) {
    console.log(chalk.red(`\n❌ Directory already exists: ${targetDir}`));
    process.exit(1);
  }

  console.log(chalk.green(`\n✨ Creating plugin: ${fullPackageName}...\n`));

  // Create directory structure
  fs.mkdirpSync(targetDir);

  // Template variables
  const vars: PluginTemplateVars = {
    packageName: `@object-ui/${fullPackageName}`,
    pluginName: cleanName,
    pascalName: pascalCaseName,
    description: answers.description,
    author: answers.author,
    version: '0.1.0',
    year: new Date().getFullYear()
  };

  // Write every templated file. The templates themselves live in
  // `./templates` so they can be unit-tested without executing this CLI.
  for (const [relativePath, contents] of Object.entries(buildPluginFiles(vars))) {
    const filePath = path.join(targetDir, relativePath);
    fs.mkdirpSync(path.dirname(filePath));
    fs.writeFileSync(filePath, contents);
  }

  console.log(chalk.green('✅ Plugin created successfully!\n'));
  console.log(chalk.blue('Next steps:\n'));
  console.log(chalk.gray(`  cd packages/${fullPackageName}`));
  console.log(chalk.gray('  pnpm install'));
  console.log(chalk.gray('  pnpm build\n'));
  console.log(chalk.blue('To use the plugin:\n'));
  console.log(chalk.gray(`  import { ${pascalCaseName} } from '${vars.packageName}';\n`));
}

program
  .name('create-plugin')
  .description('Create a new ObjectUI plugin')
  .argument('[plugin-name]', 'Name of the plugin (without plugin- prefix)')
  .option('-d, --description <description>', 'Plugin description')
  .option('-a, --author <author>', 'Author name')
  .action(createPlugin);

program.parse();
