import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyze,
  collectNodes,
  CONTROL_FIXTURES,
  deriveChannels,
  DOCS_ROOT,
  loadCarriage,
  parseFence,
  RENDERER_SOURCE,
  runControls,
  sanitizeFence,
  splitTopLevel,
} from '../check-doc-expression-carriage.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const GATE = 'scripts/check-doc-expression-carriage.mjs';

/**
 * objectui#7851. `check-doc-component-types` judges the `type` literal of a json
 * fence and says so in its own header — "NOT in scope, deliberately: whether the
 * snippet's OTHER keys are read by the renderer the type resolves to" — and
 * `check-doc-snippet-types` compiles the ts/tsx blocks only. So the json fence
 * BODIES were read by nothing, and a whole class of defect (objectui#7418,
 * #7440, #7444, #7838) reached `main` under green gates every time.
 *
 * The gate this file pins is REPORT-ONLY by ruling: three members of that class
 * are open, and a blocking gate would go red on other people's cards the day it
 * landed. That posture is the first thing asserted here, because it is the thing
 * a later edit could quietly reverse.
 *
 * The second is that the instrument can SEE. A census that runs, goes green and
 * looked at nothing is the counterfeit this shape of gate produces most easily
 * (objectstack#4928, objectui#4690), so the controls are exercised in both
 * directions AND sabotaged — a control that cannot fail is not a control.
 */
describe('check-doc-expression-carriage: the evaluated-channel universe is derived, not typed', () => {
  const channels = deriveChannels(ROOT);

  it('reads the three channel shapes off SchemaRenderer’s own call sites', () => {
    expect(channels.direct).toEqual(['content']);
    expect(channels.bags).toEqual(['properties', 'props']);
  });

  /**
   * The enumeration and the reading come from DIFFERENT places on purpose
   * (AGENTS.md §9's rule for exactly this): the gate derives the condition keys
   * from the `evaluate*Predicate(newSchema.<key>, …)` CALL SITES, and this test
   * checks that answer against the two `const` ARRAYS the same file declares for
   * the visibility chain. A single source read twice proves nothing.
   */
  it('agrees with the renderer’s own VISIBILITY_* declarations', () => {
    const source = fs.readFileSync(path.join(ROOT, RENDERER_SOURCE), 'utf8');
    const declared = (name: string): string[] => {
      const literal = source.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))?.[1];
      expect(literal, `${RENDERER_SOURCE} must still declare \`${name}\` as an array literal`).toBeDefined();
      return [...literal!.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    };
    const visibility = [...declared('VISIBILITY_SHOW_KEYS'), ...declared('VISIBILITY_HIDE_KEYS')];
    expect(visibility.length).toBe(6);
    for (const key of visibility) expect(channels.conditions).toContain(key);
    // The enablement pair is not in either array — it routes through
    // `evaluateEnablementPredicate`, which is why the gate reads call sites at all.
    expect(channels.conditions).toContain('disabled');
    expect(channels.conditions).toContain('disabledOn');
    expect(channels.conditions.length).toBe(8);
  });

  it('refuses to census against a guessed universe when the renderer is missing', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'carriage-noren-'));
    expect(() => deriveChannels(empty)).toThrow(/cannot be derived/);
    fs.rmSync(empty, { recursive: true, force: true });
  });

  it('refuses when the call sites it reads have been renamed away', () => {
    const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'carriage-renamed-'));
    fs.mkdirSync(path.join(fake, path.dirname(RENDERER_SOURCE)), { recursive: true });
    fs.writeFileSync(
      path.join(fake, RENDERER_SOURCE),
      '// no evaluate call sites at all, only prose naming visibleOn and properties\n',
    );
    expect(() => deriveChannels(fake)).toThrow(/matched nothing/);
    fs.rmSync(fake, { recursive: true, force: true });
  });
});

describe('check-doc-expression-carriage: the carriage map comes from the built artifact', () => {
  it('reads expressionBindableTextKeysFor out of the installed spec', async () => {
    const carriage = await loadCarriage();
    // The rows objectui#7418 measured, re-read here rather than copied from its
    // table: `badge` carrying NOTHING is what makes `badge.text` a finding.
    expect(carriage.keysFor('card')).toEqual(expect.arrayContaining(['title', 'description']));
    expect(carriage.keysFor('badge')).toEqual([]);
    expect(carriage.keysFor('progress')).toEqual([]);
    expect(carriage.version).toMatch(/^\d+\./);
  });
});

