// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * CreateItemDialog — the ONE standard "create a draft metadata item" form for
 * Studio.
 *
 * Studio used to scatter five bespoke two-input mini-forms (package / app /
 * object / flow / permission), each an `absolute` dropdown or a cramped rail
 * inline block — inconsistent, and the top-bar ones were clipped by the
 * header's `overflow`. This is the shared, standard `Dialog` they all now use:
 * a display-name field that auto-slugs the identifier, the identifier field,
 * an optional `extra` slot (e.g. app's "scaffold nav" checkbox), inline error,
 * and a busy-aware submit.
 *
 * It owns the two input fields and derives the identifier exactly the way the
 * old inline forms did (`toFieldNameLoose` while typing, `toFieldName` on
 * submit — the latter emits the `field` fallback for CJK-only input, which we
 * treat as "needs an explicit identifier"). Persistence stays with the caller:
 * `onSubmit({ label, name })` runs the type-specific skeleton + draft save.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@object-ui/components';
import { t, type SupportedLocale } from '../metadata-admin/i18n';
import { toFieldName, toFieldNameLoose } from '../metadata-admin/previews/object-fields-io';

export interface CreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Label for the display-name field (e.g. "Object name"). */
  labelFieldLabel: string;
  labelPlaceholder?: string;
  /** Label for the identifier field (e.g. "Identifier"). */
  idFieldLabel: string;
  idPlaceholder?: string;
  submitLabel: string;
  /** Shown on the submit button while `busy`. Falls back to `submitLabel`. */
  submittingLabel?: string;
  busy?: boolean;
  error?: string | null;
  locale: SupportedLocale;
  /** Extra fields rendered between the identifier field and the footer. */
  extra?: React.ReactNode;
  /** Persist. Receives the trimmed display label and the derived identifier. */
  onSubmit: (values: { label: string; name: string }) => void;
}

export function CreateItemDialog({
  open,
  onOpenChange,
  title,
  description,
  labelFieldLabel,
  labelPlaceholder,
  idFieldLabel,
  idPlaceholder,
  submitLabel,
  submittingLabel,
  busy = false,
  error,
  locale,
  extra,
  onSubmit,
}: CreateItemDialogProps): React.ReactElement {
  const [label, setLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);

  // Reset the transient inputs each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setLabel('');
      setName('');
      setNameTouched(false);
    }
  }, [open]);

  // Same identifier rule the inline forms enforced: need a label and a usable
  // identifier that isn't the `field` fallback `toFieldName` emits for
  // CJK-only input (the user must then type an explicit identifier).
  const finalName = toFieldName((name.trim() || label).trim());
  const valid = !!label.trim() && !!finalName && finalName !== 'field';

  const submit = () => {
    if (!valid || busy) return;
    onSubmit({ label: label.trim(), name: finalName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{labelFieldLabel}</Label>
            <Input
              autoFocus
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!nameTouched) setName(toFieldNameLoose(e.target.value));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder={labelPlaceholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{idFieldLabel}</Label>
            <Input
              className="font-mono"
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(toFieldNameLoose(e.target.value));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder={idPlaceholder}
            />
          </div>
          {extra}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('engine.studio.cancel', locale)}
          </Button>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy ? (submittingLabel ?? submitLabel) : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
