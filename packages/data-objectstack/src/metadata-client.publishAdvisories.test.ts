/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The PUBLISH door must surface the runtime authoring gate's advisory findings
 * (objectui#5026; contract objectstack#9176).
 *
 * ## Why this door is the one that matters
 *
 * objectui#4133 / PR #4236 wired the advisory rendering to the SAVE door and
 * scoped this one out, because `PublishMetaItemResponseSchema` carried no
 * `advisories` key at the time. It does now. That deferral left the common path
 * silent, and for a precise reason both halves of which are pinned here:
 *
 * - Studio's designer stages every edit as a `mode: 'draft'` save, and drafts
 *   are NEVER gated — the framework returns at its D1 early-return before a
 *   rule runs, so the save door has nothing to report on that flow.
 * - The promotion that follows IS gated. It is the write the gate actually
 *   grades, and until this change objectui parsed its response and dropped the
 *   findings on the floor exactly one layer further out than the server used to.
 *
 * So on the flow most tenants actually use, the author was told nothing at
 * either door. These pins are the red-first evidence: with the emit removed
 * from `publish()` / `publishDraft()`, every "emits" case below fails because no
 * event ever arrives.
 *
 * ## Scope control — the batch door is NOT this
 *
 * `POST /packages/:id/publish-drafts` ("publish whole app") still discards
 * per-draft advisories SERVER-side; that is objectstack#9343, open and
 * unruled at the time of writing, and nothing on this side compensates for it.
 * The last case in this file is the control that pins that absence: a
 * batch-shaped body reaching this client renders nothing.
 */

import { describe, it, expect, vi } from 'vitest';
import { PublishMetaItemResponseSchema } from '@objectstack/spec/api';
import {
  MetadataClient,
  type MetadataSaveAdvisoryEvent,
  type RuntimeAuthoringIssue,
} from './metadata-client';

/** The measured `nightly_purge` finding, in the spec's D3 shape. */
const PURGE_ADVISORY: RuntimeAuthoringIssue = {
  severity: 'warning',
  rule: 'flow/delete-without-filter',
  where: 'flow "nightly_purge" · node "purge old rows"',
  path: 'flows[0].nodes[2].config.filters',
  message: 'this delete_record node sets multi: true with no filter, so it deletes every row',
  hint: 'add a filter, or set multi: false to delete a single record',
};

/** The three keys `PublishMetaItemResponseSchema` states as REQUIRED. */
const CLEAN_BODY = {
  success: true,
  version: 'sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
  seq: 7,
  message: 'Published draft — type=flow, name=nightly_purge [seq=7]',
};

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function clientWith(
  responseBody: unknown,
  onSaveAdvisory?: (ev: MetadataSaveAdvisoryEvent) => void,
) {
  return new MetadataClient({
    baseUrl: 'http://test.local',
    fetch: vi.fn(async () => response(responseBody)) as unknown as typeof fetch,
    ...(onSaveAdvisory ? { onSaveAdvisory } : {}),
  });
}

/**
 * The premise, asserted rather than assumed — and asserted against the
 * INSTALLED `@objectstack/spec`, not against the upstream PR's description of
 * it. This card was held 13 days on a spec-pin condition and released on a
 * version-ordering argument; the reading that actually opened the gate is this
 * one, so it lives in CI instead of in a transcript.
 *
 * The reverse probe is what makes the positive a measurement: a half-shaped
 * finding must be REJECTED, or "the key parses" would prove only that the
 * schema ignores it.
 */
describe('the contract this renders (objectstack#9176), read off the installed spec', () => {
  it('declares `advisories` on the publish response, and validates its elements', () => {
    const withAdvisories = PublishMetaItemResponseSchema.safeParse({
      ...CLEAN_BODY,
      advisories: [PURGE_ADVISORY],
    });
    expect(withAdvisories.success).toBe(true);
    // Declared, not merely tolerated: an undeclared key is STRIPPED by the
    // object schema, so surviving the parse is the discriminating reading.
    expect(
      withAdvisories.success &&
        Object.prototype.hasOwnProperty.call(withAdvisories.data, 'advisories'),
    ).toBe(true);

    const halfShaped = PublishMetaItemResponseSchema.safeParse({
      ...CLEAN_BODY,
      advisories: [{ rule: 'flow/delete-without-filter' }],
    });
    expect(halfShaped.success).toBe(false);
  });

  it('omits the key entirely on a clean publish — absence means "nothing to report"', () => {
    const clean = PublishMetaItemResponseSchema.safeParse(CLEAN_BODY);
    expect(clean.success).toBe(true);
    expect(clean.success && Object.prototype.hasOwnProperty.call(clean.data, 'advisories')).toBe(
      false,
    );
  });
});

describe('MetadataClient.publish — runtime authoring gate advisories (#5026)', () => {
  it('emits the findings a successful promotion returned', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith({ ...CLEAN_BODY, advisories: [PURGE_ADVISORY] }, (e) =>
      events.push(e),
    );

    await client.publish('flow', 'nightly_purge');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'flow',
      name: 'nightly_purge',
      door: 'publish',
      mode: 'publish',
      advisories: [PURGE_ADVISORY],
    });
  });

  it('names the PUBLISH door, which `mode` alone cannot say', async () => {
    // A direct active save and a draft promotion both land the body in the
    // active overlay, so both report `mode: 'publish'`. Only `door` separates
    // them, and the renderer needs that separation: "Saved" after a Publish
    // tells the author their change is still a draft.
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith({ ...CLEAN_BODY, advisories: [PURGE_ADVISORY] }, (e) =>
      events.push(e),
    );

    await client.publish('view', 'cases');

    expect(events[0]!.door).toBe('publish');
    expect(events[0]!.mode).toBe('publish');
  });

  it('carries rule, message and hint through verbatim — they are server prose', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith({ ...CLEAN_BODY, advisories: [PURGE_ADVISORY] }, (e) =>
      events.push(e),
    );

    await client.publish('flow', 'nightly_purge');

    const [finding] = events[0]!.advisories;
    expect(finding!.rule).toBe('flow/delete-without-filter');
    expect(finding!.message).toBe(PURGE_ADVISORY.message);
    expect(finding!.hint).toBe(PURGE_ADVISORY.hint);
    // Never `error` on this channel — an error-severity finding refuses the
    // promotion and arrives as the 422 `invalid_metadata` envelope instead.
    expect(finding!.severity).toBe('warning');
  });

  it('says nothing on a clean publish — the server omits the key entirely', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith(CLEAN_BODY, (e) => events.push(e));

    await client.publish('object', 'account');

    expect(events).toEqual([]);
  });

  it('says nothing when the array is present but empty', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith({ ...CLEAN_BODY, advisories: [] }, (e) => events.push(e));

    await client.publish('object', 'account');

    expect(events).toEqual([]);
  });

  it('drops half-shaped findings rather than rendering blanks at the author', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith(
      { ...CLEAN_BODY, advisories: [PURGE_ADVISORY, { rule: 'only-a-rule' }, null] },
      (e) => events.push(e),
    );

    await client.publish('flow', 'nightly_purge');

    expect(events[0]!.advisories).toEqual([PURGE_ADVISORY]);
  });

  it('still returns the publish response unchanged', async () => {
    const body = { ...CLEAN_BODY, advisories: [PURGE_ADVISORY] };
    const client = clientWith(body, () => {});

    const result = await client.publish('flow', 'nightly_purge');

    expect(result).toEqual(body);
  });

  it('a throwing sink never fails a promotion the server already committed', async () => {
    const client = clientWith({ ...CLEAN_BODY, advisories: [PURGE_ADVISORY] }, () => {
      throw new Error('renderer exploded');
    });

    await expect(client.publish('flow', 'nightly_purge')).resolves.toBeTruthy();
  });

  it('survives the withEnvironment clone — console clients are all env-scoped', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const base = new MetadataClient({
      baseUrl: 'http://test.local',
      fetch: vi.fn(async () =>
        response({ ...CLEAN_BODY, advisories: [PURGE_ADVISORY] }),
      ) as unknown as typeof fetch,
      onSaveAdvisory: (e) => events.push(e),
    });

    await base.withEnvironment('env_1').publish('flow', 'nightly_purge');

    expect(events).toHaveLength(1);
  });

  it('survives the withPreviewDrafts clone', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const base = new MetadataClient({
      baseUrl: 'http://test.local',
      fetch: vi.fn(async () =>
        response({ ...CLEAN_BODY, advisories: [PURGE_ADVISORY] }),
      ) as unknown as typeof fetch,
      onSaveAdvisory: (e) => events.push(e),
    });

    await base.withPreviewDrafts(true).publish('flow', 'nightly_purge');

    expect(events).toHaveLength(1);
  });
});

