/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6445 — the `disabled` / `disabledOn` node gate reports a faulting
 * predicate, in BOTH builds, and says something TRUE about what its fail-soft
 * default did.
 *
 * ## The silence this closes
 *
 * Six legs of `SchemaRenderer`'s visibility chain (`visibleWhen`, `visible`,
 * `visibleOn`, `visibility`, `hidden`, `hiddenOn`) route through
 * `evaluateVisibilityPredicate` and report. These two called
 * `evaluateCondition` BARE — the only uninstrumented predicate pair in the
 * file — so a faulting `disabled` predicate had never been reported in any
 * build, in any dialect that does not report on its own.
 *
 * And it is the pair whose fail-soft default BITES. `evaluateCondition` answers
 * an unevaluable predicate with `true`; on the negated visibility legs that
 * means SHOWN, here it means GREYED OUT. So the user sees a control they cannot
 * use and the author has nothing to grep for — the support ticket the card
 * names ("the Save button is greyed out and I don't know why").
 *
 * ## Observability only — the polarity is NOT this card's to move
 *
 * `evaluateCondition`'s `true` for an unevaluable predicate is existing shipped
 * behaviour, preserved deliberately (the neighbouring family #3862/#3955 landed
 * fail-soft on purpose). Every case below therefore pins the VERDICT beside the
 * line: a faulting `disabled` still disables. A run that made this file green by
 * flipping the gate would fail those pins.
 *
 * ## Why the dedupe is pinned in BOTH directions, and across gates
 *
 * The reporter is rate-limited per `(type, key, predicate source)`
 * (`visibilityDiagnostic.ts`), and #6444 added a second, independent rate limit
 * inside `ExpressionEvaluator` for its own built-in lines. "A warning was
 * emitted" is green on an implementation that emitted fifty; "exactly one was
 * emitted" is green on one that suppresses EVERYTHING after the first line ever
 * printed. Neither pin alone can tell a working dedupe from a broken one, so
 * every dedupe case here pins both halves, and two cases pin the direction this
 * new call site made possible: the SAME predicate source authored on `disabled`
 * and on `visibleWhen` (and on `disabled` and `disabledOn`) must produce TWO
 * lines. Without those, a key that collapsed the gates together would look
 * exactly like a working rate limit.
 *
 * ## Reverse verification (direction predicted BEFORE running)
 *
 * Restoring the bare `evaluator.evaluateCondition(newSchema.disabled)` on both
 * legs — the two lines this card replaces — turns RED every report-count pin in
 * groups 1, 2, 4 and 5 (their counts fall to 0; the CEL and `${…}` cases keep a
 * count but the line becomes the evaluator's own generic one, which carries
 * neither prefix, so the prefix-filtered view is empty there too) and leaves
 * every VERDICT pin and the whole of group 3 GREEN. That asymmetry is the card
 * restated: the change moves the silence, not the answer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import {
  ADAPTER_ONLY_DATA_PREDICATE_PREFIX,
  UNRESOLVABLE_ENABLEMENT_PREFIX,
  UNRESOLVABLE_VISIBILITY_PREFIX,
} from '../utils/visibilityDiagnostic';

const NAME = 'probe-6445';
const TYPE = 'element:probe-6445';

/**
 * Records the `disabled` prop EXACTLY as it arrives — `absent` when the
 * renderer forwarded nothing — so every case can pin the VERDICT beside the
 * console line. `_disabled` is not an internal marker: it is re-injected as a
 * real `disabled` prop, which is what the user's greyed-out control is made of.
 */
const Probe = (props: { disabled?: unknown }) => (
  <div
    data-testid="probe"
    data-disabled-prop={props.disabled === undefined ? 'absent' : String(props.disabled)}
  />
);

/** The ambient scope app-shell's `ExpressionProvider` really mounts. */
const APP_SCOPE = {
  current_user: { id: 'u1' },
  user: { id: 'u1' },
  app: {},
  data: {},
  features: {},
};
const ADAPTER = { total: 99 };
const ROW = { id: 'r1', status: 'open' };

