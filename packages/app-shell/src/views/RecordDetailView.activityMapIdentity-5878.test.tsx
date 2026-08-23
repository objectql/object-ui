/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5878 — the console record page's `sys_activity` merge reads
 * `record:activity`'s table, instead of hand-copying it.
 *
 * `RecordDetailView` carried a local `activityTypeToFeed` literal holding the
 * same eleven entries as `@object-ui/plugin-detail`'s exported
 * `ACTIVITY_TYPE_TO_FEED_TYPE`. Neither file imported the other and no test
 * compared them, so the two could drift with nothing going red — and
 * objectui#5840 drifted them: it added `scheduled` -> `event` to the renderer's
 * table because a shipped producer (HotCRM's `schedule_meeting`) writes that
 * value, and left the copy here untouched. The same `sys_activity` row then
 * rendered on a hand-authored record page and vanished on the console one.
 *
 * ## Why the load-bearing pin is IDENTITY, not membership
 *
 * Every behavioural assertion below is also satisfied by restoring a private
 * literal that happens to hold today's members — i.e. by exactly the re-fork
 * this change removed, which would pass ON the defect. So two pins decide the
 * convergence, and neither can be satisfied by a copy:
 *
 *  1. a getter spy on the shared object: the merge's answer for `scheduled` is
 *     recorded only if it read THAT object's property;
 *  2. a member injected into the shared object at runtime: a private copy
 *     cannot have it, so the seeded row is dropped and the leg goes red.
 *
 * (2) is deliberately mechanism-independent — it survives any change in how
 * Vitest implements accessor spies — and it is also the card's thesis stated
 * executably: ONE edit to the shared table must reach BOTH surfaces.
 *
 * The identity spy is real here because the specifier is identical on both
 * sides. `vitest.config.mts` aliases `@object-ui/plugin-detail` to
 * `packages/plugin-detail/src`, and both this file and `RecordDetailView`
 * import through that specifier, so ESM hands them one module object. (No
 * `dist` is involved, so no rebuild stands between an edit and this run.)
 *
 * ## The legs that do NOT discriminate, and why they are still here
 *
 * `describe('the previously mapped kinds are unchanged')` stays GREEN under
 * both ablation legs by construction — a member-identical private copy answers
 * those exactly as the shared table does. They are regression controls, not
 * pins: if they move, the convergence took the mapping's membership with it
 * and the pins above would be reporting on rubble.
 *
 * Same for the "the row rendered at all" assertion inside the identity legs:
 * it is a LIVE control on the same read as the subject, so a harness that
 * stopped delivering rows fails as a broken probe rather than reporting the
 * consumer forked.
 *
 * ## Out of scope, deliberately
 *
 * Only the TABLE is shared. The row -> `FeedItem` construction around it is
 * still written twice (this merge builds the item inline; the block calls
 * `activityRowToFeedItem`), so the console surface still drops an unmapped
 * type SILENTLY where the block warns once. That is the same class of mirror
 * one level up, and it is not this card's fence.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MetadataCtx } from '@object-ui/react';
import type { FeedItemType } from '@object-ui/types';
import { ACTIVITY_TYPE_TO_FEED_TYPE } from '@object-ui/plugin-detail';

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Ada', image: null }, activeOrganization: null }),
  createAuthenticatedFetch: () => vi.fn(),
}));

