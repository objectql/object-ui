/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@object-ui/components';
import { useRecordContext } from '@object-ui/react';
import { parseCapabilityNames } from '@object-ui/fields';
import { useDetailTranslation } from '../useDetailTranslation';

/**
 * PermissionFacetLink — read-only summary + "Design in Studio →" deep-link for
 * the six authorization facets on a `sys_permission_set` record (ADR-0056 /
 * epic #2398, phase P1).
 *
 * In the pure model an app developer *designs* every permission facet in
 * Studio's structured editors; a system admin only *assigns users* in Setup.
 * So Setup must never render a facet as raw `[Object]`/JSON or let it be edited
 * inline — it shows a compact summary of the current grant plus a deep-link
 * into the structured editor for that set:
 *
 *   /apps/:appName/metadata/permission/:setName   (env scope; :name = api name)
 *
 * Registered as the `permission-facet-link` field widget (so the record form
 * and inline edit render it) and special-cased in DetailSection's read branch,
 * so all three surfaces render read-only and identically. The renderer pulls
 * the set's api-name from `useRecordContext()` and the app from `useParams()`
 * — the same pattern the reference rail uses.
 */

type FacetValue = unknown;

/** Parse a facet value that may arrive as an object, an array, or a JSON string. */
function parseFacet(value: FacetValue): unknown {
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  return value ?? null;
}

/** Count grants in a facet: array length, object key count, else 0 (empty) / 1. */
function facetCount(value: FacetValue): number {
  const v = parseFacet(value);
  if (v == null || v === '') return 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'object') return Object.keys(v as object).length;
  return 1;
}

export interface PermissionFacetLinkProps {
  value: FacetValue;
  field?: { name?: string; label?: string } | null;
}

export function PermissionFacetLink({
  value,
  field,
}: PermissionFacetLinkProps): React.ReactElement {
  const { t } = useDetailTranslation();
  const ctx = useRecordContext();
  const { appName } = useParams<{ appName?: string }>();

  const fieldName = field?.name || '';
  const setName = (ctx?.data as Record<string, unknown> | undefined)?.name;
  const to =
    appName && setName
      ? `/apps/${appName}/metadata/permission/${encodeURIComponent(String(setName))}`
      : null;

  const count = facetCount(value);
  const isEmpty = count === 0;

  // Facet-specific read-only summary. Capabilities render as chips (the names
  // read meaningfully on their own); every other facet is a compact count.
  const summary = (() => {
    if (isEmpty) {
      return (
        <span className="text-muted-foreground">
          {t('perm.facet.none', { defaultValue: 'None' })}
        </span>
      );
    }
    if (fieldName === 'system_permissions') {
      const names = parseCapabilityNames(value);
      const shown = names.slice(0, 6);
      const extra = names.length - shown.length;
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          {shown.map((n) => (
            <Badge key={n} variant="outline">
              {n}
            </Badge>
          ))}
          {extra > 0 && (
            <span className="text-muted-foreground text-xs">
              {t('perm.facet.more', { count: extra, defaultValue: `+${extra} more` })}
            </span>
          )}
        </span>
      );
    }
    const label = (() => {
      switch (fieldName) {
        case 'object_permissions':
          return t('perm.facet.objects', {
            count,
            defaultValue: `${count} object${count === 1 ? '' : 's'}`,
          });
        case 'field_permissions':
          return t('perm.facet.fields', {
            count,
            defaultValue: `${count} field rule${count === 1 ? '' : 's'}`,
          });
        case 'row_level_security':
          return t('perm.facet.rls', {
            count,
            defaultValue: `${count} RLS polic${count === 1 ? 'y' : 'ies'}`,
          });
        case 'tab_permissions':
          return t('perm.facet.tabs', {
            count,
            defaultValue: `${count} tab rule${count === 1 ? '' : 's'}`,
          });
        case 'admin_scope':
          return t('perm.facet.adminScope', {
            defaultValue: 'Delegated admin configured',
          });
        default:
          return String(count);
      }
    })();
    return <span className="text-foreground">{label}</span>;
  })();

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {summary}
      {to ? (
        <Link to={to} className="text-primary hover:underline whitespace-nowrap">
          {t('perm.facet.designInStudio', { defaultValue: 'Design in Studio →' })}
        </Link>
      ) : (
        <span className="text-muted-foreground/60 whitespace-nowrap">
          {t('perm.facet.designInStudioHint', { defaultValue: 'Design in Studio' })}
        </span>
      )}
    </span>
  );
}

export default PermissionFacetLink;
