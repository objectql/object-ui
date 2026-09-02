#!/usr/bin/env node
/**
 * Static half of the `unit`-project registry-collision guard (objectui#7134).
 *
 * ## The invariant this exists to keep true
 *
 * `vitest.config.mts` runs the `unit` project with `isolate: false`, so every
 * file in a worker shares ONE module graph — and therefore one
 * `ComponentRegistry`, which is a module-level singleton
 * (`packages/core/src/registry/Registry.ts`). Registrations performed by one
 * file's import closure are visible to every other file in that worker.
 *
 * The project's justification comment used to state the opposite ("no
 * ComponentRegistry ... state to leak across files"). Measured on
 * `ec0a7b846`: the union of the project's import closures registers 505 keys.
 * The premise was false in both directions — the project holds files that
 * WRITE to the singleton and files that assert a key is ABSENT from it — and a
 * comment is the only thing a future author consults before adding either.
 *
 * A collision between the two is order-dependent, which is the reason it needs
 * a gate rather than a rule: whether the absent-asserting file runs before or
 * after the writer in its worker decides the outcome, and neither outcome is
 * information about the code under test.
 *
 * ## What is static here and what is NOT
 *
 * This module holds only the parts that can be read off the SOURCE, all of
 * them off the TypeScript AST rather than raw text — a registration written
 * inside a fixture string (this repo has several, e.g.
 * `scripts/__tests__/component-registrations.test.ts`) is source to a regex and
 * is not a registration:
 *
 *   - the `unit` project's file population, derived from `vitest.config.mts`;
 *   - each file's import specifiers;
 *   - each file's registry-ABSENCE assertions and the keys they name;
 *   - each file's OWN `ComponentRegistry.register` / `registerLazy` calls.
 *
 * The other half — which keys a file's import CLOSURE registers — is not
 * derivable from source at all: the live path registers from data
 * (`registerAllFields()` walks a map, so `field:*` keys appear in no
 * `register('field:...')` call site anywhere). It is measured by EXECUTION in
 * `scripts/__tests__/unit-registry-absence-collision.test.ts`: fresh module
 * graph, import `@object-ui/core`, snapshot `getAllTypes()`, import the
 * specifiers, diff.
 *
 * Every reader below reports what it could NOT resolve instead of dropping it,
 * because each of these populations is one a silent zero would make green.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Matchers that assert the subject is absent / not there. */
export const ABSENCE_MATCHERS = new Set(['toBeUndefined', 'toBeNull', 'toBeFalsy']);
/** Matchers that assert absence only under a `.not` in the chain. */
export const NEGATED_PRESENCE_MATCHERS = new Set(['toBeDefined', 'toBeTruthy']);
/** Registry reads whose result an absence assertion can be made about. */
export const REGISTRY_READERS = new Set(['get', 'has']);
/** The singleton this guard is about. A local `new Registry()` is not it. */
export const SINGLETON = 'ComponentRegistry';

/** Directory names never walked when collecting the project population. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'cypress', 'e2e']);

function parse(sourceText, fileName = 'file.ts') {
  return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/**
 * The `unit` project's include roots and `domTsTests` exclusions, read out of
 * `vitest.config.mts` rather than duplicated here. Duplicating them is how the
 * population silently stops matching the project it claims to describe.
 */
