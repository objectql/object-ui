#!/usr/bin/env node

/**
 * Copies the built console app (apps/console/dist) into this package's
 * `client/` directory so it can be shipped as part of the npm package.
 *
 * Usage: node scripts/copy-client.js [source-path]
 *
 * If source-path is not provided, defaults to ../../apps/console/dist
 * (relative to this package root).
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');

const sourcePath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(packageRoot, '..', '..', 'apps', 'console', 'dist');

const targetPath = resolve(packageRoot, 'client');

if (!existsSync(sourcePath)) {
  console.error(`[copy-client] Source directory not found: ${sourcePath}`);
  console.error('[copy-client] Build the console first: pnpm --filter @object-ui/console build');
  process.exit(1);
}

console.log(`[copy-client] Copying console client files...`);
console.log(`  Source: ${sourcePath}`);
console.log(`  Target: ${targetPath}`);

// Clean target
if (existsSync(targetPath)) {
  rmSync(targetPath, { recursive: true });
}
mkdirSync(targetPath, { recursive: true });

// Copy files
cpSync(sourcePath, targetPath, { recursive: true });

console.log('[copy-client] Done.');