/**
 * Predicates that genuinely FAULT, one per dialect, measured on the built
 * evaluator. An unbound ROOT identifier is the shape objectstack#11254 hit and
 * the shape an AI-authored predicate reaches for; `record.bad(` is a parse
 * error, the only fault the CEL engine reports as `[parse]`.
 */
const FAULT_BARE = 'nosuchroot.locked == true';
const FAULT_BARE_2 = 'anotherbadroot.frozen == true';
/**
 * A DISTINCT source per development cell — not tidiness, a measurement.
 *
 * objectui#6444 added `warnedEvaluationFaults` to `ExpressionEvaluator`: module
 * state, keyed on `[site, source]`, that suppresses the evaluator's OWN built-in
 * line after the first report of a source. `inProduction` gets a fresh module
 * graph per case (`vi.resetModules`), so that `Set` starts empty there; the
 * development cases run on the STATIC graph and share one `Set` for the whole
 * file.
 *
 * So a dev cell reusing another dev cell's source could have the built-in line
 * suppressed on its behalf — and a total-count pin would then read `1` on a
 * build that reports the fault TWICE (our line plus the evaluator's), which is
 * the regression those pins exist to catch. Reported to the dispatch as the
 * in-file instance of exactly the hazard #6444's dev found in the pre-existing
 * suite. A unique source per dev cell makes the pin unmaskable rather than
 * order-dependent.
 */
const FAULT_BARE_DEV = 'devonlybadroot.locked == true';
const FAULT_BARE_PARITY = 'parityrootmissing.locked == true';
const FAULT_TEMPLATE = '${nosuchroot.locked == true}';
const FAULT_CEL = { dialect: 'cel', source: 'record.bad(' };
/** Predicates that resolve cleanly — the silence that makes the noise mean something. */
const HEALTHY_DISABLING = "record.status == 'open'";
const HEALTHY_ENABLING = "record.status == 'closed'";

type WarnSpy = { mock: { calls: unknown[][] } };
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
/** The ENABLEMENT-prefix-filtered view most assertions read. */
const reports = (warn: WarnSpy): string[] =>
  warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(UNRESOLVABLE_ENABLEMENT_PREFIX));
/** The sibling gate's view, for the cross-gate cases. */
const visibilityReports = (warn: WarnSpy): string[] =>
  warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(UNRESOLVABLE_VISIBILITY_PREFIX));
/** Everything the console was asked to print, filtered by nothing. */
const allWarnings = (warn: WarnSpy): string[] => warn.mock.calls.map((c) => String(c[0]));

/**
 * The ONE pre-existing line a development build prints beside these
 * diagnostics, and it is not ours.
 *
 * `SchemaRenderer` runs `validateSchemaOnce` in dev only, and core's
 * `BASE_SCHEMA_RULES` declares `disabled` "must be a boolean" — so every
 * EXPRESSION-valued `disabled`, the authoring form this whole card is about,
 * is also reported as an invalid schema. That is a false positive predating
 * this card and filed separately (objectui#6505); it is named here rather than
 * absorbed into a loose assertion, because "the total was 2" would go equally
 * green on a build that printed our line twice.
 *
 * Production is unaffected — that validator is a no-op there — which is why
 * the production cases below can still pin the RAW total.
 */
const DEV_SCHEMA_VALIDATOR_NOISE = '[ObjectUI] Invalid schema detected:';
/** Everything printed that is NOT the known dev-only validator line. */
const nonValidatorWarnings = (warn: WarnSpy): string[] =>
  allWarnings(warn).filter((m) => !m.includes(DEV_SCHEMA_VALIDATOR_NOISE));

