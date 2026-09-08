// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#6830 — what a declared `FlowConfigField.defaultValue` actually does
 * to the RENDERED flow-node inspector.
 *
 * This file pins BEHAVIOUR, not source text. The card's claim ("ten fields
 * declare a default, the control shows none of them") is a claim about a
 * document, so it is settled by reading the document: every case below renders
 * `FlowNodeInspector` and interrogates the control the author actually sees —
 * the checkbox's `checked`, the select trigger's text. A pin written over the
 * declaration table would be a source-text snapshot and would pass on a build
 * where nothing rendered at all.
 *
 * ⚑ objectui#8451 rewrote the BOOLEAN half of this file. Triage ruled arm A
 * ("show, do not write") on objectui#6830, and the boolean control now seeds
 * from the declared default, so the three rows that pinned the defect were
 * turned green against the repaired behaviour rather than deleted — the same
 * three PR #8431's ablation leg B predicted would move. Everything else is
 * carried over unchanged, including every select case: that half is blocked on
 * objectui#8450 and is still unrepaired.
 *
 * The measurement, in four parts:
 *
 *  1. On a BOOLEAN control a declared default now seeds the value: an unset key
 *     draws the declared state, a stored value beats it, and nothing is written
 *     to the node. On a SELECT it still reaches nothing — an unset key draws a
 *     blank trigger, not the declared option and not even a placeholder,
 *     because the field always passes a controlled value and Radix renders its
 *     placeholder only for an undefined one (objectui#8450).
 *  2. Both writers of the property feed the repaired boolean — the hand-written
 *     table here and the engine-published `configSchema` that
 *     `json-schema-to-fields` converts (`default: true` -> `defaultValue:
 *     'true'`). The select is a dead end on both.
 *  3. The property also drives VISIBILITY: a declared default on a `showWhen`
 *     CONTROLLER changes which fields are on screen at all (`controllerAdmits`).
 *     That read site predates the repair and is unchanged by it.
 *  4. A boolean control can now distinguish "key absent" from "key stored as
 *     `false`" — the two used to render byte-identical DOM even though the
 *     runtime treats them oppositely, which is the mechanism that turned a
 *     missing display into a false assertion.
 *
 * Two describes guard the repair from below:
 *
 *  - the non-regression half (objectui#8350's lesson): every claim here is also
 *    satisfied by an inspector that renders NOTHING, so the controls'
 *    existence, their stored-value behaviour, the offered vocabulary and the
 *    deprecated-value fallback are pinned beside them.
 *  - the stored-`false` rows: an implementation strictly WORSE than the bug —
 *    a box that is ALWAYS checked — satisfies "an absent key shows checked".
 *    Only a stored `false` refuses it, so those rows are load bearing and must
 *    not be softened into "differs from absent".
 *
 * ⛔ These cases pin what the tree DOES. The direction they pin is triage's
 * ruling on objectui#6830, not this file's opinion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mutable so a case can publish a server `configSchema` for one node type and
// exercise the ONLINE field derivation, which is the other writer of
// `defaultValue`. Hoisted because `vi.mock` factories run before the file body.
const stubs = vi.hoisted(() => ({ configSchemas: {} as Record<string, unknown> }));

vi.mock('../previews/useFlowNodePalette', () => ({
  useActionConfigSchemas: () => stubs.configSchemas,
  useFlowNodePalette: () => [],
}));
vi.mock('../previews/useObjectFields', () => ({
  useObjectFields: () => ({ fields: [], loading: false, error: null }),
}));

import { FlowNodeInspector } from './FlowNodeInspector';
import { fieldsForNodeType, FLOW_NODE_TYPE_OPTIONS } from './flow-node-config';
import type { MetadataSelection } from '../preview-registry';

/* ── The `meta/*` double (objectui#7307) ───────────────────────────────
 * `FlowNodeInspector` renders `FlowReferenceField` for every reference-kind key
 * on the selected node, and that field resolves its combobox options through
 * `MetadataClient.list(type)` — a real `fetch` under happy-dom. Served here from
 * a RECORDING double in the shape `FlowNodeInspector.inactiveRetained.test.tsx`
 * already uses: an EMPTY registry in the `{ type, items: [] }` envelope, which
 * is byte-identical to what the hook's `.catch` produced before, and a recorder
 * whose `afterEach` fails on any URL outside the metadata routes — so an escape
 * to a data endpoint reds here instead of vanishing into a `.catch`.
 * ─────────────────────────────────────────────────────────────────────── */

const META_PREFIX = '/api/v1/meta/';

/** Every URL these renders handed the global `fetch`, in request order. */
let metaCalls: string[] = [];

const routeOf = (url: string) => url.split('?')[0];

function installMetaDouble() {
  metaCalls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(
        input && typeof input === 'object' && 'url' in input ? (input as { url: unknown }).url : input,
      );
      metaCalls.push(url);
      const route = routeOf(url);
      if (!route.startsWith(META_PREFIX)) {
        return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ type: route.slice(META_PREFIX.length), items: [] }),
      };
    }),
  );
}

