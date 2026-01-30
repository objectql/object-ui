/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from 'chalk';
import { existsSync, statSync, readdirSync } from 'fs';
import { resolve, join, extname } from 'path';

interface AnalyzeOptions {
  bundleSize?: boolean;
  renderPerformance?: boolean;
}

/**
 * Analyze bundle size by scanning dist directory
 */
async function analyzeBundleSize() {
  console.log(chalk.bold('\n📦 Bundle Size Analysis\n'));

  const distDir = resolve(process.cwd(), 'dist');
  
  if (!existsSync(distDir)) {
    console.log(chalk.yellow('⚠ No dist directory found. Run build first.'));
    return;
  }

  const files: Array<{ path: string; size: number }> = [];
  
  function scanDirectory(dir: string) {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        files.push({
          path: fullPath.replace(distDir + '/', ''),
          size: stat.size,
        });
      }
    }
  }
  
  scanDirectory(distDir);
  
  // Sort by size (largest first)
  files.sort((a, b) => b.size - a.size);
  
  // Calculate totals
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const jsFiles = files.filter(f => extname(f.path) === '.js');
  const cssFiles = files.filter(f => extname(f.path) === '.css');
  
  const jsSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
  const cssSize = cssFiles.reduce((sum, file) => sum + file.size, 0);
  
  console.log(chalk.bold('Summary:'));
  console.log(chalk.gray('  Total Size:'), formatBytes(totalSize));
  console.log(chalk.gray('  JavaScript:'), formatBytes(jsSize), chalk.dim(`(${jsFiles.length} files)`));
  console.log(chalk.gray('  CSS:       '), formatBytes(cssSize), chalk.dim(`(${cssFiles.length} files)`));
  console.log(chalk.gray('  Other:     '), formatBytes(totalSize - jsSize - cssSize));
  
  console.log(chalk.bold('\nLargest Files:'));
  files.slice(0, 10).forEach((file) => {
    const sizeStr = formatBytes(file.size).padStart(10);
    console.log(chalk.gray(`  ${sizeStr}`), file.path);
  });
  
  // Bundle size recommendations
  console.log(chalk.bold('\n💡 Recommendations:'));
  
  if (totalSize > 1024 * 1024) {
    console.log(chalk.yellow('  ⚠ Total bundle size is large (> 1MB)'));
    console.log(chalk.gray('    Consider code splitting or lazy loading'));
  }
  
  if (jsSize > 500 * 1024) {
    console.log(chalk.yellow('  ⚠ JavaScript bundle is large (> 500KB)'));
    console.log(chalk.gray('    Consider:'));
    console.log(chalk.gray('    - Tree shaking unused code'));
    console.log(chalk.gray('    - Lazy loading components'));
    console.log(chalk.gray('    - Using dynamic imports'));
  }
  
  if (files.length > 100) {
    console.log(chalk.yellow(`  ⚠ Large number of files (${files.length})`));
    console.log(chalk.gray('    Consider bundling or combining files'));
  }
  
  console.log('');
}

/**
 * Analyze render performance (placeholder for now)
 */
async function analyzeRenderPerformance() {
  console.log(chalk.bold('\n⚡ Render Performance Analysis\n'));
  
  console.log(chalk.gray('Performance analysis features:'));
  console.log(chalk.gray('  ✓ Expression caching enabled'));
  console.log(chalk.gray('  ✓ Component memoization available'));
  console.log(chalk.gray('  ✓ Virtual scrolling support for large lists'));
  
  console.log(chalk.bold('\n💡 Performance Tips:'));
  console.log(chalk.gray('  • Use virtual scrolling for lists > 100 items'));
  console.log(chalk.gray('  • Cache frequently evaluated expressions'));
  console.log(chalk.gray('  • Use React.memo for expensive components'));
  console.log(chalk.gray('  • Implement pagination for large datasets'));
  console.log(chalk.gray('  • Use code splitting for large apps'));
  
  console.log('');
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Analyze application performance
 * 
 * @param options - Analysis options
 */
export async function analyze(options: AnalyzeOptions = {}) {
  console.log(chalk.blue('🔍 ObjectUI Performance Analyzer\n'));

  const runAll = !options.bundleSize && !options.renderPerformance;
  
  if (options.bundleSize || runAll) {
    await analyzeBundleSize();
  }
  
  if (options.renderPerformance || runAll) {
    await analyzeRenderPerformance();
  }
  
  console.log(chalk.green('✓ Analysis complete!\n'));
}