export function readUnitProjectShape(configText) {
  const domMatch = configText.match(/const domTsTests = \[([\s\S]*?)\n\];/);
  if (!domMatch) throw new Error('unit-registry-collision: could not find `domTsTests` in vitest.config.mts');
  const domTsTests = domMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith("'") || l.startsWith('"'))
    .map((l) => l.replace(/^['"]/, '').replace(/['"],?$/, ''));

  const unitBlock = configText.match(/name: 'unit'[\s\S]*?include: \[([\s\S]*?)\],/);
  if (!unitBlock) throw new Error("unit-registry-collision: could not find the `unit` project's `include` list");
  const include = unitBlock[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith("'") || l.startsWith('"'))
    .map((l) => l.replace(/^['"]/, '').replace(/['"],?$/, ''));

  const isolateFalse = /name: 'unit'[\s\S]*?isolate: false/.test(configText);
  return { domTsTests, include, isolateFalse };
}

/** Walk `root` for files whose path matches one of the simple `dir/**\/*.ext` globs. */
export function collectFiles(root, includeGlobs) {
  const specs = includeGlobs.map((g) => {
    const m = g.match(/^([^*]+)\/\*\*\/\*(\.[A-Za-z.]+)$/);
    if (!m) throw new Error(`unit-registry-collision: unsupported include glob ${JSON.stringify(g)}`);
    return { dir: m[1], ext: m[2] };
  });
  const out = [];
  for (const { dir, ext } of specs) {
    const start = path.join(root, dir);
    if (!fs.existsSync(start)) continue;
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop();
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.wt-')) continue;
          stack.push(full);
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
          out.push(path.relative(root, full).split(path.sep).join('/'));
        }
      }
    }
  }
  return [...new Set(out)].sort();
}

/** The `unit` project's files: the include globs minus the `domTsTests` opt-outs. */
export function unitProjectFiles(root, shape) {
  const dom = new Set(shape.domTsTests);
  return collectFiles(root, shape.include).filter((f) => !dom.has(f));
}

/**
 * Every import specifier the file names — static `import`/`export ... from`
 * and the dynamic `import('...')` form. Read off the AST, so the several
 * fixture sources this repo embeds in template literals are not counted.
 */
export function readImportSpecifiers(sourceText, fileName = 'file.ts') {
  const sf = parse(sourceText, fileName);
  const out = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) {
      out.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...new Set(out)];
}

/** `const X = 'literal'` declarations in the file, for resolving key expressions. */
function localStringConsts(sf) {
  const consts = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
        && ts.isStringLiteralLike(node.initializer)) {
      consts.set(node.name.text, node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return consts;
}

/** Resolve a key expression to a literal string, or `null` when it is not static. */
function resolveKeyExpression(node, consts) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isIdentifier(node)) return consts.has(node.text) ? consts.get(node.text) : null;
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const piece = resolveKeyExpression(span.expression, consts);
      if (piece === null) return null;
      out += piece + span.literal.text;
    }
    return out;
  }
  return null;
}