/**
 * Mount `schemas` in a PRODUCTION module graph.
 *
 * `__DEV__` in `SchemaRenderer` is an IIFE evaluated at module load, so the env
 * has to be stubbed before the import — hence `resetModules` and a dynamic
 * import in the test BODY (the case `object-ui/no-dynamic-import-in-test-hook`
 * exempts). The dedupe `Set` is module state of that same fresh graph, so the
 * reset has to come from the fresh graph too: resetting the statically-imported
 * copy would clear a DIFFERENT `Set`, and every count below would then be
 * measuring the previous case's leakage rather than this case's behaviour.
 */
async function inProduction(
  fn: (mount: (schemas: Record<string, unknown>[]) => void) => void | Promise<void>,
): Promise<void> {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'production');
  try {
    const [core, prod, ctx, rec, expr, diag] = await Promise.all([
      import('@object-ui/core'),
      import('../SchemaRenderer'),
      import('../context/SchemaRendererContext'),
      import('../context/RecordContext'),
      import('../hooks/useExpression'),
      import('../utils/visibilityDiagnostic'),
    ]);
    diag.__resetVisibilityPredicateWarnings();
    core.ComponentRegistry.register(NAME, Probe as never, {
      namespace: 'element',
      skipFallback: true,
    } as never);
    const mount = (schemas: Record<string, unknown>[]) =>
      render(
        <expr.PredicateScopeProvider scope={APP_SCOPE}>
          <ctx.SchemaRendererContext.Provider value={{ dataSource: ADAPTER } as never}>
            <rec.RecordContextProvider objectName="showcase_task" recordId={ROW.id} data={ROW}>
              {schemas.map((s, i) => (
                <prod.SchemaRenderer key={i} schema={{ type: TYPE, ...s } as never} />
              ))}
            </rec.RecordContextProvider>
          </ctx.SchemaRendererContext.Provider>
        </expr.PredicateScopeProvider>,
      );
    await fn(mount);
    core.ComponentRegistry.unregister?.(NAME, 'element');
  } finally {
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

/** Mount one schema in the ordinary (development) module graph. */
async function inDevelopment(
  fn: (mount: (schemas: Record<string, unknown>[]) => void) => void | Promise<void>,
): Promise<void> {
  const [core, dev, ctx, rec, expr, diag] = await Promise.all([
    import('@object-ui/core'),
    import('../SchemaRenderer'),
    import('../context/SchemaRendererContext'),
    import('../context/RecordContext'),
    import('../hooks/useExpression'),
    import('../utils/visibilityDiagnostic'),
  ]);
  diag.__resetVisibilityPredicateWarnings();
  core.ComponentRegistry.register(NAME, Probe as never, {
    namespace: 'element',
    skipFallback: true,
  } as never);
  try {
    const mount = (schemas: Record<string, unknown>[]) =>
      render(
        <expr.PredicateScopeProvider scope={APP_SCOPE}>
          <ctx.SchemaRendererContext.Provider value={{ dataSource: ADAPTER } as never}>
            <rec.RecordContextProvider objectName="showcase_task" recordId={ROW.id} data={ROW}>
              {schemas.map((s, i) => (
                <dev.SchemaRenderer key={i} schema={{ type: TYPE, ...s } as never} />
              ))}
            </rec.RecordContextProvider>
          </ctx.SchemaRendererContext.Provider>
        </expr.PredicateScopeProvider>,
      );
    await fn(mount);
  } finally {
    core.ComponentRegistry.unregister?.(NAME, 'element');
    cleanup();
  }
}

/** The forwarded `disabled` prop of the FIRST probe, or `null` if none rendered. */
const disabledProp = (): string | null => {
  const el = screen.queryAllByTestId('probe')[0];
  return el ? el.getAttribute('data-disabled-prop') : null;
};
const shownCount = () => screen.queryAllByTestId('probe').length;

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- *
 * Group 0 — the controls that decide whether the rest of the file means
 * anything. Both are about the CAPTURE, not about the renderer.
 * -------------------------------------------------------------------------- */

describe('#6445 group 0 — capture controls', () => {
  it('POSITIVE CONTROL: the spy really observes a line carrying the enablement prefix', () => {
    // Without this, every `toHaveLength(0)` in this file is equally green on a
    // capture that observes nothing at all.
    const warn = spyWarn();
    console.warn(`${UNRESOLVABLE_ENABLEMENT_PREFIX} - synthetic control line`);
    expect(reports(warn)).toHaveLength(1);
  });

  it('DEGENERATE CONTROL: unrelated console output does NOT satisfy the pin', () => {
    const warn = spyWarn();
    console.warn('[object-ui] some entirely unrelated warning');
    console.warn(`${UNRESOLVABLE_VISIBILITY_PREFIX} - a line from the OTHER gate`);
    expect(allWarnings(warn)).toHaveLength(2);
    // The sibling gate's line must not stand in for this one — that is the
    // whole reason the two prefixes are separate constants.
    expect(reports(warn)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- *
 * Group 1 — THE acceptance criterion, per dialect and per key.
 * -------------------------------------------------------------------------- */

describe('#6445 group 1 — a faulting `disabled` gate is loud, and still disables', () => {
  it('THE acceptance criterion: a BARE-STRING `disabled` fault warns in a production build (it printed NOTHING before)', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: FAULT_BARE }]);

      // VERDICT FIRST — observability only. The control is still greyed out,
      // which is exactly the property that made the silence expensive.
      expect(disabledProp()).toBe('true');

      const lines = reports(warn);
      expect(lines).toHaveLength(1);
      // The line has to identify the predicate, the gate and the node, or it is
      // not a diagnostic — it is an alarm with no address.
      expect(lines[0]).toContain(TYPE);
      expect(lines[0]).toContain('n1');
      expect(lines[0]).toContain('disabled');
      expect(lines[0]).toContain(FAULT_BARE);
      expect(lines[0]).toContain('Reason:');
      // ONE fault, ONE line: nothing else was printed alongside it.
      expect(allWarnings(warn)).toHaveLength(1);
    });
  });

  it('the `disabledOn` alias reports too — the same wiring, not a copy of it', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabledOn: FAULT_BARE }]);
      expect(disabledProp()).toBe('true');
      const lines = reports(warn);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('disabledOn');
      expect(allWarnings(warn)).toHaveLength(1);
    });
  });

  it('a `{ dialect: "cel" }` envelope fault warns ONCE — the engine\'s generic line is replaced, not joined', async () => {
    // The canonical engine already printed its own line here. The risk of this
    // wiring was two lines for one fault; the total-count pin refuses it.
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: FAULT_CEL }]);
      expect(disabledProp()).toBe('true');
      const lines = reports(warn);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('record.bad(');
      expect(allWarnings(warn)).toHaveLength(1);
    });
  });

  it('a `${…}` template fault warns ONCE across many evaluations — that dialect used to print one line PER evaluation', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([
        { id: 'n1', disabled: FAULT_TEMPLATE },
        { id: 'n2', disabled: FAULT_TEMPLATE },
        { id: 'n3', disabled: FAULT_TEMPLATE },
      ]);
      expect(shownCount()).toBe(3);
      expect(disabledProp()).toBe('true');
      expect(reports(warn)).toHaveLength(1);
      expect(allWarnings(warn)).toHaveLength(1);
    });
  });

  it('development reports it too — one wiring, not a `__DEV__` branch', async () => {
    await inDevelopment((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: FAULT_BARE_DEV }]);
      expect(disabledProp()).toBe('true');
      expect(reports(warn)).toHaveLength(1);
      expect(reports(warn)[0]).toContain(FAULT_BARE_DEV);
      // ONE fault, ONE line of ours. The dev build also prints core's
      // `disabled must be a boolean` validator line for this very node
      // (objectui#6505) — subtracted by NAME rather than by count, so a second
      // copy of OUR line could never hide inside the allowance.
      expect(nonValidatorWarnings(warn)).toHaveLength(1);
      expect(allWarnings(warn)).toHaveLength(2);
    });
  });
});

