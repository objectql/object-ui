import { describe, it, expect } from 'vitest';
import type { SharingConfig, EmbedConfig } from '@object-ui/types';
import {
  resolveSharingConfig,
  resolveEmbedConfig,
  generateEmbedCode,
  validateSharingConfig,
} from '../../protocols/SharingProtocol';

describe('SharingProtocol', () => {
  // ==========================================================================
  // resolveSharingConfig
  // ==========================================================================
  describe('resolveSharingConfig', () => {
    it('should apply defaults for empty config', () => {
      const resolved = resolveSharingConfig({});

      expect(resolved.enabled).toBe(false);
      expect(resolved.allowedDomains).toEqual([]);
      expect(resolved.allowAnonymous).toBe(false);
      expect(resolved.publicLink).toBeUndefined();
      expect(resolved.password).toBeUndefined();
      expect(resolved.expiresAt).toBeUndefined();
    });

    it('should preserve explicit values', () => {
      const config: Partial<SharingConfig> = {
        enabled: true,
        publicLink: 'https://example.com/share/abc',
        password: 'secret',
        allowedDomains: ['example.com'],
        expiresAt: '2025-12-31T00:00:00Z',
        allowAnonymous: true,
      };
      const resolved = resolveSharingConfig(config);

      expect(resolved.enabled).toBe(true);
      expect(resolved.publicLink).toBe('https://example.com/share/abc');
      expect(resolved.password).toBe('secret');
      expect(resolved.allowedDomains).toEqual(['example.com']);
      expect(resolved.expiresAt).toBe('2025-12-31T00:00:00Z');
      expect(resolved.allowAnonymous).toBe(true);
    });
  });

  // ==========================================================================
  // resolveEmbedConfig
  // ==========================================================================
  describe('resolveEmbedConfig', () => {
    it('should apply defaults for empty config', () => {
      const resolved = resolveEmbedConfig({});

      expect(resolved.enabled).toBe(false);
      expect(resolved.allowedOrigins).toEqual([]);
      expect(resolved.width).toBe('100%');
      expect(resolved.height).toBe('600px');
      expect(resolved.showHeader).toBe(true);
      expect(resolved.showNavigation).toBe(false);
      expect(resolved.responsive).toBe(true);
    });

    it('should preserve explicit values', () => {
      const config: Partial<EmbedConfig> = {
        enabled: true,
        width: '800px',
        height: '400px',
        showHeader: false,
        responsive: false,
      };
      const resolved = resolveEmbedConfig(config);

      expect(resolved.enabled).toBe(true);
      expect(resolved.width).toBe('800px');
      expect(resolved.height).toBe('400px');
      expect(resolved.showHeader).toBe(false);
      expect(resolved.responsive).toBe(false);
    });
  });

  // ==========================================================================
  // generateEmbedCode
  // ==========================================================================
  describe('generateEmbedCode', () => {
    it('should return valid iframe HTML', () => {
      const config = {} as EmbedConfig;
      const html = generateEmbedCode(config, 'https://app.example.com/view/123');

      expect(html).toContain('<iframe');
      expect(html).toContain('</iframe>');
      expect(html).toContain('src="https://app.example.com/view/123"');
      expect(html).toContain('width="100%"');
      expect(html).toContain('height="600px"');
      expect(html).toContain('allowfullscreen');
    });

    it('should include responsive style when responsive is true', () => {
      const config = { responsive: true } as EmbedConfig;
      const html = generateEmbedCode(config, 'https://example.com');

      expect(html).toContain('max-width: 100%');
    });

    it('should not include max-width when responsive is false', () => {
      const config = { responsive: false } as EmbedConfig;
      const html = generateEmbedCode(config, 'https://example.com');

      expect(html).not.toContain('max-width');
    });

    it('should HTML-escape URLs to prevent XSS', () => {
      const config = {} as EmbedConfig;
      const maliciousUrl = 'https://example.com/"><script>alert("xss")</script>';
      const html = generateEmbedCode(config, maliciousUrl);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;');
    });
  });

  // ==========================================================================
  // validateSharingConfig
  // ==========================================================================
  describe('validateSharingConfig', () => {
    it('should return valid for a well-formed config', () => {
      const config = {
        enabled: true,
        publicLink: 'https://example.com/share/abc',
        allowedDomains: ['example.com'],
      } as SharingConfig;
      const result = validateSharingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error when enabled without publicLink', () => {
      const config = { enabled: true } as SharingConfig;
      const result = validateSharingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A public link is required when sharing is enabled.');
    });

    it('should error for invalid expiresAt date', () => {
      const config = {
        enabled: false,
        expiresAt: 'not-a-date',
      } as SharingConfig;
      const result = validateSharingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('expiresAt must be a valid ISO 8601 date string.');
    });

    it('should error for empty password string', () => {
      const config = {
        enabled: false,
        password: '',
      } as SharingConfig;
      const result = validateSharingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not be an empty string when provided.');
    });

    it('should error for empty domain entries', () => {
      const config = {
        enabled: false,
        allowedDomains: ['example.com', '  '],
      } as SharingConfig;
      const result = validateSharingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'allowedDomains contains an empty or whitespace-only entry.'
      );
    });

    it('should return valid for disabled config with no issues', () => {
      const config = { enabled: false } as SharingConfig;
      const result = validateSharingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
