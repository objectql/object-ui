/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `packages/plugin-gantt/README.md`'s record-navigation example is PARSED by
 * the schema that validates it — `@objectstack/spec`'s `NavigationConfigSchema`
 * (objectui#6050).
 *
 * ## Why this file exists
 *
 * The example documented `{ mode: 'page', basePath: '/console/apps/.../campaign' }`.
 * `basePath` is not a `NavigationConfig` member, and no read site consumes it:
 * `useNavigationOverlay` — where a gantt's `navigation` lands — builds no URL
 * out of the config at all, and `ObjectGantt` calls it with no `onNavigate`, so
 * a page-mode click falls through to the host's `onRowClick`. The destination
 * route was never authorable through that key, by any spelling.
 *
 * That made the snippet worse than inert. `NavigationConfigSchema` is a strict
 * object, so the undeclared key did not fall away quietly — it REJECTED the
 * whole config (`unrecognized_keys`), and the `mode: 'page'` the sentence was
 * actually teaching never took effect. An author copying the documented snippet
 * got a rejected navigation config.
 *
 * It was found exactly this way: objectui#5903's pin test used this README's
 * example verbatim as its "well-typed" fixture, and the fixture failed.
 *
 * ## No gate in this repo can catch it, which is the point
 *
 * `check-doc-snippet-types` compiles `ts`/`tsx` fences and
 * `check-doc-component-types` reads `type` literals; both are structurally
 * blind to a metadata key in a README. That gate's own header names the hole:
 * schema-key validity is "a different question with a different answer …
 * left unruled on purpose". A README example can be rejected by the spec while
 * every gate stays green. This test is the measurement that closes it for this
 * one example.
 *
 * ## The example is EXTRACTED, never retyped
 *
 * The fence is read out of the README on every run and parsed as JSON. A hand
 * copy drifts from the file it claims to pin and therefore pins nothing — a
 * snippet nobody re-measured is the defect this test exists to prevent, so
 * reproducing it inside the test would be self-defeating. A moved heading, a
 * removed fence or a non-JSON body throws out of the extractor rather than
 * vacuously passing on an empty fixture.
 *
 * ## The green carries its own control
 *
 * A `safeParse` that succeeds proves nothing on its own if the schema accepts
 * everything, so the historical shape is parsed alongside and must be REJECTED
 * by name. The pair is the measurement; neither half alone is one.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NavigationConfigSchema } from '@objectstack/spec/ui';

/** Walk up to the workspace root, so the README is found by repo layout. */
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found from this test file');
}

const README = join(repoRoot(), 'packages/plugin-gantt/README.md');

/** The bullet that documents the override, and the sentence that introduces it. */
const SECTION_HEADING = '\n### Create / Edit / Delete / View\n';
const ANCHOR = 'Override by setting `navigation` on the schema';

/**
 * The declared member names, read out of the schema's OWN shape. Restating them
 * here would fork the vocabulary — the drift `ObjectGanttSchema.navigation`'s
 * doc comment (objectui#5903) exists to prevent — so they are derived instead.
 */
interface ShapeCarrier {
  shape?: Record<string, unknown>;
  _def?: {
    getter?: () => ShapeCarrier;
    innerType?: ShapeCarrier;
    shape?: Record<string, unknown> | (() => Record<string, unknown>);
  };
}

function declaredMembers(): Set<string> {
  let node = NavigationConfigSchema as unknown as ShapeCarrier;
  for (let hop = 0; hop < 6; hop += 1) {
    if (node.shape) return new Set(Object.keys(node.shape));
    const def = node._def;
    if (def?.getter) { node = def.getter(); continue; }
    if (def?.innerType) { node = def.innerType; continue; }
    if (typeof def?.shape === 'function') return new Set(Object.keys(def.shape()));
    if (def?.shape) return new Set(Object.keys(def.shape));
    break;
  }
  throw new Error('NavigationConfigSchema no longer exposes an object shape — cannot derive its members');
}

