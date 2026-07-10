/**
 * System object definitions for Console administration.
 *
 * These schemas define the system objects (sys_user, sys_org, sys_role,
 * sys_permission, sys_audit_log) used for user management, organization
 * management, role-based access control, and audit logging.
 */

export const systemObjects = [
  {
    name: 'sys_user',
    label: 'Users',
    icon: 'Users',
    fields: [
      { name: 'id', type: 'text', label: 'ID', readonly: true },
      { name: 'name', type: 'text', label: 'Name', required: true },
      { name: 'email', type: 'email', label: 'Email', required: true },
      { name: 'role', type: 'select', label: 'Role', options: ['admin', 'member', 'viewer'] },
      { name: 'status', type: 'select', label: 'Status', options: ['active', 'inactive', 'suspended'] },
      { name: 'emailVerified', type: 'boolean', label: 'Email Verified' },
      { name: 'image', type: 'url', label: 'Avatar URL' },
      { name: 'lastLoginAt', type: 'datetime', label: 'Last Login', readonly: true },
      { name: 'createdAt', type: 'datetime', label: 'Created At', readonly: true },
      { name: 'updatedAt', type: 'datetime', label: 'Updated At', readonly: true },
    ],
    titleFormat: '{name}',
    views: [
      {
        name: 'all',
        label: 'All Users',
        type: 'grid',
        columns: ['name', 'email', 'role', 'status', 'lastLoginAt'],
      },
    ],
  },
  {
    name: 'sys_org',
    label: 'Organizations',
    icon: 'Building2',
    fields: [
      { name: 'id', type: 'text', label: 'ID', readonly: true },
      { name: 'name', type: 'text', label: 'Organization Name', required: true },
      { name: 'slug', type: 'text', label: 'Slug', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'plan', type: 'select', label: 'Plan', options: ['free', 'pro', 'enterprise'] },
      { name: 'status', type: 'select', label: 'Status', options: ['active', 'inactive', 'suspended'] },
      { name: 'memberCount', type: 'number', label: 'Members', readonly: true },
      { name: 'createdAt', type: 'datetime', label: 'Created At', readonly: true },
    ],
    titleFormat: '{name}',
    views: [
      {
        name: 'all',
        label: 'All Organizations',
        type: 'grid',
        columns: ['name', 'slug', 'plan', 'status', 'memberCount'],
      },
    ],
  },
  {
    name: 'sys_position',
    label: 'Positions',
    icon: 'Shield',
    fields: [
      { name: 'id', type: 'text', label: 'ID', readonly: true },
      { name: 'name', type: 'text', label: 'Position Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'permissions', type: 'text', label: 'Permissions' },
      { name: 'isSystem', type: 'boolean', label: 'System Position', readonly: true },
      { name: 'userCount', type: 'number', label: 'Users', readonly: true },
      { name: 'createdAt', type: 'datetime', label: 'Created At', readonly: true },
    ],
    titleFormat: '{name}',
    views: [
      {
        name: 'all',
        label: 'All Positions',
        type: 'grid',
        columns: ['name', 'description', 'isSystem', 'userCount'],
      },
    ],
  },
  {
    name: 'sys_permission',
    label: 'Permissions',
    icon: 'Key',
    fields: [
      { name: 'id', type: 'text', label: 'ID', readonly: true },
      { name: 'name', type: 'text', label: 'Permission Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'resource', type: 'text', label: 'Resource' },
      { name: 'action', type: 'select', label: 'Action', options: ['create', 'read', 'update', 'delete', 'manage'] },
      { name: 'createdAt', type: 'datetime', label: 'Created At', readonly: true },
    ],
    titleFormat: '{name}',
    views: [
      {
        name: 'all',
        label: 'All Permissions',
        type: 'grid',
        columns: ['name', 'resource', 'action', 'description'],
      },
    ],
  },
  {
    name: 'sys_audit_log',
    label: 'Audit Log',
    icon: 'ScrollText',
    // Field names mirror the framework schema at
    // framework/packages/platform-objects/src/audit/sys-audit-log.object.ts
    // so console renderers receive populated values from the REST API.
    fields: [
      { name: 'id', type: 'text', label: 'ID', readonly: true },
      { name: 'created_at', type: 'datetime', label: 'Timestamp', readonly: true },
      { name: 'action', type: 'text', label: 'Action', readonly: true },
      { name: 'user_id', type: 'text', label: 'Actor', readonly: true },
      { name: 'object_name', type: 'text', label: 'Object', readonly: true },
      { name: 'record_id', type: 'text', label: 'Record ID', readonly: true },
      { name: 'old_value', type: 'textarea', label: 'Before', readonly: true },
      { name: 'new_value', type: 'textarea', label: 'After', readonly: true },
      { name: 'ip_address', type: 'text', label: 'IP Address', readonly: true },
      { name: 'user_agent', type: 'textarea', label: 'User Agent', readonly: true },
      { name: 'tenant_id', type: 'text', label: 'Tenant', readonly: true },
      { name: 'metadata', type: 'textarea', label: 'Metadata', readonly: true },
    ],
    titleFormat: '{action} · {object_name}',
    views: [
      {
        name: 'all',
        label: 'All Logs',
        type: 'grid',
        columns: ['created_at', 'action', 'object_name', 'record_id', 'user_id', 'ip_address'],
      },
    ],
  },
];
