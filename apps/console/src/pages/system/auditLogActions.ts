/**
 * `sys_audit_log.action` values recognized by the console (filter dropdown +
 * badge coloring), split into their own module — rather than living inline
 * in AuditLogPage.tsx — so they can be imported by AuditLogPage.test.ts
 * without pulling a component export into a non-component file (React Fast
 * Refresh wants component files to only export components).
 *
 * Kept options mirror the server-declared `sys_audit_log.action` enum
 * (packages/plugins/plugin-audit/src/objects/sys-audit-log.object.ts in
 * objectstack): `permission_change`, `export`, and `restore` were retired
 * because no writer anywhere in the platform ever produces them (audit
 * surface principle: narrow-but-honest over broad-but-lying — objectui#4476).
 * `import` stays: it has a real writer (plugin-auth's admin-import-users.ts)
 * and the server enum + the config_changes list view both still use it.
 */

export const ACTION_OPTIONS = [
  'create', 'update', 'delete',
  'login', 'logout',
  'config_change', 'import',
] as const;

export const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  login: 'outline',
  logout: 'outline',
  config_change: 'secondary',
  import: 'outline',
};
