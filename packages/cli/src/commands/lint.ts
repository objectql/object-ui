import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface LintOptions {
  fix?: boolean;
}

export async function lint(options: LintOptions) {
  const cwd = process.cwd();
  
  console.log(chalk.blue('🔍 Running linter...\n'));

  // Check if the generated temp app exists
  const tmpDir = join(cwd, '.objectui-tmp');
  const hasTempApp = existsSync(tmpDir);

  if (!hasTempApp) {
    throw new Error(
      'No Object UI application found. Run \'objectui dev\' first to generate the application.'
    );
  }

  // Check if package.json and node_modules exist
  const packageJsonPath = join(tmpDir, 'package.json');
  const nodeModulesPath = join(tmpDir, 'node_modules');
  
  if (!existsSync(packageJsonPath) || !existsSync(nodeModulesPath)) {
    throw new Error(
      'Dependencies not installed. Run \'objectui dev\' first to set up the application.'
    );
  }

  try {
    const fixFlag = options.fix ? '--fix' : '';
    const command = `npx eslint "src/**/*.{js,jsx,ts,tsx}" ${fixFlag}`.trim();
    
    console.log(chalk.dim(`  Running: ${command}\n`));
    
    execSync(command, {
      cwd: tmpDir,
      stdio: 'inherit',
    });

    console.log();
    console.log(chalk.green('✓ Linting completed successfully!'));
    console.log();
  } catch {
    // ESLint returns non-zero exit code when there are linting errors
    console.log();
    console.log(chalk.yellow('⚠ Linting found issues.'));
    if (!options.fix) {
      console.log(chalk.dim('  Run \'objectui lint --fix\' to automatically fix some issues.'));
    }
    console.log();
    process.exit(1);
  }
}