describe('check-doc-expression-carriage: the controls can see, and can fail', () => {
  it('reports the objectui#7418 badge site and stays silent on a clean node', async () => {
    const carriage = await loadCarriage();
    const controls = runControls({ channels: deriveChannels(ROOT), carriage });
    expect(controls.failures).toEqual([]);
    expect(controls.positive).toEqual(['text', 'variant']);
    expect(controls.negative).toEqual([]);
  });

  it('fails when the carriage map is widened until the defect disappears', async () => {
    const carriage = { version: 'sabotaged', keysFor: () => ['text', 'variant'] };
    const controls = runControls({ channels: deriveChannels(ROOT), carriage });
    expect(controls.failures.join('\n')).toMatch(/positive control/);
  });

  it('fails when a carried channel is dropped and the clean node starts reporting', async () => {
    const carriage = await loadCarriage();
    const real = deriveChannels(ROOT);
    const crippled = { ...real, all: real.all.filter((key) => key !== 'visibleOn') };
    const controls = runControls({ channels: crippled, carriage });
    expect(controls.failures.join('\n')).toMatch(/negative control/);
  });

  it('keeps the positive fixture a real pre-repair site, not a synthetic one', () => {
    // If this fixture ever stops spelling `badge` + `text`, the control is no
    // longer the objectui#7418 site and the header's claim goes stale.
    expect(CONTROL_FIXTURES.positive).toContain('"type": "badge"');
    expect(CONTROL_FIXTURES.positive).toContain('"text"');
  });
});

describe('check-doc-expression-carriage: the parse surface', () => {
  const parse = (body: string) => parseFence(body);

  it('drops comments outside strings and keeps a // that is data', () => {
    const out = parse('{ "type": "text", // a note\n  "content": "https://example.com" }');
    expect(out.ok).toBe(true);
    expect(out.values[0]).toEqual({ type: 'text', content: 'https://example.com' });
  });

  it('re-escapes the raw newlines these pages write inside ${…}', () => {
    const out = parse('{\n "type": "text",\n "content": "${ a\n  ? 1\n  : 2 }"\n}');
    expect(out.ok).toBe(true);
    expect(out.values[0].content).toContain('${');
  });

  it('tolerates trailing commas', () => {
    expect(parse('{ "type": "text", "content": "x", }').ok).toBe(true);
  });

  it('tolerates the three elision spellings, and keeps a dotted VALUE', () => {
    expect(parse('{ "type": "form", "fields": [...] }').ok).toBe(true);
    expect(parse('{ "type": "form", "fields": […] }').ok).toBe(true);
    const strung = parse('{ "type": "div", "children": [ { "type": "kanban", "..." } ] }');
    expect(strung.ok).toBe(true);
    const value = parse('{ "type": "input", "placeholder": "..." }');
    expect(value.ok).toBe(true);
    expect(value.values[0].placeholder).toBe('...');
  });

  it('splits a fence holding several top-level objects', () => {
    const out = parse('{ "type": "a" }\n\n{ "type": "b" }');
    expect(out.ok).toBe(true);
    expect(out.values).toHaveLength(2);
  });

  it('retries an object BODY wrapped in braces', () => {
    const out = parse('"dependencies": {\n  "@object-ui/plugin-x": "workspace:*"\n}');
    expect(out.ok).toBe(true);
    expect(out.wrapped).toBe(true);
  });

  it('reports a fence it cannot read instead of silently dropping it', () => {
    const out = parse('{ "type": "text"');
    expect(out.ok).toBe(false);
    expect(out.reason).toBeTruthy();
  });

  it('never invents a key: sanitizing only removes non-data', () => {
    const body = '{ "type": "badge", "label": "a//b", "variant": "x" }';
    expect(Object.keys(JSON.parse(sanitizeFence(body)))).toEqual(['type', 'label', 'variant']);
    expect(splitTopLevel(sanitizeFence(body)).values).toHaveLength(1);
  });

  it('finds a node wherever it sits, including inside a bag', () => {
    const nodes = collectNodes({ type: 'page', properties: { child: { type: 'badge' } } });
    expect(nodes.map((n) => n.type)).toEqual(['page', 'badge']);
  });
});