/** Does `node`'s subtree read the singleton, and with which key expression? */
function findSingletonRead(node) {
  let found = null;
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === SINGLETON
        && REGISTRY_READERS.has(n.expression.name.text)) {
      found = { method: n.expression.name.text, keyExpr: n.arguments[0] ?? null };
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/**
 * Registry-ABSENCE assertions in the file: `expect(<read of the singleton>)`
 * followed by a matcher that asserts the subject is not there.
 *
 * Sites whose key is not statically resolvable are returned with `key: null`
 * rather than dropped — `unit-registry-absence-collision.test.ts` floors them,
 * so a new unresolvable one is a decision rather than a silent shrink in what
 * the gate can see.
 */
export function readAbsenceAssertions(sourceText, fileName = 'file.ts') {
  const sf = parse(sourceText, fileName);
  const consts = localStringConsts(sf);
  const sites = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const matcher = node.expression.name.text;
      const plainAbsence = ABSENCE_MATCHERS.has(matcher);
      const negatable = NEGATED_PRESENCE_MATCHERS.has(matcher);
      if (plainAbsence || negatable) {
        // Walk the property-access chain back to its `expect(...)` root,
        // remembering whether a `.not` inverted it on the way.
        let cur = node.expression.expression;
        let negated = false;
        while (ts.isPropertyAccessExpression(cur)) {
          if (cur.name.text === 'not') negated = !negated;
          cur = cur.expression;
        }
        const isAbsence = negatable ? negated : !negated;
        if (isAbsence && ts.isCallExpression(cur) && ts.isIdentifier(cur.expression)
            && cur.expression.text === 'expect' && cur.arguments.length) {
          const read = findSingletonRead(cur.arguments[0]);
          if (read) {
            sites.push({
              key: resolveKeyExpression(read.keyExpr, consts),
              method: read.method,
              matcher: (negated ? 'not.' : '') + matcher,
              line: lineOf(sf, node),
              text: cur.arguments[0].getText(sf).replace(/\s+/g, ' ').slice(0, 120),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return sites;
}

/**
 * Keys the file itself writes into the singleton from a test body — the
 * registrations no import-closure measurement can see, because they only
 * happen when the test runs.
 *
 * `register(type, c, { namespace: n })` writes `n:type` AND the bare `type`
 * fallback unless `skipFallback` is set (`Registry.register`), so both are
 * reported.
 */
export function readOwnRegistrations(sourceText, fileName = 'file.ts') {
  const sf = parse(sourceText, fileName);
  const consts = localStringConsts(sf);
  const keys = [];
  const unresolved = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === SINGLETON
        && (node.expression.name.text === 'register' || node.expression.name.text === 'registerLazy')) {
      const type = resolveKeyExpression(node.arguments[0], consts);
      if (type === null) {
        unresolved.push({ line: lineOf(sf, node), text: node.getText(sf).replace(/\s+/g, ' ').slice(0, 100) });
      } else {
        const meta = node.arguments.find((a) => ts.isObjectLiteralExpression(a));
        let namespace = null;
        let skipFallback = false;
        if (meta) {
          for (const prop of meta.properties) {
            if (!ts.isPropertyAssignment(prop) || !prop.name) continue;
            const name = ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name) ? prop.name.text : null;
            if (name === 'namespace') namespace = resolveKeyExpression(prop.initializer, consts);
            if (name === 'skipFallback') skipFallback = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
          }
        }
        if (namespace) {
          keys.push(`${namespace}:${type}`);
          if (!skipFallback) keys.push(type);
        } else {
          keys.push(type);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { keys: [...new Set(keys)], unresolved };
}

/**
 * The judgement, kept pure so it can be exercised on planted populations.
 *
 * `readers`: [{ file, keys }] — keys asserted ABSENT.
 * `writers`: [{ file, keys }] — keys the file (or its closure) registers.
 * A file colliding with ITSELF is not a finding: it is hermetic either way.
 */
export function findCollisions(readers, writers) {
  const out = [];
  for (const reader of readers) {
    for (const key of reader.keys) {
      for (const writer of writers) {
        if (writer.file === reader.file) continue;
        if (writer.keys.includes(key)) out.push({ key, reader: reader.file, writer: writer.file });
      }
    }
  }
  return out;
}

export function formatCollisions(collisions) {
  return collisions
    .map(
      (c) =>
        `  ${JSON.stringify(c.key)}\n` +
        `      asserted ABSENT by: ${c.reader}\n` +
        `      registered by:      ${c.writer}`,
    )
    .join('\n');
}

/**
 * Floors for every population this gate derives. Each one is a population a
 * silent zero would make GREEN — no readers, no keys, no modules imported —
 * which is the failure mode the gate exists to refuse one level down, so it is
 * refused here too. Move one deliberately, never to make a red run green.
 */
export const FLOORS = {
  populationFiles: 500,
  readerFiles: 1,
  resolvedAbsentKeys: 2,
  distinctSpecifiers: 200,
  registeredKeys: 100,
};

/** Floors that were not met, as human-readable lines. Empty means non-vacuous. */
export function checkFloors(counts, floors = FLOORS) {
  const out = [];
  for (const [name, floor] of Object.entries(floors)) {
    const got = counts[name];
    if (typeof got !== 'number') out.push(`${name}: NOT MEASURED (floor ${floor})`);
    else if (got < floor) out.push(`${name}: found ${got}, floor is ${floor}`);
  }
  return out;
}

const MODULE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json', ''];

/**
 * Where an import specifier points. `workspace` ids are absolute paths this
 * repo owns and MUST import; `bare` ids are package specifiers left to the
 * resolver; `unresolved` is a relative specifier with no file behind it, which
 * is reported rather than dropped.
 */
export function resolveSpecifier(root, fromFile, spec) {
  if (!spec.startsWith('.')) return { kind: 'bare', id: spec };
  const dir = path.dirname(path.join(root, fromFile));
  const base = path.resolve(dir, spec.replace(/\.js$/, ''));
  for (const ext of MODULE_EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return { kind: 'workspace', id: candidate };
  }
  for (const ext of MODULE_EXTENSIONS) {
    if (ext === '') continue;
    const candidate = path.join(base, 'index' + ext);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return { kind: 'workspace', id: candidate };
  }
  const asWritten = path.resolve(dir, spec);
  if (fs.existsSync(asWritten) && fs.statSync(asWritten).isFile()) return { kind: 'workspace', id: asWritten };
  return { kind: 'unresolved', id: spec };
}