beforeEach(() => {
  stubs.configSchemas = {};
  installMetaDouble();
});

afterEach(() => {
  // A router, not a sink: a request to anything but the metadata registry fails
  // here rather than being swallowed.
  expect(metaCalls.filter((url) => !routeOf(url).startsWith(META_PREFIX))).toEqual([]);
  // Unmount BEFORE restoring the real `fetch` (objectui#7439).
  cleanup();
  vi.unstubAllGlobals();
});

function draftWith(type: string, node: Record<string, unknown>) {
  return { nodes: [{ id: 'n1', type, label: 'Node', ...node }], edges: [] };
}

function renderInspector(draft: Record<string, unknown>) {
  const onPatch = vi.fn();
  const utils = render(
    <FlowNodeInspector
      type="flow"
      name="renewal"
      draft={draft}
      selection={{ kind: 'node', id: 'n1' } as MetadataSelection}
      onPatch={onPatch}
      onClearSelection={vi.fn()}
      readOnly={false}
      locale="en-US"
    />,
  );
  return { onPatch, ...utils };
}

/** The rendered text of a labelled select trigger (Radix `button[role=combobox]`). */
const triggerText = (name: string) => screen.getByRole('combobox', { name }).textContent;

/** The rendered checkbox for a labelled boolean control, or null when absent. */
const checkbox = (name: string) =>
  screen.queryByLabelText(name) as HTMLInputElement | null;

describe('select: a declared defaultValue still does not reach the control (objectui#8450)', () => {
  it('select: an unset key draws the placeholder, not the declared "GET"', () => {
    // Premise, read from the table the inspector renders from.
    const method = fieldsForNodeType('http_request').find((f) => f.id === 'method');
    expect(method?.defaultValue, 'http_request.method declares a default').toBe('GET');

    renderInspector(draftWith('http_request', { config: {} }));

    // Measured, not assumed: the trigger is EMPTY — it shows neither the
    // declared default nor `InspectorSelectField`'s own em-dash placeholder.
    // Radix renders a placeholder only for an UNCONTROLLED/undefined value; the
    // field always passes a controlled one (the `''` -> sentinel bridge), and a
    // controlled value matching no `SelectItem` renders as nothing at all.
    expect(
      triggerText('Method'),
      'the Method trigger renders empty — no declared default, not even the placeholder',
    ).toBe('');
    expect(
      screen.queryByText('GET'),
      'the declared default "GET" reaches no part of the rendered inspector',
    ).toBeNull();
  });

  it('select: the same control DOES show "GET" when the key is stored — the lit control', () => {
    renderInspector(draftWith('http_request', { config: { method: 'GET' } }));
    expect(
      triggerText('Method'),
      'a stored GET renders, so the negative above is a real absence and not a dead document',
    ).toBe('GET');
    expect(screen.queryByText('GET'), 'the lit control fires').not.toBeNull();
  });
});

