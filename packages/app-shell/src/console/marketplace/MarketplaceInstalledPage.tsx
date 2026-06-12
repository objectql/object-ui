/**
 * Marketplace Installed Apps Page (legacy React route).
 *
 * The Installed Apps surface is migrating to plugin-carried metadata
 * (cloud ADR-0009 P2a): the page shell ships with
 * @objectstack/cloud-connection's install-local plugin and renders the
 * `marketplace:installed-list` widget. This route remains during the
 * migration window (the marketplace page's "Installed (N)" button links
 * here) and renders the SAME widget — single implementation, two entries.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@object-ui/components';
import { ArrowLeft, Store } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { InstalledList } from './InstalledListWidget';

export function MarketplaceInstalledPage() {
  const navigate = useNavigate();
  const { appName } = useParams<{ appName?: string }>();
  const { t } = useObjectTranslation();
  const basePath = appName ? `/apps/${appName}` : '';

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => navigate(`${basePath}/system/marketplace`)}
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden="true" />
        {t('marketplace.back')}
      </Button>

      <div>
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('marketplace.installedTitle')}</h1>
        </div>
        <p
          className="text-sm text-muted-foreground mt-1"
          // Subtitle contains an inline <code> path; render translated HTML from our own bundle.
          dangerouslySetInnerHTML={{ __html: t('marketplace.installedSubtitle') }}
        />
      </div>

      <InstalledList />
    </div>
  );
}