/* -------------------------------------------------------------------------- *
 * Group 2 — the rate limit: BOTH halves, and both gates.
 * -------------------------------------------------------------------------- */

describe('#6445 group 2 — deduped per predicate SOURCE and per GATE', () => {
  it('COLLAPSING HALF: three nodes with DIFFERENT ids and the SAME source produce exactly ONE line', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([
        { id: 'alpha', disabled: FAULT_BARE },
        { id: 'beta', disabled: FAULT_BARE },
        { id: 'gamma', disabled: FAULT_BARE },
      ]);
      expect(shownCount()).toBe(3);
      expect(reports(warn)).toHaveLength(1);
    });
  });

  it('COLLAPSING HALF: re-rendering the same faulting predicate does NOT add a line', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: FAULT_BARE }]);
      cleanup();
      mount([{ id: 'n1', disabled: FAULT_BARE }]);
      cleanup();
      mount([{ id: 'n1', disabled: FAULT_BARE }]);
      expect(reports(warn)).toHaveLength(1);
    });
  });

  it('COLLAPSING HALF: a two-hundred-row list of ONE broken predicate is one line, not two hundred', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount(Array.from({ length: 200 }, (_, i) => ({ id: `row-${i}`, disabled: FAULT_BARE })));
      expect(shownCount()).toBe(200);
      expect(reports(warn)).toHaveLength(1);
      expect(allWarnings(warn)).toHaveLength(1);
    });
  });

  it('SEPARATING HALF: a SECOND distinct predicate source still warns — without this, a dedupe that suppresses everything looks identical', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([
        { id: 'n1', disabled: FAULT_BARE },
        { id: 'n2', disabled: FAULT_BARE_2 },
      ]);
      const lines = reports(warn);
      expect(lines).toHaveLength(2);
      expect(lines.some((l) => l.includes(FAULT_BARE))).toBe(true);
      expect(lines.some((l) => l.includes(FAULT_BARE_2))).toBe(true);
    });
  });

  it('SEPARATING HALF, across KEYS: the same source on `disabled` and on `disabledOn` is two lines', async () => {
    // `key` is in the dedupe key, so the two legs of this gate cannot silence
    // each other. An author who wrote the same broken predicate on both hears
    // about both.
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([
        { id: 'n1', disabled: FAULT_BARE },
        { id: 'n2', disabledOn: FAULT_BARE },
      ]);
      const lines = reports(warn);
      expect(lines).toHaveLength(2);
      expect(lines.some((l) => l.includes('  disabled: '))).toBe(true);
      expect(lines.some((l) => l.includes('  disabledOn: '))).toBe(true);
    });
  });

  it('SEPARATING HALF, across GATES: the same source on `disabled` and on `visibleWhen` is two lines, one per gate', async () => {
    // The direction this new call site made possible. Both gates share one
    // reporter and one `Set`; if the key ever stopped separating them, the
    // second gate to render would go silent — and every "exactly one line" pin
    // above would still pass. This case is what makes those pins mean
    // "deduped", not "swallowed".
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([
        { id: 'n1', disabled: FAULT_BARE },
        { id: 'n2', visibleWhen: FAULT_BARE },
      ]);
      expect(reports(warn)).toHaveLength(1);
      expect(visibilityReports(warn)).toHaveLength(1);
      expect(allWarnings(warn)).toHaveLength(2);
    });
  });

  it('… and in the other mount order, which is the half a shared `Set` could still get wrong', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([
        { id: 'n1', visibleWhen: FAULT_BARE },
        { id: 'n2', disabled: FAULT_BARE },
      ]);
      expect(reports(warn)).toHaveLength(1);
      expect(visibilityReports(warn)).toHaveLength(1);
      expect(allWarnings(warn)).toHaveLength(2);
    });
  });
});

