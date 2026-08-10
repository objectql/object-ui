#!/usr/bin/env node
/**
 * Every key a component asks `t()` for must EXIST in the `en` locale pack.
 *
 * Run:  node scripts/check-i18n-call-site-keys.mjs   (also `pnpm check:i18n-keys`)
 * Exit: 0 = every in-scope call-site key resolves (or is baselined), 1 = it does not
 *
 * ## The gap this closes (objectui#3530)
 *
 * `packages/i18n/src/__tests__/all-locales-key-parity.test.ts` asserts that every
 * pack defines every `en` key and no pack defines a key `en` lacks — a **pack vs
 * pack** invariant. It is blind by construction to the other direction: a key a
 * component *references* that NO pack defines. Ten packs identically missing a
 * key is full parity, and full parity is green.
 *
 * Nothing else caught it either, because `fallbackLng: 'en'` plus an inline
 * `t(key, { defaultValue: 'English text' })` renders correct English at the one
 * call site while the key stays untranslatable in all ten languages. The
 * dev-only missing-key warner (`i18n.ts`) is the only runtime signal and CI
 * never sees a browser console. objectui#3517 was one instance —
 * `form.createTargetOrg`, missing from all ten packs, covered by an inline
 * default for months, found only by #3469's by-hand per-key sweep. This gate is
 * the class, not the instance: the first full run over `main` found
 * 258 more.
 *
 * ## Division of labour with the other two i18n gates
 *
 * All three read the same ten packs, and each is blind to what the next owns:
 *
 *   - THIS gate: call site -> `en`. Does the key a component asks for exist?
 *   - `packages/i18n/src/__tests__/all-locales-key-parity.test.ts`: pack vs pack
 *     KEY SETS, plus placeholder shape.
 *   - `scripts/check-i18n-en-drift.mjs` (objectui#3650): the only one that reads
 *     VALUES, and only as an event — when an `en` string CHANGES, the nine
 *     translations must change in the same PR (or be waived). Neither key gate
 *     can see a value go stale: objectui#3582 and objectui#3625 were eight packs
 *     serving a retired sentence at full key parity, the second one in idiomatic
 *     native script that every value-shaped heuristic also reads as healthy.
 *
 * ## What is IN scope, and why the answer is not "every `t(`"
 *
 * A naive grep for `t('...')` scores 3485 call sites in this repo and would be
 * wrong about roughly a third of them, because `t` is not one function:
 *
 *   - 2370 calls reach i18next and therefore the locale packs. Those are the
 *     subject of this gate.
 *   - 1074 calls go to `packages/app-shell/src/views/metadata-admin/i18n.ts`, a
 *     module-local `engine.*` label table that is NOT an i18next pack and never
 *     will be (read its header). Checking its keys against `en` produces 89
 *     permanent false reds — measured, by removing the exclusion.
 *   - 41 calls are a local `t` that is not a translator at all — a `useCallback`
 *     result, a `Date` difference, a `||` chain, a `.t()` method on some other
 *     object.
 *
 * So the unit of classification is the **binding**, not the spelling. For each
 * `t(...)`/`tt(...)` call this file resolves which declaration of `t` is in
 * scope at that position (nearest enclosing scope wins, then the latest
 * declaration before the use), and classifies it:
 *
 *   PACK   — bound from a call to a translate hook: `const { t } = useXxx…()`,
 *            `const tt = useSafeTranslate()`. The hook-name convention is
 *            `use*Translation` / `use*Translate` / `use*T` and it is a real
 *            repo-wide convention: all 26 such hooks are either
 *            `createSafeTranslation(...)` factories or thin wrappers over
 *            `useObjectTranslation`. **Checked.**
 *   LOCAL  — bound from an `import` of a module in EXCLUDED_TRANSLATORS below,
 *            or forwarded inside that module's declared scope. **Skipped**, by
 *            declaration, with a reason. An import from any *other* module is a
 *            hard error, so a second local table cannot appear silently.
 *   OTHER  — anything else (`const t = someValue`). **Skipped**, counted.
 *
 * A `t` received as a parameter or a prop inherits its file's provenance: a
 * helper that takes `t: TranslateFn` is checked in a file whose own `t` comes
 * from a hook, and skipped inside the metadata-admin tree. That hop is the one
 * place a type checker would be exact and this parser is a heuristic, so it is
 * worth knowing what it buys: deleting `forwardedScope` puts 89 call sites
 * (78 distinct `engine.*`/`perm.cel.*`/`perm.rls.*` keys) back on the report,
 * every one of them a component that was handed the metadata-admin table's `t`
 * by its parent, and not one of them a real finding.
 *
 * ## Two failure classes
 *
 * 1. `missing-key` — a literal key with no leaf in `en`. i18next plural suffixes
 *    (`_one`, `_other`, …) count as defining the base key, and a key passed with
 *    `returnObjects: true` may name a subtree rather than a leaf.
 * 2. `missing-prefix` — a template key (`` t(`marketplace.category.${c}`) ``)
 *    whose static head matches NO `en` key at all. Then every possible expansion
 *    is missing, whatever the substitution evaluates to. This is the only claim
 *    about a dynamic key that is true without knowing the value.
 *
 * ## Dynamic keys: the explicit policy
 *
 * A key that is not a string literal cannot be resolved statically. Those call
 * sites are **not checked and not failed** — they are COUNTED, and the count is
 * printed on every run, so the unanalyzable surface is visible rather than
 * silently absorbed. The `missing-prefix` class above recovers the part of it
 * that can be decided. Same treatment, same reason, for the deliberate
 * `I18N_PROBE_FLAG` misses (see below) and for the skipped binding classes.
 *
 * ## The probe exclusion
 *
 * `useObjectLabel` probes convention keys (`{ns}.objects.{name}.label`) that are
 * SUPPOSED to miss — it falls back to the server-resolved label. Those calls
 * carry `[I18N_PROBE_FLAG]: true`, and this gate excludes them by that flag, not
 * by path, so a probe written anywhere is excluded and a non-probe call in
 * `useObjectLabel.ts` is not. Both of today's probe sites happen to use dynamic
 * keys, so the flag currently only moves them out of the dynamic counter; the
 * exclusion is still load-bearing for the literal-key probe someone writes next,
 * and `scripts/__tests__/check-i18n-call-site-keys.test.ts` pins that shape.
 *
 * ## The baseline
 *
 * `scripts/i18n-call-site-key-baseline.json` lists the keys already missing on
 * `main` when this gate landed, each with the issue tracking its fix. It is a
 * ratchet, not an allowlist: a key that is NOT in it fails, and an entry that no
 * longer fires (key added to `en`, or its last call site deleted) ALSO fails, so
 * the file can only shrink. Fixing the debt means adding the key to
 * `packages/i18n/src/locales/en.ts` — which immediately makes
 * `all-locales-key-parity.test.ts` demand it in the other nine packs, which is
 * the correct order.
 */

