/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `preview-samples.ts` ↔ `@objectstack/spec` conformance (objectui#3257, #3266).
 *
 * The preview gallery's samples are not test fixtures — they are the drafts the
 * metadata designers render, i.e. the worked EXAMPLE an author sees for each
 * metadata type. The implicit promise of an example is "copy this and it
 * works". Nothing was checking that promise, and it had already broken: the
 * `tool` sample declared `category` / `active` / `requiresConfirmation`, three
 * keys `ToolSchema` had been retired and now rejects BY NAME (objectstack#3896,
 * objectstack#3715 / ADR-0033 §2). Anyone copying it — a human, and far more
 * often a model generating metadata — produced a tool definition that
 * `ToolSchema.parse()` refuses outright. A bad example does not fail once; it
 * propagates.
 *
 * Nothing in the gallery validates a draft (previews render whatever they are
 * handed), so a sample can rot silently through any number of spec releases.
 * This test is the missing feedback loop: it makes a sample going stale a CI
 * failure instead of a lesson taught to the next author.
 *
 * HOW IT VALIDATES — samples are embedded in a whole stack:
 *
 *   ObjectStackSchema.safeParse({ tools: [SAMPLES.tool] })
 *
 * rather than reached through a hand-picked `XxxSchema` export. Two reasons,
 * both learned the hard way while writing this:
 *
 *  1. `ObjectStackSchema` IS the authoring contract — the shape an author may
 *     publish. Guessing the schema by name gets it wrong: the obvious pick for
 *     `email_template` is `EmailTemplateSchema`, which is the runtime send
 *     payload (`id` / `body` / `bodyType`); the authorable record is actually
 *     `EmailTemplateDefinitionSchema` (`name` / `label` / `subject` /
 *     `bodyHtml`). Reading the collection cannot pick the wrong one.
 *  2. It needs no Zod internals. Unwrapping `optional > array > …` by hand via
 *     `._def` would silently mis-resolve (or worse, vacuously pass) the day Zod
 *     changes its internals. Here the wrapper does the unwrapping, so this test
 *     asks precisely the question that matters: would this sample survive being
 *     published in a real stack?
 *
 * LIMIT — worth knowing before trusting a pass. This used to read "only some
 * element schemas are `.strict()`", and it named `views` / `jobs` /
 * `emailTemplates` as the lenient ones. Spec 17.0.0 closed that gap: those
 * three now reject unknown keys by name too, which is how the 17.0.0-rc.2 pin
 * bump caught this file's `view.list.object`, `job.concurrency` /
 * `job.timeoutMs` and `email_template.from` / `.to` — four stale samples that
 * had been passing precisely because the key was stripped instead of refused.
 *
 * Some element schemas are still non-strict, and for those a PASS proves the
 * sample is structurally sound, NOT that it is free of retired keys — the guard
 * is exactly as strict as the spec is. `RETIRED_KEYS` below covers the named
 * retirements regardless, which is the only reason the `tool` / `report` rows
 * mean anything: `report` reached SPEC_CLEAN by binding a dataset, and its
 * stripped pre-9.0 `object` / `groupBy` keys would not have failed anything on
 * their own.
 */

import { describe, it, expect } from 'vitest';
import { ObjectStackSchema } from '@objectstack/spec';
import { SAMPLES } from '../preview-samples';

/**
 * Sample type → the `ObjectStackSchema` collection that carries it. Only
 * top-level collections appear here; `validation` is nested and handled below.
 */
const STACK_COLLECTION: Record<string, string> = {
  object: 'objects',
  page: 'pages',
  view: 'views',
  dashboard: 'dashboards',
  report: 'reports',
  app: 'apps',
  action: 'actions',
  flow: 'flows',
  job: 'jobs',
  agent: 'agents',
  tool: 'tools',
  skill: 'skills',
  permission: 'permissions',
  position: 'positions',
  datasource: 'datasources',
  email_template: 'emailTemplates',
  translation: 'translations',
};

/**
 * Samples that MUST parse. This is the guard: any of these going stale — a
 * retired key re-added, a shape drifting from the spec — fails CI here.
 */
const SPEC_CLEAN = [
  'view',
  'job',
  'tool',
  'permission',
  'position',
  'email_template',
  // Promoted from KNOWN_STALE by objectui#3266.
  'action',
  'agent',
  'skill',
  'flow',
  'report',
  'validation',
  'datasource',
  'app',
  // Promoted from KNOWN_STALE by objectui#3446. The page's components carried
  // their config under `props`, which `PageComponentSchema.strict()` rejects by
  // name (ADR-0089 D3a) — the sole reason this row was quarantined. Fixed as
  // part of making the sample's block types resolvable: the mis-layered bag and
  // the unregistered `heading` type were one defect wearing two faces, since
  // `page:header` reads its title off `schema`/`schema.properties` and a `props`
  // bag would have rendered an empty header bar even with the type corrected.
  'page',
] as const;

/**
 * Samples that map to a real spec collection and DO NOT parse today. Each entry
 * is the first thing a reader of that sample would copy and get rejected for.
 *
 * This list is a ledger, not an excuse: the reverse assertion below fails if an
 * entry starts passing, so it can only ever shrink. objectui#3266 emptied out
 * the mechanically-fixable half of it (`action`, `agent`, `skill`, `flow`,
 * `report`, `validation`, `datasource`, `app` — all now in SPEC_CLEAN above),
 * and objectui#3446 took `page` the same way.
 *
 * What remains is NOT "not got to yet" — each of these three needs a decision
 * that does not belong in this file, and the reason is recorded with it. A
 * sample only leaves this ledger by being FIXED; relaxing the guard, exempting
 * a schema, or moving a row into NO_AUTHORING_SCHEMA to buy a green run would
 * delete the only thing keeping the gallery's examples honest.
 */
const KNOWN_STALE: Record<string, string> = {
  // TWO defects, and the reason says both on purpose (objectui#6647). A row
  // here records what a reader would be rejected for, and a reason naming only
  // the first blocker sends whoever fixes it back to a sample that is STILL
  // red with no note — which is exactly how this row read until #6647.
  //
  // 1. The array `fields` — NOT a typo:
  //    `packages/app-shell/.../object-fields-io.ts` `readFields()` branches on
  //    `shape: 'array' | 'record'` and round-trips whichever the draft used, so
  //    this sample is what covers the array branch in the gallery. Rewriting it
  //    to a record would drop that coverage while leaving the designer still
  //    able to author a shape ObjectSchema rejects, which is the actual
  //    question (AGENTS.md #0.1) — an app-shell question, not a
  //    preview-samples one.
  //
  // 2. `status.options` as bare strings, where `FieldSchema` wants option
  //    OBJECTS (`{ label, value }`; an empty `{}` reports both as missing).
  //    Unlike (1) this one is not deliberate — the designer cannot read it
  //    either (`ObjectFieldInspector`'s `readOptions()` does
  //    `String(o?.value ?? '')`, so three string options render as three BLANK
  //    rows) — but re-authoring it means inventing the `value` codes the sample
  //    should demonstrate, which is a sample-content decision, not a mechanical
  //    re-spelling. Filed separately rather than smuggled in here.
  //
  // Both are measured against spec 17.2.0; only (1) is REPORTED today, because
  // the parse short-circuits at `objects.0.fields` before it ever descends into
  // a field. That masking is the whole hazard this ledger row now records: the
  // third defect, `reference_to` on the lookup field, hid behind it for four
  // spec releases and was fixed in #6647 — see its RETIRED_KEYS pin below,
  // which is what stops it (or its twin) drifting back in while this row's
  // quarantine keeps the reverse assertion satisfied on the array shape alone.
  object:
    '`fields` is an array; ObjectSchema wants a record keyed by field name (deliberate — it covers the array branch of `readFields()`). Fixing that alone is NOT enough: `status.options` are bare strings where the spec wants `{ label, value }` objects, reported only once the array shape stops short-circuiting the parse.',
  dashboard: 'widgets miss `dataset`/`values` and use retired `value`/`format`; `chart` is not a widget type',
  translation:
    'the `translations` collection is Array< Record< locale, TranslationData > >, but this sample is the metadata-RECORD form (name/label/locale/data) the console edits — so this row is a mapping mismatch, not necessarily a stale sample. Settle which contract the sample targets before guarding it.',
};

/**
 * Samples with no authoring schema in `@objectstack/spec` at all — nothing to
 * validate against, so they are exempt by documented fact rather than by
 * omission. The assertion below re-checks that fact every run.
 */
const NO_AUTHORING_SCHEMA: Record<string, string> = {
  workflow: 'no `workflows` collection and no WorkflowSchema in spec 17',
  approval: 'no `approvals` collection; spec only has ApprovalNodeConfigSchema (a flow node)',
};

/**
 * Retired keys that must never reappear in a sample, with the adjudication that
 * removed each one. A preview or inspector that still READS one of these is not
 * a reason to re-add it — that reader is the bug (see objectui#3236 / PR #3258,
 * where `ToolPreview` stopped rendering its three).
 *
 * For a SPEC_CLEAN sample this table is belt-and-braces: that row would already
 * go red generically, and naming the key only keeps the retirement legible. For
 * a KNOWN_STALE sample it is the ONLY guard there is — the reverse assertion
 * below asks for `length > 0`, which the quarantined defect satisfies forever,
 * so a retired key re-added to such a sample changes no test result at all.
 * That is not hypothetical: it is how `object` carried `reference_to` through
 * four spec releases (objectui#6647). Quarantine suppresses the generic signal,
 * so per-key pins have to carry it.
 */
const RETIRED_KEYS: Array<[type: string, key: string, adjudication: string]> = [
  ['tool', 'category', 'objectstack#3896'],
  ['tool', 'active', 'objectstack#3715 / ADR-0033 §2'],
  ['tool', 'requiresConfirmation', 'objectstack#3896'],
  ['action', 'bulkEnabled', 'objectstack#3896'],
  ['agent', 'tools', 'objectstack#3894 — use `skills`'],
  ['agent', 'knowledge', 'objectstack#3896'],
  ['skill', 'triggerPhrases', 'objectstack#3896'],
  ['flow', 'onTimeout', 'objectstack#4158'],
  // `landing` was replaced by `homePageId` in objectstack#4001, and
  // `homePageId` was itself retired in objectstack#4667 / #4709. There is no
  // authorable landing key any more: the landing page IS the first navigation
  // item (by `order`), and the root landing follows `isDefault`.
  ['app', 'landing', 'objectstack#4001 — landing is now the first nav item'],
  ['app', 'homePageId', 'objectstack#4667 / #4709 — landing is now the first nav item'],
  // Both spellings of the lookup target, pinned together because the spec
  // refuses each BY NAME with the same did-you-mean and the designer reads
  // neither: `ObjectFieldInspector` seeds its target box from `def.reference`.
  // `referenceTo` is tombstoned in `@object-ui/types` with
  // `specEquivalent: 'reference'`; the snake_case twin is the one that was
  // actually in this sample.
  ['object', 'reference_to', 'objectui#6647 — the spec spells it `reference`'],
  ['object', 'referenceTo', 'objectui#6041 — the spec spells it `reference`'],
];

/** Every key name appearing anywhere in `value`, at any depth. */
function keyNamesIn(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) keyNamesIn(item, out);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      keyNamesIn(child, out);
    }
  }
  return out;
}

