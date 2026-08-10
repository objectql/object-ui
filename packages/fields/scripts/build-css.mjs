/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Builds `dist/index.css` from `src/index.css` — the file `@object-ui/fields`
 * has always PROMISED via its `"./style.css"` export and never once shipped.
 *
 * ## What was wrong (objectui#4059)
 *
 * `packages/fields/package.json` declared `"./style.css": "./dist/index.css"`
 * while `scripts.build` was `tsc && vite build` and `src` held no `.css` file
 * at all, so Vite's library build had nothing to extract. Every published
 * tarball up to and including 17.3.0 contains ZERO `.css` files (measured over
 * the full `tar -tzf` listing), which means a consumer's
 * `@import '@object-ui/fields/style.css'` did not merely render badly — it
 * failed to resolve and took their build down with it.
 *
 * ## Why the file has to exist rather than the export be deleted
 *
 * Deleting the export was the cheaper fix and was ruled out on a measurement:
 * fields' class surface is NOT a subset of what `@object-ui/components`'
 * published sheet carries. Compiling fields' own source against components'
 * theme and diffing against `@object-ui/components@17.3.0`'s published
 * `dist/index.css` leaves 155 classes that exist only here — `cursor-crosshair`
 * (SignatureField), `group/email` (index.tsx), the whole tag colour map
 * (`text-indigo-700`, `bg-pink-50`, …), `min-w-[8ch]` (TagsField),
 * `hover:fill-yellow-500` (RatingField), and so on.
 *
 * 17 of those depend on the ObjectUI `@theme` block, which lives in
 * `packages/components/src/index.css` and is NOT published (that package ships
 * `dist` only). `bg-primary/20`, `hover:bg-accent/30`, `ring-destructive/50`
 * and friends therefore have exactly one possible producer in the world: a
 * build inside this monorepo that can see that theme. No amount of consumer-side
 * `@source` configuration can regenerate them.
 *
 * ## The "narrow" shape, and why it is not just `@import 'tailwindcss'`
 *
 * The naive fix — give fields a normal Tailwind entry — re-emits preflight, the
 * theme and ~1350 utilities the consumer already got from
 * `@object-ui/components/style.css`, i.e. ~180 kB of near-pure duplication. The
 * same objection retired two `@source` lines from the quick-start guide in
 * objectui#3884 for costing 100 kB and buying 14 selectors; it applies with more
 * force to a stylesheet we ship ourselves.
 *
 * So this build emits the DIFFERENCE and nothing else:
 *
 *   1. `src/index.css` `@reference`s components' entry — theme tokens, the
 *      class-based `dark` variant and the animate plugin become available for
 *      resolution while emitting nothing — and imports only the utilities
 *      layer, so there is no preflight and no `:root` theme block to begin with.
 *   2. This script compiles components' stylesheet too, in-process, and
 *      subtracts every rule that sheet already ships.
 *
 * The result is a supplement of a few kB. It is only correct when loaded AFTER
 * the components sheet, which is what the `exports` docs and the guides now say.
 *
 * ## The coupling, stated plainly
 *
 * `src/index.css` `@reference`s `packages/components/src/index.css` over a
 * build-time relative path, and this script reads that package's BUILT
 * `dist/index.css`. Both are inside the monorepo and neither is reachable from
 * the published tarball — the same shape of coupling `@object-ui/components`'
 * own `scripts/build-css.mjs` has to its `src/index.css`, one directory further
 * away. Nothing in the published artifact refers to either path.
 *
 * Reading components' built artifact rather than re-compiling its entry is
 * deliberate: it is by definition "what the consumer already has", and it is
 * not sensitive to the working directory. Re-compiling was tried first and is
 * subtly wrong — Tailwind's automatic source detection resolves against the
 * process cwd, so compiling components' entry from THIS package's directory
 * scanned `packages/fields` and folded fields' own classes into the set being
 * subtracted. Every fields-only rule then looked "already shipped" and the
 * verification below, which trusts that set, could not see it.
 *
 * ## Failure modes this script refuses to have
 *
 * A subtraction that drops too much would silently ship an under-styled
 * package — exactly the defect being fixed, wearing a green build. Three
 * assertions run BEFORE the file is written, and each throws rather than
 * writing a wrong sheet: every rule must be accounted for, the subtraction must
 * have removed something, and the utilities that only this build can produce
 * must still be present.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const componentsRoot = resolve(root, '../components');