import ts from 'typescript';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** Hook names whose `t` reaches i18next. See the header for why a name is enough. */
export const PACK_HOOK = /^use[A-Za-z0-9_]*(Translation|Translate|T)$/;

/**
 * Annotations that mark a forwarded `t` as a translator. Only used to tell a
 * forwarded translator apart from an unrelated `t` parameter; provenance (which
 * table it reaches) comes from the file, not from the type.
 */
export const TRANSLATOR_TYPE =
  /Translat|\bTFunction\b|\bTFn\b|\(\s*key\s*:|\(\s*keyOrKeys\s*:|\(\s*k\s*:\s*string/;

/** The option flag `useObjectLabel` sets on its deliberate convention-key misses. */
export const PROBE_FLAG_NAMES = /I18N_PROBE_FLAG|__ouiLabelProbe/;

/**
 * `t` bindings that do NOT resolve against the locale packs. Every entry is a
 * decision with a reason; an imported `t` from anywhere else is a hard error
 * (`unregistered-translator`) rather than a silent skip.
 *
 * `forwardedScope` is the directory whose files may receive this table's `t` as
 * a parameter or prop. Without it, a component that takes `t` from a
 * metadata-admin parent reads as pack-backed and its `engine.*` keys report as
 * missing — 89 such false reds, measured, across `CelPredicateField.tsx`,
 * `CelTestRunDialog.tsx`, `ConditionalFormattingEditor.tsx`,
 * `PermissionAdvancedFacets.tsx` and `PermissionMatrixEditor.tsx`.
 */
export const EXCLUDED_TRANSLATORS = [
  {
    module: 'packages/app-shell/src/views/metadata-admin/i18n.ts',
    forwardedScope: ['packages/app-shell/src/views/metadata-admin/'],
    reason:
      'module-local engine.* label table (a plain Record lookup, not i18next); ' +
      'its keys are not in any locale pack by design — see that file\'s header',
  },
];

/** Directories never scanned: build output, deps, and test/mock trees. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.turbo', '__mocks__']);
const TEST_FILE = /(^|[/\\])__tests__[/\\]|\.test\.tsx?$|\.spec\.tsx?$/;

/** i18next resolves `key` when the pack defines any of these plural forms. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

// ── the `en` pack ────────────────────────────────────────────────────────────

/**
 * Dotted leaf paths of `packages/i18n/src/locales/en.ts`, read from its AST.
 *
 * Parsed rather than imported so the gate needs no build step and no TS loader.
 * `scripts/__tests__/check-i18n-call-site-keys.test.ts` pins this extraction
 * against the real module evaluated by vitest, so the two cannot drift.
 *
 * @returns {{ leaves: Set<string>, branches: Set<string> }}
 */
export function collectEnKeys(root) {
  const file = join(root, 'packages/i18n/src/locales/en.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

  const unwrap = (node) => {
    let n = node;
    while (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || (ts.isSatisfiesExpression?.(n) ?? false)) n = n.expression;
    return n;
  };

  let literal = null;
  const findEn = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'en' &&
      node.initializer
    ) {
      const init = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(init)) literal = init;
    }
    ts.forEachChild(node, findEn);
  };
  findEn(source);
  if (!literal) throw new Error(`cannot find the \`const en = { … }\` object literal in ${file}`);

  const leaves = new Set();
  const branches = new Set();
  const walk = (object, prefix) => {
    for (const prop of object.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(`unsupported property form in ${file} at ${prefix || '<root>'}: ${ts.SyntaxKind[prop.kind]}`);
      }
      const name =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)
          ? prop.name.text
          : null;
      if (name === null) {
        throw new Error(`unsupported key form in ${file} at ${prefix || '<root>'}`);
      }
      const path = prefix ? `${prefix}.${name}` : name;
      const value = unwrap(prop.initializer);
      if (ts.isObjectLiteralExpression(value)) {
        branches.add(path);
        walk(value, path);
      } else {
        leaves.add(path);
      }
    }
  };
  walk(literal, '');
  return { leaves, branches };
}

