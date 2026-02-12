/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Security module integration for @objectstack/spec v3.0.0
 * Provides advanced security policies: CSP config, audit logging, data masking.
 */

export interface SecurityPolicy {
  /** Content Security Policy configuration */
  csp?: CSPConfig;
  /** Audit logging configuration */
  auditLog?: AuditLogConfig;
  /** Data masking rules */
  dataMasking?: DataMaskingConfig;
}

export interface CSPConfig {
  /** Script sources */
  scriptSrc: string[];
  /** Style sources */
  styleSrc: string[];
  /** Image sources */
  imgSrc: string[];
  /** Connect sources (APIs, WebSockets) */
  connectSrc: string[];
  /** Font sources */
  fontSrc: string[];
  /** Frame sources */
  frameSrc?: string[];
  /** Report URI for violations */
  reportUri?: string;
}

export interface AuditLogConfig {
  /** Whether audit logging is enabled */
  enabled: boolean;
  /** Events to audit */
  events: AuditEventType[];
  /** Log retention days */
  retentionDays?: number;
  /** External log destination */
  destination?: 'console' | 'server' | 'both';
}

export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'data.create'
  | 'data.read'
  | 'data.update'
  | 'data.delete'
  | 'admin.config'
  | 'admin.user'
  | 'admin.role';

export interface DataMaskingConfig {
  /** Fields to mask */
  rules: DataMaskingRule[];
  /** Default masking character */
  maskChar?: string;
}

export interface DataMaskingRule {
  /** Field name or pattern */
  field: string;
  /** Masking strategy */
  strategy: 'full' | 'partial' | 'hash' | 'redact';
  /** Number of visible characters (for partial masking) */
  visibleChars?: number;
  /** Roles that can see unmasked data */
  exemptRoles?: string[];
}

export interface AuditLogEntry {
  /** Event timestamp */
  timestamp: string;
  /** Event type */
  event: AuditEventType;
  /** User who triggered the event */
  userId: string;
  /** Target resource */
  resource?: string;
  /** Record ID */
  recordId?: string;
  /** Additional details */
  details?: Record<string, unknown>;
  /** IP address */
  ipAddress?: string;
}

/**
 * Security policy manager.
 * Handles CSP generation, audit logging, and data masking.
 */
export class SecurityManager {
  private policy: SecurityPolicy;
  private auditLog: AuditLogEntry[] = [];

  constructor(policy: SecurityPolicy = {}) {
    this.policy = policy;
  }

  /**
   * Generate a CSP header string from the configuration.
   */
  generateCSPHeader(): string {
    const csp = this.policy.csp;
    if (!csp) return '';

    const directives: string[] = [];
    
    if (csp.scriptSrc?.length) directives.push(`script-src ${csp.scriptSrc.join(' ')}`);
    if (csp.styleSrc?.length) directives.push(`style-src ${csp.styleSrc.join(' ')}`);
    if (csp.imgSrc?.length) directives.push(`img-src ${csp.imgSrc.join(' ')}`);
    if (csp.connectSrc?.length) directives.push(`connect-src ${csp.connectSrc.join(' ')}`);
    if (csp.fontSrc?.length) directives.push(`font-src ${csp.fontSrc.join(' ')}`);
    if (csp.frameSrc?.length) directives.push(`frame-src ${csp.frameSrc.join(' ')}`);
    if (csp.reportUri) directives.push(`report-uri ${csp.reportUri}`);

    return directives.join('; ');
  }

  /**
   * Record an audit log entry.
   */
  recordAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    if (!this.policy.auditLog?.enabled) return;
    if (this.policy.auditLog.events && !this.policy.auditLog.events.includes(entry.event)) return;

    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.auditLog.push(fullEntry);

    const dest = this.policy.auditLog.destination ?? 'console';
    if (dest === 'console' || dest === 'both') {
      console.info('[AUDIT]', fullEntry.event, fullEntry.userId, fullEntry.resource ?? '');
    }
  }

  /**
   * Get audit log entries.
   */
  getAuditLog(filter?: { event?: AuditEventType; userId?: string; since?: string }): AuditLogEntry[] {
    let entries = [...this.auditLog];
    if (filter?.event) entries = entries.filter(e => e.event === filter.event);
    if (filter?.userId) entries = entries.filter(e => e.userId === filter.userId);
    if (filter?.since) entries = entries.filter(e => e.timestamp >= filter.since!);
    return entries;
  }

  /**
   * Apply data masking to a record.
   */
  maskRecord(record: Record<string, unknown>, userRoles: string[] = []): Record<string, unknown> {
    if (!this.policy.dataMasking?.rules?.length) return record;

    const masked = { ...record };
    const maskChar = this.policy.dataMasking.maskChar ?? '*';

    for (const rule of this.policy.dataMasking.rules) {
      if (!(rule.field in masked) || masked[rule.field] == null) continue;
      
      // Check role exemptions
      if (rule.exemptRoles?.some(role => userRoles.includes(role))) continue;

      const value = String(masked[rule.field]);
      
      switch (rule.strategy) {
        case 'full':
          masked[rule.field] = maskChar.repeat(value.length);
          break;
        case 'partial': {
          const visible = rule.visibleChars ?? 4;
          // Values shorter than visibleChars are fully masked for security
          if (value.length <= visible) {
            masked[rule.field] = maskChar.repeat(value.length);
          } else {
            masked[rule.field] = value.slice(0, visible) + maskChar.repeat(value.length - visible);
          }
          break;
        }
        case 'hash':
          masked[rule.field] = `[HASHED:${simpleHash(value)}]`;
          break;
        case 'redact':
          masked[rule.field] = '[REDACTED]';
          break;
      }
    }

    return masked;
  }

  /**
   * Update the security policy.
   */
  updatePolicy(policy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Get current security policy.
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }
}

/**
 * Simple hash function for data masking (not cryptographic).
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
