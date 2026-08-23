/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `dashboard` — the honoured keys are published, per key, and the two ruled
 * out stay pinned out (objectui#5742).
 *
 * ## The card
 *
 * The `dashboard` registration published exactly three inputs (`columns`,
 * `gap`, `className`) while `DashboardRenderer` honoured `widgets`, `label` /
 * legacy `title`, `description`, `header`, `globalFilters`, `dateRange` and
 * `refreshInterval`. `inputs` is not documentation: it is the published
 * authoring surface (`gen-manifest.ts` serializes it into
 * `sdui.manifest.json` — the save gate and parser whitelist — and into
 * `sdui-intrinsics.d.ts`, and `dashboard` is in `PUBLIC_BLOCKS`). So
 * `validateTree` warned authors off keys that work — `widgets` included, the
 * very prop whose CONTENTS the objectui#5709 `unconsumed-widget-option`
 * warning reasons about, two diagnostics reading incoherently side by side.
 *
 * ## The per-key line (the shipped #4668 / #5091 precedents)
 *
 * A key is DECLARED only when both hold: the renderer reads it AND
 * `@objectstack/spec`'s strict `DashboardSchema` accepts it — so the manifest
 * never offers a key the save gate refuses. That line puts seven keys in and
 * keeps two honest exclusions out:
 *
 *   - `title` — the legacy objectui spelling of the spec-canonical `label`
 *     (framework#1878). The spec REJECTS it by name, so declaring it would
 *     publish a key an author could not save. The `schema.title ||
 *     schema.label` read STAYS — documents in the wild carry it — which is
 *     exactly the #5091 shape: non-author surface, still read.
 *   - `aria` — the spec carries a TOMBSTONE for `dashboard.aria` (removed at
 *     the #3896 audit close-out, "no dashboard renderer ever applied it").
 *     Measured here too: this package has NO read site for `schema.aria`, so
 *     unlike `title` there is no "renderer still reads it" leg — the issue
 *     body's listing of `aria` among the honoured reads was wrong on that one
 *     key. The pin is that it stays unpublished and spec-refused.
 *
 * ## The open question this file deliberately does NOT answer
 *
 * `schema.name` is also read (it keys the `dashboards.{name}.*` translation
 * lookups) and the spec ACCEPTS `name` (requires it, on the document form).
 * But it is a document identity key, written by the stored-dashboard path
 * (`DashboardView` hands the loaded document to the renderer); no docs
 * example authors it inline and no sibling registration declares a `name`
 * input. Whether the INLINE node should publish it is raised as an open
 * question on objectui#5742 rather than guessed — its absence from `inputs`
 * is therefore *pending*, not ruled. If the ruling lands "declare", add it to
 * the registration and to `DECLARED` below; if "non-author", move it into the
 * exclusion pins with the producer evidence above.
 *
 * ## Why every positive has a control
 *
 * "No diagnostic" is also what a silenced check looks like: the undeclared
 * probe key must still draw `unknown-prop`, the declared control must be
 * published, and the spec must accept the full declared document — otherwise
 * every absence/rejection assertion here would pass against a registry that
 * published nothing or a schema that refuses everything (the same pairing
 * `ga-honoured-inputs-author-reach.test.ts` and `gridNonAuthorKeys.test.tsx`
 * use, for the same reason).
 *
 * Module-scope registration import, not a hook (AGENTS.md §测试纪律): the
 * registration is the fixture, and its cold transform must not be billed to a
 * bounded test/hook window.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { DashboardSchema } from '@objectstack/spec/ui';
import { manifestFromConfigs, validateTree, generateDts, propsName } from '@object-ui/sdui-parser';
import type { Diagnostic, SchemaElement } from '@object-ui/sdui-parser';
import { ActionProvider } from '@object-ui/react';
import { DashboardRenderer } from '../DashboardRenderer';
// Module scope, not a hook: this import IS the registration.
import '../index';

/**
 * The manifest exactly as `gen-manifest.ts` / `dump-public-manifest.mjs`
 * build the published one — `getPublicConfigs()` through
 * `manifestFromConfigs` — so the verdicts below are the ones a real author
 * gets, not ones a hand-written fixture was shaped to produce. (Only this
 * package's registrations are loaded here; `dashboard` is among them, which
 * is all these assertions read.)
 */
const manifest = manifestFromConfigs(
  ComponentRegistry.getPublicConfigs() as unknown as Parameters<typeof manifestFromConfigs>[0],
);

const diagnose = (node: Record<string, unknown>): Diagnostic[] =>
  validateTree({ type: 'dashboard', ...node } as unknown as SchemaElement, manifest).diagnostics;

/** Diagnostics naming a specific prop (the messages quote prop names). */
const codesMentioning = (node: Record<string, unknown>, prop: string): string[] =>
  diagnose(node)
    .filter((d) => d.message.includes(`"${prop}"`))
    .map((d) => d.code);

/** The spec's verdict on a minimal legal document plus one patch. */
const specVerdict = (patch: Record<string, unknown>) =>
  DashboardSchema.safeParse({ name: 'sales_ops', label: 'Sales Ops', widgets: [], ...patch });

/** Unrecognized KEYS from a failed parse — a key verdict, never a document one. */
const unrecognizedKeys = (result: { success: boolean; error?: unknown }): string[] =>
  ((result as { error?: { issues: Array<{ code: string; keys?: string[] }> } }).error?.issues ?? [])
    .filter((issue) => issue.code === 'unrecognized_keys')
    .flatMap((issue) => issue.keys ?? []);

/**
 * The newly published keys, each with a spec-legal sample value. The sample
 * doubles as the spec-acceptance evidence: `full declared document` below
 * parses all of them at once.
 */
const DECLARED: Array<[string, unknown]> = [
  ['widgets', [{ id: 'w1', type: 'bar', dataset: 'invoices', values: ['count'] }]],
  ['label', 'Sales Overview'],
  ['label', { en: 'Sales Overview', 'zh-CN': '销售总览' }],
  ['description', 'The numbers behind the pipeline'],
  ['description', { en: 'The numbers behind the pipeline' }],
  ['header', { showTitle: false, actions: [{ label: 'Open', actionUrl: '/x' }] }],
  ['globalFilters', [{ field: 'region', label: 'Region', type: 'select' }]],
  ['dateRange', { field: 'created_at', defaultRange: 'last_30_days' }],
  ['refreshInterval', 30],
];

/** Values matching NO declared arm — each must still be reported. */
const OFF_ARM: Array<[string, unknown]> = [
  ['widgets', {}],
  ['label', 42],
  ['description', 42],
  ['header', true],
  ['globalFilters', 'region'],
  ['dateRange', []],
  ['refreshInterval', '30'],
];

/** The two keys ruled OUT, with the evidence a reader can re-check. */
const NON_AUTHOR = [
  {
    key: 'title',
    sample: 'Legacy Ops',
    why:
      'legacy spelling of the spec-canonical `label` (framework#1878) — `DashboardSchema` '
      + 'rejects it by name, so publishing it would offer a key the save gate refuses',
  },
  {
    key: 'aria',
    sample: { ariaLabel: 'Ops' },
    why:
      'spec tombstone (#3896 audit close-out): no dashboard renderer ever applied it, and '
      + 'this package has no `schema.aria` read site',
  },
] as const;

afterEach(cleanup);

describe('the manifest resolves `dashboard`, and the check is live (objectui#5742)', () => {
  it('resolves the block (reachability before any absence claim)', () => {
    expect(manifest.components['dashboard']).toBeTruthy();
    expect(diagnose({}).map((d) => d.code)).not.toContain('unknown-component');
  });

  it('an undeclared key still draws unknown-prop — the control', () => {
    expect(codesMentioning({ objectui5742NotAProp: 'x' }, 'objectui5742NotAProp')).toContain(
      'unknown-prop',
    );
  });
});

describe('the honoured keys now validate clean on an inline dashboard node (objectui#5742)', () => {
  it.each(DECLARED)('%s draws no diagnostic', (key, value) => {
    expect(codesMentioning({ [key]: value }, key), `dashboard.${key}`).toEqual([]);
  });

  it.each(OFF_ARM)('%s still rejects an off-arm value — declaring is not disarming', (key, value) => {
    expect(codesMentioning({ [key]: value }, key)).toContain('type-mismatch');
  });

  it('the spec accepts the full declared document — the declarations rest on its verdicts', () => {
    const result = specVerdict({
      description: 'x',
      header: { showTitle: true },
      columns: 4,
      gap: 6,
      refreshInterval: 30,
      dateRange: { field: 'created_at', defaultRange: 'last_30_days' },
      globalFilters: [{ field: 'region', label: 'Region', type: 'select' }],
    });
    expect(result.success, JSON.stringify((result as { error?: unknown }).error ?? {})).toBe(true);
  });

  it('both arms of the two union keys are spec-derived, not guessed', () => {
    // `label` / `description` are `string | inline locale map` on the spec —
    // the declared `['string', 'object']` arms restate exactly that, and a
    // kind matching neither arm is refused by BOTH authorities.
    for (const key of ['label', 'description']) {
      expect(specVerdict({ [key]: 'plain' }).success).toBe(true);
      expect(specVerdict({ [key]: { en: 'plain', 'zh-CN': '文' } }).success).toBe(true);
      expect(specVerdict({ [key]: 42 }).success).toBe(false);
    }
  });
});

describe('the two ruled-out keys stay unpublished — and checkably so (objectui#5742)', () => {
  const inputNames = (namespace?: string): string[] =>
    ((ComponentRegistry.getConfig('dashboard', namespace) as { inputs?: Array<{ name: string }> })
      ?.inputs ?? []).map((i) => i.name);

  it.each([undefined, 'view'] as const)(
    'the registration publishes neither, looked up %s',
    (namespace) => {
      const declared = inputNames(namespace);
      for (const { key, why } of NON_AUTHOR) {
        expect(declared, `\`dashboard\` now publishes \`${key}\` — but ${why}.`).not.toContain(key);
      }
      // The declared controls: absence above means something only while the
      // same registration really publishes the ruled-in surface.
      expect(declared).toContain('label');
      expect(declared).toContain('widgets');
    },
  );

  it('the spec rejects `title` by name — the exclusion is checkable', () => {
    const result = specVerdict({ title: 'Legacy Ops' });
    expect(result.success, 'the spec now ACCEPTS dashboard.title — re-open objectui#5742').toBe(false);
    expect(unrecognizedKeys(result)).toContain('title');
  });

  it('the spec refuses every `aria` value — the tombstone is still standing', () => {
    const result = specVerdict({ aria: { ariaLabel: 'Ops' } });
    expect(result.success, 'the spec re-admitted dashboard.aria — re-open objectui#5742').toBe(false);
    const ariaIssue = (result as { error: { issues: Array<{ path: unknown[]; message: string }> } })
      .error.issues.find((i) => i.path.join('.') === 'aria');
    expect(ariaIssue, 'no issue at path `aria`').toBeTruthy();
    // The tombstone names the removal; a mere shape error would not.
    expect(ariaIssue!.message).toMatch(/removed/);
  });

  it.each(NON_AUTHOR)('$key draws unknown-prop from the real validator — the ruled outcome', ({ key, sample }) => {
    expect(
      codesMentioning({ [key]: sample }, key),
      `\`${key}\` no longer draws \`unknown-prop\`. If that is deliberate it means the key was`
        + ' declared — which the objectui#5742 triage forbids for this key.',
    ).toContain('unknown-prop');
  });
});

describe('the legacy `title` read stays — non-author surface, still honoured (objectui#5742)', () => {
  const renderDashboard = (schema: Record<string, unknown>) =>
    render(
      <ActionProvider>
        <DashboardRenderer schema={{ type: 'dashboard', widgets: [], header: {}, ...schema } as never} />
      </ActionProvider>,
    );

  it('a wild document carrying only the legacy spelling keeps its header title', () => {
    renderDashboard({ title: 'Legacy Ops' });
    expect(screen.getByRole('heading', { name: 'Legacy Ops' })).toBeInTheDocument();
  });

  it('the canonical spelling renders too — the read above is the fallback, not the contract', () => {
    renderDashboard({ label: 'Canonical Ops' });
    expect(screen.getByRole('heading', { name: 'Canonical Ops' })).toBeInTheDocument();
  });
});

describe('the published artifacts carry the change — same generators as gen-manifest (objectui#5742)', () => {
  it('the manifest entry publishes exactly the triaged input list', () => {
    // Exact list, not `toContain`: the failure mode both ways is silent — a
    // shrink un-publishes a key authors rely on, a growth publishes one the
    // triage ruled out.
    expect(manifest.components['dashboard'].inputs.map((i) => i.name)).toEqual([
      'widgets',
      'label',
      'description',
      'header',
      'globalFilters',
      'dateRange',
      'refreshInterval',
      'columns',
      'gap',
      'className',
    ]);
  });

  it('the generated JSX intrinsics type the new keys, unions included', () => {
    const dts = generateDts(manifest);
    const match = dts.match(
      new RegExp(`export interface ${propsName('dashboard')} extends SduiBaseProps \\{[^}]*\\}`),
    );
    expect(match, `no ${propsName('dashboard')} interface in the generated d.ts`).toBeTruthy();
    const block = match![0];
    expect(block).toContain('widgets?: unknown[];');
    expect(block).toContain('label?: string | Record<string, unknown>;');
    expect(block).toContain('description?: string | Record<string, unknown>;');
    expect(block).toContain('header?: Record<string, unknown>;');
    expect(block).toContain('globalFilters?: unknown[];');
    expect(block).toContain('dateRange?: Record<string, unknown>;');
    expect(block).toContain('refreshInterval?: number;');
    // The exclusions stay out of the type surface an author compiles against.
    expect(block).not.toMatch(/\btitle\b/);
    expect(block).not.toMatch(/\baria\b/);
  });
});
