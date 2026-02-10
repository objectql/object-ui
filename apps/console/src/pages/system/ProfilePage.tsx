/**
 * User Profile Page
 *
 * Allows the authenticated user to view and edit their profile,
 * change their password, and manage account settings.
 */

import React, { useState } from 'react';
import { useAuth } from '@object-ui/auth';

export function ProfilePage() {
  const { user, updateUser, isLoading } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* Profile Info */}
        <div className="rounded-md border p-6">
          <h2 className="mb-4 text-lg font-semibold">Personal Information</h2>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            {saved && (
              <div className="rounded-md bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400" role="status">
                Profile updated successfully.
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="profile-name" className="text-sm font-medium leading-none">
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="profile-email" className="text-sm font-medium leading-none">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={user.email}
                disabled
                className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Role</label>
              <input
                type="text"
                value={user.role ?? 'member'}
                disabled
                className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password Change */}
        <div className="rounded-md border p-6">
          <h2 className="mb-4 text-lg font-semibold">Change Password</h2>
          <p className="text-sm text-muted-foreground">
            To change your password, use the password reset flow from the login page.
          </p>
        </div>
      </div>
    </div>
  );
}