/** Issues the spec raises for one sample, scoped to that sample's own path. */
function issuesFor(type: string): { path: string; message: string }[] {
  const sample = SAMPLES[type];

  // `validation` is not a top-level collection — it lives on an object as
  // `validations[]`, so it is embedded in a minimal host object. That host is
  // itself valid, so every issue reported below belongs to the sample.
  const [stack, prefix] =
    type === 'validation'
      ? [
          {
            objects: [
              {
                name: 'sales_order',
                label: 'Sales Order',
                fields: { amount: { type: 'currency', label: 'Amount' } },
                validations: [sample],
              },
            ],
          },
          'objects.0.validations',
        ]
      : [{ [STACK_COLLECTION[type]]: [sample] }, STACK_COLLECTION[type]];

  const result = ObjectStackSchema.safeParse(stack);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join('.').startsWith(prefix))
    .map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/**
 * The `page` sample as the spec actually MATERIALISES it — i.e. after defaults
 * are applied, not as authored. Parsing is the only way to see a defaulted key:
 * reading `SAMPLES.page.type` shows what the author wrote, which is precisely
 * the blind spot objectui#3454 was filed for.
 */
function parsedPage(): Record<string, unknown> {
  const result = ObjectStackSchema.safeParse({ pages: [SAMPLES.page] });
  if (!result.success) throw new Error('page sample no longer parses');
  return (result.data as { pages: Record<string, unknown>[] }).pages[0];
}