describe('check-doc-expression-carriage: the census on a fixture tree', () => {
  /** A throwaway docs tree: one page with a known defect, one page that is clean. */
  function fixtureTree(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'carriage-docs-'));
    const docs = path.join(root, DOCS_ROOT, 'guide');
    fs.mkdirSync(docs, { recursive: true });
    fs.writeFileSync(
      path.join(docs, 'bad.md'),
      ['# Bad', '', '```json', '{', '  "type": "badge",', '  "text": "${status}"', '}', '```', ''].join('\n'),
    );
    fs.writeFileSync(
      path.join(docs, 'clean.md'),
      [
        '# Clean',
        '',
        '```json',
        '{',
        '  "type": "card",',
        '  "title": "${item.name}",',
        '  "visibleOn": "${item.active}"',
        '}',
        '```',
        '',
        '```tsx',
        'const x: string = `${notJson}`;',
        '```',
        '',
      ].join('\n'),
    );
    return root;
  }

  it('names the defective site and says nothing about the clean page', async () => {
    const root = fixtureTree();
    const census = analyze(root, { channels: deriveChannels(ROOT), carriage: await loadCarriage() });
    expect(census.counters.fences).toBe(2); // the tsx block is not this gate's surface
    expect(census.counters.unparsed).toBe(0);
    expect(census.sites).toHaveLength(1);
    expect(census.sites[0]).toMatchObject({
      file: `${DOCS_ROOT}/guide/bad.md`,
      type: 'badge',
      key: 'text',
      line: 6,
    });
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('check-doc-expression-carriage: the real tree, and the posture', () => {
  it('is looking at something — a vacuity guard, not a snapshot', async () => {
    const census = analyze(ROOT, { channels: deriveChannels(ROOT), carriage: await loadCarriage() });
    expect(census.counters.fences).toBeGreaterThan(100);
    expect(census.counters.nodes).toBeGreaterThan(100);
    // ⛔ Deliberately NOT asserted: how many findings there are. That number moves
    // with every card in this class, and pinning it here would make this gate
    // blocking through the back door — the exact thing the ruling forbade.
  });

  it('has no blind spot on the corpus it ships against', async () => {
    const census = analyze(ROOT, { channels: deriveChannels(ROOT), carriage: await loadCarriage() });
    expect(
      census.unparsed,
      'a json fence under content/docs that this gate cannot parse is a fence it says NOTHING ' +
        'about — the size of its blind spot, not a docs rule. Teach `sanitizeFence` the spelling ' +
        `(see the tolerances in ${GATE}'s header), or fix the fence if it is simply malformed.`,
    ).toEqual([]);
  });

  it('is REPORT-ONLY: exit 0 on the real tree even with findings', () => {
    const run = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('Controls pass');
    expect(run.stdout).toContain('Report-only');
    // The findings themselves go to stdout, never stderr: nothing downstream
    // should be able to read them as a failure.
    expect(run.stderr).toBe('');
  });

  it('is LOUD when the instrument itself is broken', () => {
    // A copy of the gate with no repo under it: no renderer to derive channels
    // from and no installed spec to read the carriage map out of. Either way the
    // answer must be exit 1 — report-only declines to fail on FINDINGS, never on
    // having looked at nothing.
    const orphan = fs.mkdtempSync(path.join(os.tmpdir(), 'carriage-orphan-'));
    fs.mkdirSync(path.join(orphan, 'scripts'));
    for (const file of ['check-doc-expression-carriage.mjs', 'invoked-as.mjs']) {
      fs.copyFileSync(path.join(ROOT, 'scripts', file), path.join(orphan, 'scripts', file));
    }
    const run = spawnSync(process.execPath, ['scripts/check-doc-expression-carriage.mjs'], {
      cwd: orphan,
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('A failure, not a skip');
    fs.rmSync(orphan, { recursive: true, force: true });
  });

  it('runs the controls alone under --self-test', () => {
    const out = execFileSync(process.execPath, [GATE, '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toContain('Controls pass');
    expect(out).not.toContain('Scanned');
  });
});

describe('check-doc-expression-carriage: the wiring', () => {
  it('is actually run by ci.yml — a gate nobody runs cannot be told from one that passes', () => {
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain(`node ${GATE}`);
  });

  it('is named on the page that documents what CI runs', () => {
    const page = fs.readFileSync(path.join(ROOT, 'content/docs/guide/ci-cd-pipeline.md'), 'utf8');
    expect(page).toContain(GATE);
    // objectui#3653 pins the pairing by command; this asserts the page also says
    // the posture, because a row that reads like a guardrail when the step blocks
    // nothing is the objectui#3451 mistake.
    const row = page.split('\n').find((line) => line.startsWith('|') && line.includes(GATE));
    expect(row, 'the docs job row must name the gate').toBeDefined();
    expect(row!.toLowerCase()).toContain('report-only');
  });
});
