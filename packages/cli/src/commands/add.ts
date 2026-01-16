import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export async function add(component: string) {
  console.log(chalk.bold(`Object UI Add: ${component}`));
  console.log(chalk.yellow('Feature not implemented yet.'));
  console.log(`This command will download the source code for ${component}Renderer to your project.`);
}
