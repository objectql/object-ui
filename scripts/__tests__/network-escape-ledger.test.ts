/**
 * The shrink-only pin for the network-escape ledger (objectui#6640).
 *
 * `KNOWN_ESCAPES` in `vitest.setup.network-escape-guard.ts` records the 21 test
 * files measured reaching a real socket on `67dadd6`. The guard's own docstring
 * says that list "may only shrink" — and until this file existed, nothing made
 * that true. An author who hit the guard's red could make it green by adding a
 * line, which is exactly how a burn-down ledger decays into the permanent
 * quarantine it is not supposed to be. THAT is the failure this pin prevents;
 * it does not re-measure escapes (that needs a real DOM run) and does not try.
 *
 * It reconciles the live set against the pinned literal in BOTH directions:
 *
 *   - a name in the ledger but not in the pin  -> the ledger GREW. Red.
 *   - a name in the pin but not in the ledger  -> a real fix landed, and the
 *     pin is now stale. Red until the pin is updated too, which is the point:
 *     shrinking the ledger is a deliberate TWO-LINE change (delete from the
 *     ledger, delete from the pin), never a silent one.
 *
 * Plus an anchored non-vacuity floor, because both reconciles above pass
 * vacuously if the imported set or the pin is empty — the classic way a pin
 * keeps reporting green after the thing it pins stopped existing.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { KNOWN_ESCAPES } from '../../vitest.setup.network-escape-guard';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The 21 files measured escaping on `67dadd6`, pinned verbatim.
 *
 * Provenance: a full sweep of every Vitest project (`dom` all 8 shards,
 * `dom-heavy`, `unit`, `apps/console`) with an attribution ledger wrapping
 * `fetch`. Do not add to this list. Deleting from it is the intended direction
 * and must be done in lockstep with `KNOWN_ESCAPES`.
 */
const PINNED_LEDGER: readonly string[] = [
  'examples/schema-catalog/test/catalog-gallery-render.test.tsx',
  'packages/app-shell/src/console/home/__tests__/HomePage.approvalsTarget.test.tsx',
  'packages/app-shell/src/console/home/__tests__/HomePage.authoringCapabilityGate.test.tsx',
  'packages/app-shell/src/console/home/__tests__/HomePage.inboxLinksTarget.test.tsx',
  'packages/app-shell/src/console/home/__tests__/HomePage.notificationDeepLink.test.tsx',
  'packages/app-shell/src/views/metadata-admin/inspectors/FlowNodeInspector.inactiveRetained.test.tsx',
  'packages/app-shell/src/views/metadata-admin/inspectors/FlowNodeInspector.specKeys.test.tsx',
  'packages/app-shell/src/views/studio-design/StudioDesignSurface.designerRegistryMissing.test.tsx',
  'packages/app-shell/src/views/studio-design/__tests__/studioSurfaceContext.test.tsx',
  'packages/plugin-calendar/src/ObjectCalendar.navWidthDefault.test.tsx',
  'packages/plugin-charts/src/ObjectChart.heightChain.test.tsx',
  'packages/plugin-detail/src/__tests__/defaultFieldGroupsPage.sectionHeadings.test.tsx',
  'packages/plugin-detail/src/__tests__/guideCrudAppRenders.test.tsx',
  'packages/plugin-detail/src/__tests__/recordDetailsBodySource.test.tsx',
  'packages/plugin-detail/src/renderers/__tests__/record-details.emptySectionDefault.test.tsx',
  'packages/plugin-gantt/src/ObjectGantt.navWidthDefault.test.tsx',
  'packages/plugin-grid/src/__tests__/bulkDeleteVisibleWhen.test.tsx',
  'packages/plugin-kanban/src/ObjectKanban.navWidthDefault.test.tsx',
  'packages/plugin-kanban/src/ObjectKanban.overlayTitleI18n.test.tsx',
  'packages/plugin-kanban/src/ObjectKanban.overlayTitleNoProviderFallback.test.tsx',
  'packages/plugin-view/src/__tests__/ObjectView.namedViewSortArity.test.tsx',
];

describe('network-escape ledger (objectui#6640) is shrink-only', () => {
  it('has not GROWN: every name in KNOWN_ESCAPES is in the pin', () => {
    const pinned = new Set(PINNED_LEDGER);
    const added = [...KNOWN_ESCAPES].filter((file) => !pinned.has(file)).sort();

    expect(
      added,
      [
        'The network-escape ledger GREW, and it may only shrink.',
        '',
        'A test that reaches a real socket is a defect to fix, not a line to add here.',
        'If the guard went red on your file, serve its probe from a double instead —',
        'packages/plugin-report/src/__tests__/DatasetReportRenderer.test.tsx is the shape',
        "(vi.stubGlobal('fetch', router) + vi.unstubAllGlobals()).",
        '',
        'Names added to KNOWN_ESCAPES but absent from PINNED_LEDGER:',
        ...added.map((file) => `  ${file}`),
      ].join('\n'),
    ).toEqual([]);
  });

  it('has not gone STALE: every pinned name is still in KNOWN_ESCAPES', () => {
    const stale = PINNED_LEDGER.filter((file) => !KNOWN_ESCAPES.has(file)).sort();

    expect(
      stale,
      [
        'A pinned escape is gone from KNOWN_ESCAPES — which is good news, banked wrong.',
        '',
        'Shrinking the ledger is deliberately a TWO-LINE change: delete the entry from',
        'KNOWN_ESCAPES in vitest.setup.network-escape-guard.ts AND delete it from',
        'PINNED_LEDGER in this file. This red is the second line asking to be written.',
        '',
        'Pinned but no longer in the ledger:',
        ...stale.map((file) => `  ${file}`),
      ].join('\n'),
    ).toEqual([]);
  });

  it('is not vacuous: the pin is non-empty and every pinned path exists on disk', () => {
    // Both reconciles above are satisfied by two empty collections. Anchor the
    // floor to a literal so that emptying either side is a red rather than a
    // silent green — and check the paths resolve, so a rename cannot leave the
    // pin agreeing with the ledger about files that no longer exist.
    expect(
      PINNED_LEDGER.length,
      'PINNED_LEDGER is empty, so both reconciles above pass vacuously. If the ledger ' +
        'genuinely reached zero, that is the win this whole instrument was built for — ' +
        'delete the guard\'s KNOWN_ESCAPES machinery and this pin together, rather than ' +
        'leaving a pin that asserts nothing.',
    ).toBeGreaterThan(0);

    expect(
      KNOWN_ESCAPES.size,
      'KNOWN_ESCAPES is empty while PINNED_LEDGER is not — see the staleness test above.',
    ).toBeGreaterThan(0);

    const missing = PINNED_LEDGER.filter(
      (file) => !fs.existsSync(path.join(repoRoot, file)),
    ).sort();

    expect(
      missing,
      [
        'A pinned escape names a file that is not on disk.',
        '',
        'The ledger keys off the test file path, so a renamed or deleted file leaves an',
        'entry that can never match and can never be burned down — it would sit here',
        'looking like outstanding work that no longer exists.',
        '',
        'Missing paths:',
        ...missing.map((file) => `  ${file}`),
      ].join('\n'),
    ).toEqual([]);
  });
});
