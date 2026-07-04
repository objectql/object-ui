/**
 * CreateWorkspaceDialog
 *
 * Dialog for creating a new workspace (organization).
 * Auto-generates a slug from the name.
 *
 * @module
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@object-ui/components';
import { useAuth } from '@object-ui/auth';
import type { AuthOrganization } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { Loader2 } from 'lucide-react';
import { provisionProductionEnvironment } from './provisionEnvironment';

/**
 * Convert a display name to a URL-friendly slug.
 *
 * The ASCII pass strips everything outside [a-z0-9 _-]. For a name written
 * entirely in a non-Latin script (中文 / 日本語 / 한국어 / العربية …) that pass
 * yields the empty string — and an empty slug left the "Create workspace"
 * button permanently disabled (`!slug.trim()`), dead-ending the FIRST step of
 * onboarding for every non-Latin-name user. Rather than block them, fall back
 * to a deterministic, non-empty slug they can still edit.
 *
 * Deterministic (not random) on purpose: a name-derived hash means the slug
 * doesn't jitter on every keystroke while typing a CJK name, and re-typing the
 * same name reproduces the same slug. Uniqueness across different names comes
 * from the hash; the server still enforces global slug uniqueness on submit.
 */
function nameToSlug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  if (ascii) return ascii;
  // Empty name → empty slug (keep the button disabled; nothing to create yet).
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Non-empty name with no ASCII-sluggable chars → deterministic fallback.
  let hash = 0;
  for (const ch of trimmed) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  return `workspace-${hash.toString(36).slice(0, 6)}`;
}

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (org: AuthOrganization) => void;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const { t } = useObjectTranslation();
  const { createOrganization, getAuthConfig } = useAuth();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defense-in-depth: the toolbar button that opens this dialog is already
  // hidden when `multiOrgEnabled === false`, but if a future caller opens the
  // dialog by another path we still want to fail fast with a friendly message
  // instead of bouncing off the server's FORBIDDEN.
  const [multiOrgDisabled, setMultiOrgDisabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setMultiOrgDisabled(cfg?.features?.multiOrgEnabled === false);
      })
      .catch(() => {
        /* leave default — server still enforces */
      });
    return () => {
      cancelled = true;
    };
  }, [open, getAuthConfig]);

  // Auto-generate slug from name (unless manually edited)
  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(nameToSlug(name));
    }
  }, [name, slugManuallyEdited]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugManuallyEdited(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !slug.trim()) return;
      if (multiOrgDisabled) {
        setError(
          t('workspace.multiOrgDisabled', {
            defaultValue: 'Creating new organizations is disabled on this instance.',
          }),
        );
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const org = await createOrganization({ name: name.trim(), slug: slug.trim() });
        // Born-with-env: eagerly ensure the new org's production environment so
        // the user lands in a ready workspace with no onboarding-wizard detour.
        // `createOrganization` already switched the active org; we also pass
        // `organizationId` explicitly so the target is unambiguous. Idempotent +
        // best-effort: a control plane that auto-provisions the env on create
        // resolves this to `alreadyProvisioned`; a genuine failure falls through
        // to the onboarding gate (lazy provision on first navigation).
        try {
          await provisionProductionEnvironment({ organizationId: org.id });
        } catch (provisionErr) {
          console.warn(
            '[CreateWorkspace] eager env provision failed; onboarding gate will provision lazily',
            provisionErr,
          );
        }
        onCreated?.(org);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create workspace');
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, slug, multiOrgDisabled, t, createOrganization, onCreated],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="create-workspace-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t('workspace.createTitle', { defaultValue: 'Create a workspace' })}
            </DialogTitle>
            <DialogDescription>
              {t('workspace.createDescription', {
                defaultValue: 'A workspace is a shared space for your team to collaborate.',
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="workspace-name">
                {t('workspace.nameLabel', { defaultValue: 'Workspace name' })}
              </Label>
              <Input
                id="workspace-name"
                placeholder={t('workspace.namePlaceholder', { defaultValue: 'e.g., Acme Inc' })}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                data-testid="workspace-name-input"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="workspace-slug">
                {t('workspace.slugLabel', { defaultValue: 'URL slug' })}
              </Label>
              <Input
                id="workspace-slug"
                placeholder="acme-inc"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManuallyEdited(true);
                }}
                data-testid="workspace-slug-input"
              />
              <p className="text-xs text-muted-foreground">
                {t('workspace.slugHint', { defaultValue: 'Used in URLs. Only lowercase letters, numbers, and hyphens.' })}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive" data-testid="workspace-create-error">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !slug.trim()}
              data-testid="workspace-create-submit"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('workspace.createButton', { defaultValue: 'Create workspace' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
