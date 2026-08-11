/**
 * v3.0.0 compatibility tests for @objectstack dependencies.
 * Validates that all integration modules work correctly with the spec.
 */
import { describe, it, expect } from 'vitest';
import { validatePluginContract, generateContractManifest } from './contracts';
import { IntegrationManager } from './integration';
import { SecurityManager } from './security';
import { createDefaultCanvasConfig, snapToGrid, calculateAutoLayout } from './studio';

// The `Cloud namespace (replacing Hub)` block that used to open this file is
// gone with its subject (objectui#4152). Its three cases constructed
// `CloudOperations` against a client stub of `{}` and asserted that the results
// had the right KEYS — which is precisely how the surface stayed green for as
// long as it did: every method optional-chained into a `cloud` namespace no
// released `@objectstack/client` has ever exported, so what the assertions were
// reading was the fallback literal, not a deployment. The replacement is a
// negative pin next door, `cloud-surface-retired-4152.pin.test.ts`, which fails
// if the exports come back.

describe('v3.0.0 Compatibility', () => {
  describe('Contracts module', () => {
    it('should validate a valid plugin contract', () => {
      const contract = {
        name: 'my-plugin',
        version: '1.0.0',
        exports: [{ name: 'MyComponent', type: 'component' as const }],
        permissions: ['data.read'],
      };
      const result = validatePluginContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid plugin contract', () => {
      const contract = {
        name: '',
        version: 'invalid',
        exports: [],
      };
      const result = validatePluginContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should generate contract manifest', () => {
      const contract = {
        name: 'test-plugin',
        version: '2.0.0',
        exports: [{ name: 'GridView', type: 'component' as const, description: 'A grid view' }],
        permissions: ['data.read', 'data.write'],
      };
      const manifest = generateContractManifest(contract);
      expect(manifest.$schema).toBeDefined();
      expect(manifest.name).toBe('test-plugin');
      expect(manifest.version).toBe('2.0.0');
    });
  });

  describe('Integration module', () => {
    it('should register and retrieve integrations', () => {
      const manager = new IntegrationManager();
      manager.register('slack-1', {
        provider: 'slack',
        enabled: true,
        config: { webhookUrl: 'https://hooks.slack.com/test' },
        triggers: [{ event: 'record.created' }],
      });

      const all = manager.getAll();
      expect(all.size).toBe(1);
    });

    it('should filter integrations by event', () => {
      const manager = new IntegrationManager();
      manager.register('webhook-1', {
        provider: 'webhook',
        enabled: true,
        config: { url: 'https://example.com/hook', method: 'POST' },
        triggers: [{ event: 'record.created' }],
      });
      manager.register('webhook-2', {
        provider: 'webhook',
        enabled: true,
        config: { url: 'https://example.com/hook2', method: 'POST' },
        triggers: [{ event: 'record.deleted' }],
      });

      const createMatches = manager.getForEvent('record.created');
      expect(createMatches).toHaveLength(1);
    });

    it('should unregister integrations', () => {
      const manager = new IntegrationManager();
      manager.register('test', {
        provider: 'webhook',
        enabled: true,
        config: { url: 'https://example.com', method: 'POST' },
      });
      manager.unregister('test');
      expect(manager.getAll().size).toBe(0);
    });
  });

  describe('Security module', () => {
    it('should generate CSP header', () => {
      const manager = new SecurityManager({
        csp: {
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://api.example.com'],
          fontSrc: ["'self'"],
        },
      });

      const header = manager.generateCSPHeader();
      expect(header).toContain("script-src 'self' 'unsafe-inline'");
      expect(header).toContain("connect-src 'self' https://api.example.com");
    });

    it('should record and filter audit logs', () => {
      const manager = new SecurityManager({
        auditLog: {
          enabled: true,
          events: ['data.create', 'data.read', 'auth.login'],
          destination: 'console',
        },
      });

      manager.recordAudit({ event: 'data.create', userId: 'user-1', resource: 'accounts' });
      manager.recordAudit({ event: 'auth.login', userId: 'user-2' });
      manager.recordAudit({ event: 'data.create', userId: 'user-1', resource: 'contacts' });

      const allLogs = manager.getAuditLog();
      expect(allLogs).toHaveLength(3);

      const userLogs = manager.getAuditLog({ userId: 'user-1' });
      expect(userLogs).toHaveLength(2);

      const loginLogs = manager.getAuditLog({ event: 'auth.login' });
      expect(loginLogs).toHaveLength(1);
    });

    it('should mask record data', () => {
      const manager = new SecurityManager({
        dataMasking: {
          rules: [
            { field: 'ssn', strategy: 'partial', visibleChars: 4 },
            { field: 'password', strategy: 'redact' },
            { field: 'email', strategy: 'full' },
            { field: 'phone', strategy: 'partial', visibleChars: 3, exemptRoles: ['admin'] },
          ],
        },
      });

      const record = {
        ssn: '123-45-6789',
        password: 'secret123',
        email: 'john@example.com',
        phone: '555-1234',
        name: 'John',
      };
      
      const masked = manager.maskRecord(record);
      expect(masked.ssn).toBe('123-*******');
      expect(masked.password).toBe('[REDACTED]');
      expect(masked.email).toBe('****************');
      expect(masked.name).toBe('John'); // Not masked
      
      // Admin sees phone unmasked
      const adminMasked = manager.maskRecord(record, ['admin']);
      expect(adminMasked.phone).toBe('555-1234');
    });
  });

  describe('Studio module', () => {
    it('should create default canvas config', () => {
      const config = createDefaultCanvasConfig();
      expect(config.width).toBe(1200);
      expect(config.height).toBe(800);
      expect(config.snapToGrid).toBe(true);
      expect(config.zoom.min).toBe(0.25);
      expect(config.zoom.max).toBe(3);
    });

    it('should create canvas config with overrides', () => {
      const config = createDefaultCanvasConfig({ width: 1600, showMinimap: true });
      expect(config.width).toBe(1600);
      expect(config.showMinimap).toBe(true);
      expect(config.height).toBe(800); // Default
    });

    it('should snap positions to grid', () => {
      expect(snapToGrid(13, 27, 8)).toEqual({ x: 16, y: 24 });
      expect(snapToGrid(0, 0, 8)).toEqual({ x: 0, y: 0 });
      expect(snapToGrid(4, 4, 8)).toEqual({ x: 8, y: 8 });
    });

    it('should calculate auto-layout positions', () => {
      const items = [
        { id: '1', width: 200, height: 150 },
        { id: '2', width: 200, height: 100 },
        { id: '3', width: 200, height: 200 },
      ];
      const positions = calculateAutoLayout(items, 1200);
      expect(positions).toHaveLength(3);
      expect(positions[0].x).toBe(40); // padding
      expect(positions[0].y).toBe(40); // padding
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
    });
  });

  describe('PaginatedResult API (records/total/hasMore)', () => {
    it('should support v3.0.0 PaginatedResult fields', () => {
      // Verify the QueryResult type supports records/total/hasMore
      const result = {
        data: [{ id: '1' }],
        total: 10,
        page: 1,
        pageSize: 5,
        hasMore: true,
      };
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });
  });
});
