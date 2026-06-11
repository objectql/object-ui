/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0037 — the persistent "Draft preview" watermark. Renders only while the
 * tree is in preview mode (`?preview=draft`); makes the mode unmistakable and
 * offers the only two actions that matter: leave the preview, or make it real
 * (the same governed one-click publish the Home banner uses). The bar is what
 * keeps a read-only preview from ever being confused with the live app.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, X, Rocket } from 'lucide-react';
import { Button } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { usePreviewDrafts, PREVIEW_QUERY_FLAG } from './PreviewModeContext';
import { usePublishAllDrafts } from './usePublishAllDrafts';

export function DraftPreviewBar() {
  const preview = usePreviewDrafts();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { publishAll, publishing } = usePublishAllDrafts(t);

  if (!preview) return null;

  const exit = () => {
    const params = new URLSearchParams(location.search);
    params.delete(PREVIEW_QUERY_FLAG);
    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`, { replace: true });
  };

  const publish = async () => {
    const result = await publishAll();
    if (!result.ok) return;
    // The draft world just became the real world — exit preview and reload so
    // every renderer re-reads the published registry.
    exit();
    setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 300);
  };

  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-3 border-b border-amber-300/70 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
      data-testid="draft-preview-bar"
    >
      <Eye className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 truncate">
        {t('preview.draftBar.message', {
          defaultValue: 'Draft preview — you are seeing unpublished changes. Nothing here is live until you publish.',
        })}
      </p>
      <Button size="sm" onClick={publish} disabled={publishing} data-testid="draft-preview-publish">
        <Rocket className="mr-1 h-3.5 w-3.5" />
        {publishing
          ? t('preview.draftBar.publishing', { defaultValue: 'Publishing…' })
          : t('preview.draftBar.publish', { defaultValue: 'Publish' })}
      </Button>
      <Button size="sm" variant="outline" onClick={exit} data-testid="draft-preview-exit">
        <X className="mr-1 h-3.5 w-3.5" />
        {t('preview.draftBar.exit', { defaultValue: 'Exit preview' })}
      </Button>
    </div>
  );
}
