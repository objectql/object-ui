/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createContext } from 'react';
import type { AuthUser, AuthSession, PreviewModeOptions } from './types';

export interface AuthContextValue {
  /** Current authenticated user */
  user: AuthUser | null;
  /** Current session information */
  session: AuthSession | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is loading */
  isLoading: boolean;
  /** Authentication error */
  error: Error | null;
  /** Whether the app is running in preview mode */
  isPreviewMode: boolean;
  /** Preview mode configuration (only set when isPreviewMode is true) */
  previewMode: PreviewModeOptions | null;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign up with name, email, and password */
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
  /** Update user profile */
  updateUser: (data: Partial<AuthUser>) => Promise<void>;
  /** Request password reset */
  forgotPassword: (email: string) => Promise<void>;
  /** Reset password with token */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

export const AuthCtx = createContext<AuthContextValue | null>(null);
AuthCtx.displayName = 'AuthContext';
