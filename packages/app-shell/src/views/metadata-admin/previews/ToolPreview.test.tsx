// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ToolPreview must not advertise retired `ToolSchema` flags (objectui#3236).
 *
 * `tool.requiresConfirmation` (objectstack#3715, ADR-0033 §2) and
 * `tool.category` / `tool.active` / `tool.builtIn` (objectstack#3896 audit
 * close-out) were removed from `@objectstack/spec`. `ToolSchema` is now
 * `.strict()` and rejects each by name, so no *new* tool metadata can carry
 * them — but stored rows authored before the removal still do, and the
 * preview kept reading them off the raw draft and painting pills.
 *
 * That is the objectui#2962 shape: a UI badge advertising a capability the
 * runtime never had. `Requires confirmation` promised a pause that no
 * execution path performs (the real gate is `action.ai.requiresConfirmation`
 * plus the HITL approval queue), and `Disabled` claimed a withdrawal while
 * `ToolRegistry.getAll()` kept handing the tool to the LLM and
 * `POST /ai/tools/:name/execute` kept running it.
 *
 * These tests feed the preview a STALE draft that still carries all four keys
 * and assert nothing renders from them. They are the pin that stops the pills
 * growing back: the names survive in the spec's tombstone guidance, so the
 * next reader has a plausible reason to "restore" them.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ToolPreview } from './ToolPreview';

afterEach(cleanup);

/** A draft as an author wrote it *before* the spec removals — every retired key present. */
const STALE_DRAFT = {
  name: 'delete_all_orders',
  label: 'Delete All Orders',
  description: 'Permanently removes every order matching the filter.',
  category: 'data',
  active: false,
  builtIn: true,
  requiresConfirmation: true,
  objectName: 'sales_order',
  parameters: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', description: 'Filter by status' },
    },
  },
} satisfies Record<string, unknown>;

function renderPreview(draft: Record<string, unknown>) {
  return render(
    <ToolPreview type="tool" name="delete_all_orders" draft={draft} />,
  );
}

describe('ToolPreview does not render retired ToolSchema flags', () => {
  it('renders no confirmation badge for a stale draft with requiresConfirmation: true', () => {
    renderPreview(STALE_DRAFT);
    // The badge claimed a safety pause that no execution path has ever
    // performed — never show it, whatever the stored row says.
    expect(screen.queryByText(/requires confirmation/i)).toBeNull();
    expect(screen.queryByText(/confirm/i)).toBeNull();
  });

  it('renders no Active/Disabled badge — `active` withdrew nothing', () => {
    renderPreview(STALE_DRAFT);
    expect(screen.queryByText(/^Disabled$/)).toBeNull();
    expect(screen.queryByText(/^Active$/)).toBeNull();
  });

  it('renders no built-in or category badge', () => {
    renderPreview(STALE_DRAFT);
    expect(screen.queryByText(/built-in/i)).toBeNull();
    expect(screen.queryByText(/^data$/)).toBeNull();
  });

  it('an `active: true` draft gets no badge either — the key is gone, not inverted', () => {
    renderPreview({ ...STALE_DRAFT, active: true, requiresConfirmation: false, builtIn: false });
    expect(screen.queryByText(/^Active$/)).toBeNull();
    expect(screen.queryByText(/requires confirmation/i)).toBeNull();
  });
});

describe('ToolPreview still renders everything the spec accepts', () => {
  it('keeps label, machine name, description and the live objectName pill', () => {
    renderPreview(STALE_DRAFT);
    expect(screen.getByText('Delete All Orders')).toBeTruthy();
    expect(screen.getByText('delete_all_orders')).toBeTruthy();
    expect(
      screen.getByText('Permanently removes every order matching the filter.'),
    ).toBeTruthy();
    // `objectName` is NOT residue — ToolSchema still accepts it.
    expect(screen.getByText('sales_order')).toBeTruthy();
  });

  it('still renders the parameters table and the example LLM call', () => {
    renderPreview(STALE_DRAFT);
    expect(screen.getByText('Input Parameters')).toBeTruthy();
    expect(screen.getByText('status')).toBeTruthy();
    expect(screen.getByText('Example LLM Call')).toBeTruthy();
  });

  it('drops the pill row entirely when objectName is absent', () => {
    const noObject: Record<string, unknown> = { ...STALE_DRAFT };
    delete noObject.objectName;
    renderPreview(noObject);
    expect(screen.queryByText('sales_order')).toBeNull();
    expect(screen.getByText('Delete All Orders')).toBeTruthy();
  });
});