/* -------------------------------------------------------------------------- *
 * Group 3 — the silence that makes the noise mean something.
 * -------------------------------------------------------------------------- */

describe('#6445 group 3 — nothing else became loud', () => {
  it('a HEALTHY `disabled` predicate prints nothing, on either verdict', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: HEALTHY_DISABLING }]);
      expect(disabledProp()).toBe('true');
      cleanup();
      mount([{ id: 'n2', disabled: HEALTHY_ENABLING }]);
      expect(disabledProp()).toBe('absent');
      expect(allWarnings(warn)).toHaveLength(0);
    });
  });

  it('the objectui#3862 EMPTY shapes stay silent AND stay enabled — an undeclared gate never reaches the evaluator', async () => {
    // `hasDeclaredPredicate` still decides this one line earlier, so these rows
    // are not faults; they are non-gates. A wiring that reported them would be
    // reporting metadata that says nothing, once per empty spelling in the app.
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([
        { id: 'e1', disabled: '' },
        { id: 'e2', disabled: null },
        { id: 'e3', disabled: '   ' },
        { id: 'e4', disabled: { dialect: 'cel', source: '' } },
        { id: 'e5', disabledOn: '' },
      ]);
      expect(shownCount()).toBe(5);
      expect(disabledProp()).toBe('absent');
      expect(allWarnings(warn)).toHaveLength(0);
    });
  });

  it('literal `disabled: true` / `false` and a node with no gate print nothing', async () => {
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: true }]);
      expect(disabledProp()).toBe('true');
      cleanup();
      mount([{ id: 'n2', disabled: false }]);
      expect(disabledProp()).toBe('absent');
      cleanup();
      mount([{ id: 'n3' }]);
      expect(disabledProp()).toBe('absent');
      expect(allWarnings(warn)).toHaveLength(0);
    });
  });

  it('objectui#5687 is NOT extended to this gate: an adapter-only `data.*` `disabled` predicate stays silent (filed as objectui#6504)', async () => {
    // Deliberately out of scope. That leg reports a predicate that evaluated
    // PERFECTLY against the wrong object — not a fault — and its ruling
    // (2026-08-22 option A) is scoped to the visibility gate, with copy written
    // about hiding. Pinned so the boundary is a stated decision rather than
    // something a later reader discovers by surprise.
    await inDevelopment((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: "data.status == 'locked'" }]);
      // The verdict is the documented one: a constant, here constant-false.
      expect(disabledProp()).toBe('absent');
      // No predicate diagnostic of ANY kind: not this card's (the predicate
      // did not fault), not objectui#5687's (not wired to this gate), not the
      // visibility one.
      expect(reports(warn)).toHaveLength(0);
      expect(visibilityReports(warn)).toHaveLength(0);
      expect(
        allWarnings(warn).filter((m) => m.includes(ADAPTER_ONLY_DATA_PREDICATE_PREFIX)),
      ).toHaveLength(0);
      // The only thing the console saw is the dev validator's pre-existing
      // false positive on a string-valued `disabled` (objectui#6505).
      expect(nonValidatorWarnings(warn)).toHaveLength(0);
    });
  });
});

