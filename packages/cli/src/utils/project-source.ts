/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * What `dev`, `serve` and `build` are asked to render — resolved once, for all
 * three (objectui#4923).
 *
 * ## The divergence this replaces
 *
 * Every one of the three commands answered "what is this project?" on its own.
 * `dev` anchored the answer on the SCHEMA ARGUMENT: `dirname(<schema>)` is the
 * project root, `pages/` beside the schema means file-system routing, and the
 * named file is the app config. `serve` and `build` looked only at
 * `join(cwd, 'pages')` and never at where the argument pointed, so from any
 * directory above the project the same invocation fell through to single-schema
 * mode — with the app config itself handed to the renderer as if it were a page.
 *
 * Measured on the commit that filed the card, fixture `<root>/app.json` +
 * `<root>/pages/index.json`, invoked from the directory above:
 *
 * - `objectui dev  <root>/app.json` → project structure, 1 route.
 * - `objectui serve <root>/app.json` → `Loading schema: <root>/app.json`.
 * - `objectui build <root>/app.json` → same, and it EXITS 0: the emitted bundle
 *   embeds the app config as the page schema and contains no page from
 *   `pages/` at all. A wrong artifact, produced silently.
 *
 * So the defect is not that one of the two readings is wrong — it is that one
 * invocation has two answers, and the losing one fails without saying so. There
 * is no documented intent for `serve`/`build` to be single-schema commands; the
 * documentation states the opposite twice (`cli.ts` calls `dev` an "alias for
 * serve", `README.md` and `content/docs/utilities/cli.mdx` call `serve` a
 * "legacy alias of `dev`", and the docs' routing section says `dev` and `build`
 * switch to file-system routing when "the project contains a `pages/`
 * directory"). Hence the richer, argument-anchored reading wins and lives here,
 * where the three share it — the same anti-drift shape objectui#3890 gave the
 * module-resolution face in `workspace-vite.ts`.
 *
 * ## Single-schema mode is still a mode
 *
 * A lone schema file with no `pages/` next to it is legitimate input and keeps
 * behaving exactly as before: the file is parsed and rendered on its own. It is
 * the fallback, not the casualty.
 */

import { existsSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

import chalk from 'chalk';

import { parseSchemaFile, scanPagesDirectory, type RouteInfo } from './app-generator.js';

/** Where the `pages/` directory that won was found. */
export type PagesDirOrigin = 'schema-dir' | 'cwd';

/** File-system routing: a `pages/` directory decides the routes. */
export interface RoutedProjectSource {
  mode: 'routes';
  /** The directory treated as the project root. */
  projectRoot: string;
  /** Absolute path of the `pages/` directory being scanned. */
  pagesDir: string;
  /** Which of the two candidate locations `pagesDir` came from. */
  pagesDirOrigin: PagesDirOrigin;
  routes: RouteInfo[];
  /** Parsed app config, when one was found and readable. */
  appConfig: unknown;
  /** Absolute path the app config was read from, if any. */
  appConfigPath: string | null;
  /** Non-fatal problems for the caller to report. */
  warnings: string[];
}

/** Single schema file mode: no `pages/` anywhere, render the named file. */
export interface SingleSchemaSource {
  mode: 'schema';
  /** The directory treated as the project root. */
  projectRoot: string;
  /** Absolute path of the schema file that was parsed. */
  schemaFile: string;
  schema: unknown;
  warnings: string[];
}

export type ProjectSource = RoutedProjectSource | SingleSchemaSource;

/**
 * Parse a file as an app config, degrading to a warning.
 *
 * A malformed app config is not fatal — the routes are still renderable without
 * a layout — so it warns and continues, which is what `dev` has always done.
 */
function readAppConfig(path: string, warnings: string[]): unknown {
  try {
    return parseSchemaFile(path);
  } catch (error) {
    warnings.push(
      `Failed to parse app config ${path}: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

/**
 * Resolve what to render from an invocation, identically for all three commands.
 *
 * Pure apart from reading the filesystem: nothing is logged and nothing is
 * written, so the three commands' reporting stays in `reportProjectSource` and
 * this can be exercised directly.
 *
 * Resolution order — first match wins:
 *
 * 1. `<schemaArg>` is an existing file and `pages/` sits beside it → routing
 *    from there, with the named file as the app config. This is the limb
 *    `serve`/`build` never had.
 * 2. `<cwd>/pages` exists → routing from there, with `<cwd>/app.json` as the app
 *    config when it exists. Invoking inside the project keeps working, including
 *    with the default `app.json` argument and with a `pages/` argument.
 * 3. Otherwise → single schema file mode.
 *
 * Throws when the resolved input cannot be rendered at all: a missing schema
 * file, an unparsable one, or a `pages/` directory holding no schema.
 */
export function resolveProjectSource(cwd: string, schemaArg: string): ProjectSource {
  const warnings: string[] = [];
  const absoluteSchemaPath = resolve(cwd, schemaArg);

  // 1. Anchored on the argument: a project is the directory the schema lives in.
  if (existsSync(absoluteSchemaPath) && statSync(absoluteSchemaPath).isFile()) {
    const projectRoot = dirname(absoluteSchemaPath);
    const pagesDir = join(projectRoot, 'pages');

    if (existsSync(pagesDir)) {
      return {
        mode: 'routes',
        projectRoot,
        pagesDir,
        pagesDirOrigin: 'schema-dir',
        routes: scanRoutes(pagesDir),
        appConfig: readAppConfig(absoluteSchemaPath, warnings),
        appConfigPath: absoluteSchemaPath,
        warnings
      };
    }
  }

  // 2. Anchored on the working directory.
  const localPagesDir = join(cwd, 'pages');
  if (existsSync(localPagesDir)) {
    const localAppConfigPath = join(cwd, 'app.json');
    const hasLocalAppConfig = existsSync(localAppConfigPath);

    return {
      mode: 'routes',
      projectRoot: cwd,
      pagesDir: localPagesDir,
      pagesDirOrigin: 'cwd',
      routes: scanRoutes(localPagesDir),
      appConfig: hasLocalAppConfig ? readAppConfig(localAppConfigPath, warnings) : null,
      appConfigPath: hasLocalAppConfig ? localAppConfigPath : null,
      warnings
    };
  }

  // 3. Single schema file mode.
  if (!existsSync(absoluteSchemaPath)) {
    throw new Error(
      `Schema file not found: ${schemaArg}\nRun 'objectui init' to create a sample schema.`
    );
  }

  let schema: unknown;
  try {
    schema = parseSchemaFile(absoluteSchemaPath);
  } catch (error) {
    // The caught error's message is inlined below. We can't pass it as the
    // `Error` `cause` option because this package targets ES2020, whose lib
    // types the 1-arg `Error` constructor only; hence the scoped disable.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Invalid schema file: ${error instanceof Error ? error.message : error}`);
  }

  return {
    mode: 'schema',
    projectRoot: dirname(absoluteSchemaPath),
    schemaFile: absoluteSchemaPath,
    schema,
    warnings
  };
}

/** Scan a `pages/` directory, refusing an empty one. */
function scanRoutes(pagesDir: string): RouteInfo[] {
  const routes = scanPagesDirectory(pagesDir);
  if (routes.length === 0) {
    throw new Error(`No schema files found in ${pagesDir}`);
  }
  return routes;
}

/**
 * Print the detection result.
 *
 * Split from the resolution so the three commands report identically by
 * construction: the divergence the card describes was visible in exactly these
 * lines, and a reader comparing two commands' output is comparing this function
 * with itself.
 */
export function reportProjectSource(source: ProjectSource, cwd: string): void {
  for (const warning of source.warnings) {
    console.warn(chalk.yellow(`⚠ ${warning}`));
  }

  if (source.mode === 'schema') {
    console.log(chalk.blue('📋 Loading schema:'), chalk.cyan(relative(cwd, source.schemaFile) || source.schemaFile));
    return;
  }

  console.log(chalk.blue(`📂 Detected project structure at ${source.projectRoot}`));
  if (source.appConfigPath && source.appConfig) {
    console.log(chalk.blue(`⚙️  Loaded App Config from ${relative(cwd, source.appConfigPath) || source.appConfigPath}`));
  }
  console.log(chalk.blue(`📁 Using file-system routing from ${source.pagesDir}`));
  console.log(chalk.green(`✓ Found ${source.routes.length} route(s)`));
  for (const route of source.routes) {
    console.log(chalk.dim(`  ${route.path} → ${relative(cwd, route.filePath)}`));
  }
}