/** The README section this example lives in, bounded to its own heading. */
function navigationSection(): string {
  const src = readFileSync(README, 'utf8');
  const start = src.indexOf(SECTION_HEADING);
  if (start < 0) throw new Error(`"${SECTION_HEADING.trim()}" heading not found in ${README}`);
  const next = src.indexOf('\n### ', start + 1);
  const section = src.slice(start, next < 0 ? undefined : next);

  const anchors = section.split(ANCHOR).length - 1;
  if (anchors !== 1) {
    throw new Error(`expected exactly one "${ANCHOR}" in the section, found ${anchors}`);
  }
  return section;
}

/** The `json` fence that follows the anchor sentence — the example itself. */
function readmeExample(): Record<string, unknown> {
  const section = navigationSection();
  const after = section.slice(section.indexOf(ANCHOR));
  const fence = /^[ \t]*```json[ \t]*\n([\s\S]*?)\n[ \t]*```/m.exec(after);
  if (!fence) throw new Error('no ```json fence follows the navigation-override sentence in the README');

  // Not wrapped in a try/catch: `JSON.parse`'s own `SyntaxError` names the
  // offending token and is thrown from this line, which is louder than anything
  // a re-throw could add. (A wrapper would also have to attach the caught error
  // as a `cause` to satisfy `preserve-caught-error`, and `Error.cause` is ES2022
  // — above this project's ES2020 lib.)
  const parsed: unknown = JSON.parse(fence[1]);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('the README\'s navigation example is not a JSON object');
  }
  const doc = parsed as Record<string, unknown>;
  const nav = doc.navigation;
  if (typeof nav !== 'object' || nav === null || Array.isArray(nav)) {
    throw new Error('the README\'s navigation example no longer carries a `navigation` object');
  }
  return nav as Record<string, unknown>;
}

const MEMBERS = declaredMembers();
const EXAMPLE = readmeExample();

/** The historical shape, kept only as the control's input. */
const REJECTED_KEY = 'basePath';

function unrecognizedKeys(issues: readonly { code: string }[]): string[] {
  const out: string[] = [];
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      out.push(...((issue as { keys?: string[] }).keys ?? []));
    }
  }
  return out;
}

describe('plugin-gantt README: the record-navigation example', () => {
  it('is a shape `NavigationConfigSchema` ACCEPTS', () => {
    const result = NavigationConfigSchema.safeParse(EXAMPLE);
    expect(
      result.success ? [] : result.error.issues.map((i) => `${i.code} ${JSON.stringify(i.path)}: ${i.message}`),
      'The documented example must survive the schema that validates it. An author who copies ' +
        'this snippet is handing it to exactly this parse — a rejected config renders nothing ' +
        'the snippet promises, including the `mode` beside the offending key.',
    ).toEqual([]);
  });

  it('CONTROL: the same parse still REJECTS an undeclared key by name', () => {
    const result = NavigationConfigSchema.safeParse({ ...EXAMPLE, [REJECTED_KEY]: '/console/apps/.../campaign' });
    expect(
      result.success,
      'This control is what makes the assertion above a measurement rather than a schema that ' +
        'accepts anything. If this ever passes, `NavigationConfigSchema` has stopped being ' +
        'strict and the green above no longer says what it claims.',
    ).toBe(false);
    expect(result.success ? [] : unrecognizedKeys(result.error.issues)).toContain(REJECTED_KEY);
  });

  it('names only members the schema declares', () => {
    const undeclared = Object.keys(EXAMPLE).filter((k) => !MEMBERS.has(k));
    expect(
      undeclared,
      `The README example must not teach a key \`NavigationConfigSchema\` does not declare. ` +
        `\`${REJECTED_KEY}\` was the original offender: a route prefix, in a config that owns no route.`,
    ).toEqual([]);
  });

  it('still teaches the thing its sentence promises — page mode', () => {
    expect(
      EXAMPLE.mode,
      'The sentence promises "route to the standalone detail page instead". `mode` is what ' +
        'delivers that; an example that lost it would be valid and useless.',
    ).toBe('page');
  });

  it('does not reintroduce the route-prefix key anywhere in the section', () => {
    expect(
      navigationSection().includes(REJECTED_KEY),
      `\`${REJECTED_KEY}\` is not authorable here in any spelling — prose or fence. ` +
        '`useNavigationOverlay` builds no URL out of this config; the host owns the route.',
    ).toBe(false);
  });
});
