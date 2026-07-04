// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Turn a metadata save/publish failure into a FIELD-ANCHORED message. The
// framework validates a draft against its spec and returns structured issues
// (`error.details.issues: [{ path, message }]`, surfaced on `MetadataError.issues`
// by the client); a publish carries per-draft failures in `data.failed[]`. These
// helpers render "which field, and why" instead of a single opaque banner line —
// the point of surfacing validation at the save/publish moment.

import type { MetadataValidationIssue } from '@object-ui/data-objectstack';

/** Pull structured validation issues off a caught error (empty if none). */
export function extractIssues(e: unknown): MetadataValidationIssue[] {
  const issues = (e as { issues?: unknown } | null | undefined)?.issues;
  return Array.isArray(issues) ? (issues as MetadataValidationIssue[]) : [];
}

/** One issue → a single field-anchored line: `• fields.amount.type — Required`. */
function issueLine(i: MetadataValidationIssue): string {
  return `• ${i.path && i.path.length > 0 ? i.path : '(root)'} — ${i.message}`;
}

/**
 * Format a caught save/publish error for a banner/toast. When the error carries
 * spec-validation issues, list them (one field per line) so the user sees the
 * offending fields; otherwise fall back to the plain message. Rendered with
 * `whitespace-pre-line` so the lines show as a list.
 */
export function formatMetadataError(e: unknown): string {
  const issues = extractIssues(e);
  if (issues.length > 0) return issues.map(issueLine).join('\n');
  const err = e as { message?: string } | null | undefined;
  return err?.message ?? String(e);
}

/** A single failed draft from a publish response's `data.failed[]`. */
export interface PublishFailure {
  type: string;
  name: string;
  error: string;
  issues?: MetadataValidationIssue[];
}

/**
 * Format the `failed[]` from a partial publish (the server returns 200 with the
 * drafts that DIDN'T go live). Each failed draft gets a heading and, when the
 * failure was a validation error, its field-anchored issues indented below.
 */
export function formatPublishFailures(failed: PublishFailure[]): string {
  return failed
    .map((f) => {
      const head = `${f.type}/${f.name}: ${f.error}`;
      const issues = Array.isArray(f.issues) ? f.issues : [];
      return [head, ...issues.map((i) => `  ${issueLine(i)}`)].join('\n');
    })
    .join('\n');
}
