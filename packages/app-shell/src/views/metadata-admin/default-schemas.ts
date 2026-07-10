// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * default-schemas — minimal JSONSchemas used by SchemaForm when the
 * framework's `/meta/types` registry row doesn't carry a `schema` field
 * (i.e. for every type today — full Zod→JSONSchema generation in the
 * framework is a deferred milestone).
 *
 * These schemas cover the universal metadata header (name/label/
 * description/scope) plus the small set of per-type "obvious" fields
 * users expect on day one. Anything that doesn't fit here can still be
 * edited via the raw JSON escape hatch — the schema is intentionally
 * lax (no `additionalProperties: false`) so unknown payload keys round-
 * trip untouched.
 *
 * When the framework starts emitting JSONSchemas in the registry, this
 * file becomes a no-op (SchemaForm receives the real schema and ignores
 * `defaultSchema`).
 */

import { registerMetadataResource } from './registry';

/** Shared header fields every metadata item has. */
const headerProps = {
  name: {
    type: 'string',
    title: 'Name',
    description: 'Machine name. snake_case, used as the URL path and DB key.',
    pattern: '^[a-z_][a-z0-9_]*$',
  },
  label: {
    type: 'string',
    title: 'Label',
    description: 'Human-readable display name.',
  },
  description: {
    type: 'string',
    title: 'Description',
    format: 'multiline',
  },
} as const;

