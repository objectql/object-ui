/**
 * SettingsPage
 *
 * Organization settings: general info form + danger zone.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Label,
  Separator,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@object-ui/components';
import { useAuth } from '@object-ui/auth';
import type { AuthOrganizationMember } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { useUpload } from '@object-ui/providers';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useOrgContext } from './orgContext.js';

export function SettingsPage() {
  const { t } = useObjectTranslation();
  const { org } = useOrgContext();
  const {
    user,
    getMembers,
    updateOrganization,
    deleteOrganization,
    leaveOrganization,
  } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug ?? '');
  const [logo, setLogo] = useState(org.logo ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { upload } = useUpload();

  // Owner check
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);

  // Danger zone dialogs
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');
  const [isDangerLoading, setIsDangerLoading] = useState(false);

  // Sync form when org changes (e.g., after save)
  useEffect(() => {
    setName(org.name);
    setSlug(org.slug ?? '');
    setLogo(org.logo ?? '');
  }, [org]);

  // Load members to determine if current user is owner
  useEffect(() => {
    let cancelled = false;
    setMembersLoading(true);
    getMembers(org.id)
      .then((members: AuthOrganizationMember[]) => {
        if (cancelled) return;
        const me = members.find((m) => m.userId === user?.id);
        setIsOwner(me?.role === 'owner');
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [org.id, user?.id, getMembers]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
        await updateOrganization(org.id, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          logo: logo.trim() || undefined,
        });
        toast.success(t('organization.settings.saved', { defaultValue: 'Settings saved' }));
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t('organization.settings.saveFailed', { defaultValue: 'Failed to save settings' }),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [org.id, name, slug, logo, updateOrganization, t],
  );

  const handleLeave = async () => {
    setIsDangerLoading(true);
    try {
      await leaveOrganization(org.id);
      toast.success(t('organization.settings.leftOrg', { defaultValue: 'You have left the organization' }));
      navigate('/organizations');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('organization.settings.leaveFailed', { defaultValue: 'Failed to leave organization' }),
      );
    } finally {
      setIsDangerLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDangerLoading(true);
    try {
      await deleteOrganization(org.id);
      toast.success(t('organization.settings.deleted', { defaultValue: 'Organization deleted' }));
      navigate('/organizations');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('organization.settings.deleteFailed', { defaultValue: 'Failed to delete organization' }),
      );
    } finally {
      setIsDangerLoading(false);
    }
  };

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="settings-page">
      {/* General settings */}
      <section>
        <h2 className="text-lg font-semibold">
          {t('organization.settings.generalTitle', { defaultValue: 'General' })}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('organization.settings.generalDescription', {
            defaultValue: 'Update your organization information.',
          })}
        </p>

        <Separator className="my-4" />

        {!isOwner ? (
          <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
            {t('organization.settings.readOnlyNote', {
              defaultValue: 'Only owners can change settings.',
            })}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="org-name">
                {t('organization.settings.nameLabel', { defaultValue: 'Organization name' })}
              </Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="settings-name-input"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-slug">
                {t('organization.settings.slugLabel', { defaultValue: 'Slug' })}
              </Label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                data-testid="settings-slug-input"
              />
            </div>
            <div className="grid gap-2">
              <Label>
                {t('organization.settings.logoLabel', { defaultValue: 'Logo' })}
              </Label>
              <div className="flex items-center gap-3">
                <Avatar className="size-16 rounded-md">
                  {logo ? (
                    <AvatarImage src={logo} alt={name} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="rounded-md text-base">
                    {(name || 'O').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (logoInputRef.current) logoInputRef.current.value = '';
                        if (!file) return;
                        setIsUploadingLogo(true);
                        try {
                          const result = await upload(file);
                          setLogo(result.url);
                          toast.success(
                            t('organization.settings.logoUploaded', {
                              defaultValue: 'Logo uploaded — save to apply',
                            }),
                          );
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : t('organization.settings.logoUploadFailed', {
                                  defaultValue: 'Failed to upload logo',
                                }),
                          );
                        } finally {
                          setIsUploadingLogo(false);
                        }
                      }}
                      data-testid="settings-logo-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      data-testid="settings-logo-upload-btn"
                    >
                      {isUploadingLogo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {logo
                        ? t('organization.settings.logoReplace', { defaultValue: 'Replace' })
                        : t('organization.settings.logoUpload', { defaultValue: 'Upload' })}
                    </Button>
                    {logo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogo('')}
                        data-testid="settings-logo-clear-btn"
                      >
                        <X className="mr-2 h-4 w-4" />
                        {t('organization.settings.logoClear', { defaultValue: 'Remove' })}
                      </Button>
                    )}
                  </div>
                  <Input
                    id="org-logo"
                    type="url"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="text-xs"
                    data-testid="settings-logo-input"
                  />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={isSaving} data-testid="settings-save-btn">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('organization.settings.save', { defaultValue: 'Save changes' })}
            </Button>
          </form>
        )}
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-lg font-semibold text-destructive">
          {t('organization.settings.dangerZone', { defaultValue: 'Danger zone' })}
        </h2>
        <Separator className="my-4" />

        <div className="space-y-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          {/* Leave organization */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">
                {t('organization.settings.leaveTitle', { defaultValue: 'Leave organization' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('organization.settings.leaveDescription', {
                  defaultValue: 'You will lose access to this organization.',
                })}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setIsLeaveOpen(true)}>
              {t('organization.settings.leaveAction', { defaultValue: 'Leave' })}
            </Button>
          </div>

          <Separator />

          {/* Delete organization */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">
                {t('organization.settings.deleteTitle', { defaultValue: 'Delete organization' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('organization.settings.deleteDescription', {
                  defaultValue: 'Permanently delete this organization and all its data.',
                })}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteConfirmSlug('');
                setIsDeleteOpen(true);
              }}
              disabled={!isOwner}
            >
              {t('organization.settings.deleteAction', { defaultValue: 'Delete' })}
            </Button>
          </div>
        </div>
      </section>

      {/* Leave confirmation */}
      <AlertDialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('organization.settings.leaveConfirmTitle', { defaultValue: 'Leave organization?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organization.settings.leaveConfirmDescription', {
                defaultValue:
                  'Are you sure you want to leave {{name}}? You will lose access immediately.',
                name: org.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerLoading}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLeave}
              disabled={isDangerLoading}
            >
              {isDangerLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('organization.settings.leaveConfirmAction', { defaultValue: 'Leave' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setDeleteConfirmSlug('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('organization.settings.deleteConfirmTitle', { defaultValue: 'Delete organization?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organization.settings.deleteConfirmDescription', {
                defaultValue:
                  'This action is irreversible. All data will be permanently deleted. Type the organization slug to confirm.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label htmlFor="delete-confirm-slug" className="text-sm font-medium">
              {t('organization.settings.deleteConfirmSlugLabel', {
                defaultValue: 'Type "{{slug}}" to confirm',
                slug: org.slug,
              })}
            </Label>
            <Input
              id="delete-confirm-slug"
              className="mt-2"
              value={deleteConfirmSlug}
              onChange={(e) => setDeleteConfirmSlug(e.target.value)}
              placeholder={org.slug}
              data-testid="delete-confirm-slug-input"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerLoading}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDangerLoading || deleteConfirmSlug !== org.slug}
            >
              {isDangerLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('organization.settings.deleteConfirmAction', { defaultValue: 'Delete organization' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
