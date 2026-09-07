import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KNOWN_UNDECLARED_READS,
  analyze,
  collectArms,
  isHandlerKey,
  registrationsIn,
  parseSource,
} from '../check-handler-key-read-sites.mjs';

/**
 * objectui#7753 — every `on*` key a registered renderer READS off the authored
 * document must be a declared member of the arm for the type it is registered
 * under.
 *
 * `BaseSchema` is `.passthrough()`, so a key that is not declared is not refused:
 * it stops being judged and the value is KEPT. objectui#7664 measured that on the
 * built dist — `{ type: 'kanban', columns: [], onCardClick: { action: 'toast' } }`
 * went from REFUSED to ACCEPTED with the object surviving into the parsed output
 * — while every gate stayed green, because the #6124 ledger's population is a
 * literal and the change re-keyed the arm by SUBSTITUTION.
 *
 * What this file pins, in the order the gate can go wrong:
 *
 *  1. **The lit control, and a control ON that control.** Deleting a
 *     still-read key from an arm must go RED and name it; a deletion of
 *     comparable size from the same arm that is HARMLESS must stay GREEN.
 *     Without the second leg, "the plant reddens it" only proves the gate
 *     reacts to edits.
 *  2. **The historical shape, rebuilt as a fixture.** The registration hands
 *     over a NAME, that name is an HOC, the document reaches the reader through
 *     a render-prop parameter and an object spread. Every hop in that chain is
 *     load-bearing: a walk that stops at any of them is GREEN on objectui#7664's
 *     own deletion, which is the one reading that would make this gate
 *     worthless.
 *  3. **Each narrowing, named after the false positive it removed.** The first,
 *     coarser cut of this gate produced 36 findings on `main`; every one of the
 *     rules below is why a class of them is gone.
 *  4. **A green is never "the walk found nothing."** Every fixture that passes
 *     asserts its own counters are non-zero, and so does the repository run.
 *  5. **This repository is green**, with the ledger's rows all still live.
 *  6. **The gate is wired** where the sibling parse-based gates run, and the
 *     page that inventories them names it.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const fixtures: string[] = [];
afterAll(() => {
  for (const dir of fixtures) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A throwaway tree in the shape the gate walks: `packages/<name>/src/<file>`,
 * with the zod mirrors at `packages/types/src/zod`. Written to disk rather than
 * fed as strings because the population walk — which directories are read, which
 * files are skipped as tooling — is half of what can go wrong.
 */
function tree(label: string, files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `handler-reads-${label}-`));
  fixtures.push(root);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

/** `BaseSchema` is the base every arm extends; without it no arm resolves. */
const BASE = `
import { z } from 'zod';
export const BaseSchema = z.object({
  id: z.string().optional(),
  className: z.string().optional(),
});
`;

/** One arm, written the way the mirrors write one. */
function arm(type: string, schemaName: string, members: string[]): string {
  return `
import { z } from 'zod';
import { BaseSchema } from './base.zod';
import { handlerKeyRefusal } from './tombstone.zod';
export const ${schemaName} = BaseSchema.extend({
  type: z.literal('${type}'),
${members.map((m) => `  ${m},`).join('\n')}
});
`;
}

const RUNTIME_SLOT = (key: string) => `${key}: handlerKeyRefusal('${key}', 'runtime-slot', '${key} handler')`;
const RETIRED = (key: string) => `${key}: handlerKeyRefusal('${key}', 'retired', '${key} handler')`;

/** Keys of the findings a run produced, in a form a test can read. */
const keysOf = (root: string) => analyze(root).findings.map((finding) => finding.key).sort();