/* -------------------------------------------------------------------------- *
 * Group 4 — the words. This is the card's design content: the visibility
 * reporter's copy is written for a gate that did NOT bite, and this one DOES.
 * -------------------------------------------------------------------------- */

/** The exact consequence + advice an author reads on THIS gate. */
const ENABLEMENT_TAIL =
  'The node was treated as its safe default, which on THIS gate is the one\n' +
  'that BITES: the node renders DISABLED - on screen, greyed out, refusing\n' +
  'input - and that is indistinguishable from a gate the author meant to\n' +
  'close. No pixel says a predicate failed, so this line is the only thing\n' +
  'that will ever name the one that did it.\n' +
  'Page-component predicates bind `record` (the row on a record page),\n' +
  '`current_user`, and page state as `page.<var>`. Check those roots and the\n' +
  'CEL syntax.';

/** The shipped visibility copy, which must not move. */
const VISIBILITY_TAIL =
  'The node was treated as its safe default, which on this surface means the\n' +
  'gate did NOT bite - a predicate that cannot be evaluated reads on screen\n' +
  'exactly like one that said yes.\n' +
  'Page-component predicates bind `record` (the row on a record page),\n' +
  '`current_user`, and page state as `page.<var>`. Check those roots and the\n' +
  'CEL syntax.';

