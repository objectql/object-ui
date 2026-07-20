/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Integration module for @objectstack/spec v3.0.0
 * Provides third-party service connectors for Slack, email, webhooks.
 */

export type IntegrationProvider = 'slack' | 'email' | 'webhook' | 'teams' | 'discord';

export interface IntegrationConfig {
  /** Integration provider type */
  provider: IntegrationProvider;
  /** Whether this integration is enabled */
  enabled: boolean;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
  /** Event triggers */
  triggers?: IntegrationTrigger[];
}

export interface IntegrationTrigger {
  /** Event name (e.g. 'record.created', 'record.updated') */
  event: string;
  /** Filter condition */
  filter?: string;
  /** Template for the message/payload */
  template?: string;
}

export interface SlackIntegrationConfig extends IntegrationConfig {
  provider: 'slack';
  config: {
    webhookUrl: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
  };
}

export interface EmailIntegrationConfig extends IntegrationConfig {
  provider: 'email';
  config: {
    smtpHost: string;
    smtpPort: number;
    secure: boolean;
    from: string;
    to: string[];
    subject?: string;
  };
}

export interface WebhookIntegrationConfig extends IntegrationConfig {
  provider: 'webhook';
  config: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    retryCount?: number;
    retryDelay?: number;
  };
}

/**
 * Integration service manager.
 * Manages third-party service connections and event dispatching.
 */
export class IntegrationManager {
  private integrations: Map<string, IntegrationConfig> = new Map();

  /**
   * Register a new integration.
   */
  register(id: string, config: IntegrationConfig): void {
    this.integrations.set(id, config);
  }

  /**
   * Remove an integration.
   */
  unregister(id: string): void {
    this.integrations.delete(id);
  }

  /**
   * Get all registered integrations.
   */
  getAll(): Map<string, IntegrationConfig> {
    return new Map(this.integrations);
  }

  /**
   * Get integrations that match a specific event.
   */
  getForEvent(event: string): IntegrationConfig[] {
    return Array.from(this.integrations.values()).filter(
      (integration) =>
        integration.enabled &&
        integration.triggers?.some((t) => t.event === event)
    );
  }

  /**
   * Dispatch an event to all matching integrations.
   * Returns results for each integration.
   */
  async dispatch(event: string, payload: Record<string, unknown>): Promise<Array<{ id: string; success: boolean; error?: string }>> {
    const matching = this.getForEvent(event);
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const [id, integration] of this.integrations) {
      if (!matching.includes(integration)) continue;
      
      try {
        await this.send(integration, payload);
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: (err as Error).message });
      }
    }

    return results;
  }

  /**
   * Send payload to a specific integration.
   */
  private async send(integration: IntegrationConfig, payload: Record<string, unknown>): Promise<void> {
    switch (integration.provider) {
      case 'webhook': {
        const cfg = integration.config as WebhookIntegrationConfig['config'];
        const url = cfg.url;
        // Validate URL - only allow http and https protocols
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error(`Invalid URL protocol: ${parsed.protocol}`);
          }
        } catch (e) {
          if (e instanceof TypeError) {
            // A malformed URL surfaces as its own message; we can't attach `e`
            // as the `Error` `cause` because this package targets ES2020, whose
            // lib types the 1-arg `Error` constructor only. Scoped disable.
            // eslint-disable-next-line preserve-caught-error
            throw new Error(`Invalid webhook URL: ${url}`);
          }
          throw e;
        }
        await fetch(url, {
          method: cfg.method,
          headers: {
            'Content-Type': 'application/json',
            ...cfg.headers,
          },
          body: JSON.stringify(payload),
        });
        break;
      }
      case 'slack': {
        const cfg = integration.config as SlackIntegrationConfig['config'];
        const url = cfg.webhookUrl;
        // Validate URL - only allow https protocol for Slack webhooks
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'https:') {
            throw new Error(`Invalid Slack webhook URL protocol: ${parsed.protocol}`);
          }
        } catch (e) {
          if (e instanceof TypeError) {
            // A malformed URL surfaces as its own message; we can't attach `e`
            // as the `Error` `cause` because this package targets ES2020, whose
            // lib types the 1-arg `Error` constructor only. Scoped disable.
            // eslint-disable-next-line preserve-caught-error
            throw new Error(`Invalid Slack webhook URL: ${url}`);
          }
          throw e;
        }
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: cfg.channel,
            username: cfg.username,
            icon_emoji: cfg.iconEmoji,
            text: JSON.stringify(payload),
          }),
        });
        break;
      }
      // Email and other providers would require server-side implementation
      default:
        break;
    }
  }
}
