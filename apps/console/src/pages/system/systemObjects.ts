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
    name: 'sys_role',
    label: 'Roles',
    icon: 'Shield',
    fields: [
      { name: 'id', type: 'text', label: 'ID', readonly: true },
      { name: 'name', type: 'text', label: 'Role Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'permissions', type: 'text', label: 'Permissions' },
      { name: 'isSystem', type: 'boolean', label: 'System Role', readonly: true },
      { name: 'userCount', type: 'number', label: 'Users', readonly: true },
      { name: 'createdAt', type: 'datetime', label: 'Created At', readonly: true },
    ],
    titleFormat: '{name}',
    views: [
      {
        name: 'all',
        label: 'All Roles',
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
    fields: [
      { name: 'id', type: 'text', label: 'ID', readonly: true },
      { name: 'action', type: 'text', label: 'Action', readonly: true },
      { name: 'resource', type: 'text', label: 'Resource', readonly: true },
      { name: 'resourceId', type: 'text', label: 'Resource ID', readonly: true },
      { name: 'userId', type: 'text', label: 'User ID', readonly: true },
      { name: 'userName', type: 'text', label: 'User Name', readonly: true },
      { name: 'ipAddress', type: 'text', label: 'IP Address', readonly: true },
      { name: 'details', type: 'textarea', label: 'Details', readonly: true },
      { name: 'createdAt', type: 'datetime', label: 'Timestamp', readonly: true },
    ],
    titleFormat: '{action} on {resource}',
    views: [
      {
        name: 'all',
        label: 'All Logs',
        type: 'grid',
        columns: ['action', 'resource', 'userName', 'ipAddress', 'createdAt'],
      },
    ],
  },
];
