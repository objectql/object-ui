#!/usr/bin/env node

/**
 * Shadcn Components Sync Script
 * 
 * This script compares ObjectUI components with the latest Shadcn UI components
 * and provides options to update them to the latest version.
 * 
 * Usage:
 *   node scripts/shadcn-sync.js [options]
 * 
 * Options:
 *   --check           Check for component differences (default)
 *   --update <name>   Update specific component from Shadcn registry
 *   --update-all      Update all components from Shadcn registry
 *   --diff <name>     Show detailed diff for a component
 *   --list            List all components
 *   --backup          Create backup before updating
 *   --force           Overwrite even when local edits would be lost
 *   --no-verify       Skip the type-check that runs after an update
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.join(__dirname, '..');
const COMPONENTS_DIR = path.join(REPO_ROOT, 'packages/components/src/ui');
const MANIFEST_PATH = path.join(REPO_ROOT, 'packages/components/shadcn-components.json');
const BACKUP_DIR = path.join(REPO_ROOT, 'packages/components/.backup');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function loadManifest() {
  try {
    const content = await fs.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    log(`Error loading manifest: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function getLocalComponents() {
  try {
    const files = await fs.readdir(COMPONENTS_DIR);
    return files
      .filter(f => f.endsWith('.tsx'))
      .map(f => f.replace('.tsx', ''));
  } catch (error) {
    log(`Error reading components directory: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Registry `@/…` alias → ObjectUI relative path.
 *
 * Shadcn ships components with alias specifiers that assume its own repo
 * layout, and it has changed that layout at least once: the older generation
 * was `@/components/ui/x`, while every endpoint this manifest points at now
 * serves `@/registry/<style>/{ui,hooks,lib}/x`. Both forms are listed so a
 * pinned or re-pointed source keeps working.
 *
 * Synced files land in `packages/components/src/ui/`, so `ui/` resolves to a
 * sibling (`./x`) while `hooks/` and `lib/` step up one level (`../hooks/x`).
 *
 * Matching is on the quoted specifier rather than on `from "…"`, so
 * `export … from`, dynamic `import()` and `vi.mock()` are covered too. The
 * backreference keeps the original quote style.
 */
