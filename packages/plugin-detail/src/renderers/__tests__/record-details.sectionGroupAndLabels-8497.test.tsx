/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `record:details` — the field-label ladder an enumerated `fields` list walks
 * (objectui#8497, finding 2).
 *
 * An enumerated `sections[].fields` list resolved its labels ONLY through the
 * i18n bundle. With no bundle — the default for an app that never configured
 * translations — every detail page rendered raw snake_case field names under a
 * `text-transform: uppercase`, while the object's own `label:` sat unread one
 * lookup away and neither `validate` nor `lint` reported a thing.
 *
 * `DetailSection` renders `fieldLabel(objectName, field.name, field.label ||
 * field.name)` — an i18n lookup whose third argument is the fallback — so the
 * ladder is `bundle key -> field.label -> field.name`. An enumerated list is
 * bare strings, which the renderer turned into `{ name }` with NO `label`:
 * rung 2 was missing entirely and the ladder collapsed to two rungs. All three
 * are asserted below, ⛔ not just the first and the last.
 *
 * The label is not invented here. It is the same read the GROUP-derived body
 * already performed (`toField` in `synth/buildDefaultPageSchema.ts`:
 * `label: f.label || name`), which is exactly why the platform's synthesized
 * default record page showed declared labels while a hand-authored enumeration
 * of the same fields did not.
 *
 * Every leg navigates by {@link requireLiveBody}, whose anchor is a section no
 * leg is about, and whose failure text is deliberately unlike any content
 * assertion here — so a dead harness can never read as a strong refusal
 * (objectui#8504). It uses no positional navigation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as React from 'react';
import { RecordContextProvider } from '@object-ui/react';
import { I18nProvider, createI18n } from '@object-ui/i18n';
import { RecordDetailsRenderer } from '../record-details';

/* ─────────────────────────────────────────────────────────────────────────────
 * Fixture
 *
 * `name` is DECLARED and left UNSET on every record below. The renderer's
 * page-H1 dedupe ladder resolves its title candidate to `name`, finds no value
 * there and hides nothing — without it the ladder's ADR-0079 derivation rung
 * ends on the first title-eligible field and would silently drop one of the
 * rows these legs assert on (the objectui#8175 trap).
 * ─────────────────────────────────────────────────────────────────────────── */

const OBJECT_NAME = 'clm_contract';

const objectSchema = {
  name: OBJECT_NAME,
  fields: {
    name: { type: 'text', label: 'Contract Name' },
    // Members of the `parties` group — and the two fields whose declared labels
    // the enumerated body used to lose.
    our_entity: { type: 'text', label: 'Our Signing Entity', group: 'parties' },
    counterparty: { type: 'text', label: 'Counterparty', group: 'parties' },
    // Ungrouped: reachable only by enumeration, so the two bodies below name
    // DIFFERENT fields and neither can accidentally satisfy the other's leg.
    term_months: { type: 'number', label: 'Term (Months)' },
    // ⭐ Rung 3's control: declares NO label at all, so its row must still read
    // as its raw name. Without it, "the declared label wins" and "there is no
    // rung 3 left" are indistinguishable.
    auto_renew: { type: 'boolean' },
  },
  fieldGroups: [{ key: 'parties', label: 'Parties' }],
};

const record = {
  our_entity: 'Acme Holdings',
  counterparty: 'Globex',
  term_months: 24,
  auto_renew: true,
};

/** The sibling section every leg keeps: well-formed, enumerated, never a group. */
const WELL_FORMED_SIBLING = {
  name: 'terms',
  label: 'Terms',
  fields: ['term_months'],
};

const renderDetails = (
  schema: Record<string, unknown>,
  options: { i18n?: ReturnType<typeof createI18n> } = {},
) => {
  const tree = (
    <RecordContextProvider
      objectName={OBJECT_NAME}
      recordId="C1"
      data={record}
      objectSchema={objectSchema}
    >
      <RecordDetailsRenderer schema={schema as any} />
    </RecordContextProvider>
  );
  return render(
    options.i18n ? <I18nProvider instance={options.i18n}>{tree}</I18nProvider> : tree,
  );
};

/**
 * The one landmark every leg navigates by, and the reason no leg navigates by
 * the thing under repair.
 *
 * ⚠️ Its failure text is deliberately unlike every other failure in this file.
 * If a change to `record:details` erased the body wholesale, a leg that queried
 * the GROUP section directly would fail with "Unable to find an element" — the
 * same sentence a genuine refusal produces — and the pin would read strong
 * while measuring nothing (objectui#8504). Here the harness dies first, loudly,
 * and says so. The harness-kill leg below proves this actually fires.
 */
const requireLiveBody = (): HTMLElement => {
  const heading = screen.queryAllByText('Terms');
  if (heading.length !== 1) {
    throw new Error(
      `HARNESS DEAD: expected exactly 1 well-formed sibling section heading, found ${heading.length}`,
    );
  }
  return document.body;
};

/**
 * ⚠️ `queryByText` throws on MULTIPLE matches as well as returning null on
 * none, and inside a `waitFor` that surfaces as a timeout pointing at the
 * component rather than at the query. Every count below goes through
 * `queryAllByText(...).length`, which reports both directions honestly.
 */
const textCount = (text: string): number => screen.queryAllByText(text).length;

/* ── the `/api/v1/security/explain` recording double ────────────────────────
 * `useRecordEditable` degrades to the GLOBAL `fetch` when no host supplies an
 * authenticated one, and under happy-dom that is a real HTTP client. A router,
 * not a sink: `afterEach` fails on any URL outside the one route it serves, so
 * an escape elsewhere reds here instead of vanishing into the hook's
 * best-effort `catch`. Nothing in this file reads the verdict.
 * ─────────────────────────────────────────────────────────────────────────── */

const EXPLAIN_ROUTE = '/api/v1/security/explain';
let explainCalls: string[] = [];

beforeEach(() => {
  explainCalls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(
        input && typeof input === 'object' && 'url' in input ? (input as { url: unknown }).url : input,
      );
      explainCalls.push(url);
      if (url !== EXPLAIN_ROUTE) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ record: { visible: true } }) };
    }),
  );
});