// ── source walk ──────────────────────────────────────────────────────────────

/** Every non-test `.ts`/`.tsx` file under `packages/` and `apps/`. */
export function collectSourceFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !TEST_FILE.test(full)) out.push(full);
    }
  };
  for (const top of ['packages', 'apps']) {
    const dir = join(root, top);
    if (existsSync(dir)) walk(dir);
  }
  return out.sort();
}

/** The scope node a declaration belongs to (function body, block, file, …). */
function enclosingScope(node) {
  let current = node.parent;
  while (current) {
    if (
      ts.isSourceFile(current) ||
      ts.isBlock(current) ||
      ts.isModuleBlock(current) ||
      ts.isCaseBlock(current) ||
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isForStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isForInStatement(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/** Resolve a relative import specifier to a repo-relative file path. */
function resolveImport(root, fromFile, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const base = resolve(dirname(fromFile), specifier);
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(root, candidate);
  }
  return relative(root, base);
}

/**
 * Collect every declaration of `t`/`tt` in a file, with the shape that produced
 * it. Kinds: `packHook`, `import`, `localFunction`, `forwarded`, `other`.
 */
function collectBindings(root, file, source) {
  const bindings = [];
  const add = (name, declaration, kind, detail) =>
    bindings.push({
      name,
      kind,
      detail,
      scope: enclosingScope(declaration) ?? source,
      pos: declaration.getStart(source),
    });
  const named = (name) => name === 't' || name === 'tt';

  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const specifier = node.moduleSpecifier.getText(source).slice(1, -1);
      for (const element of node.importClause.namedBindings.elements) {
        if (named(element.name.text)) {
          add(element.name.text, node, 'import', resolveImport(root, file, specifier));
        }
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name && named(node.name.text)) {
      add(node.name.text, node, 'localFunction', 'declared in this file');
    }

    if (ts.isVariableDeclaration(node) && node.initializer) {
      let init = node.initializer;
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || ts.isNonNullExpression(init)) {
        init = init.expression;
      }
      let kind = 'other';
      let detail = ts.SyntaxKind[init.kind];
      if (ts.isCallExpression(init) && ts.isIdentifier(init.expression)) {
        detail = `${init.expression.text}()`;
        if (PACK_HOOK.test(init.expression.text)) kind = 'packHook';
      } else if (ts.isCallExpression(init)) {
        detail = `${init.expression.getText(source)}()`;
      } else if (ts.isIdentifier(init)) {
        // `const { t } = props` — a forwarded translator, same hop as a parameter.
        kind = 'forwarded';
        detail = `destructured from \`${init.text}\``;
      }

      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const property = element.propertyName ? element.propertyName.getText(source) : element.name.getText(source);
          if (property !== 't' && property !== 'tt') continue;
          if (!ts.isIdentifier(element.name)) continue;
          add(element.name.text, node, kind === 'other' ? 'other' : kind, detail);
        }
      } else if (ts.isIdentifier(node.name) && named(node.name.text)) {
        add(node.name.text, node, kind, detail);
      }
    }

    if (ts.isParameter(node)) {
      if (ts.isIdentifier(node.name) && named(node.name.text)) {
        const annotation = node.type ? node.type.getText(source).replace(/\s+/g, ' ') : '';
        add(node.name.text, node, TRANSLATOR_TYPE.test(annotation) ? 'forwarded' : 'other', `parameter: ${annotation || '(untyped)'}`);
      } else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const property = element.propertyName ? element.propertyName.getText(source) : element.name.getText(source);
          if (property !== 't' && property !== 'tt') continue;
          if (!ts.isIdentifier(element.name)) continue;
          // A destructured prop: prefer the member's own type off an inline
          // type literal, else the whole annotation (`SomeProps`).
          let annotation = node.type ? node.type.getText(source).replace(/\s+/g, ' ') : '';
          if (node.type && ts.isTypeLiteralNode(node.type)) {
            for (const member of node.type.members) {
              if (ts.isPropertySignature(member) && member.name.getText(source) === property && member.type) {
                annotation = member.type.getText(source).replace(/\s+/g, ' ');
              }
            }
          }
          add(element.name.text, node, 'forwarded', `prop: ${annotation || '(untyped)'}`);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
  return bindings;
}

/** Nearest binding of `name` visible at `position`: deepest scope, then latest declaration. */
function bindingAt(bindings, source, name, position) {
  let best = null;
  for (const binding of bindings) {
    if (binding.name !== name) continue;
    if (!binding.scope) continue;
    if (position < binding.scope.getStart(source) || position > binding.scope.getEnd()) continue;
    if (!best) {
      best = binding;
      continue;
    }
    const deeper = binding.scope.getStart(source) > best.scope.getStart(source);
    const sameScope = binding.scope === best.scope;
    if (deeper) best = binding;
    else if (sameScope && binding.pos <= position && (best.pos > position || binding.pos > best.pos)) best = binding;
  }
  return best;
}

/** Strip `as`/parenthesis wrappers, which callers use to satisfy the key type. */
function unwrapExpression(node) {
  let current = node;
  while (current && (ts.isAsExpression(current) || ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current))) {
    current = current.expression;
  }
  return current;
}