const input = resolve(root, 'src/index.css');
const output = resolve(root, 'dist/index.css');
/**
 * The stylesheet a consumer already has from `@object-ui/components/style.css`
 * — that package's real build output, not a re-derivation of it.
 */
const componentsSheetPath = resolve(componentsRoot, 'dist/index.css');

async function compile(file) {
  const css = await readFile(file, 'utf8');
  const result = await postcss([tailwindPostcss()]).process(css, { from: file, to: output });
  return postcss.parse(result.css, { from: file });
}

/**
 * `var(--x, <fallback>)` -> `var(--x)`, at any nesting depth.
 *
 * Tailwind inlines a fallback for every theme variable whose declaration is not
 * emitted in the same sheet. Ours never are — that is the entire point of the
 * `@reference` entry — so `.rounded-md` compiles here to
 * `var(--radius-md, calc(var(--radius) - 2px))` and in components' sheet to
 * `var(--radius-md)`. Same rule, same computed value once the components sheet
 * is loaded, different bytes. Comparing raw text therefore finds ~750 spurious
 * differences and keeps the whole duplicate sheet.
 *
 * Normalisation is applied ONLY to the comparison key; the emitted CSS keeps its
 * fallbacks, so a rule that does survive still degrades sensibly on its own.
 * Hand-written rather than a regex because the fallbacks nest (`calc(var(…))`,
 * `hsl(var(…))`) and a regex cannot match balanced parentheses.
 */
function stripVarFallbacks(value) {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    if (!value.startsWith('var(', i)) {
      out += value[i];
      continue;
    }
    // Find this var()'s matching close paren, and the top-level comma inside it.
    let depth = 0;
    let comma = -1;
    let end = -1;
    for (let j = i + 3; j < value.length; j += 1) {
      const ch = value[j];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      } else if (ch === ',' && depth === 1 && comma === -1) comma = j;
    }
    if (end === -1) {
      out += value.slice(i);
      break;
    }
    const name = value.slice(i + 4, comma === -1 ? end : comma).trim();
    out += `var(${name})`;
    i = end;
  }
  return out;
}

/**
 * The at-rule context a node sits in, as a stable string — `@media (…)` and
 * `@layer utilities` and so on, outermost first.
 *
 * Without this, `.lg\:max-w-5xl` inside `@media (min-width:64rem)` and a
 * hypothetical top-level rule with the same selector would collide, and the
 * subtraction could drop a responsive variant because an unrelated base rule
 * matched. Keys are compared, never parsed, so the exact spelling only has to
 * be consistent between the two compilations — and both come from the same
 * Tailwind version in the same process.
 */
function contextOf(node) {
  const parts = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
    parts.unshift(p.type === 'atrule' ? `@${p.name} ${(p.params ?? '').trim()}`.trim() : String(p.selector ?? ''));
  }
  return parts.join(' > ');
}

/** A rule's declarations, normalised so formatting differences cannot matter. */
function bodyOf(rule) {
  return rule.nodes
    .map((n) =>
      n.type === 'decl'
        ? `${n.prop}:${stripVarFallbacks(String(n.value).trim())}${n.important ? '!important' : ''}`
        : stripVarFallbacks(n.toString().replace(/\s+/g, ' ').trim()),
    )
    .join(';');
}

const ruleKey = (rule) => `${contextOf(rule)}||${rule.selector.trim()}`;
/** Whole-node identity for at-rules that carry no selector (`@property`, `@keyframes`). */
const atRuleKey = (at) => `${contextOf(at)}||@${at.name} ${(at.params ?? '').trim()}`.trim();
const normalise = (node) => stripVarFallbacks(node.toString().replace(/\s+/g, ' ').trim());

