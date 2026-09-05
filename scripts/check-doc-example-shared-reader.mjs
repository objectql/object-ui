#!/usr/bin/env node
// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * A doc comment must not PRESCRIBE a call-site spelling that a published shared
 * reader already owns.
 *
 * Run:  node scripts/check-doc-example-shared-reader.mjs   (also `pnpm check:doc-example-readers`)
 *       node scripts/check-doc-example-shared-reader.mjs --list   (every pair this gate compared)
 * Exit: 0 = no `@example` hand-spells a reader its own call sites delegate to,
 *       1 = at least one does, or the scan collapsed.
 *
 * ## The gap this closes (objectui#7652)
 *
 * A JSDoc `@example` on an exported hook or helper is not decoration: call sites
 * copy it. When the ruling the example encoded moves, the prose stays — and every
 * later copy is seeded from the prose, not from the code. Fixing the call sites
 * without fixing the prose re-seeds them.
 *
 * Measured cost before this gate existed: two cards and three copied call sites.
 *
 *   objectui#7627  `useSettledSchema`'s `@example` spelled the record-source
 *                  ladder inline (`dataConfig?.provider === 'object' ? …`). Six
 *                  view plugins carried their own copy of it, drifted three ways.
 *   objectui#7638  `useNavigationOverlay`'s `@example` passed the bare
 *                  `schema.objectName`. Three components copied that line while
 *                  resolving their record source the other way in the same file.
 *
 * Both were closed by pointing the prose at `resolveRecordSourceObjectName` from
 * `@object-ui/core` — the ONE reader objectui#7627 published for that ladder.
 * Nothing in CI could see either one.
 *
 * ## What this gate answers, and what it deliberately does NOT
 *
 * It answers exactly one question:
 *
 *   **when the real in-repo call sites of a documented symbol obtain an argument
 *   by CALLING a shared reader, does the symbol's own `@example` obtain it the
 *   same way — or does it still hand-spell what that reader owns?**
 *
 * It does NOT answer, on purpose, and each of these is a real limit rather than
 * an oversight:
 *
 *   1. **Whether the spelling a doc comment prescribes is CORRECT.** That is a
 *      ruling, and a ruling is not in the tree. Both instances above were, on the
 *      day they were filed, in a state where the prose and every copy of it
 *      AGREED — nothing in the repository disagreed with the doc comment, so no
 *      gate reading only the tree could have known the prose was wrong. What this
 *      gate catches is the state immediately AFTER: the call sites move to the
 *      shared reader and the prose does not. That transition is the moment the
 *      prose becomes a seed, and it is the one the two cards above both name.
 *   2. **Prose outside a fenced `@example`.** A `@param` line that prescribes a
 *      spelling in running text is the same defect (objectui#7627's did), but the
 *      fence is where a copier's cursor goes and it is the part that parses.
 *      Extending to `@param` needs a way to tell a prescription from an aside,
 *      and guessing that boundary is what produces a gate people learn to ignore.
 *   3. **Documentation under `content/docs/**`.** That surface belongs to
 *      `check-doc-snippet-types.mjs` (does the snippet still compile) and
 *      `check-doc-component-types.mjs` (does the `type` it names exist). This
 *      gate reads doc comments in `packages/<pkg>/src` only.
 *   4. **A reader nobody calls yet.** The trigger is a real call site, not the
 *      existence of a helper. A shared reader published this morning with no
 *      consumer says nothing about any doc comment.
 *   5. **Whether the reader the call sites use is the RIGHT reader.** It compares
 *      the doc against the call sites; it does not grade either against a spec.
 *
 * ## Why this is not `check-spec-symbol-derivation.mjs` (objectui#7617 was
 * mis-cited for this class, twice)
 *
 * That gate's rule 4 judges citations of `@objectstack/spec` at MEMBER
 * granularity — a docblock naming `NavigationConfigSchema.zzzNotARealMember`
 * fails it. Measured on `useNavigationOverlay.ts`, which carried objectui#7638's
 * instance: baseline exit 0 with zero mentions of the file; plant a dangling spec
 * member in that same doc block and it goes to exit 1 naming the file. So it DOES
 * read the file — it simply has nothing to say about prose that prescribes a
 * LOCAL spelling and cites no spec symbol. The zero was a reading, not a dead
 * instrument, and objectui#7638's card and the dispatch that followed it both
 * recorded the coverage anyway. This file is the gate that was missing.
 *
 * ## The narrowing, stated as a rule
 *
 * A finding needs all four of these to hold at once:
 *
 *   a. an exported symbol `S` in `packages/<pkg>/src` whose JSDoc carries a fenced
 *      `ts`/`tsx` `@example` that CALLS `S`;
 *   b. at least one real in-repo call site of `S`, outside `S`'s own file, whose
 *      expression for the same argument slot CALLS an exported single-`return`
 *      reader `R`;
 *   c. the `@example`'s expression for that slot does NOT call `R`;
 *   d. that expression is structurally what `R` itself resolves — equal to `R`'s
 *      whole return expression, or to one of its RUNGS (the branches of its
 *      conditional, the operands of its `??`/`||` chain), written with `R`'s own
 *      parameter spellings.
 *
 * (d) is what keeps this off ordinary examples. A doc comment is allowed to pass
 * a literal, a placeholder, or a locally-named variable where a call site passes
 * something else — that is what an example is for. It is not allowed to spell out
 * the body of the reader its callers delegate to, because that spelling is the
 * thing that gets copied.
 *
 * Local `const` bindings are inlined one level on both sides before comparison,
 * because both sides of every real instance were written that way:
 * `const schemaKey = resolveRecordSourceObjectName(schema, dataConfig)` at the
 * call site, and the same shape in the example.
 *
 * ## Rollout
 *
 * `KNOWN_HAND_SPELLINGS` below is empty and is an allowlist that only shrinks: an
 * entry is a live defect with a card, never a waiver. It exists so that a first
 * run finding real instances cannot force the prose fixes into the same PR as the
 * gate — the same shape `scripts/__tests__/network-escape-ledger.test.ts` uses.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { TOOLING_FILE, listSourceFiles } from './check-phantom-dependencies.mjs';
