import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface TestOptions {
  watch?: boolean;
  coverage?: boolean;
  ui?: boolean;
}

export async function test(options: TestOptions) {
  const cwd = process.cwd();
  
  console.log(chalk.blue('🧪 Running tests...\n'));

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
    let command = 'npx vitest';
    
    if (options.watch) {
      command += ' --watch';
    } else if (options.ui) {
      command += ' --ui';
    } else {
      command += ' run';
    }

    if (options.coverage) {
      command += ' --coverage';
    }

    console.log(chalk.dim(`  Running: ${command}\n`));
    
    execSync(command, {
      cwd: tmpDir,
      stdio: 'inherit',
    });

    if (!options.watch && !options.ui) {
      console.log();
      console.log(chalk.green('✓ Tests completed successfully!'));
      console.log();
    }
  } catch {
    // Vitest returns non-zero exit code when tests fail
    console.log();
    console.log(chalk.red('✗ Some tests failed.'));
    console.log();
    process.exit(1);
  }
}
