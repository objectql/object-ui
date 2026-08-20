/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * MEASUREMENT HARNESS for objectui#5401 — evidence, NOT a shipped contract.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This file exists to make the roll-back on objectui#5401 checkable rather
 * than merely asserted. It records what the SHIPPED pipeline does today, so a
 * maintainer re-ruling that card can re-run the measurement in one command
 * instead of taking a report's word for it.
 *
 * It is deliberately NOT on a PR. Several of the verdicts pinned below are the
 * DEFECT under decision, not desired behaviour — in particular every case
 * marked `[DEFECT]`. Do not read a green run here as "the platform is
 * correct"; read it as "the platform still behaves the way the #5401 report
 * measured it".
 *
 * The card's ruling (2026-08-20, option A) was 「A 让 record:alert 认
 * visibleWhen(推荐)」 — make `record:alert` honour `visibleWhen`. The three
 * groups below are what falsify that ruling's premise:
 *
 *   Group 1 — `record:alert` ALREADY honours node-level `visibleWhen`, on both
 *             polarities, identically to `record:path`. There is nothing to
 *             implement for the case the card describes.
 *
 *   Group 2 — node-level `visibleWhen` cannot see `record` AT ALL, on any
 *             block. `SchemaRenderer` builds its evaluator from the ambient
 *             predicate scope (app-shell's `ExpressionProvider`: `current_user`
 *             / `user` / `ctx.user` / `os.user` / `app` / `data` / `features`)
 *             plus `data: dataSource` (the data-source ADAPTER) and
 *             `page: pageVariables`. No `record` in any of them. So a
 *             `record.*` predicate fails to resolve, this surface is
 *             fail-SOFT, and the block stays VISIBLE. `record:path` — the
 *             sibling the card calls "honoured" — has exactly the same hole.
 *
 *   Group 3 — `properties.visible` DOES bind `record`, on both polarities.
 *             It is not a "renderer-private prop that nothing normalizes":
 *             `@objectstack/spec`'s `RecordAlertProps` declares it as
 *             `z.union([z.boolean(), ExpressionInputSchema])` and aliases
 *             `visibleWhen -> visible` on this very surface.
 *
 * Together: implementing the ruling would move a `record.*` predicate OUT of
 * the only scope on this component where `record` is bound (group 3) and INTO
 * one where it is not (group 2) — turning a working gate into a permanently
 * visible banner, which is the exact failure mode the card was filed to stop.
 *
 * Every "hidden" verdict below is PAIRED with a "shown" mount of the same
 * schema, because this renderer has three other `return null` paths (dismissed,
 * empty record, and the props gate). Without the pair, "nothing rendered" does
 * not mean "the gate said no".
 */

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RecordContextProvider, SchemaRenderer, PredicateScopeProvider } from '@object-ui/react';
import '../../index';

/**
 * The ambient scope app-shell actually mounts on a record page
 * (`providers/ExpressionProvider.tsx` — `data` is `{}` at both of its two call
 * sites, and the `SchemaRendererProvider` `dataSource` is the connector
 * adapter). Reproduced verbatim so the absence of `record` is a property of the
 * fixture that matches production, not an omission in the test.
 */
const APP_SCOPE = {
  current_user: { id: 'u1', name: 'Ada', email_verified: true },
  user: { id: 'u1', email_verified: true },
  ctx: { user: { id: 'u1' } },
  os: { user: { id: 'u1' } },
  app: {},
  data: {},
  features: { multiOrgEnabled: true },
};

const IN_REVIEW = { id: 'r1', status: 'in_review' };
const DONE = { id: 'r1', status: 'done' };
const TITLE = 'Awaiting review';

const cel = (source: string) => ({ dialect: 'cel', source });

function mount(node: unknown, record: Record<string, unknown>) {
  return render(
    <PredicateScopeProvider scope={APP_SCOPE}>
      <RecordContextProvider objectName="showcase_task" recordId="r1" data={record}>
        <SchemaRenderer schema={node as never} />
      </RecordContextProvider>
    </PredicateScopeProvider>,
  );
}

const alertShown = (c: HTMLElement) => (c.textContent || '').includes(TITLE);
const pathShown = (c: HTMLElement) => c.innerHTML.length > 0;

const ALERT = { type: 'record:alert', properties: { title: TITLE } };
const PATH = {
  type: 'record:path',
  properties: {
    statusField: 'status',
    stages: [
      { value: 'in_review', label: 'In Review' },
      { value: 'done', label: 'Done' },
    ],
  },
};

afterEach(() => cleanup());