describe('boolean: a declared defaultValue seeds the control (objectui#8451, arm A)', () => {
  it('boolean: an unset key draws a CHECKED box, because the table declares true', () => {
    const notify = fieldsForNodeType('approval').find((f) => f.id === 'escalation.notifySubmitter');
    expect(notify?.defaultValue, 'escalation.notifySubmitter declares a default').toBe('true');

    // `enabled: true` is set only so the gated field is on screen at all; the
    // key under measurement (`notifySubmitter`) is the one left unset.
    renderInspector(draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24 } } }));

    const box = checkbox('Notify submitter');
    expect(box, 'the Notify submitter control is rendered').not.toBeNull();
    expect(
      box!.checked,
      'the box reads CHECKED, which is what the runtime applies to the omitted key',
    ).toBe(true);
  });

  it('boolean: showing the default WRITES nothing — the node still omits the key', () => {
    // The other half of "show, do not write". A seeded control that also
    // committed would turn every visit to the inspector into a metadata edit,
    // freezing today's default into the node and un-tracking it from the spec.
    const { onPatch } = renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24 } } }),
    );
    expect(checkbox('Notify submitter')!.checked, 'the seed is on screen').toBe(true);
    expect(
      onPatch.mock.calls,
      'rendering a seeded control patches the draft exactly zero times',
    ).toEqual([]);
  });

  it('boolean: a stored true renders checked — unchanged by the repair', () => {
    renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24, notifySubmitter: true } } }),
    );
    expect(checkbox('Notify submitter')!.checked, 'a stored true renders checked').toBe(true);
  });

  it('boolean: a stored FALSE beats the declared true and draws an UNCHECKED box', () => {
    // ⛔ Load bearing, and not interchangeable with "differs from the absent
    // rendering": this is the only row an ALWAYS-CHECKED control fails. Without
    // it, an implementation strictly worse than the bug — one that ignores both
    // the stored value and the declaration — satisfies every other claim here.
    renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24, notifySubmitter: false } } }),
    );
    expect(
      checkbox('Notify submitter')!.checked,
      'a deliberate false is the author\'s answer and outranks the declaration',
    ).toBe(false);
  });

  it('boolean: a field declaring NO default still draws unchecked when unset', () => {
    // The seed belongs to the DECLARATION, not to the control: a boolean with
    // nothing declared must not acquire a default from the repair. Measured on
    // the online writer because the offline table has no undeclared boolean to
    // measure — it carries exactly two boolean fields and both declare one.
    stubs.configSchemas = {
      approval: {
        type: 'object',
        properties: {
          escalation: {
            type: 'object',
            title: 'SLA escalation',
            properties: {
              enabled: { type: 'boolean', default: true },
              notifySubmitter: { type: 'boolean', title: 'Notify submitter' },
            },
          },
        },
      },
    };
    renderInspector(draftWith('approval', { config: { escalation: { timeoutHours: 24 } } }));
    const box = checkbox('Notify submitter');
    expect(box, 'the sibling is on screen — the gate default admitted it').not.toBeNull();
    expect(
      box!.checked,
      'and it draws unchecked, because this schema declares no default for it',
    ).toBe(false);
  });

  it('boolean: the #6620-wrong declaration ships NO worded claim (objectui#6620)', () => {
    // `escalation.enabled` is the one field in the offline table whose declared
    // default contradicts what the installed spec applies to an omitted key.
    // This card ships the SEED and no caption, which is why: the seed renders
    // that field exactly as it rendered before (unchecked — the declaration
    // says 'false'), so no new claim about the declaration reaches the author,
    // while a "(default)" caption would have asserted the wrong one in words.
    //
    // ⚠️ Deliberately does NOT compare the declaration against the spec. That
    // comparison is objectui#6620's tripwire, held disarmed on purpose in
    // `flow-node-config.spec-reconciliation.test.ts`; arming it here would
    // discharge an on-hold card from an unrelated PR.
    const gate = fieldsForNodeType('approval').find((f) => f.id === 'escalation.enabled');
    expect(gate?.defaultValue, 'the gate declares a default at all').toBe('false');

    renderInspector(draftWith('approval', { config: { escalation: { timeoutHours: 24 } } }));
    const box = checkbox('SLA escalation');
    expect(box, 'the gate control is on screen').not.toBeNull();
    expect(box!.checked, 'and it renders as it always did — unchecked').toBe(false);
    expect(
      box!.closest('label')?.textContent,
      'the control carries its label and nothing else — no caption naming a default',
    ).toBe('SLA escalation');
  });
});

