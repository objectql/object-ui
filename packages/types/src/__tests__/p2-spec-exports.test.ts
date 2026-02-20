/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P2.3/P2.4 Spec Protocol Type Re-export Tests
 *
 * Verifies that P2.3 (Sharing & Embedding) and P2.4 (View Configuration)
 * Zod schemas from @objectstack/spec/ui are properly re-exported and functional.
 *
 * The types index re-exports these as `export type { ... }`, so we verify:
 *   1. Type-level re-exports compile correctly (import type from '../index')
 *   2. Runtime Zod schemas from @objectstack/spec/ui validate data correctly
 */
import { describe, it, expect } from 'vitest';
import type {
  SharingConfig,
  SharingConfigSchema,
  EmbedConfig,
  EmbedConfigSchema,
  AddRecordConfig,
  AddRecordConfigSchema,
  AppearanceConfig,
  AppearanceConfigSchema,
  UserActionsConfig,
  UserActionsConfigSchema,
  ViewTab,
  ViewTabSchema,
} from '../index';

// Runtime Zod schemas are imported directly from the spec package
import {
  SharingConfigSchema as SharingConfigZod,
  EmbedConfigSchema as EmbedConfigZod,
  AddRecordConfigSchema as AddRecordConfigZod,
  AppearanceConfigSchema as AppearanceConfigZod,
  UserActionsConfigSchema as UserActionsConfigZod,
  ViewTabSchema as ViewTabZod,
} from '@objectstack/spec/ui';

// ============================================================================
// P2.3 Sharing & Embedding
// ============================================================================
describe('P2.3 Spec Protocol Type Re-exports — Sharing & Embedding', () => {
  describe('SharingConfigSchema', () => {
    it('should be a valid Zod schema with parse method', () => {
      expect(SharingConfigZod).toBeDefined();
      expect(typeof SharingConfigZod.parse).toBe('function');
      expect(typeof SharingConfigZod.safeParse).toBe('function');
    });

    it('should validate a minimal SharingConfig', () => {
      const config: SharingConfig = { enabled: true };
      const result = SharingConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate a full SharingConfig', () => {
      const config: SharingConfig = {
        enabled: true,
        publicLink: 'https://example.com/shared/abc123',
        password: 'secret',
        allowedDomains: ['example.com'],
        expiresAt: '2025-12-31',
        allowAnonymous: false,
      };
      const result = SharingConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('EmbedConfigSchema', () => {
    it('should be a valid Zod schema with parse method', () => {
      expect(EmbedConfigZod).toBeDefined();
      expect(typeof EmbedConfigZod.parse).toBe('function');
      expect(typeof EmbedConfigZod.safeParse).toBe('function');
    });

    it('should validate a minimal EmbedConfig', () => {
      const config: EmbedConfig = { enabled: true };
      const result = EmbedConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate a full EmbedConfig', () => {
      const config: EmbedConfig = {
        enabled: true,
        allowedOrigins: ['https://example.com'],
        width: '100%',
        height: '600px',
        showHeader: false,
        showNavigation: false,
        responsive: true,
      };
      const result = EmbedConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// P2.4 View Configuration
// ============================================================================
describe('P2.4 Spec Protocol Type Re-exports — View Configuration', () => {
  describe('AddRecordConfigSchema', () => {
    it('should be a valid Zod schema with parse method', () => {
      expect(AddRecordConfigZod).toBeDefined();
      expect(typeof AddRecordConfigZod.parse).toBe('function');
      expect(typeof AddRecordConfigZod.safeParse).toBe('function');
    });

    it('should validate a minimal AddRecordConfig', () => {
      const config: AddRecordConfig = { enabled: true };
      const result = AddRecordConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate a full AddRecordConfig', () => {
      const config: AddRecordConfig = {
        enabled: true,
        position: 'top',
        mode: 'inline',
        formView: 'new-contact-form',
      };
      const result = AddRecordConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('AppearanceConfigSchema', () => {
    it('should be a valid Zod schema with parse method', () => {
      expect(AppearanceConfigZod).toBeDefined();
      expect(typeof AppearanceConfigZod.parse).toBe('function');
      expect(typeof AppearanceConfigZod.safeParse).toBe('function');
    });

    it('should validate a minimal AppearanceConfig', () => {
      const config: AppearanceConfig = {};
      const result = AppearanceConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate a full AppearanceConfig', () => {
      const config: AppearanceConfig = {
        showDescription: true,
        allowedVisualizations: ['grid', 'kanban', 'calendar'],
      };
      const result = AppearanceConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('UserActionsConfigSchema', () => {
    it('should be a valid Zod schema with parse method', () => {
      expect(UserActionsConfigZod).toBeDefined();
      expect(typeof UserActionsConfigZod.parse).toBe('function');
      expect(typeof UserActionsConfigZod.safeParse).toBe('function');
    });

    it('should validate a minimal UserActionsConfig', () => {
      const config: UserActionsConfig = {};
      const result = UserActionsConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate a full UserActionsConfig', () => {
      const config: UserActionsConfig = {
        sort: true,
        search: true,
        filter: true,
        rowHeight: true,
      };
      const result = UserActionsConfigZod.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('ViewTabSchema', () => {
    it('should be a valid Zod schema with parse method', () => {
      expect(ViewTabZod).toBeDefined();
      expect(typeof ViewTabZod.parse).toBe('function');
      expect(typeof ViewTabZod.safeParse).toBe('function');
    });

    it('should validate a minimal ViewTab', () => {
      const tab: ViewTab = { name: 'all', label: 'All Records' };
      const result = ViewTabZod.safeParse(tab);
      expect(result.success).toBe(true);
    });

    it('should validate a full ViewTab', () => {
      const tab: ViewTab = {
        name: 'active',
        label: 'Active',
        icon: 'CheckCircle',
        filter: [{ field: 'status', operator: 'eq', value: 'active' }],
        order: 1,
        pinned: true,
        isDefault: true,
        visible: true,
      };
      const result = ViewTabZod.safeParse(tab);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Type re-export verification (compile-time)
// ============================================================================
describe('Type re-exports from @object-ui/types index', () => {
  it('should re-export P2.3 types (compile-time verification)', async () => {
    // Dynamic import to verify exports exist on the module
    const types = await import('../index');

    // These are type-only re-exports, so they won't appear as runtime properties.
    // We verify the module itself is importable and other runtime exports are intact.
    expect(types).toBeDefined();
    expect(typeof types.defineStack).toBe('function');
  });

  it('should allow type annotations with P2.3 Sharing & Embedding types', () => {
    // Compile-time check: these lines would fail to compile if types were not re-exported
    const sharing: SharingConfig = { enabled: true };
    const embed: EmbedConfig = { enabled: false };
    expect(sharing.enabled).toBe(true);
    expect(embed.enabled).toBe(false);
  });

  it('should allow type annotations with P2.4 View Configuration types', () => {
    const addRecord: AddRecordConfig = { enabled: true };
    const appearance: AppearanceConfig = { showDescription: true };
    const userActions: UserActionsConfig = { sort: true };
    const tab: ViewTab = { name: 'main', label: 'Main' };
    expect(addRecord.enabled).toBe(true);
    expect(appearance.showDescription).toBe(true);
    expect(userActions.sort).toBe(true);
    expect(tab.name).toBe('main');
  });
});