describe('#5401 group 1 — record:alert ALREADY honours node-level `visibleWhen`', () => {
  it('a constant-false `visibleWhen` hides the banner; the same schema without it renders', () => {
    expect(alertShown(mount({ ...ALERT, visibleWhen: cel('false') }, DONE).container)).toBe(false);
    cleanup();
    // The pair. Without it, `false` above could equally mean "never rendered".
    expect(alertShown(mount(ALERT, DONE).container)).toBe(true);
  });

  it('a `current_user` predicate keeps its verdict on BOTH polarities', () => {
    // `current_user.email_verified` is `true` in APP_SCOPE.
    expect(
      alertShown(mount({ ...ALERT, visibleWhen: cel('current_user.email_verified == false') }, DONE).container),
    ).toBe(false);
    cleanup();
    expect(
      alertShown(mount({ ...ALERT, visibleWhen: cel('current_user.email_verified == true') }, DONE).container),
    ).toBe(true);
  });

  it('`record:path` — the sibling the card calls "honoured" — behaves identically', () => {
    expect(pathShown(mount({ ...PATH, visibleWhen: cel('false') }, DONE).container)).toBe(false);
    cleanup();
    expect(pathShown(mount(PATH, DONE).container)).toBe(true);
  });
});

describe('#5401 group 2 [DEFECT] — node-level `visibleWhen` does not bind `record`, on ANY block', () => {
  it('[DEFECT] a `record.*` predicate on record:alert is inert — visible whatever the record says', () => {
    // Both mounts should differ if `record` were bound. Neither does: the
    // predicate cannot resolve, the surface is fail-soft, so the banner shows.
    expect(
      alertShown(mount({ ...ALERT, visibleWhen: cel("record.status == 'in_review'") }, DONE).container),
    ).toBe(true);
    cleanup();
    expect(
      alertShown(mount({ ...ALERT, visibleWhen: cel("record.status == 'in_review'") }, IN_REVIEW).container),
    ).toBe(true);
  });

  it('[DEFECT] the same hole on record:path, so this is not a record:alert defect', () => {
    expect(pathShown(mount({ ...PATH, visibleWhen: cel("record.status == 'done'") }, DONE).container)).toBe(true);
    cleanup();
    expect(pathShown(mount({ ...PATH, visibleWhen: cel("record.status == 'zzz'") }, DONE).container)).toBe(true);
    cleanup();
    // Counter-probe for the two "shown" verdicts above: this block CAN be
    // hidden by this channel, so "shown" is a verdict and not an inability.
    expect(pathShown(mount({ ...PATH, visibleWhen: cel('false') }, DONE).container)).toBe(false);
  });
});

describe('#5401 group 3 — `properties.visible` DOES bind `record`, both polarities', () => {
  it('the showcase node, verbatim, gates correctly on the record', () => {
    // examples/app-showcase/src/ui/pages/task-detail.page.ts, unmodified.
    const showcase = {
      type: 'record:alert',
      properties: {
        severity: 'warning',
        icon: 'eye',
        title: TITLE,
        body: 'This task is in review — confirm the work before marking it done.',
        visible: "record.status == 'in_review'",
        dismissible: true,
      },
    };
    expect(alertShown(mount(showcase, IN_REVIEW).container)).toBe(true);
    cleanup();
    expect(alertShown(mount(showcase, DONE).container)).toBe(false);
  });
});

describe('#5401 group 4 [DEFECT] — the precedence collision the card actually measured', () => {
  it('[DEFECT] a co-declared `properties.visible` short-circuits `visibleWhen`, on every block type', () => {
    // `SchemaRenderer` hoists `properties.visible` onto `schema.visible`, and
    // its visibility chain tests `visible` BEFORE `visibleWhen`, so the node
    // gate is never consulted. This is what the card observed in the browser
    // as "adding visibleWhen to record:alert does nothing" — and it is generic,
    // not a property of this renderer.
    const withBoth = (type: string, extra: Record<string, unknown>) => ({
      type,
      properties: { visible: 'true', ...extra },
      visibleWhen: cel('false'),
    });
    expect(alertShown(mount(withBoth('record:alert', { title: TITLE }), DONE).container)).toBe(true);
    cleanup();
    expect(pathShown(mount(withBoth('record:path', PATH.properties), DONE).container)).toBe(true);
    cleanup();
    // And the paired control: drop `properties.visible`, the node gate bites.
    expect(alertShown(mount({ ...ALERT, visibleWhen: cel('false') }, DONE).container)).toBe(false);
  });
});