describe('the online writer of defaultValue hits the same dead end', () => {
  it('a server-published `default` is derived into the field and still not rendered', () => {
    // `json-schema-to-fields` turns JSON-Schema `default: 'POST'` into
    // `defaultValue: 'POST'` — the ONLINE half of the same property. The render
    // path is shared, so it is undelivered there too.
    stubs.configSchemas = {
      http_request: {
        type: 'object',
        properties: {
          method: { type: 'string', title: 'Method', enum: ['GET', 'POST'], default: 'POST' },
        },
      },
    };
    renderInspector(draftWith('http_request', { config: {} }));

    expect(
      triggerText('Method'),
      'the server-derived default is not seeded into the control either',
    ).toBe('');
    expect(screen.queryByText('POST'), 'the derived default reaches no rendered node').toBeNull();
  });
});

describe('the one read site: a declared default on a showWhen CONTROLLER changes visibility', () => {
  /**
   * `controllerAdmits` resolves an UNSET controller through its `defaultValue`.
   * The hand-written approval group declares `escalation.enabled: 'false'`, so
   * the offline table cannot demonstrate the effect (an absent default and a
   * 'false' default both hide the group). The engine-published schema can: the
   * spec's own `ApprovalEscalationSchema` defaults `enabled` to TRUE, and
   * `json-schema-to-fields` carries that onto the gate field.
   */
  const escalationSchema = {
    type: 'object',
    properties: {
      escalation: {
        type: 'object',
        title: 'SLA escalation',
        properties: {
          enabled: { type: 'boolean', default: true },
          notifySubmitter: { type: 'boolean', title: 'Notify submitter', default: true },
        },
      },
    },
  };

  it('a gate whose default is true reveals its siblings for a node that omits the key', () => {
    stubs.configSchemas = { approval: escalationSchema };
    renderInspector(draftWith('approval', { config: { escalation: { timeoutHours: 24 } } }));
    const sibling = checkbox('Notify submitter');
    expect(
      sibling,
      'the sibling is on screen because the gate default resolved to true',
    ).not.toBeNull();
    // objectui#8451 — and the ONLINE writer's own `default: true` seeds it, so
    // the repair is not a property of the hand-written table.
    expect(
      sibling!.checked,
      'the engine-published default reaches the control too',
    ).toBe(true);
  });

  it('and hides them when the gate is stored off — the lit control for the same predicate', () => {
    stubs.configSchemas = { approval: escalationSchema };
    renderInspector(draftWith('approval', { config: { escalation: { enabled: false } } }));
    expect(
      checkbox('Notify submitter'),
      'a stored false beats the declared default, so the predicate really is being evaluated',
    ).toBeNull();
  });

  it('the offline table hides the same siblings, because it declares the gate false', () => {
    // Recorded, not endorsed: the hand-written 'false' contradicts the spec's
    // `.default(true)`. That divergence is objectui#6620's subject, not this
    // card's; pinned here only so a change to either side is visible.
    renderInspector(draftWith('approval', { config: { escalation: { timeoutHours: 24 } } }));
    expect(
      checkbox('Notify submitter'),
      'offline, the same node hides the sibling the online schema reveals',
    ).toBeNull();
  });
});

describe('absent and stored-false are now DISTINGUISHABLE on a boolean control', () => {
  it('renders differently when the key is missing than when it is explicitly false', () => {
    renderInspector(draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24 } } }));
    const absentBox = checkbox('Notify submitter')!;
    const absentChecked = absentBox.checked;
    const absent = absentBox.outerHTML;
    cleanup();
    renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24, notifySubmitter: false } } }),
    );
    const storedFalseBox = checkbox('Notify submitter')!;
    const storedFalseChecked = storedFalseBox.checked;
    const storedFalse = storedFalseBox.outerHTML;

    // Named states, not just an inequality: "the two differ" is also satisfied
    // by a control that gets BOTH wrong, so each side is asserted on its own.
    expect(absentChecked, 'the omitted key draws the declared true').toBe(true);
    expect(storedFalseChecked, 'the deliberate false draws unchecked').toBe(false);
    expect(
      absent,
      'and the difference reaches the DOM — the author can tell them apart',
    ).not.toBe(storedFalse);
  });
});