describe('check-handler-key-read-sites — the lit control, and the control on it', () => {
  const board = (members: string[]) => ({
    'packages/types/src/zod/base.zod.ts': BASE,
    'packages/types/src/zod/complex.zod.ts': arm('kanban', 'KanbanSchema', members),
    'packages/plugin-kanban/src/index.tsx': `
import { ComponentRegistry } from '@object-ui/core';
export const KanbanRenderer = ({ schema }: { schema: any }) => (
  <Board onCardMove={schema.onCardMove} onCardClick={schema.onCardClick} />
);
ComponentRegistry.register('kanban', KanbanRenderer, { namespace: 'view' });
`,
  });

  const DECLARED = [RUNTIME_SLOT('onCardMove'), RUNTIME_SLOT('onCardClick'), "coverImageField: z.string().optional()"];

  it('is green while both read keys are declared, and says so with real counts', () => {
    const result = analyze(tree('lit-green', board(DECLARED)));
    expect(result.findings).toEqual([]);
    // A green that walked nothing is the failure this whole gate family exists
    // to prevent, so the green above is only meaningful beside these.
    expect(result.counters.arms).toBeGreaterThan(0);
    expect(result.counters.armed).toBe(1);
    expect(result.counters.reads).toBe(2);
    expect(result.counters.judged).toBe(2);
  });

  it('goes RED and names the key when a still-read key is deleted from the arm', () => {
    // objectui#7664's edit, verbatim in shape: the key leaves the arm, the
    // renderer keeps forwarding it.
    const root = tree('lit-red', board(DECLARED.filter((m) => !m.includes('onCardClick'))));
    const result = analyze(root);
    expect(result.findings.map((f) => f.key)).toEqual(['kanban::KanbanSchema.onCardClick']);
    expect(result.findings[0].kind).toBe('undeclared');
    expect(result.findings[0].file).toBe('packages/plugin-kanban/src/index.tsx');
  });

  it('stays GREEN on a deletion of the same size from the same arm that is harmless', () => {
    // The control ON the control. Identical operation — one member removed from
    // the same object literal in the same file — but the member is not read by
    // any renderer, so nothing about the document's judgement changed. If this
    // reddened, the red above would only mean "a file was edited".
    const root = tree('lit-nearmiss', board(DECLARED.filter((m) => !m.includes('coverImageField'))));
    const result = analyze(root);
    expect(result.findings).toEqual([]);
    expect(result.counters.judged).toBe(2);
  });

  it('goes RED when a still-read key is declared RETIRED rather than deleted', () => {
    // The other direction of the same contract: a tombstone says nothing reads
    // this key, and a renderer reading it contradicts that in the tree.
    const root = tree('lit-retired', board([RUNTIME_SLOT('onCardMove'), RETIRED('onCardClick')]));
    const result = analyze(root);
    expect(result.findings.map((f) => `${f.kind} ${f.key}`)).toEqual([
      'retired-but-read kanban::KanbanSchema.onCardClick',
    ]);
  });
});

describe('check-handler-key-read-sites — the historical chain, hop by hop', () => {
  /**
   * objectui#7664's real shape, which is the reason this gate walks at all:
   *
   *   register('kanban', ObjectKanbanRenderer)   — a NAME, not a body
   *   ObjectKanbanRenderer = block(Inner)        — an HOC
   *   Inner renders <Gate schema={schema}>{(bound) => <ObjectKanban schema={bound} />}
   *   ObjectKanban renders <KanbanRenderer schema={{ ...effective, … }} />
   *   KanbanRenderer reads schema.onCardClick
   */
  const chain = (members: string[]) => ({
    'packages/types/src/zod/base.zod.ts': BASE,
    'packages/types/src/zod/complex.zod.ts': arm('kanban', 'KanbanSchema', members),
    'packages/plugin-kanban/src/index.tsx': `
import { ComponentRegistry } from '@object-ui/core';
import { ObjectKanban } from './ObjectKanban';
export const KanbanRenderer = ({ schema }: { schema: any }) => (
  <Board onCardMove={schema.onCardMove} onCardClick={schema.onCardClick} />
);
export const ObjectKanbanRenderer = elementDataSourceBlock(({ schema, ...props }: any) => (
  <ElementDataSourceGate schema={schema}>
    {(bound: any) => <ObjectKanban schema={bound} {...props} />}
  </ElementDataSourceGate>
));
ComponentRegistry.register('kanban', ObjectKanbanRenderer, { namespace: 'view' });
`,
    'packages/plugin-kanban/src/ObjectKanban.tsx': `
import { KanbanRenderer } from './index';
export const ObjectKanban = ({ schema }: { schema: any }) => {
  const effectiveSchema = { ...schema, columns: [] };
  return <KanbanRenderer schema={{ ...effectiveSchema, onCardMove: handle }} />;
};
`,
  });

  it('reaches the reader four hops away and is green when the arm declares the keys', () => {
    const result = analyze(tree('chain-green', chain([RUNTIME_SLOT('onCardMove'), RUNTIME_SLOT('onCardClick')])));
    expect(result.findings).toEqual([]);
    // Named, not counted: a walk that stopped at the registration identifier
    // would also report zero findings.
    expect(result.census.map((c) => `${c.type}.${c.key}`).sort()).toEqual(['kanban.onCardClick', 'kanban.onCardMove']);
  });

  it('goes RED on the real deletion, four hops from the registration', () => {
    const root = tree('chain-red', chain([RUNTIME_SLOT('onCardMove')]));
    expect(keysOf(root)).toEqual(['kanban::KanbanSchema.onCardClick']);
  });
});

