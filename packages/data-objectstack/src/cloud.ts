/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Cloud namespace integration for @objectstack/spec v3.0.0
 * Replaces the legacy Hub namespace for cloud deployment, hosting, and marketplace schemas.
 */

export interface CloudDeploymentConfig {
  /**
   * Deploy target requested by {@link CloudOperations.deploy}.
   *
   * **A deliberate third vocabulary — not drift** (objectui#3720). It is
   * neither of the two environment enums `@objectstack/spec` declares, and the
   * pin test next door (`cloud-environment-vocabulary.pin.test.ts`) keeps every
   * claim below executable rather than merely written down:
   *
   * | vocabulary | members | models |
   * |:--|:--|:--|
   * | `EnvironmentType` (`@objectstack/spec/cloud`) | `production` `sandbox` `development` `test` `staging` `preview` `trial` | the categorical tag of a provisioned `sys_environment` row |
   * | `DiscoveryEnvironment` (`@objectstack/spec/api`) | `production` `sandbox` `development` | the coarse posture a `/discovery` response advertises — "am I talking to production?" |
   * | this list | `development` `staging` `production` | the target a deploy REQUEST asks for |
   *
   * ## Why nothing is imported from either
   *
   * Neither models a deploy target. The producer that would own that vocabulary
   * is the cloud deploy API itself — and as of `@objectstack/client@17.0.0-rc.5`
   * that API does not exist: the client exports no `cloud` namespace at all, so
   * `deploy()` below optional-chains into `undefined` and returns its synthetic
   * pending result. There is no producer-side type to derive from, and no
   * accepted vocabulary to measure this list against.
   *
   * Restating it as a subset of `EnvironmentType` (an `Extract` of those three
   * members) was considered and rejected twice over. It would assert a subset
   * relationship no producer confirms; and `Extract` degrades SILENTLY — the day
   * spec drops or renames a member, this union quietly loses it with no error
   * anywhere, which is the drift this note exists to prevent.
   *
   * ## The `staging` trap
   *
   * `staging` is NOT a `DiscoveryEnvironment` member. Spec's own
   * `NODE_ENV_TO_DISCOVERY_ENVIRONMENT` (`src/api/discovery.zod.ts`) folds a raw
   * `staging` onto `sandbox`, because `sandbox` is that enum's pre-production
   * member. So a value of this field must never be copied onto a discovery
   * response — and no mapping between the two is invented here, because they
   * answer different questions.
   *
   * ## When to revisit
   *
   * When a real deploy API lands — a `cloud` surface on `@objectstack/client`,
   * or a deploy-target enum in spec — converge onto ITS type and delete this
   * note. That is also the moment objectui#3720 named as the breakpoint: if
   * deploy targets and discovery postures ever have to interconvert, the
   * conversion belongs at the producer, not in a consumer-side guess.
   */
  environment: 'development' | 'staging' | 'production';
  /** Cloud region */
  region?: string;
  /** Auto-scaling configuration */
  scaling?: {
    minInstances: number;
    maxInstances: number;
    targetCPU?: number;
  };
  /** Environment variables */
  envVars?: Record<string, string>;
}

export interface CloudHostingConfig {
  /** Custom domain */
  customDomain?: string;
  /** SSL configuration */
  ssl?: {
    enabled: boolean;
    autoRenew: boolean;
  };
  /** CDN configuration */
  cdn?: {
    enabled: boolean;
    regions?: string[];
  };
}

export interface CloudMarketplaceEntry {
  /** Plugin or app ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Version */
  version: string;
  /** Author */
  author: string;
  /** Category */
  category: string;
  /** Tags */
  tags: string[];
  /** Rating (1-5) */
  rating?: number;
  /** Install count */
  installCount?: number;
  /** Price (0 = free) */
  price?: number;
}

/**
 * Cloud operations helper for ObjectStack adapter.
 * Provides methods for cloud deployment, hosting, and marketplace operations.
 */
export class CloudOperations {
  constructor(private getClient: () => any) {}

  /**
   * Deploy an application to the cloud.
   */
  async deploy(appId: string, config: CloudDeploymentConfig): Promise<{ deploymentId: string; status: string }> {
    const client = this.getClient();
    const result = await client.cloud?.deploy?.(appId, config);
    return result ?? { deploymentId: `deploy-${Date.now()}`, status: 'pending' };
  }

  /**
   * Get deployment status.
   */
  async getDeploymentStatus(deploymentId: string): Promise<{ status: string; url?: string }> {
    const client = this.getClient();
    const result = await client.cloud?.getDeployment?.(deploymentId);
    return result ?? { status: 'unknown' };
  }

  /**
   * Search marketplace entries.
   */
  async searchMarketplace(query?: string, category?: string): Promise<CloudMarketplaceEntry[]> {
    const client = this.getClient();
    const result = await client.cloud?.marketplace?.search?.({ query, category });
    return result?.items ?? [];
  }

  /**
   * Install a marketplace plugin.
   */
  async installPlugin(pluginId: string): Promise<{ success: boolean }> {
    const client = this.getClient();
    const result = await client.cloud?.marketplace?.install?.(pluginId);
    return result ?? { success: false };
  }
}
