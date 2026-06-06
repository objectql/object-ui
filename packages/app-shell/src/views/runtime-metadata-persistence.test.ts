// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  persistRuntimeMetadata,
  publishRuntimeMetadata,
  isViaMeta,
} from './runtime-metadata-persistence';

/**
 * ADR-0034 seam tests.
 *
 * The flag is read live from `import.meta.env.VITE_RUNTIME_EDIT_VIA_META`
 * via `isViaMeta()`, so we toggle it with `vi.stubEnv`. Flag OFF is the
 * default and must reproduce the legacy `sys_*` writes; flag ON routes to
 * the metadata client's draft/publish.
 */

function makeAdapter() {
  return {
    update: vi.fn().mockResolvedValue(undefined),
    updateDashboard: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMetadataClient() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
  };
}

describe('runtime-metadata-persistence seam (ADR-0034)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('flag OFF (default — legacy sys_* path)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', '');
    });

    it('isViaMeta() is false', () => {
      expect(isViaMeta()).toBe(false);
    });

    it('report → adapter.update("sys_report", name, body)', async () => {
      const adapter = makeAdapter();
      const metadataClient = makeMetadataClient();
      const body = { title: 'Pipeline' };

      await persistRuntimeMetadata('report', 'my_report', body, {
        adapter,
        metadataClient,
      });

      expect(adapter.update).toHaveBeenCalledTimes(1);
      expect(adapter.update).toHaveBeenCalledWith('sys_report', 'my_report', body);
      expect(metadataClient.save).not.toHaveBeenCalled();
    });

    it('dashboard → adapter.updateDashboard(name, body) when available', async () => {
      const adapter = makeAdapter();
      const body = { widgets: [] };

      await persistRuntimeMetadata('dashboard', 'my_dash', body, { adapter });

      expect(adapter.updateDashboard).toHaveBeenCalledTimes(1);
      expect(adapter.updateDashboard).toHaveBeenCalledWith('my_dash', body);
      expect(adapter.update).not.toHaveBeenCalled();
    });

    it('dashboard → falls back to adapter.update("sys_dashboard", …) when no updateDashboard', async () => {
      const adapter = { update: vi.fn().mockResolvedValue(undefined) };
      const body = { widgets: [] };

      await persistRuntimeMetadata('dashboard', 'my_dash', body, { adapter });

      expect(adapter.update).toHaveBeenCalledTimes(1);
      expect(adapter.update).toHaveBeenCalledWith('sys_dashboard', 'my_dash', body);
    });

    it('view → dataSource.updateViewConfig(objectName, name, body)', async () => {
      const dataSource = { updateViewConfig: vi.fn().mockResolvedValue(undefined) };
      const body = { columns: ['name'] };

      await persistRuntimeMetadata('view', 'my_view', body, {
        dataSource,
        objectName: 'crm_lead',
      });

      expect(dataSource.updateViewConfig).toHaveBeenCalledWith('crm_lead', 'my_view', body);
    });

    it('publishRuntimeMetadata is a no-op (no draft concept in legacy model)', async () => {
      const metadataClient = makeMetadataClient();

      await publishRuntimeMetadata('report', 'my_report', { metadataClient });

      expect(metadataClient.publish).not.toHaveBeenCalled();
    });
  });

  describe('flag ON (/meta draft/publish path)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
    });

    it('isViaMeta() is true', () => {
      expect(isViaMeta()).toBe(true);
    });

    it('report → metadataClient.save("report", name, body, { mode: "draft" })', async () => {
      const adapter = makeAdapter();
      const metadataClient = makeMetadataClient();
      const body = { title: 'Pipeline' };

      await persistRuntimeMetadata('report', 'my_report', body, {
        adapter,
        metadataClient,
      });

      expect(metadataClient.save).toHaveBeenCalledTimes(1);
      expect(metadataClient.save).toHaveBeenCalledWith('report', 'my_report', body, {
        mode: 'draft',
      });
      // Legacy path must NOT run when the flag is on.
      expect(adapter.update).not.toHaveBeenCalled();
    });

    it('dashboard → metadataClient.save("dashboard", …, { mode: "draft" })', async () => {
      const metadataClient = makeMetadataClient();
      const body = { widgets: [] };

      await persistRuntimeMetadata('dashboard', 'my_dash', body, { metadataClient });

      expect(metadataClient.save).toHaveBeenCalledWith('dashboard', 'my_dash', body, {
        mode: 'draft',
      });
    });

    it('publishRuntimeMetadata → metadataClient.publish(type, name)', async () => {
      const metadataClient = makeMetadataClient();

      await publishRuntimeMetadata('report', 'my_report', { metadataClient });

      expect(metadataClient.publish).toHaveBeenCalledTimes(1);
      expect(metadataClient.publish).toHaveBeenCalledWith('report', 'my_report');
    });
  });
});
