/**
 * User Profile Page
 *
 * Allows the authenticated user to view and edit their profile,
 * change their password, and manage account settings.
 */

import React, { useState } from 'react';
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
import { CheckCircle2, AlertCircle, User, Lock } from 'lucide-react';

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
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 max-w-2xl">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account settings</p>
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
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base sm:text-lg">Personal Information</CardTitle>
          </div>
          <CardDescription>Update your name and view account details</CardDescription>
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
                  Profile updated successfully.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
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
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                type="text"
                value={user.role ?? 'member'}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base sm:text-lg">Change Password</CardTitle>
          </div>
          <CardDescription>
            To change your password, use the password reset flow from the login page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
