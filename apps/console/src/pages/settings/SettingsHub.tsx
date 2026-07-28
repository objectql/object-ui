/**
 * <SettingsHub> — landing page for `/system/settings`.
 *
 * Lists every visible manifest grouped by category. Cards mirror the
 * SystemHubPage look-and-feel for visual consistency.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Skeleton,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { Settings as SettingsIcon } from 'lucide-react';
import { getIcon } from '../../utils/getIcon';
import { listSettingsManifests } from './api';
import { resolveLabel, type SettingsManifest } from './types';
import { useSettingsLabel } from './useSettingsLabel';

/**
 * One manifest card. Extracted so it can resolve the manifest's own
 * translated title/description via {@link useSettingsLabel} (hooks can't be
 * called inside a `.map()` callback in the parent).
 */
function SettingCard({ m, onOpen }: { m: SettingsManifest; onOpen: () => void }) {
  const { t } = useObjectTranslation();
  const labels = useSettingsLabel(m.namespace);
  const Icon = m.icon ? getIcon(m.icon) : SettingsIcon;
  const literalLabel = resolveLabel(m.label);
  const title = labels.title(literalLabel);
  const description = labels.description(m.description ?? undefined);

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
      onClick={onOpen}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line react-hooks/static-components -- getIcon returns a module-cached stable component per name, not one created during render */}
          <Icon className="h-6 w-6 text-muted-foreground" />
          {m.beta ? (
            <Badge variant="secondary" className="text-[10px]">
              {t('console.settingsHub.beta')}
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-base mt-2">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-[11px] text-muted-foreground">
          {t('console.settingsHub.settingsCount', { n: m.specifiers.length })}
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsHub() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const [manifests, setManifests] = useState<SettingsManifest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSettingsManifests()
      .then((r) => setManifests(r.manifests ?? []))
      .catch((err) =>
        setError(err?.message ?? t('console.settingsHub.loadError')),
      );
  }, [t]);

  const byCategory = useMemo(() => {
    if (!manifests) return null;
    const grouped = new Map<string, SettingsManifest[]>();
    for (const m of [...manifests].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))) {
      const cat = m.category ?? 'Other';
      const arr = grouped.get(cat) ?? [];
      arr.push(m);
      grouped.set(cat, arr);
    }
    return grouped;
  }, [manifests]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('console.settingsHub.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('console.settingsHub.subtitle')}</p>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!manifests ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      ) : manifests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('console.settingsHub.empty')}
          </CardContent>
        </Card>
      ) : (
        Array.from(byCategory ?? []).map(([category, items]) => (
          <section key={category} className="mb-8">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-3">
              {t(`console.settingsHub.categories.${category}`, { defaultValue: category })}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((m) => (
                <SettingCard
                  key={m.namespace}
                  m={m}
                  onOpen={() => navigate(`/system/settings/${m.namespace}`)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