const IMPORT_REWRITES = [
  [/(["'])@\/registry\/[^/"']+\/ui\/([^"']+)\1/g, '$1./$2$1'],
  [/(["'])@\/registry\/[^/"']+\/hooks\/([^"']+)\1/g, '$1../hooks/$2$1'],
  [/(["'])@\/registry\/[^/"']+\/lib\/([^"']+)\1/g, '$1../lib/$2$1'],
  [/(["'])@\/components\/ui\/([^"']+)\1/g, '$1./$2$1'],
  [/(["'])@\/hooks\/([^"']+)\1/g, '$1../hooks/$2$1'],
  [/(["'])@\/lib\/([^"']+)\1/g, '$1../lib/$2$1'],
];

function rewriteRegistryImports(content) {
  return IMPORT_REWRITES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), content);
}

/**
 * Any `@/…` specifier the table above did not map. These do not resolve from
 * `src/ui/`, so writing a file that still contains one produces a component
 * that cannot compile — which is how `resizable` reached `customComponents`.
 * Callers must treat a non-empty result as a hard failure, not a warning:
 * this is the only thing standing between a Shadcn layout change and a
 * broken build.
 */
function findUnmappedAliases(content) {
  return [...new Set([...content.matchAll(/["'](@\/[^"']+)["']/g)].map((m) => m[1]))];
}

/** The header `updateComponent` prepends, so it isn't counted as a local edit. */
const OBJECTUI_HEADER = /^\/\*\*\n \* ObjectUI\n(?: \*.*\n)* \*\/\n+/;

/**
 * Lines the local file has that the incoming upstream version does not.
 *
 * These are what an overwrite destroys, and a type-check cannot see them:
 * upstream drops a local addition *and* its usages consistently, so the result
 * still compiles. `command.tsx` is the worked example — it carries a local
 * `sr-only` `DialogTitle`/`DialogDescription` on `CommandDialog` (Radix
 * requires an accessible name). Syncing it deletes 38 lines, removes the
 * accessibility fix, and type-checks clean.
 *
 * Comments count. A local comment explaining why we diverged is exactly the
 * kind of thing that must not evaporate silently.
 *
 * Measured across the 46 registry entries: 29 have none of these and sync
 * cleanly; 17 do. So this discriminates rather than crying wolf.
 */
function localOnlyLines(localContent, upstreamContent) {
  const norm = (t) =>
    t
      .replace(OBJECTUI_HEADER, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  const upstream = new Set(norm(upstreamContent));
  return norm(localContent).filter((l) => !upstream.has(l));
}

/**
 * Type-check the package after writing to it, and say plainly whether the sync
 * left it compiling.
 *
 * The `findUnmappedAliases` guard above only catches import paths. The other
 * way a sync breaks things is by discarding local edits: several components
 * have picked up named imports upstream does not have (`command` added
 * `DialogTitle`/`DialogDescription`, `sonner` added `toast`), and overwriting
 * them wholesale drops those. That surfaces as a type error, not a bad path —
 * so nothing short of actually compiling will catch it.
 *
 * Reporting only. Rolling back automatically would throw away a sync the user
 * may want to fix by hand, so this prints the command instead.
 */
function verifyPackageCompiles({ backup } = {}) {
  logSection('Verifying the package still compiles');
  log('Running: pnpm --filter @object-ui/components type-check', 'dim');
  log('(skip with --no-verify)\n', 'dim');

  const result = spawnSync('pnpm', ['--filter', '@object-ui/components', 'type-check'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  if (result.error) {
    log(`\n⚠ Could not run the type-check: ${result.error.message}`, 'yellow');
    log('  Verify by hand before committing.', 'yellow');
    return null;
  }

  if (result.status === 0) {
    log('\n✓ Type-check passed — the synced components still compile.', 'green');
    return true;
  }

  log(`\n✗ Type-check FAILED (exit ${result.status}). The sync broke the package.`, 'red');
  log('  Most likely a local edit was overwritten — upstream does not carry every', 'yellow');
  log('  named export we import (e.g. command/DialogTitle, sonner/toast).', 'yellow');
  log('\n  To roll back everything this run wrote:', 'cyan');
  log('    git checkout -- packages/components/src/ui/', 'dim');
  if (backup) {
    log(`  Backups from this run are also in ${path.relative(REPO_ROOT, BACKUP_DIR)}/`, 'dim');
  } else {
    log('  (Re-run with --backup next time to keep copies outside git.)', 'dim');
  }
  return false;
}

async function checkComponent(name, manifest) {
  const componentInfo = manifest.components[name];
  if (!componentInfo) {
    return {
      name,
      status: 'custom',
      message: 'Custom ObjectUI component (not in Shadcn)',
    };
  }

  const localPath = path.join(COMPONENTS_DIR, `${name}.tsx`);
  try {
    const localContent = await fs.readFile(localPath, 'utf-8');
    const localLines = localContent.split('\n').length;
    
    // Fetch latest from registry
    try {
      const registryData = await fetchUrl(componentInfo.source);
      // Rewrite before comparing, so import-path style alone does not read as
      // a difference — the local file has already been through this transform.
      const shadcnContent = rewriteRegistryImports(registryData.files?.[0]?.content || '');
      const shadcnLines = shadcnContent.split('\n').length;
      
      // Simple heuristic: check if significantly different
      const lineDiff = Math.abs(localLines - shadcnLines);
      const isDifferent = lineDiff > 10 || localContent.includes('ObjectUI') || localContent.includes('data-slot');
      
      return {
        name,
        status: isDifferent ? 'modified' : 'synced',
        localLines,
        shadcnLines,
        lineDiff,
        message: isDifferent ? 
          `Modified (${lineDiff} lines difference)` : 
          'Synced with Shadcn',
      };
    } catch (fetchError) {
      return {
        name,
        status: 'error',
        message: `Error fetching from registry: ${fetchError.message}`,
      };
    }
  } catch (error) {
    return {
      name,
      status: 'error',
      message: `Error reading local file: ${error.message}`,
    };
  }
}

async function checkAllComponents() {
  logSection('Checking Components Status');
  
  const manifest = await loadManifest();
  const localComponents = await getLocalComponents();
  
  log(`Found ${localComponents.length} local components`, 'cyan');
  log(`Tracking ${Object.keys(manifest.components).length} Shadcn components`, 'cyan');
  log(`Tracking ${Object.keys(manifest.customComponents).length} custom components\n`, 'cyan');
  
  const results = {
    synced: [],
    modified: [],
    custom: [],
    error: [],
  };
  
  for (const component of localComponents) {
    const result = await checkComponent(component, manifest);
    results[result.status].push(result);
    
    const symbol = {
      synced: '✓',
      modified: '⚠',
      custom: '●',
      error: '✗',
    }[result.status];
    
    const color = {
      synced: 'green',
      modified: 'yellow',
      custom: 'blue',
      error: 'red',
    }[result.status];
    
    log(`${symbol} ${result.name.padEnd(25)} ${result.message}`, color);
  }
  
  // Summary
  logSection('Summary');
  log(`✓ Synced:   ${results.synced.length} components`, 'green');
  log(`⚠ Modified: ${results.modified.length} components`, 'yellow');
  log(`● Custom:   ${results.custom.length} components`, 'blue');
  log(`✗ Errors:   ${results.error.length} components`, 'red');
  
  if (results.modified.length > 0) {
    log('\nTo update a component:', 'cyan');
    log('  node scripts/shadcn-sync.js --update <component-name>', 'dim');
    log('  node scripts/shadcn-sync.js --update-all', 'dim');
  }
  
  return results;
}

async function createBackup(componentName) {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const sourcePath = path.join(COMPONENTS_DIR, `${componentName}.tsx`);
  const backupPath = path.join(BACKUP_DIR, `${componentName}.tsx.${Date.now()}.backup`);
  
  try {
    await fs.copyFile(sourcePath, backupPath);
    log(`Created backup: ${path.basename(backupPath)}`, 'dim');
  } catch (error) {
    log(`Warning: Could not create backup: ${error.message}`, 'yellow');
  }
}

async function updateComponent(name, manifest, options = {}) {
  const componentInfo = manifest.components[name];
  
  if (!componentInfo) {
    log(`Component "${name}" not found in Shadcn registry (might be custom)`, 'red');
    return false;
  }
  
  log(`\nUpdating ${name}...`, 'cyan');
  
  try {
    // Fetch from registry
    const registryData = await fetchUrl(componentInfo.source);
    
    if (!registryData.files || registryData.files.length === 0) {
      log(`No files found in registry for ${name}`, 'red');
      return false;
    }

    // Only files[0] is written. Say so rather than truncating silently — a
    // multi-file entry (e.g. `toast`) needs its extra files placed by hand.
    if (registryData.files.length > 1) {
      const extra = registryData.files.slice(1).map((f) => f.path || f.name || '?');
      log(`  ⚠ Registry ships ${registryData.files.length} files; only the first is written.`, 'yellow');
      log(`    Not written: ${extra.join(', ')}`, 'yellow');
    }

    // Transform imports to match ObjectUI structure
    let content = rewriteRegistryImports(registryData.files[0].content);

    // Fail closed. An unmapped `@/…` specifier does not resolve from src/ui/,
    // so writing the file would swap working code for code that cannot
    // compile. Better to refuse and have someone extend IMPORT_REWRITES.
    const unmapped = findUnmappedAliases(content);
    if (unmapped.length > 0) {
      log(`✗ Refusing to write ${name}.tsx — unmapped registry import path(s):`, 'red');
      unmapped.forEach((spec) => log(`    ${spec}`, 'red'));
      log(`  Shadcn's alias layout changed. Add a rule to IMPORT_REWRITES in this script.`, 'yellow');
      return false;
    }

    // Don't clobber local edits silently. A type-check will not catch this —
    // see localOnlyLines — so refusing is the only thing that makes the loss
    // a decision rather than an accident.
    const targetPathForCheck = path.join(COMPONENTS_DIR, `${name}.tsx`);
    let existing = null;
    try {
      existing = await fs.readFile(targetPathForCheck, 'utf-8');
    } catch {
      /* new component — nothing to lose */
    }

    if (existing && !options.force) {
      const lost = localOnlyLines(existing, content);
      if (lost.length > 0) {
        log(`✗ Refusing to overwrite ${name}.tsx — ${lost.length} local line(s) upstream does not have:`, 'red');
        lost.slice(0, 8).forEach((l) => log(`    ${l.length > 96 ? l.slice(0, 96) + '…' : l}`, 'dim'));
        if (lost.length > 8) log(`    … and ${lost.length - 8} more`, 'dim');
        log(`  Overwriting deletes these. Port them onto the new upstream version by hand,`, 'yellow');
        log(`  or re-run with --force if they are genuinely obsolete.`, 'yellow');
        return 'skipped';
      }
    }

    // Add ObjectUI header
    const header = `/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

`;
    
    content = header + content;
    
    // Create backup if requested
    if (options.backup) {
      await createBackup(name);
    }
    
    // Write updated component
    const targetPath = path.join(COMPONENTS_DIR, `${name}.tsx`);
    await fs.writeFile(targetPath, content, 'utf-8');
    
    log(`✓ Updated ${name}.tsx`, 'green');
    
    // Check and log dependencies
    if (componentInfo.dependencies.length > 0) {
      log(`  Dependencies: ${componentInfo.dependencies.join(', ')}`, 'dim');
    }
    if (componentInfo.registryDependencies.length > 0) {
      log(`  Registry deps: ${componentInfo.registryDependencies.join(', ')}`, 'dim');
    }
    
    return true;
  } catch (error) {
    log(`✗ Error updating ${name}: ${error.message}`, 'red');
    return false;
  }
}

async function updateAllComponents(options = {}) {
  logSection('Updating All Components from Shadcn Registry');
  
  const manifest = await loadManifest();
  const componentNames = Object.keys(manifest.components);
  
  if (options.backup) {
    log('Creating backups...', 'cyan');
  }
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of componentNames) {
    const result = await updateComponent(name, manifest, options);
    if (result === true) {
      updated++;
    } else if (result === 'skipped') {
      skipped++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  logSection('Update Complete');
  log(`✓ Updated: ${updated} components`, 'green');
  if (skipped > 0) {
    log(`⊘ Skipped: ${skipped} components (local edits would be lost — see above)`, 'yellow');
    log(`  Port those edits by hand, or re-run with --force to take upstream as-is.`, 'dim');
  }
  if (failed > 0) {
    log(`✗ Failed:  ${failed} components`, 'red');
  }
  
  // Only worth compiling if something was actually written.
  const compiles = updated > 0 && options.verify !== false ? verifyPackageCompiles(options) : undefined;

  log('\nNext steps:', 'cyan');
  log('1. Review the changes: git diff packages/components/src/ui/', 'dim');
  if (compiles === false) {
    log('2. Fix or roll back — the type-check above failed.', 'dim');
  } else {
    log('2. Test the components: pnpm test', 'dim');
    log('3. Build the package: pnpm --filter @object-ui/components build', 'dim');
  }
}

async function showDiff(name) {
  logSection(`Component Diff: ${name}`);
  
  const manifest = await loadManifest();
  const componentInfo = manifest.components[name];
  
  if (!componentInfo) {
    log(`Component "${name}" not found in registry`, 'red');
    return;
  }
  
  try {
    const localPath = path.join(COMPONENTS_DIR, `${name}.tsx`);
    const localContent = await fs.readFile(localPath, 'utf-8');
    const registryData = await fetchUrl(componentInfo.source);
    // Same transform `--update` would apply, so the two sides are comparable.
    const shadcnContent = rewriteRegistryImports(registryData.files?.[0]?.content || '');

    log('Local version:', 'cyan');
    console.log(localContent.substring(0, 500) + '...\n');

    log('Shadcn version (import paths rewritten):', 'cyan');
    console.log(shadcnContent.substring(0, 500) + '...\n');

    log(`Local:  ${localContent.split('\n').length} lines`, 'dim');
    log(`Shadcn: ${shadcnContent.split('\n').length} lines`, 'dim');

    const unmapped = findUnmappedAliases(shadcnContent);
    if (unmapped.length > 0) {
      log(`\n⚠ Unmapped registry import path(s) — \`--update ${name}\` would refuse:`, 'yellow');
      unmapped.forEach((spec) => log(`    ${spec}`, 'yellow'));
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
  }
}

async function listComponents() {
  logSection('Component List');
  
  const manifest = await loadManifest();
  
  log('Shadcn Components:', 'cyan');
  Object.keys(manifest.components).sort().forEach(name => {
    console.log(`  • ${name}`);
  });
  
  log('\nCustom ObjectUI Components:', 'blue');
  Object.entries(manifest.customComponents).sort().forEach(([name, info]) => {
    console.log(`  • ${name.padEnd(20)} ${colors.dim}${info.description}${colors.reset}`);
  });
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--check')) {
    await checkAllComponents();
  } else if (args.includes('--update-all')) {
    const backup = args.includes('--backup');
    const verify = !args.includes('--no-verify');
    const force = args.includes('--force');
    await updateAllComponents({ backup, verify, force });
  } else if (args.includes('--update')) {
    const idx = args.indexOf('--update');
    const componentName = args[idx + 1];
    if (!componentName) {
      log('Error: --update requires a component name', 'red');
      process.exit(1);
    }
    const manifest = await loadManifest();
    const backup = args.includes('--backup');
    const verify = !args.includes('--no-verify');
    const force = args.includes('--force');
    const written = await updateComponent(componentName, manifest, { backup, force });
    // A single component can break the package just as thoroughly as a bulk
    // run, so it gets the same compile check.
    if (written === true && verify) verifyPackageCompiles({ backup });
  } else if (args.includes('--diff')) {
    const idx = args.indexOf('--diff');
    const componentName = args[idx + 1];
    if (!componentName) {
      log('Error: --diff requires a component name', 'red');
      process.exit(1);
    }
    await showDiff(componentName);
  } else if (args.includes('--list')) {
    await listComponents();
  } else if (args.includes('--help') || args.includes('-h')) {
    logSection('Shadcn Components Sync Script');
    console.log('Usage: node scripts/shadcn-sync.js [options]\n');
    console.log('Options:');
    console.log('  --check              Check for component differences (default)');
    console.log('  --update <name>      Update specific component from Shadcn');
    console.log('  --update-all         Update all components from Shadcn');
    console.log('  --diff <name>        Show detailed diff for a component');
    console.log('  --list               List all components');
    console.log('  --backup             Create backup before updating');
    console.log('  --force              Overwrite even if local edits would be lost');
    console.log('  --no-verify          Skip the post-update type-check');
    console.log('  --help, -h           Show this help message\n');
  } else {
    log('Unknown option. Use --help for usage information.', 'red');
    process.exit(1);
  }
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