/** Per-type fallback schemas. */
const SCHEMAS: Record<string, Record<string, unknown>> = {
  role: {
    type: 'object',
    title: 'Role',
    required: ['name'],
    properties: {
      ...headerProps,
      level: {
        type: 'string',
        title: 'Level',
        description: 'Coarse seniority tier (used by UI / sort order).',
        enum: ['member', 'lead', 'manager', 'director', 'executive', 'admin'],
      },
      parentRole: {
        type: 'string',
        title: 'Parent Role',
        description: 'Optional parent role name for hierarchy.',
      },
    },
  },

  profile: {
    type: 'object',
    title: 'Profile',
    required: ['name'],
    properties: {
      ...headerProps,
      isProfile: { type: 'boolean', title: 'Is profile', description: 'Profiles are mutually exclusive (one per user).' },
      objects: {
        type: 'object',
        title: 'Object Permissions',
        description: 'Edit this via the Permission Matrix tab for a row-by-row UI.',
      },
    },
  },

  permission: {
    type: 'object',
    title: 'Permission',
    required: ['id', 'resource', 'actions', 'description'],
    properties: {
      id: {
        type: 'string',
        title: 'ID',
        description: 'Stable identifier (e.g. crm.account.read).',
      },
      resource: {
        type: 'string',
        title: 'Resource',
        description: 'What this permission applies to.',
        enum: [
          'data.object', 'data.record', 'data.field',
          'ui.view', 'ui.dashboard', 'ui.report',
          'system.config', 'system.plugin', 'system.api', 'system.service',
          'storage.file', 'storage.database',
          'network.http', 'network.websocket',
          'process.spawn', 'process.env',
        ],
      },
      actions: {
        type: 'array',
        title: 'Actions',
        description: 'Permitted operations on the resource.',
        items: {
          type: 'string',
          enum: [
            'create', 'read', 'update', 'delete',
            'execute', 'admin', 'manage', 'configure',
            'import', 'export', 'share',
          ],
        },
      },
      description: {
        type: 'string',
        title: 'Description',
        description: 'Why this permission exists (shown in admin UIs).',
      },
      scope: {
        type: 'string',
        title: 'Scope',
        enum: ['tenant', 'user', 'plugin', 'global', 'resource'],
        default: 'tenant',
      },
      required: {
        type: 'boolean',
        title: 'Required',
        description: 'Must be present for the holder to function.',
      },
      justification: {
        type: 'string',
        title: 'Justification',
      },
    },
  },

  translation: {
    type: 'object',
    title: 'Translation Bundle',
    required: ['name'],
    properties: {
      name: { ...headerProps.name, description: 'Bundle id (e.g. zh_CN, en_US, package-locale).' },
      label: headerProps.label,
      description: headerProps.description,
      locale: {
        type: 'string',
        title: 'Locale',
        description: 'BCP-47 tag, e.g. en, zh-Hans, ja-JP.',
      },
      strings: {
        type: 'object',
        title: 'Strings',
        description: 'Key → translated string map.',
      },
    },
  },

  tool: {
    type: 'object',
    title: 'AI Tool',
    required: ['name'],
    properties: {
      ...headerProps,
      kind: {
        type: 'string',
        title: 'Kind',
        enum: ['function', 'http', 'mcp'],
      },
      inputSchema: { type: 'object', title: 'Input Schema (JSON Schema)' },
      outputSchema: { type: 'object', title: 'Output Schema (JSON Schema)' },
    },
  },

  skill: {
    type: 'object',
    title: 'AI Skill',
    required: ['name'],
    properties: {
      ...headerProps,
      instructions: { type: 'string', title: 'Instructions', format: 'multiline' },
      tools: { type: 'array', title: 'Tools', items: { type: 'string' } },
    },
  },

  app: {
    type: 'object',
    title: 'Application',
    required: ['name'],
    properties: {
      ...headerProps,
      icon: { type: 'string', title: 'Icon' },
      navigation: { type: 'array', title: 'Navigation', items: { type: 'object' } },
    },
  },

  page: {
    type: 'object',
    title: 'Page',
    required: ['name'],
    properties: {
      ...headerProps,
      route: { type: 'string', title: 'Route', description: 'URL path under the app.' },
      layout: { type: 'string', title: 'Layout' },
    },
  },

  view: {
    type: 'object',
    title: 'View',
    required: ['name'],
    properties: {
      ...headerProps,
      type: {
        type: 'string',
        title: 'View Type',
        enum: ['grid', 'kanban', 'calendar', 'gantt', 'simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal'],
      },
    },
  },

  dashboard: {
    type: 'object',
    title: 'Dashboard',
    required: ['name'],
    properties: {
      ...headerProps,
      widgets: { type: 'array', title: 'Widgets', items: { type: 'object' } },
    },
  },

  report: {
    type: 'object',
    title: 'Report',
    required: ['name'],
    properties: {
      ...headerProps,
      object: { type: 'string', title: 'Object' },
      filters: { type: 'array', title: 'Filters', items: { type: 'object' } },
    },
  },

  book: {
    type: 'object',
    title: 'Documentation Book',
    required: ['name', 'groups'],
    properties: {
      ...headerProps,
      slug: {
        type: 'string',
        title: 'Slug',
        description: 'Portal URL segment; defaults to the name without its package prefix.',
      },
      icon: { type: 'string', title: 'Icon' },
      order: {
        type: 'number',
        title: 'Order',
        description: 'Orders books within the portal.',
      },
      audience: {
        title: 'Audience',
        description:
          "Access audience. 'org' (default) inherits the package grant; 'public' is anonymously readable; { permissionSet } gates by a permission set the reader must hold (ADR-0090).",
        // Union of the two scalar literals and the { permissionSet } object — kept lax
        // so the permission-set-gated object form round-trips untouched through the form.
        oneOf: [
          { type: 'string', enum: ['org', 'public'] },
          {
            type: 'object',
            title: 'Permission-set gated',
            properties: { permissionSet: { type: 'string', title: 'Permission set' } },
            required: ['permissionSet'],
          },
        ],
      },
      groups: {
        type: 'array',
        title: 'Groups (spine)',
        description: 'Ordered sections. Membership is derived from each group\'s include rule — edit the structure visually in the Preview tab.',
        items: {
          type: 'object',
          required: ['key', 'label'],
          properties: {
            key: { type: 'string', title: 'Key', pattern: '^[a-z][a-z0-9_]*$' },
            label: { type: 'string', title: 'Label' },
            order: { type: 'number', title: 'Order' },
            include: { title: 'Include rule', description: 'Glob over doc names (e.g. crm_guide_*) or { tag }.' },
            package: { type: 'string', title: 'Package scope' },
            pages: { type: 'array', title: 'Explicit pages (override)', items: {} },
          },
        },
      },
    },
  },

  email_template: {
    type: 'object',
    title: 'Email Template',
    required: ['name', 'label', 'subject', 'bodyHtml'],
    properties: {
      ...headerProps,
      category: {
        type: 'string',
        title: 'Category',
        enum: ['auth', 'notification', 'workflow', 'marketing', 'custom'],
        default: 'custom',
      },
      locale: { type: 'string', title: 'Locale', default: 'en-US', description: 'BCP-47 tag (en-US, zh-CN, …)' },
      subject: { type: 'string', title: 'Subject', description: 'Supports {{var.path}} interpolation' },
      bodyHtml: { type: 'string', title: 'HTML Body', format: 'multiline' },
      bodyText: { type: 'string', title: 'Plain-Text Body', format: 'multiline' },
      variables: { type: 'array', title: 'Variables', items: { type: 'object' } },
      fromOverride: { type: 'object', title: 'From Override' },
      replyTo: { type: 'string', title: 'Reply-To' },
      active: { type: 'boolean', title: 'Active', default: true },
      isSystem: { type: 'boolean', title: 'System Template', default: false },
    },
  },
};

/**
 * Register fallback schemas for every writable type. Idempotent — uses
 * `registerMetadataResource` so any prior registration (e.g. a bespoke
 * EditPage from PermissionMatrixEditor) is merged via the engine.
 */
export function registerDefaultMetadataSchemas(): void {
  for (const [type, schema] of Object.entries(SCHEMAS)) {
    registerMetadataResource({
      type,
      defaultSchema: schema,
      fieldOrder: ['name', 'label', 'description'],
    });
  }
}