import { isEntrypoint } from './invoked-as.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * Doc comments known to hand-spell a reader their call sites delegate to, each
 * with the card that decides the prose.
 *
 * Empty is the healthy state. An entry is an admission that a doc comment is
 * live seed text, not a decision that it is fine — so it carries a card, and it
 * comes out when that card lands. The key is `file::symbol::slot`.
 */
export const KNOWN_HAND_SPELLINGS = new Map([]);

/** Packages are the population: this gate reads doc comments that ship. */
export function populationFiles(root) {
  const packagesDir = resolve(root, 'packages');
  const files = [];
  let entries;
  try {
    entries = readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const src = join(packagesDir, entry.name, 'src');
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of listSourceFiles(src)) {
      const rel = relative(root, file).split(sep).join('/');
      if (TOOLING_FILE.test(rel)) continue;
      if (rel.endsWith('.d.ts')) continue;
      files.push(file);
    }
  }
  return files;
}

export function parseSource(text, fileName) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/**
 * The canonical form two expressions are compared in.
 *
 * Optional chaining is erased because it is a null-safety choice, not a
 * different read: the reader below returns `schema?.objectName` while every
 * copy of it in the tree wrote `schema.objectName`, and treating those as
 * different expressions would make the gate blind to the exact instance it
 * exists for. Parens and non-null assertions go for the same reason.
 */
