/**
 * ObjectUI — network-escape guard (objectui#6640)
 *
 * Makes a test that reaches a REAL socket a NAMED, RED test instead of an
 * anonymous stack on stderr.
 *
 * ## The class this closes
 *
 * happy-dom's DEFAULT document URL is `http://localhost:3000` — nothing in this
 * repo configures it. So any DOM-env test that renders a component reaching one
 * of the ~18 `apiFetch ?? fetch` / `globalThis.fetch` fallbacks in product code
 * resolves a relative `/api/v1/...` against a real TCP socket, and prints:
 *
 *     Error: connect ECONNREFUSED 127.0.0.1:3000
 *         at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1637:16)
 *
 * That stack has NO `stderr | FILE > TESTNAME` header and NO user stack frame —
 * it is an unhandled socket error raised below the layer Vitest captures per
 * test, so Vitest cannot tie it to a file. THE ANONYMITY IS THE DEFECT, not the
 * noise: it is why this class was fixed four times (objectui#5225 / #3339 /
 * #4106 / #4688, all still intact on main) and still reproduced in 12 of 16
 * green shards. Each fix closed the files someone had listed by hand, and the
 * output never said who was left. A measured sweep of every project found 21
 * emitting files across 9 packages, none of them a file those four cards fixed.
 *
 * ## Why enforcement is in `afterEach` and NOT a throwing `fetch`
 *
 * The obvious instrument — make the escaping `fetch` reject loudly — DOES NOT
 * WORK HERE, and would have shipped a guard that never fires. Every one of
 * these call sites already tolerates failure by construction:
 *
 *     const doFetch = apiFetch ?? fetch;
 *     try { ... } catch { /* best-effort: leaves the rows as the server sent *\/ }
 *
 * That tolerance is exactly why the suite is GREEN while escaping. A throw from
 * inside `fetch` lands in that same `catch` and is swallowed, leaving the test
 * green and the guard silent. So the escape is RECORDED at the call and
 * ASSERTED in `afterEach`, where no product `catch` can reach it.
 *
 * ## What it does NOT do
 *
 * It does not silence anything: the real request still goes out and the real
 * ECONNREFUSED still prints, because those stacks are the evidence that a test
 * reached for a socket (objectui#6640 ruling). It adds attribution beside them.
 * It skips and quarantines nothing — every test still runs and asserts exactly
 * what it asserted before.
 *
 * ## The burn-down list
 *
 * `KNOWN_ESCAPES` is the 21 files measured on `67dadd6`. They are not excused:
 * each still emits, and now prints an ATTRIBUTED line naming itself, so a
 * reader who meets a bare stack in a truncated run can tell whose it is. The
 * list may only SHRINK — enforced mechanically by the reconcile pin in
 * `scripts/__tests__/network-escape-ledger.test.ts`, which is the only reason
 * the word "only" here is a fact rather than a hope. A file removed from it can
 * never come back green, and a NEW escape in any other file is red on its first
 * run. Fix one by serving the probe from a double (see
 * `DatasetReportRenderer.test.tsx` for the shape), then delete its line here AND
 * from `PINNED_LEDGER` in the pin — the two must move together.
 */
import { afterEach, expect } from 'vitest';

// No `node:*` imports, no `process` typings and no `import.meta.dirname` here,
// deliberately: `tsconfig.vitest-setup.json` — the gate that compiles this file
// — ships NO `@types/node` on purpose (it documents the measurement: adding it
// costs 12 errors inside third-party declarations). Every Node touch below goes
// through a locally-declared structural type instead, so the gate stays green
// without weakening it for the other root setup files.

/**
 * This file sits at the repo root, so its own directory IS the repo root.
 *
 * Derived by STRING SURGERY on `import.meta.url`, not with `new URL('.',
 * import.meta.url)`: Vite statically rewrites that exact pattern at transform
 * time, and the value that survives into the run is `/@fs/...`, not a real path.
 * Measured — it silently turned every path relative-isation into a miss, which
 * failed all 21 known escapes at once.
 */