describe('preview-samples conform to @objectstack/spec', () => {
  // Without this, a sample added to the gallery tomorrow would be validated by
  // nothing and no test would notice — the exact failure mode this file exists
  // to end. Classification is mandatory, so adding a sample forces a decision.
  it('classifies every sample exactly once', () => {
    const classified = [
      ...SPEC_CLEAN,
      ...Object.keys(KNOWN_STALE),
      ...Object.keys(NO_AUTHORING_SCHEMA),
    ];
    expect([...classified].sort()).toEqual([...new Set(classified)].sort());
    expect(classified.sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it.each(SPEC_CLEAN)('%s sample is valid metadata', (type) => {
    expect(issuesFor(type)).toEqual([]);
  });

  /**
   * objectui#3454 — the page sample must declare the page KIND it is used as.
   *
   * Being valid is not the same as meaning what it says. `PageSchema.type` is
   * `PageTypeSchema.default('record')`, so a page that omits `type` parses
   * clean and MATERIALISES as a record page — one bound to no object, since
   * `object` is optional. This sample is not a record page: the `app` sample in
   * the same file routes it as the CRM's landing entry
   * (`navigation[0] = { id: 'home', type: 'page', pageName: 'crm_welcome' }`),
   * and its content is a welcome header with quick links.
   *
   * The mismatch is invisible in the gallery, which renders the UNPARSED draft
   * — so nothing would ever have gone red over it. It matters because these
   * samples are the worked example an author (increasingly, a model generating
   * metadata) copies: a landing page silently defaulting to `record` is wrong
   * semantics propagating from the file that exists to demonstrate right ones.
   *
   * Asserted on the PARSED value, not the authored literal, because the defect
   * lives in the default: only the parse distinguishes "declared `home`" from
   * "omitted, therefore `record`". Deleting the sample's `type` line turns this
   * red with the received value `'record'`.
   */
  it('page sample declares `home`, the kind the app sample routes it as', () => {
    expect(parsedPage().type).toBe('home');
    expect(SAMPLES.page.type).toBe('home');
  });

  // Reverse assertion (same shape as objectui#3212): a ledger nobody re-checks
  // becomes a dumping ground. If a quarantined sample starts parsing — because
  // someone fixed it, or the spec relaxed — this fails and demands it be
  // promoted, so the list can only shrink.
  it.each(Object.keys(KNOWN_STALE))(
    '%s sample still fails as recorded (promote it to SPEC_CLEAN once fixed)',
    (type) => {
      expect(issuesFor(type).length).toBeGreaterThan(0);
    },
  );

  it.each(Object.keys(NO_AUTHORING_SCHEMA))(
    '%s still has no collection in the spec',
    (type) => {
      // If spec grows one, this fails — map the sample and guard it.
      expect(Object.keys(ObjectStackSchema.shape)).not.toContain(`${type}s`);
    },
  );

  // The specific retirements objectui#3257 and objectui#3266 cleared, pinned by
  // name. SPEC_CLEAN already catches a re-added key (every one of these schemas
  // rejects it BY NAME via `retiredKey()`), but only as a generic "sample is
  // invalid"; naming them keeps each retirement legible — with its adjudication
  // — to whoever is tempted to put one back because a preview still reads it.
  //
  // Matched at ANY depth, not just top level: `waitEventConfig.onTimeout` lives
  // on a flow node, and a retired key is no less retired for being nested.
  it.each(RETIRED_KEYS)(
    '%s sample does not resurrect retired key `%s` (%s)',
    (type, key) => {
      expect([...keyNamesIn(SAMPLES[type])]).not.toContain(key);
    },
  );
});
