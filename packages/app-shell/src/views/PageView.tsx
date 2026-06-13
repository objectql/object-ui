/**
 * Page View Component
 *
 * Renders a custom page based on the pageName parameter. Page *authoring*
 * happens in the metadata studio (canvas + inspector), not here — runtime is
 * pure rendering. For parity with the view/report/dashboard runtime editors,
 * admins get a lightweight "Edit in studio" affordance that deep-links to the
 * page's studio editor (`/apps/:app/metadata/page/:name`) rather than
 * embedding the heavyweight page canvas in the runtime.
 */

import { useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { SchemaRenderer, useAdapter } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { FileText, Pencil } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useAuth } from '@object-ui/auth';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useMetadata } from '../providers/MetadataProvider';
import { useExpressionContext } from '../providers/ExpressionProvider';
import { preferLocal } from '../utils/preferLocal';
import { ConsoleActionRuntimeProvider } from '../hooks/useConsoleActionRuntime';
import { InterfaceListPage } from './InterfaceListPage';

export function PageView() {
  const { t } = useObjectTranslation();
  const { pageName } = useParams<{ pageName: string }>();
  const [searchParams] = useSearchParams();
  const { showDebug } = useMetadataInspector();
  const navigate = useNavigate();
  const location = useLocation();
  // Editing a page mutates the shared metadata definition, so the entry point
  // is admin-only (mirrors the view/report/dashboard runtime editors).
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { pages, objects } = useMetadata();
  // ADR-0048 Phase 2 — prefer the page owned by the current app's package so
  // two packages shipping `page/<same-name>` each resolve within their own
  // container instead of by load order.
  const { app: activeApp } = useExpressionContext();
  const dataSource = useAdapter();
  // Bumped after a successful page action so embedded data (lists, etc.)
  // re-fetch. Threaded into the page context AND used to remount the renderer.
  const [refreshKey, setRefreshKey] = useState(0);
  const page = preferLocal(pages as any[], pageName, (activeApp as any)?._packageId);

  if (!page) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('empty.pageNotFound')}</EmptyTitle>
          <EmptyDescription>
            {t('empty.pageNotFoundDescription', { name: pageName })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const params = Object.fromEntries(searchParams.entries());

  // Resolve the app slug from the path (`/apps/:app/page/:name`) so the deep
  // link survives whatever Router basename the host mounts under.
  const appName = location.pathname.match(/\/apps\/([^/]+)/)?.[1];
  const canEditInStudio = isAdmin && !!appName && !!pageName;
  const openInStudio = () => {
    if (!canEditInStudio) return;
    navigate(`/apps/${appName}/metadata/page/${encodeURIComponent(pageName!)}`);
  };

  return (
    // Mount the shared console action runtime so page-level `action:button`s can
    // collect params, call authenticated APIs, show confirm/result dialogs, run
    // screen flows, navigate the SPA, and refresh embedded data — the same
    // runtime ObjectView uses (#1605). Pages run global / action-scoped actions,
    // so no `objectName` is bound.
    <ConsoleActionRuntimeProvider
      dataSource={dataSource}
      objects={objects}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    >
      <div className="flex flex-row h-full w-full overflow-hidden relative">
        <div className="flex-1 overflow-auto h-full relative">
          {canEditInStudio && (
            <button
              type="button"
              onClick={openInStudio}
              className="absolute right-3 top-3 z-30 inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-accent-foreground"
              data-testid="page-edit-in-studio-button"
              title={t('common.editInStudio', { defaultValue: 'Edit in studio' })}
              aria-label={t('common.editInStudio', { defaultValue: 'Edit in studio' })}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {(page as any).interfaceConfig?.source ? (
            // ADR-0047 interface mode: the page binds a source view into a
            // curated list surface — rendered directly, not via regions.
            <InterfaceListPage key={refreshKey} page={page} />
          ) : (
            <SchemaRenderer
              key={refreshKey}
              schema={{
                ...page,
                type: (page as any).type || 'page',
                context: { ...(page as any).context, params, refreshKey },
              }}
            />
          )}
        </div>
        <MetadataPanel
          open={showDebug}
          sections={[{ title: 'Page Configuration', data: page }]}
        />
      </div>
    </ConsoleActionRuntimeProvider>
  );
}
