/**
 * App Management Page
 *
 * Lists all configured applications with search, enable/disable toggle,
 * delete, set-default, and navigation to create/edit pages.
 *
 * ## The writes are real (objectui#4233)
 *
 * Every mutating control here used to carry `// TODO: Replace with real API
 * call when backend supports app management` immediately before a
 * `toast.success(...)`, then `refresh()`. Zero non-GET requests reached the
 * wire, and reloading showed the server unchanged — so the page reported
 * success for work it had not done, and `refresh()` re-rendered the SAME
 * server state underneath the confirmation, which is what made it look like it
 * had worked.
 *
 * The premise of that TODO was measured against `@objectstack/client`
 * 17.0.0-rc.6 and is false: the metadata write surface exists and is the same
 * one the rest of this console already writes through —
 * `PUT /api/v1/meta/:type/:name` (`meta.saveItem`) and
 * `DELETE /api/v1/meta/:type/:name` (`meta.deleteItem`), both gated on
 * `manage_metadata` (ADR-0066 D1). `useNavigationSync` in `@object-ui/app-shell`
 * has been persisting app schemas through `meta.saveItem('app', …)` all along.
 *
 * So each handler now awaits a real mutation and only then reports success; a
 * rejection (403 from the permission gate, 5xx, offline) surfaces the server's
 * own message instead of a lie. This is deliberately the LAST link of
 * objectui#4233's other half: because these controls never wrote, an operator
 * could not set `isDefault` from the UI at all — the app had to be republished
 * through metadata — so the landing bug had no in-product workaround.
 *
 * ## The chrome is keyed, the server's words are not (objectui#4307)
 *
 * Every string this page AUTHORS goes through `t('appManagement.…')`. Every
 * string the SERVER authored is interpolated raw, and the split is deliberate
 * rather than incidental: a refusal like `forbidden: manage_metadata required`
 * is the server's diagnosis of a specific request, so keying it would mean
 * inventing a fixed catalogue of sentences the server does not promise to keep
 * sending. So the failure toasts are keyed **templates with a `{{reason}}`
 * hole** — the frame is localized, what fills it is passed through byte for
 * byte. `AppManagementPage.i18n.test.tsx` pins both halves at once, against a
 * `t` that answers in no natural language at all.
 */

import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Input,
  Checkbox,
} from '@object-ui/components';
import {
  Plus,
  LayoutGrid,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Star,
  ExternalLink,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMetadata, useAdapter } from '@object-ui/app-shell';
import { useObjectTranslation } from '@object-ui/i18n';
import { resolveKeyedI18nLabel } from '../../utils';

/**
 * The two metadata writes this page needs, named rather than reached for
 * through `any` — these are the calls whose ABSENCE was the defect, so the
 * shape they are called with is part of what this file now guarantees.
 */
interface MetaWriteClient {
  saveItem: (type: string, name: string, item: unknown) => Promise<unknown>;
  deleteItem: (type: string, name: string) => Promise<unknown>;
}

interface AdapterWithClient {
  getClient?: () => { meta?: MetaWriteClient } | null | undefined;
}

/**
 * What the server said, when it said anything — never a swallowed failure.
 *
 * The message is returned UNTRANSLATED by construction (objectui#4307): it is
 * the server's own sentence about this request, and the only localized part is
 * `unknown`, which is what this page says when the server said nothing at all.
 */
function reason(e: unknown, unknown: string): string {
  const message = e instanceof Error ? e.message : String(e ?? '');
  return message || unknown;
}

