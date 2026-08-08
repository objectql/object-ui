import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3261: the header comment in `.github/workflows/lint.yml` said
 * `eslint.config.js` sets *three* `object-ui/*` rules to `error` and named the
 * three sources they came from. The config had four. The parenthesised list of
 * sources was short by one for the same reason.
 *
 * Miscounting is the visible symptom, not the defect. That comment is the only
 * written explanation of why `lint.yml` exists at all — it records that those
 * `error` ratchets sat inert for months because the workflow was
 * `workflow_dispatch`-only until #2923. The next person adding an `error`-level
 * rule reads it to decide what this gate covers, and a stale enumeration reads
 * exactly as authoritative as a fresh one: it will tell them their new rule is
 * outside the gate (or inside it) with equal confidence, and be wrong.
 *
 * A hand-copied enumeration drifts by construction; #3212 measured the same
 * page's workflow count at 11 in the doc, 12 in the issue and 13 in reality on
 * a single day. So the comment no longer counts or names anything, and this
 * file is what keeps it that way — plus it pins the two claims the comment
 * still makes, so the prose cannot quietly become fiction:
 *
 *   1. the enumeration does not come back (the #3261 regression itself);
 *   2. `eslint.config.js` really does set `object-ui/*` rules to `error`,
 *      otherwise the comment describes a gate that no longer has anything to
 *      gate;
 *   3. this workflow really does run on pull requests, otherwise those rules
 *      are inert again exactly as they were before #2923 — and the comment
 *      would be describing the bug as history while it is live.
 *
 * Deliberately NOT asserted: that a *list* of the rules somewhere matches the
 * config. Keeping such a list is the thing this issue removed — the generic
 * phrasing ("the rules `eslint.config.js` sets to `error`") is always true, so
 * the only honest list is the config itself.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(repoRoot, '.github/workflows/lint.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

type FlatConfigEntry = { rules?: Record<string, unknown>; files?: string[] };

/**
 * The resolved flat config, imported rather than text-scanned: severity is
 * authored four different ways (`'error'`, `2`, `['error', {…}]`, `[2, {…}]`)
 * and the `object-ui/*` rules live in four separate config objects with
 * different `files` scopes. Reading the evaluated array is the only way to get
 * the same answer ESLint would.
 *
 * At module scope, not in `beforeAll` — AGENTS.md's testing discipline, and
 * `object-ui/no-dynamic-import-in-test-hook` mechanically enforces it: the cost
 * of loading typescript-eslint and the local plugin belongs to the import
 * phase, where no test or hook timeout applies.
 */
const eslintConfig = ((await import('../../eslint.config.js')) as { default: FlatConfigEntry[] })
  .default;

const severityOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const objectUiErrorRules = eslintConfig
  .flatMap((entry) => Object.entries(entry?.rules ?? {}))
  .filter(([name, value]) => {
    const severity = severityOf(value);
    return name.startsWith('object-ui/') && (severity === 'error' || severity === 2);
  })
  .map(([name]) => name);

/**
 * The `# …` prose block between `name:` and `on:` — the comment this issue is
 * about. Scoped so the assertions below read the explanation, not the YAML.
 */
function headerComment(): string {
  const start = workflow.indexOf('\n#');
  const end = workflow.indexOf('\non:');
  expect(start, 'lint.yml must still carry a header comment above `on:`').toBeGreaterThan(-1);
  expect(end, 'lint.yml must still have a top-level `on:` block').toBeGreaterThan(start);
  return workflow.slice(start, end);
}

/**
 * The header comment as one continuous line: `#` markers stripped and wrapping
 * undone. Matching the raw block instead would miss the exact sentence that
 * caused #3261 — "sets three" ended a line and "`object-ui/*` rules" began the
 * next one, so any pattern spanning the two has to survive a `\n# ` in the
 * middle. Comment prose re-wraps whenever a word is edited, so the assertions
 * below must not depend on where the lines happen to break.
 */
function unwrappedHeaderComment(): string {
  return headerComment()
    .replace(/^[ \t]*#[ \t]?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The `on:` block, from the top-level `on:` key to the next top-level key.
 * Trigger claims have to be read here and not from the whole file, where the
 * word `pull_request` also appears in `concurrency`/`github.ref` expressions.
 */
function onBlock(): string {
  const start = workflow.indexOf('\non:');
  const rest = workflow.slice(start + 1);
  const next = rest.search(/\n[a-z_]+:/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('lint.yml header comment — objectui#3261', () => {
  it('never hand-counts the object-ui/* rules again', () => {
    const comment = unwrappedHeaderComment();

    // `three \`object-ui/*\` rules`, `all four ratchets`, `4 object-ui rules`…
    const counted = [
      ...comment.matchAll(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b[^.]{0,20}?(`?object-ui|ratchet)/gi,
      ),
    ].map((m) => m[0]);

    expect(
      counted,
      `lint.yml's header comment counts the \`object-ui/*\` error rules again:\n` +
        counted.map((c) => `  - ${JSON.stringify(c)}`).join('\n') +
        `\n\nDon't. The count was wrong within weeks last time (objectui#3261: the ` +
        `comment said three, the config had four) and a stale count still reads as ` +
        `authoritative to the next person deciding what this gate covers. Say "the ` +
        `\`object-ui/*\` rules \`eslint.config.js\` sets to \`error\`" instead — always ` +
        `true, never maintained. content/docs/guide/ci-cd-pipeline.md phrases it that ` +
        `way for the same reason.`,
    ).toEqual([]);
  });

  it('never enumerates them by name either', () => {
    // Same defect one level down: naming the rules is a list that has to be
    // maintained in lockstep with the config, and nothing makes anyone do it.
    const named = objectUiErrorRules.filter((rule) => workflow.includes(rule));

    expect(
      named,
      `lint.yml names specific \`object-ui/*\` rules:\n` +
        named.map((r) => `  - ${r}`).join('\n') +
        `\n\nThat list is a second copy of eslint.config.js and will drift from it ` +
        `(objectui#3261). The workflow explains why the gate exists; eslint.config.js ` +
        `is where the rules are, with each rule's own comment giving its ADR/issue.`,
    ).toEqual([]);
  });
});

describe('lint.yml header comment — the claims it still makes', () => {
  it("eslint.config.js really does set object-ui/* rules to `error`", () => {
    // The comment's premise. If every ratchet is downgraded or deleted, this
    // fails — which is the moment the comment has to be rewritten rather than
    // left describing a gate with nothing behind it.
    expect(
      objectUiErrorRules,
      `No \`object-ui/*\` rule is set to \`error\` in eslint.config.js, but lint.yml's ` +
        `header comment is built entirely on the premise that some are. Either a ` +
        `severity was downgraded by accident, or the ratchets are genuinely gone and ` +
        `that comment now needs rewriting (objectui#3261).`,
    ).not.toEqual([]);
  });

  it('still runs on pull requests, so those rules are not inert again (#2923)', () => {
    const on = onBlock();

    expect(
      on,
      `lint.yml no longer triggers on \`pull_request\`. That is exactly the state ` +
        `#2923 fixed: every \`object-ui/*\` rule \`eslint.config.js\` sets to \`error\` ` +
        `goes silently inert, because the only thing that runs them on a PR is this ` +
        `workflow. The header comment describes that as history — keep it history.`,
    ).toMatch(/^\s{2}pull_request:/m);
  });

  it('does not skip the TypeScript sources those rules lint', () => {
    // A narrow tripwire, not a glob engine (the repo has no glob matcher at the
    // root, and vendoring one for this would cost more than it protects). The
    // realistic way to un-gate the ratchets without touching the triggers above
    // is adding a TypeScript pattern to the ignore list; today's entries are all
    // markdown, `content/**`, `docs/**` and `.changeset/**`.
    //
    // That list now lives in TWO places and both have to be read, which is the
    // objectui#3523 change: `paths-ignore` stayed on the `push` trigger, but for
    // pull requests it moved INTO the job, as `:(exclude,glob)…` pathspecs in
    // the `Decide whether this change needs a full run` step. Reading only the
    // `on:` block would have gone on passing while a `**/*.ts` exclusion was
    // added to the job — the gate reporting green having linted nothing.
    // `merge-queue-reporting.test.ts` pins the two lists to each other and pins
    // why the trigger may not filter pull requests at all; this one stays on its
    // own question, which is what may be in the list.
    const ignored = [
      ...[...onBlock().matchAll(/^\s*-\s*'([^']+)'/gm)].map((m) => m[1]),
      ...[...workflow.matchAll(/':\(exclude,glob\)([^']+)'/g)].map((m) => m[1]),
    ];

    expect(
      ignored.length,
      'lint.yml must still declare an ignore list — on the `push` trigger, in the job, or both',
    ).toBeGreaterThan(0);

    const swallowsSource = ignored.filter((pattern) => /\.tsx?$/.test(pattern));
    expect(
      swallowsSource,
      `lint.yml skips TypeScript changes:\n` +
        swallowsSource.map((p) => `  - ${p}`).join('\n') +
        `\n\nEvery \`object-ui/*\` rule \`eslint.config.js\` sets to \`error\` only gates ` +
        `a PR because this workflow lints the .ts/.tsx it touches. Excluding them is the ` +
        `pre-#2923 inert state with extra steps — and since objectui#3523 it is the quieter ` +
        `version of it, because the \`Lint\` check still reports, green.`,
    ).toEqual([]);
  });
});
