/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/collaboration
 *
 * Real-time collaboration for Object UI providing:
 * - useRealtimeSubscription hook for WebSocket data subscriptions
 * - usePresence hook for live cursor and presence tracking
 * - useConflictResolution hook for version history and conflict management
 * - CommentThread component for threaded comments with @mentions
 * - LiveCursors component for displaying remote user cursors
 * - PresenceAvatars component for showing active user avatars
 *
 * @packageDocumentation
 */

export {
  useRealtimeSubscription,
  type RealtimeConfig,
  type ConnectionState,
  type RealtimeMessage,
  type RealtimeResult,
} from './useRealtimeSubscription';

export {
  usePresence,
  createPresenceUpdater,
  type PresenceUser,
  type PresenceConfig,
  type PresenceResult,
} from './usePresence';

export {
  useConflictResolution,
  type VersionEntry,
  type ConflictInfo,
  type ConflictResolutionResult,
} from './useConflictResolution';

export {
  CommentThread,
  type Comment,
  type CommentThreadProps,
} from './CommentThread';

export {
  LiveCursors,
  type LiveCursorsProps,
} from './LiveCursors';

export {
  PresenceAvatars,
  type PresenceAvatarsProps,
} from './PresenceAvatars';

// Re-export types from @object-ui/types for convenience
export type {
  CollaborationPresence,
  CollaborationOperation,
  CollaborationConfig,
} from '@object-ui/types';
