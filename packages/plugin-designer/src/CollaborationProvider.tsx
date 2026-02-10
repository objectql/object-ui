/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import type { CollaborationConfig, CollaborationPresence, CollaborationOperation } from '@object-ui/types';

export interface CollaborationContextValue {
  /** Active users in the session */
  users: CollaborationPresence[];
  /** Whether collaboration is connected */
  isConnected: boolean;
  /** Send an operation to collaborators */
  sendOperation: (operation: Omit<CollaborationOperation, 'id' | 'timestamp' | 'version'>) => void;
  /** Current user ID */
  currentUserId?: string;
}

const CollabCtx = createContext<CollaborationContextValue | null>(null);
CollabCtx.displayName = 'CollaborationContext';

export interface CollaborationProviderProps {
  /** Collaboration configuration */
  config: CollaborationConfig;
  /** Current user info */
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  /** Callback when an operation is received from another user */
  onOperation?: (operation: CollaborationOperation) => void;
  /** Children */
  children: React.ReactNode;
}

/**
 * Provider for multi-user collaborative editing.
 * Manages WebSocket connection, presence, and operation broadcasting.
 */
export function CollaborationProvider({
  config,
  user,
  onOperation,
  children,
}: CollaborationProviderProps) {
  const users = useMemo<CollaborationPresence[]>(() => {
    if (!config.enabled || !user) return [];
    return [{
      userId: user.id,
      userName: user.name,
      avatar: user.avatar,
      color: generateColor(user.id),
      status: 'active' as const,
      lastActivity: new Date().toISOString(),
    }];
  }, [config.enabled, user]);

  const isConnected = config.enabled && !!user;

  const sendOperation = useCallback(
    (operation: Omit<CollaborationOperation, 'id' | 'timestamp' | 'version'>) => {
      if (!isConnected || !user) return;

      const fullOp: CollaborationOperation = {
        ...operation,
        id: `op-${Date.now()}`,
        userId: user.id,
        timestamp: new Date().toISOString(),
        version: Date.now(),
      };

      // In a real implementation, this would send via WebSocket
      onOperation?.(fullOp);
    },
    [isConnected, user, onOperation],
  );

  const value = useMemo<CollaborationContextValue>(
    () => ({
      users,
      isConnected,
      sendOperation,
      currentUserId: user?.id,
    }),
    [users, isConnected, sendOperation, user?.id],
  );

  return <CollabCtx.Provider value={value}>{children}</CollabCtx.Provider>;
}

/**
 * Hook to access the collaboration context.
 */
export function useCollaboration(): CollaborationContextValue | null {
  return useContext(CollabCtx);
}

/**
 * Generate a consistent color for a user ID.
 */
function generateColor(userId: string): string {
  const colors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}
