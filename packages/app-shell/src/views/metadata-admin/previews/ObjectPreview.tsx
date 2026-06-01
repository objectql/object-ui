// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectPreview — form-designer canvas for an Object metadata draft.
 *
 * Each field renders as the labeled input control it will become at
 * runtime. Clicking a field selects it and the host swaps the right
 * panel to {@link ObjectFieldInspector}. Trailing "+ Add field"
 * button opens a categorized type picker.
 *
 * Read/write of `draft.fields` is non-destructive: the original shape
 * (array vs record) and any unknown properties on each field are
 * preserved via `object-fields-io`.
 */

import * as React from 'react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { ObjectFormCanvas } from './ObjectFormCanvas';
import { t } from '../i18n';

export function ObjectPreview({
  name,
  draft,
  onPatch,
  selection,
  onSelectionChange,
  locale,
}: MetadataPreviewProps) {
  const objectName = String((draft as any).name ?? name ?? '');

  if (!objectName) {
    return (
      <PreviewShell hint="object">
        <PreviewMessage>
          {t('designer.canvas.nameToStart', locale)}
        </PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint="object · designer">
      <PreviewErrorBoundary fallbackHint="The form designer couldn't be rendered. Check the Form tab.">
        <ObjectFormCanvas
          objectName={objectName}
          draft={draft}
          onPatch={onPatch}
          selection={selection}
          onSelectionChange={onSelectionChange}
          locale={locale}
        />
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
