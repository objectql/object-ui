// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasourcePreview vs `DatasourceSchema` (objectui#3275).
 *
 * `DatasourceSchema` is `.strict()`. Three reads in this preview were for keys
 * it rejects outright, and each one made an unsaveable draft look correct:
 *
 *  • `capabilities` — a `DatasourceCapabilities` OBJECT of boolean flags. The
 *    preview tested `Array.isArray(d.capabilities)`, which is exactly
 *    backwards: it lit the CAPABILITIES block up only for the pre-17 token
 *    array the schema refuses, and left it dark for the object form the schema
 *    requires. objectui#3266 watched the block vanish the moment the sample was
 *    corrected.
 *  • `driver ?? d.type` — `type` is rejected with an explicit `type` → `driver`
 *    alias hint, so the fallback taught the wrong spelling.
 *  • `isDefault` / `default` — not datasource keys at all; routing is declared
 *    at stack level via `datasourceMapping`.
 *
 * A preview that renders a rejected key is not being helpful; it is making the
 * author's mistake invisible until publish (AGENTS.md #0.1).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// The federation panel makes REST calls against a saved datasource; this test
// is about which keys the preview reads, so stub it out.
vi.mock('../external/ExternalDatasourcePanel', () => ({
  ExternalDatasourcePanel: () => <div data-testid="mock-external-panel" />,
}));

import { DatasourcePreview } from './DatasourcePreview';

afterEach(cleanup);

/** Parses clean against `ObjectStackSchema` — mirrors the gallery's sample. */
const VALID_DRAFT = {
  name: 'warehouse',
  label: 'Analytics Warehouse',
  description: 'Read-only Postgres replica for reporting.',
  driver: 'postgres',
  active: true,
  ssl: { enabled: true, rejectUnauthorized: true },
  config: { host: 'db.internal', port: 5432, database: 'analytics' },
  pool: { min: 2, max: 10 },
  capabilities: { readOnly: true, queryAggregations: true },
  healthCheck: { enabled: true, intervalMs: 60000 },
} satisfies Record<string, unknown>;

/** Pre-17 shape: array capabilities, `type` instead of `driver`, `isDefault`. */
const STALE_DRAFT = {
  name: 'warehouse',
  label: 'Analytics Warehouse',
  type: 'postgres',
  isDefault: true,
  config: { host: 'db.internal' },
  capabilities: ['read', 'aggregate'],
} satisfies Record<string, unknown>;

function renderPreview(draft: Record<string, unknown>) {
  return render(
    <DatasourcePreview {...({ type: 'datasource', name: 'warehouse' } as never)} draft={draft} />,
  );
}

describe('DatasourcePreview renders object-shaped capabilities', () => {
  it('renders a chip for each capability the author set to true', () => {
    renderPreview(VALID_DRAFT);
    expect(screen.getByText('Capabilities')).toBeTruthy();
    expect(screen.getByText('readOnly')).toBeTruthy();
    expect(screen.getByText('queryAggregations')).toBeTruthy();
  });

  it('omits flags left false — a default is not an assertion worth a chip', () => {
    renderPreview({
      ...VALID_DRAFT,
      capabilities: { readOnly: true, joins: false, transactions: false },
    });
    expect(screen.getByText('readOnly')).toBeTruthy();
    expect(screen.queryByText('joins')).toBeNull();
    expect(screen.queryByText('transactions')).toBeNull();
  });

  it('renders no capabilities block when every flag is false', () => {
    renderPreview({ ...VALID_DRAFT, capabilities: { readOnly: false } });
    expect(screen.queryByText('Capabilities')).toBeNull();
  });
});

describe('DatasourcePreview renders nothing from keys the spec rejects', () => {
  it('renders no capabilities block for the array form', () => {
    renderPreview(STALE_DRAFT);
    expect(screen.queryByText('Capabilities')).toBeNull();
    expect(screen.queryByText('read')).toBeNull();
    expect(screen.queryByText('aggregate')).toBeNull();
  });

  it('does not fall back to `type` for the driver pill', () => {
    renderPreview(STALE_DRAFT);
    // `postgres` was never written to `driver`, so the preview must not claim
    // one — the alias hint belongs at save time, not as a silent rescue here.
    expect(screen.queryByText('postgres')).toBeNull();
    expect(screen.getByText('unknown')).toBeTruthy();
  });

  it('paints no `default` pill for `isDefault` / `default`', () => {
    renderPreview(STALE_DRAFT);
    expect(screen.queryByText('default')).toBeNull();
    cleanup();
    renderPreview({ ...STALE_DRAFT, isDefault: undefined, default: true });
    expect(screen.queryByText('default')).toBeNull();
  });
});

describe('DatasourcePreview still renders everything the spec accepts', () => {
  it('keeps label, name, driver, description and the redacted connection table', () => {
    renderPreview(VALID_DRAFT);
    expect(screen.getByText('Analytics Warehouse')).toBeTruthy();
    expect(screen.getByText('warehouse')).toBeTruthy();
    expect(screen.getByText('postgres')).toBeTruthy();
    expect(screen.getByText('Read-only Postgres replica for reporting.')).toBeTruthy();
    expect(screen.getByText('db.internal')).toBeTruthy();
  });

  it('keeps the pool / ssl / health-check rail blocks', () => {
    renderPreview(VALID_DRAFT);
    expect(screen.getByText('Pool')).toBeTruthy();
    expect(screen.getByText('SSL')).toBeTruthy();
    expect(screen.getByText('Health Check')).toBeTruthy();
  });
});