export function AppManagementPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = appName ? `/apps/${appName}` : '';
  const { apps, refresh } = useMetadata();
  const adapter = useAdapter();

  /**
   * The metadata write surface, or `null` when this page is mounted without an
   * adapter. Returning `null` rather than throwing keeps the read-only surface
   * (search, badges, navigation) usable; each handler refuses loudly instead —
   * which is the whole point of this card: no control may report success it
   * cannot substantiate.
   */
  const metaClient = useCallback((): MetaWriteClient | null => {
    const client = (adapter as AdapterWithClient | null | undefined)?.getClient?.();
    return client?.meta ?? null;
  }, [adapter]);

  /** The page's own word for "the server told us nothing" — see `reason`. */
  const unknownError = t('appManagement.toast.unknownError', { defaultValue: 'unknown error' });

  /**
   * One display name for an app, used by every label and toast below.
   *
   * `t` is passed on deliberately: an app's `label` may be objectui's KEYED
   * form (`{ key, defaultValue }`), and the resolver only reaches the pack when
   * it is handed a translator — the same call shape `AppSidebar` and
   * `DashboardView` already use. Without it a keyed label renders its authoring
   * `defaultValue` on every locale; interpolating `app.label` directly (what
   * these labels did before this page was keyed) renders `[object Object]`.
   */
  const appTitle = useCallback(
    (app: any): string => resolveKeyedI18nLabel(app?.label, t) || app?.name || '',
    [t],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Filter apps by search query
  const filteredApps = (apps || []).filter((app: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (app.name || '').toLowerCase().includes(q) ||
      (app.label || '').toLowerCase().includes(q) ||
      (app.description || '').toLowerCase().includes(q)
    );
  });

  const toggleSelect = useCallback((name: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredApps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApps.map((a: any) => a.name)));
    }
  }, [selectedIds.size, filteredApps]);

  const handleToggleActive = useCallback(async (app: any) => {
    const meta = metaClient();
    if (!meta) {
      toast.error(t('appManagement.toast.noClient', { defaultValue: 'Cannot reach the metadata service' }));
      return;
    }
    setProcessing(true);
    try {
      const newActive = app.active === false;
      // Spread the record the server gave us and override the ONE key this
      // control owns — the same round trip `useNavigationSync.saveApp` performs
      // for the `navigation` key. Rebuilding a minimal payload instead would
      // drop every field of the app the console does not model.
      await meta.saveItem('app', app.name, { ...app, active: newActive });
      toast.success(
        newActive
          ? t('appManagement.toast.appEnabled', { defaultValue: '{{name}} enabled', name: appTitle(app) })
          : t('appManagement.toast.appDisabled', { defaultValue: '{{name}} disabled', name: appTitle(app) }),
      );
      await refresh();
    } catch (e: unknown) {
      // The frame is localized; `{{reason}}` is the server's own sentence, raw.
      toast.error(t('appManagement.toast.toggleFailed', {
        defaultValue: 'Failed to toggle app status: {{reason}}',
        reason: reason(e, unknownError),
      }));
    } finally {
      setProcessing(false);
    }
  }, [refresh, metaClient, t, appTitle, unknownError]);

  const handleSetDefault = useCallback(async (app: any) => {
    const meta = metaClient();
    if (!meta) {
      toast.error(t('appManagement.toast.noClient', { defaultValue: 'Cannot reach the metadata service' }));
      return;
    }
    setProcessing(true);
    try {
      // `isDefault` ROUTES (`resolveLandingPath` rule 1 takes the FIRST match),
      // so it is single-valued in effect but not by construction: leaving the
      // previous holder set would make the landing depend on the order the
      // server happens to list apps in. Demote first, promote second — that
      // ordering is what makes a failure mid-way leave the deployment with NO
      // default (falls through to `/home`, the documented rule-3 answer) rather
      // than with two.
      const outgoing = (apps || []).filter(
        (a: any) => a?.isDefault === true && a.name !== app.name,
      );
      for (const prev of outgoing) {
        await meta.saveItem('app', prev.name, { ...prev, isDefault: false });
      }
      await meta.saveItem('app', app.name, { ...app, isDefault: true });
      toast.success(t('appManagement.toast.setDefaultDone', {
        defaultValue: '{{name}} set as default',
        name: appTitle(app),
      }));
      await refresh();
    } catch (e: unknown) {
      toast.error(t('appManagement.toast.setDefaultFailed', {
        defaultValue: 'Failed to set default app: {{reason}}',
        reason: reason(e, unknownError),
      }));
    } finally {
      setProcessing(false);
    }
  }, [apps, refresh, metaClient, t, appTitle, unknownError]);

  const handleDelete = useCallback(async (appToDelete: any) => {
    if (confirmDelete !== appToDelete.name) {
      setConfirmDelete(appToDelete.name);
      return;
    }
    const meta = metaClient();
    if (!meta) {
      toast.error(t('appManagement.toast.noClient', { defaultValue: 'Cannot reach the metadata service' }));
      return;
    }
    setProcessing(true);
    try {
      await meta.deleteItem('app', appToDelete.name);
      toast.success(t('appManagement.toast.appDeleted', {
        defaultValue: '{{name}} deleted',
        name: appTitle(appToDelete),
      }));
      setConfirmDelete(null);
      await refresh();
    } catch (e: unknown) {
      toast.error(t('appManagement.toast.deleteFailed', {
        defaultValue: 'Failed to delete app: {{reason}}',
        reason: reason(e, unknownError),
      }));
    } finally {
      setProcessing(false);
    }
  }, [confirmDelete, refresh, metaClient, t, appTitle, unknownError]);

  const handleBulkToggle = useCallback(async (active: boolean) => {
    const meta = metaClient();
    if (!meta) {
      toast.error(t('appManagement.toast.noClient', { defaultValue: 'Cannot reach the metadata service' }));
      return;
    }
    setProcessing(true);
    // Report what actually landed. A bulk toggle is N independent writes with
    // no transaction behind them, so "12 apps disabled" after 9 successes and 3
    // permission failures would be the same class of lie this card is closing —
    // just harder to notice.
    let saved = 0;
    const failures: string[] = [];
    try {
      const byName = new Map((apps || []).map((a: any) => [a?.name, a]));
      for (const name of selectedIds) {
        const app = byName.get(name);
        if (!app) continue;
        try {
          await meta.saveItem('app', name, { ...app, active });
          saved += 1;
        } catch (e: unknown) {
          // Keyed for its PUNCTUATION as much as its words — the CJK packs set
          // the bracket pair and the space before it, exactly as
          // `detail.userStatusTitle` does. `{{reason}}` stays the server's.
          failures.push(t('appManagement.toast.bulkFailureEntry', {
            defaultValue: '{{name}} ({{reason}})',
            name: appTitle(app),
            reason: reason(e, unknownError),
          }));
        }
      }
      if (saved > 0) {
        toast.success(
          active
            ? t('appManagement.toast.bulkEnabled', { defaultValue: '{{n}} apps enabled', n: saved })
            : t('appManagement.toast.bulkDisabled', { defaultValue: '{{n}} apps disabled', n: saved }),
        );
        setSelectedIds(new Set());
      }
      if (failures.length > 0) {
        // The joiner is a locale property, not a code constant — same rule (and
        // same past defect) as `validation.formInvalidJoiner`.
        const joiner = t('appManagement.toast.bulkFailureJoiner', { defaultValue: '; ' });
        toast.error(t('appManagement.toast.bulkFailed', {
          defaultValue: 'Failed for {{n}}: {{details}}',
          n: failures.length,
          details: failures.join(joiner),
        }));
      }
      await refresh();
    } catch (e: unknown) {
      toast.error(t('appManagement.toast.bulkOperationFailed', {
        defaultValue: 'Bulk operation failed: {{reason}}',
        reason: reason(e, unknownError),
      }));
    } finally {
      setProcessing(false);
    }
  }, [apps, selectedIds, refresh, metaClient, t, appTitle, unknownError]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {t('appManagement.title', { defaultValue: 'Applications' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('appManagement.subtitle', { defaultValue: 'Manage all configured applications' })}
          </p>
        </div>
        <Button onClick={() => navigate(`${basePath}/create-app`)} data-testid="create-app-btn">
          <Plus className="h-4 w-4 mr-2" />
          {t('appManagement.newApp', { defaultValue: 'New App' })}
        </Button>
      </div>

      {/* Search & Bulk Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <label htmlFor="app-search" className="sr-only">
            {t('appManagement.searchLabel', { defaultValue: 'Search apps' })}
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="app-search"
            placeholder={t('appManagement.searchPlaceholder', { defaultValue: 'Search apps...' })}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="app-search-input"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {t('appManagement.selectedCount', { defaultValue: '{{n}} selected', n: selectedIds.size })}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)} disabled={processing}>
              {t('appManagement.bulkEnable', { defaultValue: 'Enable' })}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)} disabled={processing}>
              {t('appManagement.bulkDisable', { defaultValue: 'Disable' })}
            </Button>
          </div>
        )}
      </div>

      {/* Select All */}
      {filteredApps.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            id="select-all-apps"
            checked={selectedIds.size === filteredApps.length && filteredApps.length > 0}
            onCheckedChange={() => toggleSelectAll()}
          />
          <label htmlFor="select-all-apps" className="cursor-pointer">
            {t('appManagement.selectAll', { defaultValue: 'Select all ({{n}})', n: filteredApps.length })}
          </label>
        </div>
      )}

      {/* App List */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="no-apps-message">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t('appManagement.empty', { defaultValue: 'No apps found.' })}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredApps.map((app: any) => {
            const isActive = app.active !== false;
            const isDefault = app.isDefault === true;
            const isDeleting = confirmDelete === app.name;
            // One resolved display name for the row: the visible heading and
            // all six control labels below name the app the SAME way.
            const title = appTitle(app);

            return (
              <Card key={app.name} className={!isActive ? 'opacity-60' : ''} data-testid={`app-card-${app.name}`}>
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <Checkbox
                    id={`select-app-${app.name}`}
                    checked={selectedIds.has(app.name)}
                    onCheckedChange={() => toggleSelect(app.name)}
                    aria-label={t('appManagement.selectApp', { defaultValue: 'Select {{name}}', name: title })}
                    className="shrink-0"
                  />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{title}</span>
                      {isDefault && (
                        <Badge variant="default" className="text-xs">
                          {t('appManagement.defaultBadge', { defaultValue: 'Default' })}
                        </Badge>
                      )}
                      <Badge variant={isActive ? 'secondary' : 'outline'} className="text-xs">
                        {isActive
                          ? t('appManagement.active', { defaultValue: 'Active' })
                          : t('appManagement.inactive', { defaultValue: 'Inactive' })}
                      </Badge>
                    </div>
                    {app.description && (
                      <p className="text-xs text-muted-foreground truncate">{resolveKeyedI18nLabel(app.description, t)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('appManagement.openApp', { defaultValue: 'Open app' })}
                      aria-label={t('appManagement.openAppNamed', { defaultValue: 'Open {{name}}', name: title })}
                      // ADR-0048 — open via the canonical package-id route segment
                      // (falls back to name for runtime apps without a package id).
                      onClick={() => navigate(`/apps/${app._packageId ?? app.name}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('appManagement.editApp', { defaultValue: 'Edit app' })}
                      aria-label={t('appManagement.editAppNamed', { defaultValue: 'Edit {{name}}', name: title })}
                      onClick={() => navigate(`${basePath}/edit-app/${app.name}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {app._packageId ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('appManagement.editWithAi', { defaultValue: 'Edit with AI' })}
                        aria-label={t('appManagement.editWithAiNamed', {
                          defaultValue: 'Edit {{name}} with AI',
                          name: title,
                        })}
                        // ADR-0070 — open the build agent in a fresh conversation
                        // pre-scoped to this app's package (passed as the chat
                        // context.packageId the cloud seeds as the active package),
                        // so the AI iterates within THIS app, not the whole env.
                        onClick={() =>
                          navigate(`/ai/build?package=${encodeURIComponent(app._packageId!)}&new=1`)
                        }
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      title={isActive
                        ? t('appManagement.disableApp', { defaultValue: 'Disable app' })
                        : t('appManagement.enableApp', { defaultValue: 'Enable app' })}
                      aria-label={isActive
                        ? t('appManagement.disableAppNamed', { defaultValue: 'Disable {{name}}', name: title })
                        : t('appManagement.enableAppNamed', { defaultValue: 'Enable {{name}}', name: title })}
                      onClick={() => handleToggleActive(app)}
                      disabled={processing}
                    >
                      {isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('appManagement.setDefault', { defaultValue: 'Set as default' })}
                      aria-label={t('appManagement.setDefaultNamed', {
                        defaultValue: 'Set {{name}} as default',
                        name: title,
                      })}
                      onClick={() => handleSetDefault(app)}
                      disabled={processing || isDefault}
                    >
                      <Star className={`h-4 w-4 ${isDefault ? 'fill-current text-yellow-500' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={isDeleting
                        ? t('appManagement.confirmDelete', { defaultValue: 'Click again to confirm delete' })
                        : t('appManagement.deleteApp', { defaultValue: 'Delete app' })}
                      aria-label={isDeleting
                        ? t('appManagement.confirmDeleteNamed', {
                            defaultValue: 'Confirm delete {{name}}',
                            name: title,
                          })
                        : t('appManagement.deleteAppNamed', { defaultValue: 'Delete {{name}}', name: title })}
                      onClick={() => handleDelete(app)}
                      disabled={processing}
                      className={isDeleting ? 'text-destructive' : ''}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
