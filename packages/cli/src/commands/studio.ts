import chalk from 'chalk';
import { serve } from './serve.js';

export async function studio() {
  console.log(chalk.bold('Starting Object UI Studio...'));
  
  // Logic to start designer server
  // This might reuse 'serve' but with a special mode or different root
  
  console.log(chalk.yellow('Studio mode is experimental.'));
  
  // For now, we can just point to the designer URL if it was hosted, 
  // or start the local dev server with a flag.
  // Assuming designer is a static app that connects to the local API.
}
