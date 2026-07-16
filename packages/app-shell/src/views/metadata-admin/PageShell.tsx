// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PageShell — common hero / breadcrumb / action bar for every metadata
 * admin page (Phase 3c).
 *
 * Layout (top → bottom):
 *   1. Breadcrumb: All Metadata Types › <type> [ › <item> ]
 *   2. Hero: icon + label + writable badge + count chip
 *   3. Description (one line)
 *   4. Action toolbar (Create / Refresh / Reset / Delete)
 *   5. Child content (list / form / history)
 *
 * Keeping the chrome here means every page looks consistent and
 * page bodies stay focused on their domain logic.
 */

import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@object-ui/components';
import { Button } from '@object-ui/components';
import { ChevronRight } from 'lucide-react';
import type { RichMetadataTypeEntry } from './useMetadata';
import { useMetadataLocale, t, translateMetadataType, translateMetadataDomain } from './i18n';

export interface PageShellProps {
  /** The type entry from `/meta/types` (or a synthesized stub). */
  entry: RichMetadataTypeEntry | undefined;
  /** Optional item name (shown in breadcrumb on edit/history). */
  itemName?: string;
  /** Sub-label below the title — e.g. "Edit overlay" / "Version history". */
  subtitle?: string;
  /** Right-side stat chips. */
  stats?: Array<{ label: string; value: React.ReactNode }>;
  /** Right-side action buttons. */
  actions?: React.ReactNode;
  /** Page body. */
  children: React.ReactNode;
}

export function PageShell({
  entry,
  itemName,
  subtitle,
  stats,
  actions,
  children,
}: PageShellProps) {
  const type = entry?.type ?? '';
  const locale = useMetadataLocale();
  // Prefer locale-table translation over server's English label.
  const label = translateMetadataType(type, locale, entry?.label);

  // Compute base path up to /metadata so breadcrumb links work regardless
  // of how deep the current route is (list, edit, history, …).
  const { pathname } = useLocation();
  const metadataBase = React.useMemo(() => {
    const idx = pathname.indexOf('/metadata');
    return idx >= 0 ? pathname.slice(0, idx + '/metadata'.length) : '/metadata';
  }, [pathname]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      {itemName ? (
        // Compact single-line header for detail pages. The big hero title
        // adds nothing once you've drilled into a specific item — the
        // breadcrumb already names the type and the item, and meta badges
        // sit inline to free a full row of vertical chrome.
        <div className="px-6 py-2.5 border-b bg-background flex items-center gap-3 min-h-[44px]">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <Link to={metadataBase} className="hover:text-foreground shrink-0">
              {t('engine.breadcrumb.allTypes', locale)}
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <Link
              to={`${metadataBase}/${encodeURIComponent(type)}`}
              className="hover:text-foreground shrink-0"
            >
              {label}
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span
              className="text-foreground font-medium font-mono truncate"
              title={itemName}
            >
              {itemName}
            </span>
          </nav>
          <div className="flex items-center gap-1.5 shrink-0">
            {entry?.domain && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider h-5 px-1.5"
              >
                {translateMetadataDomain(entry.domain, locale)}
              </Badge>
            )}
            {entry?.allowOrgOverride ? (
              <Badge
                className={
                  'text-[10px] h-5 px-1.5 ' +
                  (entry.overrideSource === 'env'
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100')
                }
                title={
                  entry.overrideSource === 'env'
                    ? 'Writable via OBJECTSTACK_METADATA_WRITABLE env var'
                    : 'Writable per ADR-0005 overlay opt-in'
                }
              >
                {t('engine.badge.writable', locale)}
              </Badge>
            ) : entry?.allowRuntimeCreate ? (
              <Badge
                className="text-[10px] h-5 px-1.5 bg-sky-100 text-sky-800 hover:bg-sky-100"
                title="Code-shipped items are locked; new items can be created at runtime"
              >
                {t('engine.badge.createOnly', locale)}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 text-muted-foreground"
              >
                {t('engine.badge.readOnly', locale)}
              </Badge>
            )}
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2 shrink-0">
            {stats?.map((s, i) => (
              <div
                key={i}
                className="flex items-baseline gap-1 px-2 py-0.5 rounded border bg-muted/30"
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                <span className="text-xs font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
            {actions}
          </div>
        </div>
      ) : (
        // List / index pages: keep the full hero. The type label IS the
        // page identity here so we earn the vertical space.
        <div className="px-6 pt-5 pb-4 border-b bg-background">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link to={metadataBase} className="hover:text-foreground">
              {t('engine.breadcrumb.allTypes', locale)}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{label}</span>
          </nav>

          {/* Title row */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold truncate">{label}</h1>
                <code className="text-xs font-mono text-muted-foreground">
                  {type}
                </code>
                {entry?.domain && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {translateMetadataDomain(entry.domain, locale)}
                  </Badge>
                )}
                {entry?.allowOrgOverride ? (
                  <Badge
                    className={
                      'text-[10px] ' +
                      (entry.overrideSource === 'env'
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100')
                    }
                    title={
                      entry.overrideSource === 'env'
                        ? 'Writable via OBJECTSTACK_METADATA_WRITABLE env var'
                        : 'Writable per ADR-0005 overlay opt-in'
                    }
                  >
                    {t('engine.badge.writable', locale)}
                  </Badge>
                ) : entry?.allowRuntimeCreate ? (
                  <Badge
                    className="text-[10px] bg-sky-100 text-sky-800 hover:bg-sky-100"
                    title="Code-shipped items are locked; new items can be created at runtime"
                  >
                    {t('engine.badge.createOnly', locale)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {t('engine.badge.readOnly', locale)}
                  </Badge>
                )}
              </div>
              {subtitle && (
                <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
              )}
              {!subtitle && entry?.description && (
                <div className="text-sm text-muted-foreground mt-1 max-w-3xl">
                  {entry.description}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {stats?.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col items-end px-3 py-1 rounded border bg-muted/30 min-w-[64px]"
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{s.value}</span>
                </div>
              ))}
              {actions}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