describe('check-handler-key-read-sites — the narrowings, each named after what it removed', () => {
  it('reads registrations off the AST, so prose naming the call registers nothing', () => {
    // 13 of the coarse cut's 36 findings came from `packages/types/src/complex.ts`,
    // which NAMES `ComponentRegistry.register('chatbot', ...)` in doc comments
    // eleven times and registers nothing — the file's own interfaces then read as
    // handler reads on three chatbot arms.
    const root = tree('prose', {
      'packages/types/src/zod/base.zod.ts': BASE,
      'packages/types/src/zod/complex.zod.ts': arm('chatbot', 'ChatbotSchema', [RUNTIME_SLOT('onSend')]),
      'packages/types/src/complex.ts': `
/**
 * The registration is \`ComponentRegistry.register('chatbot', ChatbotRenderer)\`,
 * which is where \`schema.onCardClick\` would be forwarded if it were.
 */
export interface ChatbotSchema { onCardClick?: () => void }
`,
    });
    const result = analyze(root);
    expect(result.counters.registrations).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('scopes `props.onX` to the component\'s own parameters, not every nested arrow', () => {
    // `'menubar'.onClick`, from the coarse cut: `items.map((child) => child.onClick?.())`
    // is a MENU ITEM's handler, not the board's document.
    const root = tree('nested-param', {
      'packages/types/src/zod/base.zod.ts': BASE,
      'packages/types/src/zod/complex.zod.ts': arm('menubar', 'MenubarSchema', ["menus: z.array(z.any()).optional()"]),
      'packages/components/src/menubar.tsx': `
import { ComponentRegistry } from '@object-ui/core';
ComponentRegistry.register('menubar', ({ schema, ...props }: any) => (
  <Menubar>
    {schema.menus?.map((child: any) => <Item key={child.id} onSelect={() => child.onClick?.()} />)}
  </Menubar>
), { namespace: 'ui' });
`,
    });
    expect(analyze(root).findings).toEqual([]);
  });

  it('does not follow a child handed a document the parent BUILT', () => {
    // `'object-view'.onViewChange`, from the second cut: `ObjectView` composes
    // `{ type: 'view-switcher', …, storageKey: \`view-pref-\${schema.objectName}\` }`
    // and hands it to `<ViewSwitcher schema={…} />`. It mentions `schema`, so a
    // mention test called it the parent's document and reported `ViewSwitcher`'s
    // read against `ObjectViewSchema` — an arm that is not even the one read.
    const root = tree('new-document', {
      'packages/types/src/zod/base.zod.ts': BASE,
      'packages/types/src/zod/objectql.zod.ts': arm('object-view', 'ObjectViewSchema', ["objectName: z.string().optional()"]),
      'packages/plugin-view/src/index.tsx': `
import { ComponentRegistry } from '@object-ui/core';
import { ObjectView } from './ObjectView';
ComponentRegistry.register('object-view', ObjectView, { namespace: 'view' });
`,
      'packages/plugin-view/src/ObjectView.tsx': `
import { ViewSwitcher } from './ViewSwitcher';
export const ObjectView = ({ schema }: { schema: any }) => {
  const viewSwitcherSchema = { type: 'view-switcher', storageKey: schema.objectName };
  return <ViewSwitcher schema={viewSwitcherSchema} />;
};
`,
      'packages/plugin-view/src/ViewSwitcher.tsx': `
export const ViewSwitcher = ({ schema }: { schema: any }) => <div>{schema.onViewChange}</div>;
`,
    });
    expect(analyze(root).findings).toEqual([]);
  });

  it('does not follow a child handed a DIFFERENT document', () => {
    // `'dashboard'.onRowClick`, from the second cut: a dashboard lays out widgets
    // and each gets its own `schema`, so the widget's `schema.onRowClick` is a
    // read of the WIDGET's document.
    const root = tree('other-document', {
      'packages/types/src/zod/base.zod.ts': BASE,
      'packages/types/src/zod/complex.zod.ts': arm('dashboard', 'DashboardSchema', ["components: z.array(z.any()).optional()"]),
      'packages/plugin-dashboard/src/index.tsx': `
import { ComponentRegistry } from '@object-ui/core';
import { DashboardRenderer } from './DashboardRenderer';
ComponentRegistry.register('dashboard', DashboardRenderer, { namespace: 'view' });
`,
      'packages/plugin-dashboard/src/DashboardRenderer.tsx': `
import { Widget } from './Widget';
export const DashboardRenderer = ({ schema }: { schema: any }) => (
  <div>{schema.components.map((widget: any) => <Widget key={widget.id} schema={widget} />)}</div>
);
`,
      'packages/plugin-dashboard/src/Widget.tsx': `
export const Widget = ({ schema }: { schema: any }) => <Table onRowClick={schema.onRowClick} />;
`,
    });
    expect(analyze(root).findings).toEqual([]);
  });

  it('says nothing about a type that has no arm', () => {
    // `'kanban-ui'`, `'kanban-enhanced'`, and the whole app-shell surface. An arm
    // that does not exist cannot have lost a member.
    const root = tree('no-arm', {
      'packages/types/src/zod/base.zod.ts': BASE,
      'packages/app-shell/src/notifications.tsx': `
import { ComponentRegistry } from '@object-ui/core';
ComponentRegistry.register('notifications', ({ schema }: any) => <X onDismiss={schema.onDismiss} />, {});
`,
    });
    const result = analyze(root);
    expect(result.counters.registrations).toBe(1);
    expect(result.counters.armed).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('resolves a spread shape, so a member reached through `pick().shape` counts as declared', () => {
    // Four of the first cut's findings were `chatbot-enhanced` / `chatbot-floating`
    // slots that ARE declared — through `...ChatbotSharedMirrorShape`, which is
    // `ChatbotSchema.pick({ … }).shape`.
    const root = tree('spread', {
      'packages/types/src/zod/base.zod.ts': BASE,
      'packages/types/src/zod/complex.zod.ts': `
import { z } from 'zod';
import { BaseSchema } from './base.zod';
import { handlerKeyRefusal } from './tombstone.zod';
export const ChatbotSchema = BaseSchema.extend({
  type: z.literal('chatbot'),
  ${RUNTIME_SLOT('onSend')},
  ${RUNTIME_SLOT('onError')},
});
const SharedShape = ChatbotSchema.pick({ onSend: true, onError: true }).shape;
export const ChatbotEnhancedSchema = BaseSchema.extend({
  type: z.literal('chatbot-enhanced'),
  ...SharedShape,
});
`,
      'packages/plugin-chatbot/src/renderer.tsx': `
import { ComponentRegistry } from '@object-ui/core';
ComponentRegistry.register('chatbot-enhanced', ({ schema }: any) => (
  <Chat onSend={schema.onSend} onError={schema.onError} />
), { namespace: 'plugin' });
`,
    });
    const result = analyze(root);
    expect(result.findings).toEqual([]);
    expect(result.counters.judged).toBe(2);
  });

  it('refuses to judge a read on an arm whose shape spreads something it cannot follow', () => {
    // The one direction a gate must never take is a red nobody can act on. An
    // unresolved spread means the member list is not fully known, so "undeclared"
    // is not a claim this reader is entitled to make.
    const root = tree('unresolved', {
      'packages/types/src/zod/base.zod.ts': BASE,
      'packages/types/src/zod/objectql.zod.ts': `
import { z } from 'zod';
import { BaseSchema } from './base.zod';
import { SpecFields } from '@objectstack/spec';
export const ObjectGridSchema = BaseSchema.extend({
  type: z.literal('object-grid'),
  ...SpecFields,
});
`,
      'packages/plugin-grid/src/index.tsx': `
import { ComponentRegistry } from '@object-ui/core';
ComponentRegistry.register('object-grid', ({ schema }: any) => <Grid onNavigate={schema.onNavigate} />, {});
`,
    });
    const result = analyze(root);
    expect(result.findings).toEqual([]);
    expect(result.counters.unjudgeable).toBe(1);
    expect(result.census[0].unjudgeable).toEqual(['SpecFields']);
  });

  it('resolves a bare alias base, so `BaseSchema = BaseSchemaCore` does not blank every arm', () => {
    // This one is a scar. `export const BaseSchema = BaseSchemaCore;` is a plain
    // alias; missing it made all 106 arms carry an unresolved base, which marked
    // every read unjudgeable and turned the repository run into a green that had
    // judged 23 of 62 read sites.
    const root = tree('alias-base', {
      'packages/types/src/zod/base.zod.ts': `
import { z } from 'zod';
const BaseSchemaCore = z.object({ id: z.string().optional() });
export const BaseSchema = BaseSchemaCore;
`,
      'packages/types/src/zod/form.zod.ts': arm('button', 'ButtonSchema', [RUNTIME_SLOT('onClick')]),
      'packages/components/src/button.tsx': `
import { ComponentRegistry } from '@object-ui/core';
ComponentRegistry.register('button', ({ schema }: any) => <b onClick={schema.onClick} />, {});
`,
    });
    const result = analyze(root);
    expect(result.counters.unjudgeable).toBe(0);
    expect(result.counters.judged).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('judges only `on*` names', () => {
    expect(isHandlerKey('onCardClick')).toBe(true);
    expect(isHandlerKey('onclick')).toBe(false);
    expect(isHandlerKey('on')).toBe(false);
    expect(isHandlerKey('once')).toBe(false);
    expect(isHandlerKey('columns')).toBe(false);
  });

  it('reads a registration\'s type off a string literal, and skips a computed one', () => {
    const source = parseSource(
      `ComponentRegistry.register('kanban', A, {});\nComponentRegistry.register(type, B, {});\nOther.register('x', C);`,
      'probe.tsx',
    );
    expect(registrationsIn(source).map((r) => r.type)).toEqual(['kanban']);
  });
});

describe('check-handler-key-read-sites — this repository', () => {
  const result = analyze(repoRoot);

  /**
   * The size guard. Every assertion above runs on a throwaway tree, so a
   * refactor that emptied this repository's walk would satisfy all of them while
   * reporting a pass over nothing.
   */
  it('walks a real population on both halves, and judges something in it', () => {
    expect(result.counters.arms).toBeGreaterThan(50);
    expect(result.counters.files).toBeGreaterThan(200);
    expect(result.counters.registrations).toBeGreaterThan(100);
    expect(result.counters.armed).toBeGreaterThan(10);
    expect(
      result.counters.judged,
      'no registered renderer in this repository reads a handler key off a document whose arm ' +
        'this gate could resolve, so its green says nothing',
    ).toBeGreaterThan(20);
  });

  it('is green, with the objectui#7664 read sites among the ones it judged', () => {
    expect(
      result.findings.map((f) => f.key),
      'a registered renderer reads a handler key its arm does not declare',
    ).toEqual([]);

    // Named rather than counted: these three are the reason this gate exists.
    // They sit four hops from `ComponentRegistry.register('kanban', …)`, so a
    // walk that stopped following the document would leave the green above
    // intact while losing exactly the instance the card was filed for.
    const judged = result.census.map((c) => `${c.type}.${c.key}`);
    expect(judged).toContain('kanban.onCardClick');
    expect(judged).toContain('kanban.onCardMove');
    expect(judged).toContain('kanban.onQuickAdd');
    for (const key of ['onCardClick', 'onCardMove', 'onQuickAdd']) {
      const row = result.census.find((c) => c.type === 'kanban' && c.key === key);
      expect(row?.declared, `'kanban'.${key} must be a declared member`).toBe(true);
      expect(row?.disposition, `'kanban'.${key} must carry the RUNTIME SLOT disposition`).toBe('runtime-slot');
    }
  });

  /**
   * The ledger is an EXEMPTION list, never the population, and it only shrinks.
   * Both directions are pinned: a row whose defect is gone reads as a live waiver
   * for nothing, and a row with no card is indistinguishable from switching the
   * gate off for that read site.
   */
  it('keeps every exemption honest — no stale row, and a card on each', () => {
    expect(
      result.stale,
      'a KNOWN_UNDECLARED_READS row names a read site this gate no longer finds — the defect it ' +
        'waives is fixed, so the row is a live waiver for nothing. Delete it.',
    ).toEqual([]);

    for (const [key, card] of KNOWN_UNDECLARED_READS) {
      expect(card, `KNOWN_UNDECLARED_READS[${key}] must name the card that owns the fix`).toMatch(/objectui#\d+/);
    }
  });

  it('is wired where the sibling parse-based gates run', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(manifest.scripts['check:handler-key-reads']).toBe('node scripts/check-handler-key-read-sites.mjs');

    const ci = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    expect(ci, 'the gate must run in CI, next to the other source-parsing gates').toContain(
      'run: pnpm check:handler-key-reads',
    );

    // The page that inventories the gates is pinned by command (objectui#3653), so
    // this would fail there too — asserted here as well because a reader looking
    // for this gate looks at this file first.
    const page = fs.readFileSync(path.join(repoRoot, 'content/docs/guide/ci-cd-pipeline.md'), 'utf8');
    expect(page).toContain('check:handler-key-reads');
  });

  it('derives its arms from the mirrors, including the one the card is about', () => {
    const { arms } = collectArms(repoRoot);
    const kanban = arms.get('kanban');
    expect(kanban?.schema).toBe('KanbanSchema');
    expect(kanban?.file).toBe('complex.zod.ts');
    expect(kanban?.unresolved, 'the `kanban` arm must resolve completely, or its reads go unjudged').toEqual([]);
    expect(kanban?.members.get('onCardClick')).toBe('runtime-slot');
    expect(kanban?.members.get('onColumnAdd')).toBe('retired');
  });
});