vi.mock('@object-ui/collaboration', () => ({
  useRecordPresence: () => ({ viewers: [], others: [] }),
  PresenceAvatars: () => null,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// Orthogonal chrome — stubbed so the only asynchrony in this file is the feed.
vi.mock('./ActionConfirmDialog', () => ({ ActionConfirmDialog: () => null }));
vi.mock('./ActionParamDialog', () => ({ ActionParamDialog: () => null }));
vi.mock('./ActionResultDialog', () => ({ ActionResultDialog: () => null }));
vi.mock('./FlowRunner', () => ({ FlowRunner: () => null }));
vi.mock('./MetadataInspector', () => ({
  MetadataPanel: () => null,
  useMetadataInspector: () => ({ showDebug: false, toggle: () => {} }),
}));

import { RecordDetailView } from './RecordDetailView';

const OBJECT_NAME = 'crm_account';
const RECORD_ID = 'rec-1';

/**
 * A mutable-typed VIEW of the shared table — the same object, not a copy.
 * The export is `Readonly<...>` at the type level only; `vi.spyOn` and the
 * injected-member leg both need to redefine a property on it.
 */
const sharedTable = ACTIVITY_TYPE_TO_FEED_TYPE as Record<string, FeedItemType | undefined>;

const OBJECTS = [
  {
    name: OBJECT_NAME,
    label: 'Account',
    managedBy: 'platform',
    fields: {
      id: { type: 'text', label: 'Id' },
      name: { type: 'text', label: 'Name' },
    },
  },
];

/** Body text names the activity type, so a failure message says which row moved. */
const summaryFor = (type: string) => `activity row of type ${type}`;

const activityRow = (type: string, index: number) => ({
  id: `a-${index}`,
  type,
  actor_name: 'Grace',
  summary: summaryFor(type),
  timestamp: `2026-01-0${index + 1}T00:00:00.000Z`,
});

/**
 * A fake backend that answers `sys_activity` with the seeded rows and every
 * other read with nothing — the same filter shape the view queries with, so a
 * row can only arrive through the merge under test.
 */
function makeDataSource(activityRows: Array<Record<string, any>>) {
  return {
    find: vi.fn((objectName: string) =>
      Promise.resolve({ data: objectName === 'sys_activity' ? activityRows : [] }),
    ),
    create: vi.fn(async (_o: string, row: any) => row),
    findOne: vi.fn(async (_o: string, recordId: string) => ({
      id: recordId,
      name: `Record ${recordId}`,
    })),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  } as any;
}

function makeMetadata() {
  return {
    objects: OBJECTS,
    pages: [],
    loading: false,
    error: null,
    refresh: async () => {},
    invalidate: () => {},
    ensureType: async () => [],
    getItem: async () => null,
    getItemsByType: () => [],
  } as any;
}

function tree(dataSource: any) {
  return (
    <MemoryRouter initialEntries={[`/app/demo/${OBJECT_NAME}/${RECORD_ID}`]}>
      <MetadataCtx.Provider value={makeMetadata()}>
        <RecordDetailView
          dataSource={dataSource}
          objects={OBJECTS}
          onEdit={() => {}}
          objectNameOverride={OBJECT_NAME}
          recordIdOverride={RECORD_ID}
          embedded
        />
      </MetadataCtx.Provider>
    </MemoryRouter>
  );
}

/** Render the console record page over the seeded `sys_activity` rows. */
const renderWith = (rows: Array<Record<string, any>>) => render(tree(makeDataSource(rows)));

beforeEach(() => {
  cleanup();
  // Unrelated chrome (approvals, favourites…) reaches for the platform API.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the console record page renders a `scheduled` row (objectui#5878)', () => {
  it('SUBJECT — a `scheduled` activity reaches this surface, like the block', async () => {
    // The user-visible half of the divergence: HotCRM's `schedule_meeting`
    // writes `scheduled`, objectui#5840 mapped it to `event` for the block, and
    // until this convergence the console page dropped the very same row.
    renderWith([activityRow('updated', 0), activityRow('scheduled', 1)]);

    expect(await screen.findByText(summaryFor('scheduled'))).toBeTruthy();
    // Live control on the same read — an ordinary row still arrives, so a
    // missing `scheduled` above would mean "dropped", not "harness silent".
    expect(screen.getByText(summaryFor('updated'))).toBeTruthy();
  });

  it("the answer comes from plugin-detail's table, not a value that matches it", () => {
    // Not a pin — a statement of where the reading lives, so the assertion
    // above cannot be "fixed" by editing a second literal.
    expect(ACTIVITY_TYPE_TO_FEED_TYPE.scheduled).toBe('event');
  });
});

describe('the merge consults the SHARED object — the pins a copy cannot pass', () => {
  it('IDENTITY (spy) — reading `scheduled` goes through the exported table', async () => {
    // The real value is taken FROM the object rather than written here: an
    // accessor spy on a data property drops the original, and re-typing
    // `'event'` at this line would make the pin carry its own little copy of
    // the thing it exists to stop.
    const real = sharedTable.scheduled;
    const spy = vi
      .spyOn(sharedTable, 'scheduled', 'get')
      .mockImplementation(() => real);

    try {
      renderWith([activityRow('scheduled', 0)]);
      // Live control first: the row rendered, so the merge definitely ran.
      expect(await screen.findByText(summaryFor('scheduled'))).toBeTruthy();
      // SUBJECT: it ran through THIS object. A member-identical private copy
      // leaves this empty while every value assertion above still passes.
      expect(
        spy.mock.calls.length,
        'the merge never read ACTIVITY_TYPE_TO_FEED_TYPE.scheduled — it is reading a copy',
      ).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('IDENTITY (injected member) — one edit to the shared table reaches this surface', async () => {
    // The card's thesis, executable and independent of any spy mechanism: a
    // type that exists ONLY on the shared object must render here. A private
    // copy — however faithful to today's members — cannot contain it.
    const PROBE_TYPE = 'os_probe_5878_not_a_real_activity_type';
    expect(Object.prototype.hasOwnProperty.call(sharedTable, PROBE_TYPE)).toBe(false);

    Object.defineProperty(sharedTable, PROBE_TYPE, {
      value: 'event' satisfies FeedItemType,
      configurable: true,
      enumerable: true,
      writable: true,
    });

    try {
      renderWith([activityRow('updated', 0), activityRow(PROBE_TYPE, 1)]);
      expect(await screen.findByText(summaryFor(PROBE_TYPE))).toBeTruthy();
      // Live control: an ordinary row on the same read.
      expect(screen.getByText(summaryFor('updated'))).toBeTruthy();
    } finally {
      Reflect.deleteProperty(sharedTable, PROBE_TYPE);
    }
    expect(Object.prototype.hasOwnProperty.call(sharedTable, PROBE_TYPE)).toBe(false);
  });
});

describe('the previously mapped kinds are unchanged — regression controls', () => {
  // Green under BOTH ablation legs by construction: a member-identical private
  // copy answers these exactly as the shared table does. They are here to catch
  // a convergence that moved membership, not to decide the convergence.
  it('every pre-#5840 entry still maps where it did', () => {
    expect(ACTIVITY_TYPE_TO_FEED_TYPE).toMatchObject({
      created: 'field_change',
      updated: 'field_change',
      deleted: 'field_change',
      assigned: 'field_change',
      shared: 'field_change',
      system: 'system',
      completed: 'task',
    });
  });

  it('the deliberate exclusions are still excluded, and still PRESENT as keys', () => {
    // Present-but-undefined is the distinction the block draws between "a
    // decision" and "an unmapped producer"; losing the keys would turn four
    // decisions into four unknowns.
    for (const type of ['commented', 'mentioned', 'login', 'logout']) {
      expect(Object.prototype.hasOwnProperty.call(ACTIVITY_TYPE_TO_FEED_TYPE, type), type).toBe(true);
      expect(ACTIVITY_TYPE_TO_FEED_TYPE[type], type).toBeUndefined();
    }
  });

  it('the console surface still shows a mapped row and still drops the rest', async () => {
    renderWith([
      activityRow('updated', 0),
      activityRow('commented', 1),
      activityRow('zzz_not_an_activity_type', 2),
    ]);

    expect(await screen.findByText(summaryFor('updated'))).toBeTruthy();
    // `commented` is a deliberate exclusion (its content comes from
    // `sys_comment`); the third is a type nothing maps.
    await waitFor(() => {
      expect(screen.queryByText(summaryFor('commented'))).toBeNull();
      expect(screen.queryByText(summaryFor('zzz_not_an_activity_type'))).toBeNull();
    });
  });
});