describe('#6445 group 4 — the message is true for THIS polarity', () => {
  it('the enablement line names the node, the key, the source and the consequence — word for word', async () => {
    // Asserted against a literal rather than against the formatter: a pin that
    // re-derives the message from the code under test goes green on any wording,
    // including wording that is false.
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'save-btn', disabled: FAULT_BARE }]);
      const line = reports(warn)[0];
      expect(line.startsWith(
        `${UNRESOLVABLE_ENABLEMENT_PREFIX} - node "${TYPE}" (id: "save-btn")\n` +
          `  disabled: ${JSON.stringify(FAULT_BARE)}\n` +
          '  Reason: ',
      )).toBe(true);
      expect(line.endsWith(ENABLEMENT_TAIL)).toBe(true);
    });
  });

  it('it does NOT reuse the visibility copy — the sentence that would be FALSE here is absent', async () => {
    // The card's whole design content. "The gate did NOT bite" is written about
    // a gate whose fail-soft default shows the node; here the default greys the
    // control out, and telling the author otherwise sends them hunting for a
    // rendering bug instead of at their own predicate.
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: FAULT_BARE }]);
      const line = reports(warn)[0];
      expect(line).not.toContain('gate did NOT bite');
      expect(line).not.toContain(UNRESOLVABLE_VISIBILITY_PREFIX);
      expect(line).not.toContain('reads on screen');
    });
  });

  it('and the visibility gate still prints its own copy, unchanged', async () => {
    // The other half of the same claim: this card added a second message, it
    // did not edit the first. A regression here would be shipped bytes moving
    // on six legs that objectui#6487 landed on hours earlier.
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', visibleWhen: FAULT_BARE }]);
      const line = visibilityReports(warn)[0];
      expect(line.startsWith(
        `${UNRESOLVABLE_VISIBILITY_PREFIX} - node "${TYPE}" (id: "n1")\n` +
          `  visibleWhen: ${JSON.stringify(FAULT_BARE)}\n` +
          '  Reason: ',
      )).toBe(true);
      expect(line.endsWith(VISIBILITY_TAIL)).toBe(true);
    });
  });
});

/* -------------------------------------------------------------------------- *
 * Group 5 — dev and production print the IDENTICAL line.
 * -------------------------------------------------------------------------- */

describe('#6445 group 5 — one message, both builds', () => {
  it('the same fault produces the same bytes in development and in production', async () => {
    // What makes "no `__DEV__` split on this gate" a fact rather than a comment:
    // a build-specific message would be a second diagnostic to keep in sync,
    // and the two would drift.
    let devLine = '';
    await inDevelopment((mount) => {
      const warn = spyWarn();
      // Its OWN source (see `FAULT_BARE_DEV`'s docblock): the dev leg runs on
      // the static module graph this file shares, so reusing another dev cell's
      // source would make this comparison order-dependent.
      mount([{ id: 'n1', disabled: FAULT_BARE_PARITY }]);
      const lines = reports(warn);
      expect(lines).toHaveLength(1);
      devLine = lines[0];
      expect(disabledProp()).toBe('true');
    });

    // Restore before spying again: `vi.spyOn` on an already-spied method hands
    // back the SAME spy, so a second `spyWarn()` would carry the dev call into
    // the production reading and the count below would be off by one.
    vi.restoreAllMocks();

    let prodLine = '';
    await inProduction((mount) => {
      const warn = spyWarn();
      mount([{ id: 'n1', disabled: FAULT_BARE_PARITY }]);
      const lines = reports(warn);
      expect(lines).toHaveLength(1);
      prodLine = lines[0];
      expect(disabledProp()).toBe('true');
    });

    expect(prodLine).toBe(devLine);
  });
});