afterEach(() => {
  expect(explainCalls.filter((url) => url !== EXPLAIN_ROUTE)).toEqual([]);
  // Unmount BEFORE restoring the real `fetch` — vitest runs `afterEach` in
  // reverse registration order, so unstubbing first would leave the tree
  // mounted with the real global back in place (objectui#7439).
  cleanup();
  vi.unstubAllGlobals();
});

/* ═══════════════════════════════════════════════════════════════════════════
 * B — the label ladder: bundle key -> declared label -> field name
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('record:details — an enumerated `fields` list walks all THREE label rungs', () => {
  it('RUNG_2_DECLARED_LABEL: with no bundle, the label the object declares beats the raw field name', () => {
    renderDetails({
      sections: [{ name: 'parties_enum', label: 'Parties', fields: ['our_entity', 'counterparty'] }, WELL_FORMED_SIBLING],
    });
    requireLiveBody();

    expect(textCount('Our Signing Entity')).toBe(1);
    expect(textCount('Counterparty')).toBe(1);
    // The raw names are what shipped; their absence is half the claim.
    expect(textCount('our_entity')).toBe(0);
    expect(textCount('counterparty')).toBe(0);
  });

  it('RUNG_1_BUNDLE_WINS: a bundle key still outranks the declared label (an app WITH translations is unchanged)', () => {
    const instance = createI18n({
      defaultLanguage: 'zh',
      detectBrowserLanguage: false,
      resources: {
        zh: { app: { fields: { [OBJECT_NAME]: { our_entity: '我方签约主体' } } } },
      },
    });

    renderDetails(
      {
        sections: [{ name: 'parties_enum', label: 'Parties', fields: ['our_entity', 'counterparty'] }, WELL_FORMED_SIBLING],
      },
      { i18n: instance },
    );
    requireLiveBody();

    expect(textCount('我方签约主体')).toBe(1);
    // Rung 2 must not have overtaken rung 1 …
    expect(textCount('Our Signing Entity')).toBe(0);
    // … while the field the bundle does NOT cover still gets its declared
    // label, which is what proves rung 2 is reached per FIELD, not per app.
    expect(textCount('Counterparty')).toBe(1);
  });

  it('RUNG_3_FIELD_NAME: a field declaring no label still falls back to its own name', () => {
    renderDetails({
      sections: [{ name: 'renewal', label: 'Renewal', fields: ['auto_renew'] }, WELL_FORMED_SIBLING],
    });
    requireLiveBody();

    expect(textCount('auto_renew')).toBe(1);
  });

  it('AUTHORED_LABEL_WINS: an explicit entry `label` is still the author\'s override', () => {
    renderDetails({
      sections: [
        {
          name: 'parties_enum',
          label: 'Parties',
          fields: [{ name: 'our_entity', label: 'Signatory' }],
        },
        WELL_FORMED_SIBLING,
      ],
    });
    requireLiveBody();

    expect(textCount('Signatory')).toBe(1);
    expect(textCount('Our Signing Entity')).toBe(0);
  });
});

