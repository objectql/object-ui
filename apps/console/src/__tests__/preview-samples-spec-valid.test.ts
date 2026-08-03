/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `preview-samples.ts` ↔ `@objectstack/spec` conformance (objectui#3257).
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
 * LIMIT — worth knowing before trusting a pass. Only some element schemas are
 * `.strict()` (`tools`, `apps`, `flows`, `permissions`, `positions`,
 * `datasources` are; `views`, `jobs`, `emailTemplates` are not). For the
 * non-strict ones an unknown or retired key is stripped rather than rejected,
 * so a PASS there proves the sample is structurally sound, NOT that it is free
 * of retired keys. The guard is exactly as strict as the spec is.
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
] as const;

/**
 * Samples that map to a real spec collection and DO NOT parse today. Each entry
 * is the first thing a reader of that sample would copy and get rejected for.
 *
 * This list is a ledger, not an excuse: the reverse assertion below fails if an
 * entry starts passing, so it can only ever shrink. Fixing them is objectui#3266
 * — deliberately not done here, because several are not mechanical (see that
 * issue: `object.fields` array-vs-record is a shape `readFields()` supports on
 * PURPOSE, and rewriting the `dashboard` sample changes what the gallery
 * renders, which is the shared browser-verification harness).
 */
const KNOWN_STALE: Record<string, string> = {
  object: '`fields` is an array; ObjectSchema wants a record keyed by field name',
  page: 'page components carry `props`, which PageComponentSchema rejects (ADR-0089 D3a)',
  report: '`columns` are objects; ReportSchema wants column-name strings',
  dashboard: 'widgets miss `dataset`/`values` and use retired `value`/`format`; `chart` is not a widget type',
  app: 'navigation items miss the `type` discriminator; `landing` was removed (objectstack#4001)',
  action: 'RETIRED `bulkEnabled` (objectstack#3896); `type`/`variant`/`locations` use pre-17 enum values',
  flow: 'RETIRED `waitEventConfig.onTimeout` (objectstack#4158); `type: scheduled` invalid; edges need `id`',
  agent: 'RETIRED `tools` (objectstack#3894, use `skills`) and `knowledge` (objectstack#3896)',
  skill: 'RETIRED `triggerPhrases` (objectstack#3896); `triggerConditions` needs field/operator/value',
  datasource: '`type`/`isDefault` rejected; `ssl` and `capabilities` are objects; `healthCheck.interval` is `intervalMs`',
  validation: "`events` uses pre-17 `beforeInsert`/`beforeUpdate`; the enum is `insert`/`update`",
  translation:
    'the `translations` collection is Array< Record< locale, TranslationData > >, but this sample is the metadata-RECORD form (name/label/locale/data) the console edits — so this row is a mapping mismatch, not necessarily a stale sample. Resolve in objectui#3266 before guarding it.',
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

  // The specific regression objectui#3257 fixed, pinned by name. The list above
  // would catch these via `tool`'s membership in SPEC_CLEAN, but only as a
  // generic "sample is invalid"; naming them keeps the retirement legible to
  // whoever is tempted to re-add one.
  it.each(['category', 'active', 'requiresConfirmation'])(
    'tool sample does not resurrect retired key `%s`',
    (key) => {
      expect(SAMPLES.tool).not.toHaveProperty(key);
    },
  );
});