const REPO_ROOT = (() => {
  const withoutScheme = import.meta.url.replace(/^file:\/\//, '');
  const dir = withoutScheme.replace(/\/[^/]*$/, '/');
  try {
    return decodeURIComponent(dir);
  } catch {
    return dir;
  }
})();

/** The sliver of `process` this file uses, declared rather than imported. */
type StderrHost = { process?: { stderr?: { write(chunk: string): void } } };

/**
 * The attribution line goes to process stderr, NOT through `console`: under
 * happy-dom `globalThis.console` is the window's virtual console and never
 * reaches the terminal (measured — the line vanished entirely). Node writes the
 * real ECONNREFUSED stack to process stderr, so this is also the only way to put
 * the attribution in the SAME stream, beside the stack it explains.
 */
function writeStderr(message: string): void {
  try {
    (globalThis as StderrHost).process?.stderr?.write(message);
  } catch {
    /* the instrument must never break a run */
  }
}

/** The origin happy-dom hands every relative URL when no test owns port 3000. */
const ESCAPE_ORIGIN = /^https?:\/\/(?:127\.0\.0\.1|localhost):3000(?:\/|$)/;

/**
 * Files measured escaping on 67dadd6 (objectui#6640). ONLY SHRINKS.
 * The comment on each line is the endpoint it reached.
 */
export const KNOWN_ESCAPES: ReadonlySet<string> = new Set([
  // /api/v1/security/explain
  'examples/schema-catalog/test/catalog-gallery-render.test.tsx',
  // /api/v1/meta/_drafts
  'packages/app-shell/src/console/home/__tests__/HomePage.approvalsTarget.test.tsx',
  // /api/v1/meta/_drafts
  'packages/app-shell/src/console/home/__tests__/HomePage.authoringCapabilityGate.test.tsx',
  // /api/v1/meta/_drafts
  'packages/app-shell/src/console/home/__tests__/HomePage.inboxLinksTarget.test.tsx',
  // /api/v1/meta/_drafts
  'packages/app-shell/src/console/home/__tests__/HomePage.notificationDeepLink.test.tsx',
  // /api/v1/meta/object
  'packages/app-shell/src/views/metadata-admin/inspectors/FlowNodeInspector.inactiveRetained.test.tsx',
  // /api/v1/meta/object
  'packages/app-shell/src/views/metadata-admin/inspectors/FlowNodeInspector.specKeys.test.tsx',
  // /api/v1/automation/_status
  'packages/app-shell/src/views/studio-design/StudioDesignSurface.designerRegistryMissing.test.tsx',
  // /api/v1/ai/conversations
  'packages/app-shell/src/views/studio-design/__tests__/studioSurfaceContext.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-calendar/src/ObjectCalendar.navWidthDefault.test.tsx',
  // /api/v1/meta/object/task
  'packages/plugin-charts/src/ObjectChart.heightChain.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-detail/src/__tests__/defaultFieldGroupsPage.sectionHeadings.test.tsx',
  // /api/task/42, /api/v1/security/explain
  'packages/plugin-detail/src/__tests__/guideCrudAppRenders.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-detail/src/__tests__/recordDetailsBodySource.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-detail/src/renderers/__tests__/record-details.emptySectionDefault.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-gantt/src/ObjectGantt.navWidthDefault.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-grid/src/__tests__/bulkDeleteVisibleWhen.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-kanban/src/ObjectKanban.navWidthDefault.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-kanban/src/ObjectKanban.overlayTitleI18n.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-kanban/src/ObjectKanban.overlayTitleNoProviderFallback.test.tsx',
  // /api/v1/security/explain
  'packages/plugin-view/src/__tests__/ObjectView.namedViewSortArity.test.tsx',
]);

type Escape = { file: string; test: string; url: string };

/** Escapes seen since the current test started. */
let pending: Escape[] = [];

function relative(p: string | undefined): string {
  if (!p) return '<unknown-test-file>';
  const normalised = p.replace(/\\/g, '/');
  return normalised.startsWith(REPO_ROOT) ? normalised.slice(REPO_ROOT.length) : normalised;
}

const realFetch = globalThis.fetch;

globalThis.fetch = function guardedFetch(input: any, init?: any) {
  let raw: string;
  try {
    raw = typeof input === 'string' ? input : (input?.url ?? String(input));
  } catch {
    raw = '<unreadable-request>';
  }
  let absolute = raw;
  try {
    absolute = new URL(raw, (globalThis as any).location?.href ?? undefined).href;
  } catch {
    /* a non-URL input cannot be an escape; leave it as-is */
  }

  if (ESCAPE_ORIGIN.test(absolute)) {
    let state: any = {};
    try {
      state = expect.getState() ?? {};
    } catch {
      /* called outside a test */
    }
    const escape: Escape = {
      file: relative(state.testPath),
      test: state.currentTestName ?? '<outside-a-test>',
      url: absolute,
    };
    pending.push(escape);

    // Known escapes get an ATTRIBUTED line next to the anonymous stack the real
    // request is about to print. This is the half that cures the reported harm:
    // a bare ECONNREFUSED in a truncated log no longer reads as an unowned red.
    if (KNOWN_ESCAPES.has(escape.file)) {
      writeStderr(
        `[network-escape - known - objectui#6640] ${escape.file} -> ${escape.url}\n` +
          `  The ECONNREFUSED stack near this line belongs to that file. Serve the\n` +
          `  probe from a double, then delete its line from KNOWN_ESCAPES in\n` +
          `  vitest.setup.network-escape-guard.ts.\n`,
      );
    }
  }

  // Always pass through. The real connection attempt IS the evidence that a
  // test reached for a socket; hiding it would keep the escape and remove the
  // proof (objectui#6640 ruling).
  return realFetch.call(globalThis, input, init);
} as typeof globalThis.fetch;

afterEach(() => {
  const seen = pending;
  pending = [];
  const unknown = seen.filter((e) => !KNOWN_ESCAPES.has(e.file));
  if (unknown.length === 0) return;

  const byUrl = [...new Set(unknown.map((e) => e.url))];
  const file = unknown[0].file;
  throw new Error(
    `Network escape: this test reached a REAL socket at ${byUrl.join(', ')}.\n` +
      `  file: ${file}\n` +
      `  test: ${unknown[0].test}\n` +
      `\n` +
      `happy-dom's default document URL is http://localhost:3000, so a relative\n` +
      `fetch from a component under test resolves to a live TCP connection. The\n` +
      `product call site catches the failure by design, so the test stayed green\n` +
      `while printing an unattributable ECONNREFUSED stack — that is objectui#6640.\n` +
      `\n` +
      `Fix: serve the probe from a double rather than the network. See\n` +
      `packages/plugin-report/src/__tests__/DatasetReportRenderer.test.tsx for the\n` +
      `shape (vi.stubGlobal('fetch', router) + vi.unstubAllGlobals()).\n` +
      `\n` +
      `WHERE that pair is torn down is part of the shape, not a detail\n` +
      `(objectui#7439). Vitest runs afterEach hooks in REVERSE registration order,\n` +
      `so a teardown written in THIS file runs FIRST — before the root setup's\n` +
      `RTL cleanup() and before this assertion. Unstubbing there restores the real\n` +
      `fetch while the tree is still mounted, so even a read that cleanup()'s\n` +
      `act-flush triggers escapes. So:\n` +
      `  - call cleanup() BEFORE vi.unstubAllGlobals(), as that\n` +
      `    DatasetReportRenderer afterEach already does; and\n` +
      `  - if the component can issue a read AFTER the test body returns — any\n` +
      `    refreshAfter, any notifyDataChanged consumer, any fire-and-forget\n` +
      `    refresh no barrier awaits — do not tear the double down at all.\n` +
      `    Install ONE at module scope and leave it up for the whole file, so no\n` +
      `    test can ever end with the real fetch back in place. Worked example:\n` +
      `    packages/app-shell/src/views/RecordDetailView.approvalDeclaredActions.test.tsx\n` +
      `\n` +
      `Do NOT add this file to KNOWN_ESCAPES — that list only shrinks.`,
  );
});