export function canonical(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\?\./g, '.')
    .replace(/!\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does this expression text call `name`? Asked of text, so an inlined alias counts. */
export function callsFunction(text, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(String(text));
}

/**
 * Every exported function whose body is exactly one `return`, with the rungs it
 * resolves between.
 *
 * A single-`return` export is this repository's shape for "the one spelling of a
 * resolution" — `resolveRecordSourceObjectName` is one line. A helper with
 * statements in it is doing something an example could not be hand-spelling in a
 * single argument, so it is not a candidate here.
 */
export function readersIn(sourceFile, relPath) {
  const readers = [];
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const exported = (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const statements = node.body.statements;
      if (exported && statements.length === 1 && ts.isReturnStatement(statements[0]) && statements[0].expression) {
        const expression = statements[0].expression;
        readers.push({
          name: node.name.text,
          file: relPath,
          params: node.parameters.map((p) => p.name.getText()),
          body: canonical(expression.getText()),
          rungs: rungsOf(expression),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return readers;
}

/**
 * The alternatives a reader resolves BETWEEN — the thing a hand copy writes out
 * one of. For `a ? b : c` those are `b` and `c`; for `a ?? b` they are `a` and
 * `b`; nested chains contribute each leaf. The whole expression is always a rung
 * of itself, which is how a copy of the entire body is caught.
 */
export function rungsOf(expression) {
  const out = new Set([canonical(expression.getText())]);
  const walk = (node) => {
    if (ts.isParenthesizedExpression(node)) return walk(node.expression);
    if (ts.isConditionalExpression(node)) {
      walk(node.whenTrue);
      walk(node.whenFalse);
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      walk(node.left);
      walk(node.right);
      return;
    }
    out.add(canonical(node.getText()));
  };
  walk(expression);
  return [...out];
}

/** `@example` fences, with the JSDoc line prefix removed so the code parses. */
export function exampleFences(jsdocText) {
  const body = jsdocText
    .replace(/^\s*\/\*\*/, '')
    .replace(/\*\/\s*$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n');
  if (!body.includes('@example')) return [];
  return [...body.matchAll(/```(?:tsx?|jsx?|typescript)\n([\s\S]*?)```/g)].map((m) => m[1]);
}

/** Argument slots of one call: named for an options object, `#i` for positional. */
export function slotsOf(call) {
  const slots = new Map();
  call.arguments.forEach((argument, index) => {
    if (ts.isObjectLiteralExpression(argument)) {
      for (const property of argument.properties) {
        if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
          slots.set(property.name.text, property.initializer.getText());
        } else if (ts.isShorthandPropertyAssignment(property)) {
          slots.set(property.name.text, property.name.text);
        }
      }
      return;
    }
    slots.set(`#${index}`, argument.getText());
  });
  return slots;
}

/** `const NAME = <expr>;` bindings visible from `node`, innermost first. */
export function bindingsFor(node) {
  const bindings = new Map();
  const scopes = [];
  for (let current = node; current; current = current.parent) {
    if (ts.isBlock(current) || ts.isSourceFile(current) || ts.isModuleBlock(current)) scopes.push(current);
  }
  for (const scope of scopes.reverse()) {
    for (const statement of scope.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          bindings.set(declaration.name.text, declaration.initializer.getText());
        }
      }
    }
  }
  return bindings;
}

/**
 * Substitute local `const` aliases INTO the expression, two passes deep.
 *
 * Token-level rather than whole-expression, because both sides of every real
 * instance wrap the alias in something: the call site writes
 * `useSettledSchema(schemaKey ?? '', ...)` while `schemaKey` is where the
 * resolution actually lives. A whole-expression substitution sees `schemaKey ??
 * ''`, finds no binding for it, and the resolution stays invisible — measured:
 * objectui#7627's own instance is silent without this.
 *
 * A name is substituted at most once per run, so a self-referential binding
 * (`const x = x ?? y`) terminates instead of expanding forever.
 */
export function inline(expression, bindings) {
  let text = String(expression);
  const used = new Set();
  for (let pass = 0; pass < 2; pass += 1) {
    let changed = false;
    for (const [name, value] of bindings) {
      if (used.has(name)) continue;
      const token = new RegExp(`\\b${name}\\b`);
      if (!token.test(text)) continue;
      // Not a substitution when the name is being CALLED — `foo(x)` names a
      // function, and replacing it with the function's own initializer would
      // fabricate an expression nothing in the tree wrote.
      if (new RegExp(`\\b${name}\\s*\\(`).test(text)) continue;
      used.add(name);
      text = text.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${value})`);
      changed = true;
    }
    if (!changed) break;
  }
  return text;
}

export function analyze(root) {
  const files = populationFiles(root);
  const counters = { files: files.length, readers: 0, documented: 0, compared: 0, callSites: 0 };
  const parsed = new Map();
  const readers = new Map();

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = relative(root, file).split(sep).join('/');
    const sourceFile = parseSource(text, rel);
    parsed.set(rel, sourceFile);
    for (const reader of readersIn(sourceFile, rel)) {
      if (!readers.has(reader.name)) readers.set(reader.name, reader);
    }
  }
  counters.readers = readers.size;

  // Exported symbols whose own `@example` calls them.
  const documented = new Map();
  for (const [rel, sourceFile] of parsed) {
    const visit = (node) => {
      let name = null;
      if (ts.isFunctionDeclaration(node) && node.name) name = node.name.text;
      else if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0];
        if (declaration && ts.isIdentifier(declaration.name)) name = declaration.name.text;
      }
      if (name && !documented.has(name)) {
        const exported = (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (exported) {
          for (const doc of ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc)) {
            for (const fence of exampleFences(doc.getText())) {
              const fenceFile = parseSource(fence, 'example.tsx');
              let call = null;
              const find = (n) => {
                if (!call && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name) {
                  call = n;
                }
                ts.forEachChild(n, find);
              };
              ts.forEachChild(fenceFile, find);
              if (!call) continue;
              const bindings = bindingsFor(call);
              const slots = new Map();
              for (const [slot, expression] of slotsOf(call)) slots.set(slot, inline(expression, bindings));
              documented.set(name, { file: rel, slots });
              break;
            }
            if (documented.has(name)) break;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }
  counters.documented = documented.size;

  // Real call sites of those symbols, outside the file that declares them.
  const callSites = new Map();
  for (const [rel, sourceFile] of parsed) {
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const target = documented.get(name);
        if (target && target.file !== rel) {
          const bindings = bindingsFor(node);
          const slots = new Map();
          for (const [slot, expression] of slotsOf(node)) slots.set(slot, inline(expression, bindings));
          if (!callSites.has(name)) callSites.set(name, []);
          callSites.get(name).push({ file: rel, slots });
          counters.callSites += 1;
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  const findings = [];
  const compared = [];
  for (const [name, doc] of documented) {
    const sites = callSites.get(name) ?? [];
    if (!sites.length) continue;
    for (const [slot, docExpression] of doc.slots) {
      const delegating = new Map();
      for (const site of sites) {
        const siteExpression = site.slots.get(slot);
        if (siteExpression === undefined) continue;
        for (const reader of readers.values()) {
          if (reader.name === name) continue;
          if (callsFunction(siteExpression, reader.name)) {
            if (!delegating.has(reader.name)) delegating.set(reader.name, []);
            delegating.get(reader.name).push(site.file);
          }
        }
      }
      if (!delegating.size) continue;
      counters.compared += 1;
      for (const [readerName, users] of delegating) {
        const reader = readers.get(readerName);
        compared.push({ symbol: name, slot, reader: readerName, users: users.length });
        if (callsFunction(docExpression, readerName)) continue;
        const handSpelled = reader.rungs.find((rung) => canonicalContains(docExpression, rung));
        if (!handSpelled) continue;
        const key = `${doc.file}::${name}::${slot}`;
        if (KNOWN_HAND_SPELLINGS.has(key)) continue;
        findings.push({
          key,
          file: doc.file,
          symbol: name,
          slot,
          docExpression: canonical(docExpression),
          reader: readerName,
          readerFile: reader.file,
          handSpelled,
          users,
        });
      }
    }
  }
  return { findings, counters, compared };
}

/**
 * Is `rung` the whole of this expression, or one of the alternatives it resolves
 * between? Asked structurally rather than by substring, so a reader rung of
 * `schema.objectName` does not fire on an unrelated `otherSchema.objectName`.
 */
export function canonicalContains(expressionText, rung) {
  const parsedExpression = parseSource(`const __probe = (${expressionText});`, 'probe.tsx');
  const statement = parsedExpression.statements[0];
  if (!ts.isVariableStatement(statement)) return false;
  const initializer = statement.declarationList.declarations[0]?.initializer;
  if (!initializer) return false;
  let hit = false;
  const walk = (node) => {
    if (hit) return;
    if (canonical(node.getText()) === rung) {
      hit = true;
      return;
    }
    ts.forEachChild(node, walk);
  };
  walk(initializer);
  return hit;
}

const invokedDirectly = isEntrypoint(import.meta.url);

if (invokedDirectly) {
  const argOf = (name) => {
    const index = process.argv.indexOf(name);
    return index > -1 ? process.argv[index + 1] : null;
  };
  const root = resolve(argOf('--root') ?? resolve(scriptDir, '..'));
  const { findings, counters, compared } = analyze(root);

  if (process.argv.includes('--list')) {
    for (const entry of compared) {
      console.log(`${entry.symbol}.${entry.slot} <- ${entry.reader}  (${entry.users} call site(s))`);
    }
  }

  // A refactor that quietly emptied the walk would satisfy every assertion in the
  // pin while checking nothing — the same size guard the sibling gates open with.
  if (counters.files < 200 || counters.readers < 5 || counters.documented < 5) {
    console.error(
      `The scan collapsed: ${counters.files} source file(s), ${counters.readers} single-return export(s), ` +
        `${counters.documented} documented symbol(s) whose @example calls them. An empty comparison would ` +
        'pass while asserting nothing.',
    );
    process.exit(1);
  }

  if (!findings.length) {
    console.log(
      `OK  ${counters.documented} documented symbol(s), ${counters.callSites} call site(s), ` +
        `${counters.compared} slot(s) where a call site delegates to a shared reader — no @example hand-spells one.`,
    );
    process.exit(0);
  }

  console.error(
    `x  ${findings.length} doc comment(s) prescribe a spelling a shared reader already owns:\n`,
  );
  for (const finding of findings) {
    console.error(
      `      ${finding.file}  ${finding.symbol}({ ${finding.slot}: ${finding.docExpression} })\n` +
        `          ${finding.users.length} call site(s) pass this slot through ${finding.reader}() ` +
        `(${finding.readerFile}); the example still writes \`${finding.handSpelled}\`, which is what that ` +
        `reader resolves.\n` +
        `          Call sites: ${finding.users.join(', ')}`,
    );
  }
  console.error(
    '\nThe example is what the next call site is copied from, so prose that outlives the ruling re-seeds\n' +
      'the copies (objectui#7627, objectui#7638). Point the example at the reader, or add the key to\n' +
      'KNOWN_HAND_SPELLINGS in scripts/check-doc-example-shared-reader.mjs with the card that decides it.',
  );
  process.exit(1);
}