/** Literal keys a first argument denotes, plus whether any part of it is dynamic. */
function literalKeysOf(argument, source) {
  const keys = [];
  let dynamic = false;
  const read = (node) => {
    if (!node) {
      dynamic = true;
      return;
    }
    const inner = unwrapExpression(node);
    if (inner !== node) {
      read(inner);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      keys.push(node.text);
    } else if (ts.isArrayLiteralExpression(node)) {
      // `tt(['common.total', 'dashboard.total'], 'Total')` — a migration chain.
      for (const element of node.elements) read(element);
    } else if (ts.isConditionalExpression(node)) {
      read(node.whenTrue);
      read(node.whenFalse);
    } else {
      dynamic = true;
    }
  };
  read(argument);
  return { keys, dynamic };
}

/** The literal head of a template key, i.e. everything before the first `${`. */
function staticHead(argument) {
  const inner = unwrapExpression(argument);
  // `t(`ns.${x}` as any)` is the same key shape as `t(`ns.${x}`)`; the cast is
  // there to satisfy a key type, and reading through it is what found the fifth
  // dead template family (`marketplace.disclosure.runtime.`).
  if (!inner || !ts.isTemplateExpression(inner)) return '';
  return inner.head.text;
}

// ── the analysis ─────────────────────────────────────────────────────────────

