// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AgentPreview must not render retired `AgentSchema` keys (objectui#3275).
 *
 * `agent.tools` (objectstack#3894) and `agent.knowledge` (objectstack#3896)
 * are `retiredKey()` tombstones in `@objectstack/spec` 17 — `AgentSchema`
 * rejects each BY NAME, so no draft carrying them can be saved. The preview
 * nevertheless read both off the raw draft and painted a TOOLS chip strip and
 * a `KNOWLEDGE (RAG)` block.
 *
 * That inverted the preview's whole purpose. The two shapes an author can
 * write are (a) spec-valid, which rendered NOTHING in those blocks, and
 * (b) retired, which rendered a full, healthy-looking summary right up until
 * publish refused it. The designer was rewarding the unsaveable draft — the
 * tolerant-consumer failure AGENTS.md #0.1 names, and the reason objectui#3266
 * saw the gallery render LESS after its samples were corrected.
 *
 * These tests pin both directions: a VALID draft renders its capabilities, and
 * a STALE draft renders nothing from the retired keys. The second half matters
 * because the names survive in the spec's tombstone guidance, so a future
 * reader has a plausible-looking reason to "restore" them.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AgentPreview } from './AgentPreview';

afterEach(cleanup);

/** Parses clean against `ObjectStackSchema` — mirrors the gallery's sample. */
const VALID_DRAFT = {
  name: 'sales_copilot',
  label: 'Sales Copilot',
  role: 'Assistant for sales reps',
  active: true,
  model: { provider: 'openai', model: 'gpt-4o', temperature: 0.4, maxTokens: 2048 },
  instructions: 'You are a helpful sales assistant.',
  skills: ['summarize_account', 'draft_email'],
} satisfies Record<string, unknown>;

/** A draft as an author wrote it *before* the removals — both retired keys present. */
const STALE_DRAFT = {
  ...VALID_DRAFT,
  tools: [
    { type: 'objectql', name: 'query_orders' },
    { type: 'http', name: 'lookup_company' },
  ],
  knowledge: { sources: [{ id: 'sales_playbook', type: 'vector' }] },
} satisfies Record<string, unknown>;

function renderPreview(draft: Record<string, unknown>) {
  return render(
    <AgentPreview type="agent" name="sales_copilot" draft={draft} />,
  );
}

describe('AgentPreview renders what a spec-valid agent declares', () => {
  it('renders the skills chips — the whole of an agent capability surface', () => {
    renderPreview(VALID_DRAFT);
    expect(screen.getByText('Capabilities')).toBeTruthy();
    expect(screen.getByText('Skills')).toBeTruthy();
    expect(screen.getByText('summarize_account')).toBeTruthy();
    expect(screen.getByText('draft_email')).toBeTruthy();
  });

  it('keeps persona, model pills and instructions', () => {
    renderPreview(VALID_DRAFT);
    expect(screen.getByText('Sales Copilot')).toBeTruthy();
    expect(screen.getByText('sales_copilot')).toBeTruthy();
    expect(screen.getByText('Assistant for sales reps')).toBeTruthy();
    expect(screen.getByText('openai · gpt-4o')).toBeTruthy();
    expect(screen.getByText('You are a helpful sales assistant.')).toBeTruthy();
  });

  it('says where tools come from, so the missing TOOLS block is not read as a gap', () => {
    renderPreview(VALID_DRAFT);
    expect(screen.getByText(/tools come from the attached skills/i)).toBeTruthy();
  });

  it('an agent with no skills gets an explicit empty state, not a blank', () => {
    renderPreview({ ...VALID_DRAFT, skills: [] });
    expect(screen.getByText(/no skills attached/i)).toBeTruthy();
  });
});

describe('AgentPreview renders nothing from retired AgentSchema keys', () => {
  it('paints no TOOLS block for a stale draft carrying `tools`', () => {
    renderPreview(STALE_DRAFT);
    // The chip-list heading is gone with the read...
    expect(screen.queryByText('Tools')).toBeNull();
    // ...and so is every tool name it used to advertise.
    expect(screen.queryByText('query_orders')).toBeNull();
    expect(screen.queryByText('lookup_company')).toBeNull();
  });

  it('paints no KNOWLEDGE (RAG) block for a stale draft carrying `knowledge`', () => {
    renderPreview(STALE_DRAFT);
    expect(screen.queryByText(/knowledge/i)).toBeNull();
    expect(screen.queryByText('sales_playbook')).toBeNull();
  });

  it('renders the stale draft exactly as if the retired keys were absent', () => {
    const { container: stale } = renderPreview(STALE_DRAFT);
    const staleHtml = stale.innerHTML;
    cleanup();
    const { container: valid } = renderPreview(VALID_DRAFT);
    // The strongest form of "the key is not read": the two drafts differ only
    // by `tools`/`knowledge`, so identical output proves neither reaches the DOM.
    expect(staleHtml).toBe(valid.innerHTML);
  });
});