/** Class names a selector targets, with CSS escapes resolved (`.min-w-\[8ch\]` -> `min-w-[8ch]`). */
function classesIn(selector) {
  const found = [];
  const re = /\.((?:\\.|[^\s.,>+~()[\]:#*'"\\])+)/g;
  let m;
  while ((m = re.exec(selector))) {
    found.push(
      m[1]
        .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/\\(.)/g, '$1'),
    );
  }
  return found;
}

/**
 * Utilities that MUST survive the subtraction, spanning both reasons a rule can
 * be fields-only.
 *
 * The first three resolve `@theme` tokens that `@object-ui/components` declares
 * but does not publish, so this build is the only producer they can ever have —
 * if the subtraction over-reaches, these are what silently disappear and no test
 * that renders a field in this repo would notice (every in-repo host compiles
 * fields' source directly and never loads this sheet). The last three are plain
 * utilities that simply are not in components' sheet.
 *
 * Deliberately a handful of named specimens, not a count: a threshold would have
 * to be re-tuned every time a widget gains a class, and the edit that silences a
 * real regression would look exactly like the edit that keeps it current.
 */
const MUST_SURVIVE = [
  'bg-primary/20',
  'hover:bg-accent/30',
  'ring-destructive/50',
  'cursor-crosshair',
  'min-w-[8ch]',
  'hover:fill-yellow-500',
];

/** Everything the components sheet already provides, indexed for lookup. */
function indexSheet(rootNode) {
  const rules = new Map();
  const atRules = new Map();
  rootNode.walkRules((rule) => {
    const key = ruleKey(rule);
    if (!rules.has(key)) rules.set(key, new Set());
    rules.get(key).add(bodyOf(rule));
  });
  rootNode.walkAtRules((at) => {
    // Container at-rules are represented by the rules inside them, via contextOf.
    if (at.nodes?.some((n) => n.type === 'rule')) return;
    const key = atRuleKey(at);
    if (!atRules.has(key)) atRules.set(key, new Set());
    atRules.get(key).add(normalise(at));
  });
  return { rules, atRules };
}

const fieldsSheet = await compile(input);

let componentsSheet;
try {
  componentsSheet = postcss.parse(await readFile(componentsSheetPath, 'utf8'), { from: componentsSheetPath });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  throw new Error(
    [
      `@object-ui/components has not been built: ${componentsSheetPath} does not exist.`,
      '',
      'This build subtracts the utilities that package already ships, so it needs that sheet to',
      'exist before it can decide what is left over. `turbo run build` orders this correctly via',
      "the `build` task's `dependsOn: [\"^build\"]`; a bare single-package build does not.",
      '',
      '  pnpm --filter @object-ui/components build',
    ].join('\n'),
  );
}

const shipped = indexSheet(componentsSheet);

// Snapshot the full compilation BEFORE mutating it, so the verification below
// has something independent to check the survivors against.
const fullRules = [];
fieldsSheet.walkRules((rule) => fullRules.push({ key: ruleKey(rule), body: bodyOf(rule), selector: rule.selector.trim() }));

let droppedRules = 0;
let droppedAtRules = 0;

fieldsSheet.walkRules((rule) => {
  if (shipped.rules.get(ruleKey(rule))?.has(bodyOf(rule))) {
    rule.remove();
    droppedRules += 1;
  }
});

fieldsSheet.walkAtRules((at) => {
  if (at.nodes?.some((n) => n.type === 'rule')) return;
  if (shipped.atRules.get(atRuleKey(at))?.has(normalise(at))) {
    at.remove();
    droppedAtRules += 1;
  }
});

// Drop at-rule shells the subtraction emptied out (`@media` wrappers whose every
// rule was already shipped), innermost first.
let pruned = true;
while (pruned) {
  pruned = false;
  fieldsSheet.walkAtRules((at) => {
    if (at.nodes && at.nodes.length === 0) {
      at.remove();
      pruned = true;
    }
  });
}

// ---------------------------------------------------------------------------
// Verification: nothing may go missing.
// ---------------------------------------------------------------------------
const survivors = new Set();
fieldsSheet.walkRules((rule) => survivors.add(`${ruleKey(rule)}||${bodyOf(rule)}`));

const lost = fullRules.filter(
  (r) => !survivors.has(`${r.key}||${r.body}`) && !shipped.rules.get(r.key)?.has(r.body),
);

if (lost.length > 0) {
  throw new Error(
    [
      `${lost.length} rule(s) vanished in the components-sheet subtraction and are in neither output.`,
      'Shipping this file would under-style the package — the exact defect objectui#4059 fixed.',
      '',
      ...lost.slice(0, 20).map((r) => `  ${r.selector}  [${r.key}]`),
    ].join('\n'),
  );
}

// A subtraction that removed nothing means the two compilations stopped sharing
// a key shape (a Tailwind upgrade changing layer names, say). The output would
// still be CORRECT — merely the ~180 kB duplicate this variant exists to avoid —
// so this is a loud failure rather than a silent regression to the wide shape.
if (droppedRules === 0) {
  throw new Error(
    'The components sheet subtracted nothing at all. Expected ~1350 shared utilities to be removed; ' +
      'the two sheets are no longer producing comparable keys, so this build would ship the wide ' +
      'duplicate sheet instead of the narrow supplement (objectui#4059).',
  );
}

const survivingClasses = new Set();
fieldsSheet.walkRules((rule) => {
  for (const sel of rule.selectors) for (const cls of classesIn(sel)) survivingClasses.add(cls);
});

/**
 * The opposite failure to over-subtraction: a sheet that swallowed utilities
 * belonging to OTHER packages.
 *
 * `src/index.css` pins its inputs with `source(none)` precisely so this cannot
 * happen — see the comment there. This ceiling is the assertion that the pin is
 * still doing its job, because the symptom is otherwise invisible: the build
 * succeeds, every check above passes (nothing was lost, plenty was dropped, the
 * sentinels survived) and the package just quietly publishes a stylesheet an
 * order of magnitude too big, carrying rules it has no business shipping.
 *
 * Measured on main@59df371f7: 157 classes correct, 1923 when the pin was absent
 * and the build ran from the repo root. The ceiling sits far above the real
 * value on purpose — it is a leak detector, not a budget, and a number that
 * needed re-tuning every time a widget gained a class would be edited into
 * uselessness.
 */
const CLASS_CEILING = 600;

if (survivingClasses.size > CLASS_CEILING) {
  throw new Error(
    [
      `This sheet carries ${survivingClasses.size} classes; anything over ${CLASS_CEILING} means it is no longer just this package's.`,
      '',
      "Tailwind's automatic source detection resolves against the process cwd, so a lost",
      "`source(none)` in src/index.css lets the candidate set expand to the whole workspace —",
      'which builds a valid, much larger stylesheet full of other packages\' utilities rather',
      'than failing (objectui#4059).',
    ].join('\n'),
  );
}

const vanished = MUST_SURVIVE.filter((cls) => !survivingClasses.has(cls));
if (vanished.length > 0) {
  throw new Error(
    [
      `The subtraction removed ${vanished.length} utility(ies) that only this build can produce:`,
      ...vanished.map((c) => `  .${c}`),
      '',
      'That is over-subtraction, and it ships as an under-styled package with a green build —',
      'the objectui#4059 defect restored. Check that the components sheet being subtracted is',
      "that package's own build output and has not been widened to include this package's classes.",
    ].join('\n'),
  );
}

const header = [
  '/*! @object-ui/fields — utilities this package adds on top of @object-ui/components.',
  ' *',
  ' * IMPORT AFTER the components sheet; this is a supplement, not a standalone stylesheet:',
  ' *',
  " *   @import '@object-ui/components/style.css';",
  " *   @import '@object-ui/fields/style.css';",
  ' *',
  ' * Preflight, the theme tokens and every utility the two packages share live in the',
  ' * components sheet and are deliberately not repeated here. Generated by',
  ' * packages/fields/scripts/build-css.mjs — do not edit.',
  ' */',
].join('\n');

await mkdir(dirname(output), { recursive: true });
// Tailwind's own banner stays (it carries the upstream MIT attribution); ours goes after it.
const css = `${header}\n${fieldsSheet.toString()}\n`;
await writeFile(output, css, 'utf8');

console.log(
  `✓ built dist/index.css (${(css.length / 1024).toFixed(2)} kB) — ` +
    `${survivors.size} rules kept (${survivingClasses.size} classes), ` +
    `${droppedRules} rules + ${droppedAtRules} at-rules already in @object-ui/components' sheet`,
);