describe('non-regression — a change that deletes the control must not pass this file', () => {
  /** The `notifySubmitter` value the last `onPatch` call carries, if any. */
  const committed = (onPatch: { mock: { calls: unknown[][] } }) =>
    (
      onPatch.mock.calls.at(-1)?.[0] as
        | { nodes: Array<{ config: { escalation?: Record<string, unknown> } }> }
        | undefined
    )?.nodes[0].config.escalation?.notifySubmitter;

  it('the boolean control exists, is a checkbox, and commits the author edit', () => {
    // Both directions, because the repair moved the seeded state: clicking a
    // control that shows the declared `true` must write the author's `false`,
    // and clicking one that shows a stored `false` must write `true`. A control
    // that committed the state it merely SHOWS would pass one and fail the other.
    const { onPatch } = renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24 } } }),
    );
    const box = checkbox('Notify submitter');
    expect(box, 'the control is rendered at all').not.toBeNull();
    expect(box!.type, 'and it is a real checkbox input').toBe('checkbox');
    box!.click();
    expect(
      committed(onPatch),
      'clicking a seeded-true box writes the explicit false — the control is live, not decorative',
    ).toBe(false);

    cleanup();
    const second = renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24, notifySubmitter: false } } }),
    );
    checkbox('Notify submitter')!.click();
    expect(
      committed(second.onPatch),
      'and clicking a stored-false box writes true',
    ).toBe(true);
  });

  it('the select control exists, offers its declared options, and commits', () => {
    renderInspector(draftWith('http_request', { config: {} }));
    const trigger = screen.queryByRole('combobox', { name: 'Method' });
    expect(trigger, 'the Method control is rendered at all').not.toBeNull();
    const method = fieldsForNodeType('http_request').find((f) => f.id === 'method');
    expect(
      method?.options?.map((o) => o.value),
      'and the five HTTP verbs are still the offered vocabulary',
    ).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  });

  it('a stored value the options dropped still renders, flagged deprecated', () => {
    renderInspector(draftWith('http_request', { config: { method: 'TRACE' } }));
    expect(
      triggerText('Method'),
      'a legacy stored verb is never silently blanked',
    ).toBe('TRACE (deprecated)');
  });
});

describe('the declaration surface this card names', () => {
  /**
   * The ten declaring fields, as `<node type>.<field id>`. Triage named this
   * list the acceptance surface, so it is pinned: a PR that retires the
   * property, or that adds an eleventh declaration, moves this line.
   *
   * Swept over the picker's node types plus the four that carry config but are
   * not offered in the picker (ADR-0031 import/export-only, and the legacy
   * aliases). The sweep is asserted to cover the picker so a new node type
   * cannot slip a declaration past it.
   */
  const OFF_PICKER_TYPES = ['boundary_event', 'parallel_gateway', 'join_gateway', 'legacy_action', 'notify'];

  it('exactly ten fields declare a defaultValue, and these are they', () => {
    const swept = [...FLOW_NODE_TYPE_OPTIONS, ...OFF_PICKER_TYPES];
    expect(
      FLOW_NODE_TYPE_OPTIONS.every((t) => swept.includes(t)),
      'the sweep covers every node type the picker offers',
    ).toBe(true);

    const declaring = new Set<string>();
    for (const type of swept) {
      for (const field of fieldsForNodeType(type)) {
        if (field.defaultValue !== undefined) declaring.add(`${type}.${field.id}`);
      }
    }
    expect([...declaring].sort()).toEqual([
      'approval.escalation.action',
      'approval.escalation.enabled',
      'approval.escalation.notifySubmitter',
      'approval.behavior',
      'approval.maxRevisions',
      'approval.onEmptyApprovers',
      'boundary_event.boundaryConfig.eventType',
      'http_request.method',
      'screen.mode',
      'wait.waitEventConfig.eventType',
    ].sort());
  });
});
