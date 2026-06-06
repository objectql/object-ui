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

import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { SchemaRenderer } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { FileText, Pencil } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useAuth } from '@object-ui/auth';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useMetadata } from '../providers/MetadataProvider';

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

  const { pages } = useMetadata();
  const page = pages?.find((p: any) => p.name === pageName);

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
    <div className="flex flex-row h-full w-full overflow-hidden relative">
      <div className="flex-1 overflow-auto h-full relative">
        {canEditInStudio && (
          <button
            type="button"
            onClick={openInStudio}
            className="absolute right-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-md border border-input bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-accent-foreground"
            data-testid="page-edit-in-studio-button"
            title={t('common.editInStudio', { defaultValue: 'Edit in studio' })}
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('common.editInStudio', { defaultValue: 'Edit in studio' })}
          </button>
        )}
        <SchemaRenderer
          schema={{
            ...page,
            type: (page as any).type || 'page',
            context: { ...(page as any).context, params },
          }}
        />
      </div>
      <MetadataPanel
        open={showDebug}
        sections={[{ title: 'Page Configuration', data: page }]}
      />
    </div>
  );
}