/**
 * @returns {{ findings: Array, counters: Record<string, number>, enKeyCount: number }}
 */
export function analyze(root) {
  const { leaves, branches } = collectEnKeys(root);
  const resolvesLeaf = (key) => leaves.has(key) || PLURAL_SUFFIXES.some((suffix) => leaves.has(key + suffix));
  // Materialised once, not inside the predicate: spreading a 2.6k-entry Set per
  // candidate head is the shape that made `all-locales-key-parity` quadratic
  // (7.51s -> 25ms once hoisted; see AGENTS.md 测试纪律).
  const everyPath = [...leaves, ...branches];
  const headMatches = (head) => everyPath.some((key) => key.startsWith(head));

  const registeredModules = new Set(EXCLUDED_TRANSLATORS.map((entry) => entry.module));
  const localScopes = EXCLUDED_TRANSLATORS.flatMap((entry) => entry.forwardedScope ?? []);

  const findings = [];
  const counters = {
    filesScanned: 0,
    callSites: 0,
    packCallSites: 0,
    literalKeys: 0,
    resolvedKeys: 0,
    dynamicKeySites: 0,
    probeSites: 0,
    skippedLocalTable: 0,
    skippedNotATranslator: 0,
    skippedMethodCall: 0,
  };

  for (const file of collectSourceFiles(root)) {
    counters.filesScanned += 1;
    const text = readFileSync(file, 'utf8');
    const relPath = relative(root, file).split('\\').join('/');
    const isLocalTableFile = registeredModules.has(relPath);

    // `createSafeTranslation` is the factory every pack-backed hook in this repo
    // is built from. If one is bound to a name this gate would not recognise as
    // a hook, every call through it silently leaves the checked surface — so say
    // so instead of skipping it.
    for (const match of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*createSafeTranslation\s*\(/g)) {
      if (!PACK_HOOK.test(match[1])) {
        const line = text.slice(0, match.index).split('\n').length;
        findings.push({
          reason: 'unrecognised-hook',
          file: relPath,
          line,
          column: 1,
          detail: match[1],
        });
      }
    }

    if (!/\bt\s*\(|\btt\s*\(/.test(text)) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const bindings = collectBindings(root, file, source);

    // A file's provenance: which table its own `t` reaches. A forwarded `t`
    // inherits it, because the parser cannot follow the value across modules.
    let provenance = localScopes.some((dir) => relPath.startsWith(dir)) || isLocalTableFile ? 'local' : null;
    for (const binding of bindings) {
      if (binding.kind === 'packHook' && provenance === null) provenance = 'pack';
      if (binding.kind === 'import' && registeredModules.has(binding.detail)) provenance = 'local';
    }

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        let name = null;
        let isMethod = false;
        if (ts.isIdentifier(callee)) name = callee.text;
        else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name) && callee.name.text === 't') {
          name = 't';
          isMethod = true;
        }

        if (name === 't' || name === 'tt') {
          counters.callSites += 1;
          const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
          const at = { file: relPath, line: line + 1, column: character + 1 };

          if (isMethod) {
            // `someObject.t(...)` — the receiver's type is unknowable here.
            counters.skippedMethodCall += 1;
            ts.forEachChild(node, visit);
            return;
          }

          const binding = bindingAt(bindings, source, name, node.getStart(source));
          const kind = binding ? binding.kind : 'forwarded'; // no declaration in this file = it came from outside

          if (kind === 'import' && !registeredModules.has(binding.detail)) {
            findings.push({ reason: 'unregistered-translator', ...at, detail: binding.detail });
            ts.forEachChild(node, visit);
            return;
          }
          if (kind === 'import' || kind === 'localFunction' || (kind === 'forwarded' && provenance === 'local')) {
            counters.skippedLocalTable += 1;
            ts.forEachChild(node, visit);
            return;
          }
          if (kind === 'other') {
            counters.skippedNotATranslator += 1;
            ts.forEachChild(node, visit);
            return;
          }

          // PACK: `packHook`, or a forwarded translator in a non-local file.
          counters.packCallSites += 1;

          let isProbe = false;
          let returnsObjects = false;
          for (const argument of node.arguments.slice(1)) {
            if (!ts.isObjectLiteralExpression(argument)) continue;
            for (const property of argument.properties) {
              if (!ts.isPropertyAssignment(property)) continue;
              if (ts.isComputedPropertyName(property.name) && PROBE_FLAG_NAMES.test(property.name.expression.getText(source))) {
                isProbe = true;
              }
              if (
                ts.isIdentifier(property.name) &&
                property.name.text === 'returnObjects' &&
                property.initializer.kind === ts.SyntaxKind.TrueKeyword
              ) {
                returnsObjects = true;
              }
            }
          }
          if (isProbe) {
            // Deliberate convention-key miss — excluded by the flag, not by path.
            counters.probeSites += 1;
            ts.forEachChild(node, visit);
            return;
          }

          const argument = node.arguments[0];
          const { keys, dynamic } = literalKeysOf(argument, source);
          for (const key of keys) {
            counters.literalKeys += 1;
            if (resolvesLeaf(key) || (returnsObjects && branches.has(key))) counters.resolvedKeys += 1;
            else findings.push({ reason: 'missing-key', ...at, detail: key });
          }
          if (dynamic) {
            counters.dynamicKeySites += 1;
            const head = staticHead(argument);
            if (head && !headMatches(head)) {
              findings.push({ reason: 'missing-prefix', ...at, detail: head });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { findings, counters, enKeyCount: leaves.size };
}

// ── baseline ─────────────────────────────────────────────────────────────────

export function readBaseline(root) {
  const file = join(root, 'scripts/i18n-call-site-key-baseline.json');
  if (!existsSync(file)) return { missingKeys: {}, missingPrefixes: {} };
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  return { missingKeys: parsed.missingKeys ?? {}, missingPrefixes: parsed.missingPrefixes ?? {} };
}

/**
 * Split findings against the baseline. `unexpected` fails the build; `stale`
 * fails it too — a baseline entry whose defect is gone must be deleted, so the
 * file can only shrink.
 */
export function applyBaseline(findings, baseline) {
  const unexpected = [];
  const seenKeys = new Set();
  const seenPrefixes = new Set();

  for (const finding of findings) {
    if (finding.reason === 'missing-key' && Object.hasOwn(baseline.missingKeys, finding.detail)) {
      seenKeys.add(finding.detail);
      continue;
    }
    if (finding.reason === 'missing-prefix' && Object.hasOwn(baseline.missingPrefixes, finding.detail)) {
      seenPrefixes.add(finding.detail);
      continue;
    }
    unexpected.push(finding);
  }

  const stale = [
    ...Object.keys(baseline.missingKeys).filter((key) => !seenKeys.has(key)).map((key) => ({ kind: 'missingKeys', entry: key })),
    ...Object.keys(baseline.missingPrefixes).filter((p) => !seenPrefixes.has(p)).map((entry) => ({ kind: 'missingPrefixes', entry })),
  ];

  return { unexpected, stale };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const HINTS = {
  'missing-key':
    'The key exists in no locale pack. Add it to `packages/i18n/src/locales/en.ts`' +
    ' — that is the source of truth, and adding it there makes' +
    ' `packages/i18n/src/__tests__/all-locales-key-parity.test.ts` demand the same key' +
    ' in the other nine packs, which is the point. An inline' +
    ' `t(key, { defaultValue: "…" })` is NOT a fix: it renders English at this one' +
    ' call site and leaves the string untranslatable everywhere (objectui#3517).',
  'missing-prefix':
    'No key in `en` begins with this template literal\'s static head, so every value the' +
    ' substitution can take is missing. Add the whole family to' +
    ' `packages/i18n/src/locales/en.ts`.',
  'unregistered-translator':
    'This file imports a `t` from a module this gate does not know. If that module is a' +
    ' pack-backed re-export, it should be called through a `use*Translation` hook so its' +
    ' keys are checked; if it is a module-local label table like' +
    ' `packages/app-shell/src/views/metadata-admin/i18n.ts`, register it in' +
    ' EXCLUDED_TRANSLATORS with a reason.',
  'unrecognised-hook':
    '`createSafeTranslation(...)` bound to a name outside the `use*Translation` /' +
    ' `use*Translate` / `use*T` convention. Every call through it would leave this' +
    ' gate\'s checked surface silently — rename it to the convention.',
};

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const root = resolve(scriptDir, '..');
  const { findings, counters, enKeyCount } = analyze(root);

  // Guard against a refactor quietly emptying the comparison: with no keys and
  // no call sites every assertion below is trivially satisfied. Same reason
  // `all-locales-key-parity.test.ts` opens with a size assertion.
  if (enKeyCount < 2000 || counters.packCallSites < 1000) {
    console.error(
      `The scan collapsed: ${enKeyCount} en keys and ${counters.packCallSites} pack-backed call sites.` +
        ' Expected thousands of both — the extractor or the file walk is broken, and an' +
        ' empty comparison would pass while asserting nothing.',
    );
    process.exit(1);
  }

  const { unexpected, stale } = applyBaseline(findings, readBaseline(root));

  console.log(
    `Scanned ${counters.filesScanned} files, ${counters.callSites} t()/tt() call sites: ` +
      `${counters.packCallSites} pack-backed (${counters.resolvedKeys}/${counters.literalKeys} literal keys resolve), ` +
      `${counters.dynamicKeySites} dynamic-key (report-only), ${counters.probeSites} probe-flagged, ` +
      `${counters.skippedLocalTable} module-local table, ${counters.skippedNotATranslator} not a translator, ` +
      `${counters.skippedMethodCall} method call.`,
  );

  if (unexpected.length === 0 && stale.length === 0) {
    console.log(`Every in-scope call-site key resolves against the en pack (${enKeyCount} keys).`);
    process.exit(0);
  }

  if (unexpected.length > 0) {
    const distinct = new Set(unexpected.map((f) => `${f.reason} :: ${f.detail}`));
    console.error(
      `\n${unexpected.length} call site${unexpected.length === 1 ? '' : 's'} reference${unexpected.length === 1 ? 's' : ''} ` +
        `a key the en pack does not define (${distinct.size} distinct):`,
    );
    for (const finding of unexpected) {
      console.error(`  ${finding.file}:${finding.line}:${finding.column}  [${finding.reason}]  ${finding.detail}`);
    }
    for (const reason of Object.keys(HINTS)) {
      if (unexpected.some((finding) => finding.reason === reason)) console.error(`\n${reason}: ${HINTS[reason]}`);
    }
  }

  if (stale.length > 0) {
    console.error(
      `\n${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} stale — the defect is gone, so the` +
        ' entry must go too (this file is a ratchet; it only shrinks):',
    );
    for (const entry of stale) console.error(`  ${entry.kind}: ${entry.entry}`);
  }

  console.error('\nSee the header of scripts/check-i18n-call-site-keys.mjs.');
  process.exit(1);
}
