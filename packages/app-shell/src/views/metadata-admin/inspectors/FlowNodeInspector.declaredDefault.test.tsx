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
 * The measurement, in four parts:
 *
 *  1. A declared default does NOT seed the control's value. An unset key draws
 *     an unchecked box / a blank select, whatever the table declares. The
 *     select is blank rather than showing a placeholder, because the field
 *     always passes a controlled value and Radix renders its placeholder only
 *     for an undefined one.
 *  2. That holds on BOTH writers of the property — the hand-written table here
 *     and the engine-published `configSchema` that `json-schema-to-fields`
 *     converts (`default: true` -> `defaultValue: 'true'`). Same dead end.
 *  3. It is NOT inert, though: a declared default on a `showWhen` CONTROLLER
 *     changes which fields are on screen at all (`controllerAdmits`). That is
 *     the one read site, and it is a visibility effect, not a value effect.
 *  4. A boolean control cannot distinguish "key absent" from "key stored as
 *     `false`" — the mechanism that turns a missing display into a false
 *     assertion.
 *
 * The last describe is the non-regression half (objectui#8350's lesson): every
 * negative above is also satisfied by an inspector that renders NOTHING, so the
 * controls' existence and their stored-value behaviour are pinned beside them.
 * A change that deletes the boolean branch fails here even though it would
 * satisfy "the control shows no default".
 *
 * ⛔ These cases pin what the tree DOES today. They are not a ruling that it is
 * right — the direction (show the effective default vs. retire the property) is
 * a product call recorded on the card.
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

describe('a declared defaultValue does not reach the rendered control', () => {
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

  it('boolean: an unset key draws an UNCHECKED box, though the table declares true', () => {
    const notify = fieldsForNodeType('approval').find((f) => f.id === 'escalation.notifySubmitter');
    expect(notify?.defaultValue, 'escalation.notifySubmitter declares a default').toBe('true');

    // `enabled: true` is set only so the gated field is on screen at all; the
    // key under measurement (`notifySubmitter`) is the one left unset.
    renderInspector(draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24 } } }));

    const box = checkbox('Notify submitter');
    expect(box, 'the Notify submitter control is rendered').not.toBeNull();
    expect(
      box!.checked,
      'the box reads UNCHECKED while the runtime treats the omitted key as true',
    ).toBe(false);
  });

  it('boolean: the same box IS checked when the key is stored true — the lit control', () => {
    renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24, notifySubmitter: true } } }),
    );
    expect(checkbox('Notify submitter')!.checked, 'a stored true renders checked').toBe(true);
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
    expect(
      checkbox('Notify submitter'),
      'the sibling is on screen because the gate default resolved to true',
    ).not.toBeNull();
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

describe('absent and stored-false are indistinguishable on a boolean control', () => {
  it('renders identically whether the key is missing or explicitly false', () => {
    renderInspector(draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24 } } }));
    const absent = checkbox('Notify submitter')!.outerHTML;
    cleanup();
    renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24, notifySubmitter: false } } }),
    );
    const storedFalse = checkbox('Notify submitter')!.outerHTML;
    expect(
      absent,
      'an omitted key and a deliberate false draw the same control — the author cannot tell them apart',
    ).toBe(storedFalse);
  });
});

describe('non-regression — a change that deletes the control must not pass this file', () => {
  it('the boolean control exists, is a checkbox, and commits the author edit', () => {
    const { onPatch } = renderInspector(
      draftWith('approval', { config: { escalation: { enabled: true, timeoutHours: 24 } } }),
    );
    const box = checkbox('Notify submitter');
    expect(box, 'the control is rendered at all').not.toBeNull();
    expect(box!.type, 'and it is a real checkbox input').toBe('checkbox');
    box!.click();
    const patched = onPatch.mock.calls.at(-1)?.[0] as { nodes: Array<{ config: Record<string, any> }> };
    expect(
      patched?.nodes[0].config.escalation.notifySubmitter,
      'ticking the box writes the key — the control is live, not decorative',
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
