/**
 * User Profile Page
 *
 * Allows the authenticated user to view and edit their profile,
 * change their password, and manage account settings.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAuth, getUserInitials } from '@object-ui/auth';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Alert,
  AlertDescription,
} from '@object-ui/components';
import { useUpload } from '@object-ui/providers';
import { useObjectTranslation } from '@object-ui/i18n';
import { CheckCircle2, AlertCircle, User, Lock, Upload, Loader2, X } from 'lucide-react';

export function ProfilePage() {
  const { t } = useObjectTranslation();
  const { user, updateUser, isLoading, changePassword, setInitialPassword, hasLocalPassword } = useAuth();
  const { upload } = useUpload();
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Sync local `name` state when the user object arrives or changes.
  // useState's initial value is only evaluated on first render, so when
  // this component mounts under <Suspense> (e.g. via the Account App's
  // `account:profile_card` registry entry) before AuthProvider has
  // resolved, `user` is null and `name` stays empty until we sync it.
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    try {
      await updateUser({ name });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const result = await upload(file);
      await updateUser({ image: result.url });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await updateUser({ image: null as unknown as string });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 max-w-2xl">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          {t('profile.title', { defaultValue: 'Profile' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('profile.subtitle', { defaultValue: 'Manage your account settings' })}
        </p>
      </div>

      {/* Avatar & Identity */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? 'User'} />
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold truncate">{user.name ?? 'User'}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <Badge variant="secondary" className="mt-1">{user.role ?? 'member'}</Badge>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
                data-testid="profile-avatar-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                data-testid="profile-avatar-upload-btn"
              >
                {avatarUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {user.image
                  ? t('profile.avatar.replace', { defaultValue: 'Replace' })
                  : t('profile.avatar.upload', { defaultValue: 'Upload' })}
              </Button>
              {user.image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={avatarUploading}
                  onClick={handleAvatarRemove}
                  data-testid="profile-avatar-remove-btn"
                >
                  <X className="mr-2 h-4 w-4" />
                  {t('profile.avatar.remove', { defaultValue: 'Remove' })}
                </Button>
              )}
            </div>
          </div>
          {avatarError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{avatarError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base sm:text-lg">
              {t('profile.info.title', { defaultValue: 'Personal Information' })}
            </CardTitle>
          </div>
          <CardDescription>
            {t('profile.info.description', { defaultValue: 'Update your name and view account details' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {saved && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-400">
                  {t('profile.info.saved', { defaultValue: 'Profile updated successfully.' })}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-name">{t('profile.info.name', { defaultValue: 'Name' })}</Label>
              <Input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                required
                aria-required="true"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">{t('profile.info.email', { defaultValue: 'Email' })}</Label>
              <Input
                id="profile-email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                {t('profile.info.emailImmutable', { defaultValue: 'Email cannot be changed.' })}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('profile.info.role', { defaultValue: 'Role' })}</Label>
              <Input
                type="text"
                value={user.role ?? 'member'}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading
                ? t('profile.saving', { defaultValue: 'Saving…' })
                : t('profile.info.save', { defaultValue: 'Save Changes' })}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <PasswordCard
        changePassword={changePassword}
        setInitialPassword={setInitialPassword}
        hasLocalPassword={hasLocalPassword}
      />
    </div>
  );
}

interface PasswordCardProps {
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setInitialPassword: (newPassword: string) => Promise<void>;
  hasLocalPassword: () => Promise<boolean>;
  highlight?: boolean;
  onPasswordSet?: () => void;
}

function PasswordCard({ changePassword, setInitialPassword, hasLocalPassword, highlight, onPasswordSet }: PasswordCardProps) {
  const { t } = useObjectTranslation();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasLocalPassword()
      .then((value) => { if (!cancelled) setHasPassword(value); })
      .catch(() => { if (!cancelled) setHasPassword(false); });
    return () => { cancelled = true; };
  }, [hasLocalPassword]);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError(t('profile.password.tooShort', { defaultValue: 'Password must be at least 8 characters' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('profile.password.mismatch', { defaultValue: 'Passwords do not match' }));
      return;
    }

    setSubmitting(true);
    try {
      if (hasPassword) {
        if (!currentPassword) {
          setError(t('profile.password.enterCurrent', { defaultValue: 'Enter your current password' }));
          setSubmitting(false);
          return;
        }
        await changePassword(currentPassword, newPassword);
        setSuccess(t('profile.password.changed', { defaultValue: 'Password changed.' }));
      } else {
        await setInitialPassword(newPassword);
        setSuccess(t('profile.password.localSet', {
          defaultValue: 'Local password set. You can now sign in with email and password on this environment.',
        }));
        setHasPassword(true);
        onPasswordSet?.();
      }
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state — keep the card visible to avoid layout shift.
  const initializing = hasPassword === null;

  return (
    <Card className={highlight ? 'ring-2 ring-amber-300 dark:ring-amber-700' : undefined}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base sm:text-lg">
            {hasPassword
              ? t('profile.password.changeTitle', { defaultValue: 'Change Password' })
              : t('profile.password.setTitle', { defaultValue: 'Set Local Password' })}
          </CardTitle>
        </div>
        <CardDescription>
          {hasPassword
            ? t('profile.password.changeDescription', {
                defaultValue: 'Update the password you use to sign in to this environment.',
              })
            : t('profile.password.setDescription', {
                defaultValue:
                  'You signed in via single sign-on. Set a local password to also sign in with email and password on this environment.',
              })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">
                {t('profile.password.current', { defaultValue: 'Current password' })}
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={submitting || initializing}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">
              {hasPassword
                ? t('profile.password.new', { defaultValue: 'New password' })
                : t('profile.password.password', { defaultValue: 'Password' })}
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting || initializing}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              {t('profile.password.confirm', { defaultValue: 'Confirm password' })}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting || initializing}
              minLength={8}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting || initializing} className="w-full sm:w-auto">
            {submitting
              ? t('profile.saving', { defaultValue: 'Saving…' })
              : hasPassword
                ? t('profile.password.changeAction', { defaultValue: 'Change password' })
                : t('profile.password.setAction', { defaultValue: 'Set password' })}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
