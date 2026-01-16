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
  if (existsSync(tailwindConfigPath)) {
     console.log(chalk.green('✓ tailwind.config.js found'));
     // TODO: Check content configuration
  } else {
    console.log(chalk.yellow('⚠️ tailwind.config.js not found'));
    issues++;
  }

  // Summary
  console.log('\nResult:');
  if (issues === 0) {
    console.log(chalk.green('Everything looks good! ✨'));
  } else {
    console.log(chalk.yellow(`Found ${issues} issue(s).`));
  }
}
