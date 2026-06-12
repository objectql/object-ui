// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Installed-packages list — registered as the SDUI widget
 * `marketplace:installed-list` (cloud ADR-0009 P2a).
 *
 * The Installed Apps page ships as METADATA with
 * `@objectstack/cloud-connection`'s install-local plugin; this widget is
 * the interactive body: load (control-plane list when cloud-connected,
 * local install-local cache otherwise), refresh, uninstall. The legacy
 * React route (`MarketplaceInstalledPage`) renders the SAME component
 * during the ADR-0009 migration window — single implementation, two
 * entries.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Skeleton,
} from '@object-ui/components';
import { RefreshCcw, Trash2, AlertCircle, ExternalLink } from 'lucide-react';
import { useIsWorkspaceAdmin } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { ComponentRegistry } from '@object-ui/core';
import {
  listLocalInstalls,
  listInstalledPackages,
  uninstallLocal,
  type LocalInstallEntry,
} from './marketplaceApi';
import { MarketplaceAccessDenied } from './MarketplaceAccessDenied';

export function InstalledList() {
  const navigate = useNavigate();
  const { appName } = useParams<{ appName?: string }>();
  const isAdmin = useIsWorkspaceAdmin();
  const { t, language } = useObjectTranslation();
  const basePath = appName ? `/apps/${appName}` : '';

  const [items, setItems] = useState<LocalInstallEntry[]>([]);
  // 'cloud' = list comes from the control plane (CLI/marketplace/REST installs,
  // ADR-0007 step ①); 'local' = self-hosted install-local cache.
  const [source, setSource] = useState<'cloud' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Cloud-connected env → authoritative installed list is the control
      // plane's. Self-hosted (not bound) → fall back to the local cache.
      const cloud = await listInstalledPackages();
      if (cloud.connected) {
        setSource('cloud');
        setItems(cloud.items);
      } else {
        setSource('local');
        setItems(await listLocalInstalls());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const doUninstall = async (entry: LocalInstallEntry) => {
    if (!confirm(t('marketplace.uninstall.confirm', { manifestId: entry.manifestId, version: entry.version }))) {
      return;
    }
    setWorking(entry.manifestId);
    setResult(null);
    try {
      await uninstallLocal(entry.manifestId);
      setResult({
        ok: true,
        message: t('marketplace.uninstall.successInList', { manifestId: entry.manifestId }),
      });
      await load();
    } catch (e: any) {
      setResult({ ok: false, message: e?.message ?? String(e) });
    } finally {
      setWorking(null);
    }
  };

  if (!isAdmin) return <MarketplaceAccessDenied />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
          {t('marketplace.refresh')}
        </Button>
      </div>

      {result && (
        <div className={`rounded-md border p-3 text-sm ${result.ok ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div>{result.message}</div>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border rounded-md">
          <p>{t('marketplace.installedEmpty')}</p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => navigate(`${basePath}/system/marketplace`)}
          >
            {t('marketplace.browseLink')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((entry) => (
            <Card key={entry.manifestId}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate flex items-center gap-2">
                    {entry.manifestId}
                    <Badge variant="outline">{t('marketplace.versionBadge', { version: entry.version })}</Badge>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{t('marketplace.installedAt', { when: new Date(entry.installedAt).toLocaleString(language || undefined) })}</span>
                    {entry.installedBy && <span>{t('marketplace.installedBy', { user: entry.installedBy })}</span>}
                    <span>{t('marketplace.installedPackageId')} <code className="font-mono">{entry.packageId}</code></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`${basePath}/system/marketplace/${entry.packageId}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden="true" />
                    {t('marketplace.action.details')}
                  </Button>
                  {source === 'local' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void doUninstall(entry)}
                      disabled={working === entry.manifestId}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                      {working === entry.manifestId ? t('marketplace.action.uninstalling') : t('marketplace.action.uninstall')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              {source === 'local' && (
                <CardContent
                  className="pt-0 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{
                    __html: t('marketplace.cachedAs', {
                      path: `.objectstack/installed-packages/${entry.manifestId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`,
                    }),
                  }}
                />
              )}
            </Card>
          ))}
        </div>
      )}

      <p
        className="text-xs text-muted-foreground border-t pt-4"
        dangerouslySetInnerHTML={{ __html: t('marketplace.installedAdditiveNote') }}
      />
    </div>
  );
}

// SDUI registration — the metadata page shipped by the install-local plugin
// references this widget by type.
ComponentRegistry.register('marketplace:installed-list', () => <InstalledList />, {
  namespace: 'app-shell',
  label: 'Installed Marketplace Packages',
  category: 'plugin',
  inputs: [],
});
