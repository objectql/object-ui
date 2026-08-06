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
  type RealtimeSubscriptionConfig,
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

// This package's i18n seam. Exported like `plugin-detail`'s
// `useDetailTranslation` / `DETAIL_DEFAULT_TRANSLATIONS` so a host can read the
// English defaults (e.g. to seed its own bundle) and so anything added to this
// package later translates through the same map instead of a second one.
export {
  useCollaborationTranslation,
  COLLAB_DEFAULT_TRANSLATIONS,
  type CollaborationTranslate,
} from './useCollaborationTranslation';

export {
  useMentionNotifications,
  type MentionNotificationsConfig,
  type MentionNotificationsResult,
} from './useMentionNotifications';

export {
  useCommentSearch,
  type CommentSearchConfig,
  type CommentSearchReturn,
} from './useCommentSearch';

export {
  LiveCursors,
  type LiveCursorsProps,
} from './LiveCursors';

export {
  PresenceAvatars,
  type PresenceAvatarsProps,
} from './PresenceAvatars';

export {
  PresenceProvider,
  useTenantPresence,
  useRecordPresence,
  type PresenceSource,
  type PresenceProviderProps,
  type RecordPresenceScope,
} from './PresenceProvider';

// Re-export types from @object-ui/types for convenience
export type {
  CollaborationPresence,
  CollaborationOperation,
  CollaborationConfig,
} from '@object-ui/types';