describe('MetadataClient.publishDraft — the same door, so the same report', () => {
  it('emits the findings a by-reference promotion returned', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith({ ...CLEAN_BODY, advisories: [PURGE_ADVISORY] }, (e) =>
      events.push(e),
    );

    await client.publishDraft('flow', 'nightly_purge');

    expect(events).toHaveLength(1);
    expect(events[0]!.door).toBe('publish');
    expect(events[0]!.advisories).toEqual([PURGE_ADVISORY]);
  });

  it('reads them through the dispatcher `{ success, data }` envelope it already unwraps', async () => {
    // This method tolerates an enveloped body and returns the inner object, so
    // it must read the advisories from the same place — otherwise the report
    // would depend on which of two equivalent server shapes answered.
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith(
      { success: true, data: { ...CLEAN_BODY, advisories: [PURGE_ADVISORY] } },
      (e) => events.push(e),
    );

    const result = await client.publishDraft('flow', 'nightly_purge');

    expect(events).toHaveLength(1);
    expect(events[0]!.advisories).toEqual([PURGE_ADVISORY]);
    // and the unwrapping itself is unchanged
    expect((result as { seq?: number }).seq).toBe(7);
  });

  it('says nothing on a clean by-reference publish', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith(CLEAN_BODY, (e) => events.push(e));

    await client.publishDraft('object', 'account');

    expect(events).toEqual([]);
  });

  /**
   * The scope control, and it is a real one rather than a restatement.
   *
   * "Publish whole app" is `POST /packages/:id/publish-drafts`, a route this
   * client class does not express at all — `usePublishAllDrafts` calls it with
   * a bare `fetch`. Its response reports per-draft results under `published[]`,
   * and those elements carry no advisories server-side (objectstack#9343).
   *
   * If a batch-shaped body ever reached this method, nothing here may go
   * hunting through `published[]` for findings to render: that would be the
   * batch rendering this card explicitly excluded, built on a side-channel
   * instead of on a contract. Pinned as an absence so a later "helpful"
   * traversal cannot be added without turning this red.
   */
  it('does NOT render advisories buried in a batch-shaped `published[]` body', async () => {
    const events: MetadataSaveAdvisoryEvent[] = [];
    const client = clientWith(
      {
        success: true,
        publishedCount: 1,
        failedCount: 0,
        published: [{ type: 'flow', name: 'nightly_purge', advisories: [PURGE_ADVISORY] }],
      },
      (e) => events.push(e),
    );

    await client.publishDraft('flow', 'nightly_purge');

    expect(events).toEqual([]);
  });
});
