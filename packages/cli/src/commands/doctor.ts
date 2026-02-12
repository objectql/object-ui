/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export async function doctor() {
  console.log(chalk.bold('Object UI Doctor'));
  console.log('Diagnosis in progress...\n');
  
  const cwd = process.cwd();
  let issues = 0;

  // 1. Check package.json
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      
      // Check React version
      const reactVer = pkg.dependencies?.react || pkg.devDependencies?.react;
      if (reactVer) {
        console.log(chalk.green('✓ React installed'));
      } else {
        console.log(chalk.yellow('⚠️ React not found in dependencies'));
        issues++;
      }

      // Check Tailwind
      const tailwindVer = pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss;
      if (tailwindVer) {
        console.log(chalk.green('✓ Tailwind CSS installed'));
      } else {
        console.log(chalk.yellow('⚠️ Tailwind CSS not found'));
        issues++;
      }
    } catch (e) {
      console.log(chalk.red('x Failed to read package.json'));
      issues++;
    }
  } else {
    console.log(chalk.red('x package.json not found'));
    issues++;
  }

  // 2. Check tailwind.config.js
  const tailwindConfigPath = join(cwd, 'tailwind.config.js');
  const tailwindTsPath = join(cwd, 'tailwind.config.ts');
  if (existsSync(tailwindConfigPath) || existsSync(tailwindTsPath)) {
     const configFile = existsSync(tailwindConfigPath) ? 'tailwind.config.js' : 'tailwind.config.ts';
     const configPath = existsSync(tailwindConfigPath) ? tailwindConfigPath : tailwindTsPath;
     console.log(chalk.green(`✓ ${configFile} found`));
     // Check content configuration
     try {
       const configContent = readFileSync(configPath, 'utf-8');
       if (configContent.includes('content') && (configContent.includes('./src') || configContent.includes('./app') || configContent.includes('./pages'))) {
         console.log(chalk.green('✓ Tailwind content paths configured'));
       } else {
         console.log(chalk.yellow('⚠️ Tailwind content paths may not be configured. Ensure your content array includes source directories.'));
         issues++;
       }
     } catch (_e) {
       // File exists but can't be read - not critical
     }
  } else {
    console.log(chalk.yellow('⚠️ tailwind.config.js not found'));
    issues++;
  }

  // 3. Check TypeScript version
  const tsConfigPath = join(cwd, 'tsconfig.json');
  if (existsSync(tsConfigPath)) {
    console.log(chalk.green('✓ tsconfig.json found'));
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const tsVer = pkg.devDependencies?.typescript || pkg.dependencies?.typescript;
      if (tsVer) {
        const majorVer = parseInt(tsVer.replace(/[^0-9.]/g, '').split('.')[0], 10);
        if (majorVer >= 5) {
          console.log(chalk.green(`✓ TypeScript ${tsVer} (5.0+ required)`));
        } else {
          console.log(chalk.yellow(`⚠️ TypeScript ${tsVer} detected — version 5.0+ recommended`));
          issues++;
        }
      }
    } catch (_e) {
      // Already checked package.json above
    }
  } else {
    console.log(chalk.yellow('⚠️ tsconfig.json not found'));
    issues++;
  }

  // 4. Check peer dependencies
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // Check for common peer dependency issues
      if (allDeps['@object-ui/react'] && !allDeps['react']) {
        console.log(chalk.yellow('⚠️ @object-ui/react requires react as a peer dependency'));
        issues++;
      }
      if (allDeps['@object-ui/components'] && !allDeps['tailwindcss']) {
        console.log(chalk.yellow('⚠️ @object-ui/components requires tailwindcss as a peer dependency'));
        issues++;
      }
    } catch (_e) {
      // Already handled
    }
  }

  // Summary
  console.log('\nResult:');
  if (issues === 0) {
    console.log(chalk.green('Everything looks good! ✨'));
  } else {
    console.log(chalk.yellow(`Found ${issues} issue(s).`));
  }
}
