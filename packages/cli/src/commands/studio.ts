/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export async function studio() {
  console.log(chalk.bold('\n🎨 Starting ObjectUI Studio...\n'));

  const cwd = process.cwd();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Resolve the console app directory
  // 1. Check monorepo structure (apps/console)
  // 2. Check relative path (../../apps/console from packages/cli)
  const candidates = [
    join(cwd, 'apps/console'),
    resolve(__dirname, '../../apps/console'),
    resolve(__dirname, '../../../apps/console'),
  ];

  let consolePath: string | null = null;
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'package.json'))) {
      consolePath = candidate;
      break;
    }
  }

  if (!consolePath) {
    console.log(chalk.yellow('⚠  Console app not found in workspace.'));
    console.log(chalk.dim('  Hint: Run this command from the monorepo root.'));
    console.log(chalk.dim('  Expected: apps/console/package.json\n'));
    process.exit(1);
  }

  console.log(chalk.dim(`  Console: ${consolePath}`));
  console.log(chalk.dim('  Mode:    MSW (in-browser mock server)\n'));

  // Delegate to the console's dev script which starts Vite + MSW
  const child = spawn('npx', ['vite', '--open'], {
    cwd: consolePath,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
    shell: true,
  });

  child.on('error', (err) => {
    console.error(chalk.red(`\n  ✗ Failed to start studio: ${err.message}`));
    process.exit(1);
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}
