/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSafeTranslation } from '@object-ui/i18n';

/**
 * Create a safe translation hook with fallback to defaults.
 *
 * Thin alias over `@object-ui/i18n`'s `createSafeTranslation` — this used to
 * be a local re-implementation that wrapped the hook call in try/catch, which
 * violates rules-of-hooks (objectui#2879, same class as #2595/#2596).
 * `useObjectTranslation` is provider-safe and never throws, so the testKey
 * probe alone carries the "translations not configured" fallback.
 *
 * @param defaults - Fallback English translations keyed by i18n key
 * @param testKey - A key to test if i18n is properly configured
 */
export const createSafeTranslationHook = createSafeTranslation;

/**
 * Default English translations for detail view components.
 * Used as fallback when no I18nProvider is available.
 */
export const DETAIL_DEFAULT_TRANSLATIONS: Record<string, string> = {
  // objectstack#5733 — RecordDetailDrawer's drag-resize handle. The only
  // `common.*` key in this map, deliberately: it is the SAME key #5506 gave
  // NavigationOverlay's identical handle (`common.resizeDrawer`, already in
  // all ten packs), and one control should not get two spellings just because
  // it is rendered from two packages. Adding a `detail.resizeDrawer` twin
  // would fork the translation and drift the two handles apart.
  'common.resizeDrawer': 'Resize drawer',
  'detail.back': 'Back',
  'detail.edit': 'Edit',
  'detail.editInline': 'Edit',
  'detail.save': 'Save',
  'detail.saveChanges': 'Save changes',
  'detail.editFieldsInline': 'Edit fields inline',
  'detail.editInlineHint': 'Double-click to edit',
  'detail.cancel': 'Cancel',
  'detail.cancelEdit': 'Discard changes',
  'detail.openInNewTab': 'Open in new tab',
  'detail.share': 'Share',
  'detail.duplicate': 'Duplicate',
  'detail.export': 'Export',
  'detail.viewHistory': 'View history',
  'detail.delete': 'Delete',
  'detail.moreActions': 'More actions',
  // objectstack#5407 — the activity-feed reaction button's accessible name.
  // It is icon-only, so this label IS the button as far as a screen reader
  // (or a hover tooltip) is concerned; it used to be an English literal.
  'detail.addReaction': 'Add reaction',
  // objectstack#5430 — the rest of the reaction chrome. The picker popup is
  // `role="listbox"` with no visible label, and each reaction chip is an
  // emoji + a bare number, so these labels ARE those controls to a screen
  // reader. The count pair follows the repo's two-key plural convention
  // (`relatedRecords`/`relatedRecordOne`), never an i18next `_one` suffix.
  'detail.emojiPicker': 'Emoji picker',
  'detail.reactionCount': '{{emoji}} {{count}} reactions',
  'detail.reactionCountOne': '{{emoji}} {{count}} reaction',
  'detail.addToFavorites': 'Add to favorites',
  'detail.removeFromFavorites': 'Remove from favorites',
  'detail.previousRecord': 'Previous record',
  'detail.nextRecord': 'Next record',
  'detail.recordOf': '{{current}} of {{total}}',
  'detail.recordNotFound': 'Record not found',
  'detail.recordNotFoundDescription': 'The record you are looking for does not exist or may have been deleted.',
  'detail.goBack': 'Go back',
  'detail.details': 'Details',
  'detail.related': 'Related',
  'detail.relatedRecords': '{{count}} records',
  'detail.relatedRecordOne': '{{count}} record',
  'detail.noRelatedRecords': 'No related records found',
  'detail.loading': 'Loading...',
  'detail.copyToClipboard': 'Copy to clipboard',
  'detail.copied': 'Copied!',
  'detail.deleteConfirmation': 'Are you sure you want to delete this record?',
  'detail.editRecord': 'Edit record',
  'detail.viewAll': 'View All',
  'detail.new': 'New',
  'detail.emptyValue': '—',
  'detail.noValue': 'No value',
  'detail.activity': 'Activity',
  'detail.copyRecordId': 'Copy record ID',
  'detail.showEmptyFields': 'Show {{count}} empty fields',
  'detail.hideEmptyFields': 'Hide empty fields',
  'detail.editRow': 'Edit',
  'detail.deleteRow': 'Delete',
  'detail.deleteRowConfirmation': 'Are you sure you want to delete this record?',
  'detail.actions': 'Actions',
  'detail.previousPage': 'Previous',
  'detail.nextPage': 'Next',
  'detail.pageOf': 'Page {{current}} of {{total}}',
  'detail.sortBy': 'Sort by',
  'detail.filterPlaceholder': 'Filter...',
  'detail.highlightFields': 'Key Fields',
  // Comments
  'detail.comments': 'Comments',
  'detail.searchComments': 'Search comments…',
  'detail.addCommentPlaceholder': 'Add a comment… (Ctrl+Enter to submit)',
  'detail.noMatchingComments': 'No matching comments',
  'detail.noCommentsYet': 'No comments yet',
  'detail.pinned': 'Pinned',
  'detail.pin': 'Pin',
  'detail.unpin': 'Unpin',
  'detail.justNow': 'just now',
  'detail.minutesAgo': '{{count}}m ago',
  'detail.hoursAgo': '{{count}}h ago',
  'detail.daysAgo': '{{count}}d ago',
  // Record meta footer (audit provenance). created/updated are the
  // actor-less variants used when created_by/updated_by is null (system or
  // seeded rows) — "Created by · 5m ago" dangled without an actor.
  'detail.createdBy': 'Created by',
  'detail.updatedBy': 'Updated by',
  'detail.created': 'Created',
  'detail.updated': 'Updated',
  // Attachments
  'detail.dropFilesToUpload': 'Drop files here or click to upload',
  'detail.attachmentCount': '{{count}} attachment',
  'detail.attachmentCountPlural': '{{count}} attachments',
  'detail.removeAttachment': 'Remove attachment',
  // Diff
  'detail.unifiedDiff': 'Unified diff',
  'detail.sideBySideDiff': 'Side-by-side diff',
  'detail.noChanges': 'No changes',
  'detail.previousVersion': 'Previous',
  'detail.currentVersion': 'Current',
  // Discussion
  'detail.discussion': 'Discussion',
  'detail.showDiscussion': 'Show Discussion ({{count}})',
  'detail.hideDiscussion': 'Hide discussion',
  // Rich text editor
  'detail.bold': 'Bold (Ctrl+B)',
  'detail.italic': 'Italic (Ctrl+I)',
  'detail.listFormat': 'List',
  'detail.inlineCode': 'Inline code',
  'detail.mentionSomeone': 'Mention someone',
  'detail.preview': 'Preview',
  'detail.submitComment': 'Submit (Ctrl+Enter)',
  'detail.sendComment': 'Send',
  'detail.writeComment': 'Write a comment…',
  // Subscription
  'detail.subscribedTooltip': 'Subscribed — click to unsubscribe',
  'detail.unsubscribedTooltip': 'Subscribe to notifications',
  // Navigation
  'detail.firstRecord': 'First record (Home)',
  'detail.previousRecordKey': 'Previous record (←)',
  'detail.nextRecordKey': 'Next record (→)',
  'detail.lastRecord': 'Last record (End)',
  'detail.noRecords': 'No records',
  // objectui#3863 — the packs grew a BASE key for this family, and this map has to
  // mirror it for a reason of its own: `fallbackT` (createSafeTranslation) resolves
  // `defaults[key]` LITERALLY and never appends a plural suffix, so with only the two
  // suffixed rows below the provider-less path answered `t('detail.showEmptyRelated',
  // { count })` with the raw key. The base row is the only one that path can reach;
  // the suffixed rows are kept so the map's key set still mirrors the packs'.
  'detail.showEmptyRelated': '+ {{count}} empty',
  'detail.showEmptyRelated_one': '+ {{count}} empty',
  'detail.showEmptyRelated_other': '+ {{count}} empty',
  'detail.searchWhileNavigating': 'Search while navigating',
  'detail.searchRecords': 'Search records…',
  // Activity timeline
  'detail.allActivity': 'All Activity',
  'detail.commentsOnly': 'Comments Only',
  'detail.fieldChangesFilter': 'Field Changes',
  'detail.tasksOnly': 'Tasks Only',
  'detail.leaveCommentPlaceholder': 'Leave a comment… (Ctrl+Enter to submit)',
  'detail.noActivity': 'No activity recorded',
  'detail.loadMore': 'Load more',
  'detail.edited': '(edited)',
  'detail.via': 'via {{source}}',
  'detail.viewSource': 'View source',
  // Replies
  'detail.replyCount': '{{count}} reply',
  'detail.replyCountPlural': '{{count}} replies',
  'detail.replyPlaceholder': 'Reply…',
  // Aria labels
  'detail.filterActivity': 'Filter activity',
  'detail.openDiscussion': 'Open discussion panel',
  'detail.closeDiscussion': 'Close discussion panel',
  'detail.subscribeAriaLabel': 'Subscribe to notifications',
  'detail.unsubscribeAriaLabel': 'Unsubscribe from notifications',
  'detail.clearSearch': 'Clear search',
  // Concurrent update (OCC) dialog
  'detail.concurrentUpdateTitle': 'This record was modified by someone else',
  'detail.concurrentUpdateDescription': 'Another user saved a newer version of {{field}} while you were editing. To prevent silently overwriting their change, please choose how to resolve the conflict.',
  'detail.concurrentUpdateYourEdit': 'Your edit',
  'detail.concurrentUpdateCurrentValue': 'Current value',
  'detail.concurrentUpdateUpdatedBy': 'Updated by {{name}}',
  'detail.concurrentUpdateUpdatedAt': 'Updated at {{when}}',
  'detail.concurrentUpdateReload': 'Reload latest',
  'detail.concurrentUpdateOverwrite': 'Overwrite anyway',
  'detail.concurrentUpdateCancel': 'Cancel',
  // Approval band (objectui#2618; two-state since #2902)
  'detail.lockedByApproval': 'Locked for approval',
  'detail.lockedTooltip': 'This record has a pending approval request; editing is locked',
  // …and the pending-but-writable variant: the approval node declares
  // `lockRecord: false`, so the record stays editable while the request is open.
  'detail.approvalPendingEditable': 'In approval · editable',
  'detail.approvalPendingTooltip': 'This record has a pending approval request; this step still allows editing',
  // Quorum / 会签 progress on the pending node (objectstack#4478). The group
  // NAMES are data, not copy — they come from the flow author's config.
  'detail.approvalProgress': 'Approvals — {{got}} of {{need}}',
  'detail.approvalProgressGroups': 'Sign-off — {{got}} of {{need}} groups',
  'detail.approvalProgressLabel': 'Approval progress',
  'detail.cancelApproval': 'Recall approval',
  'detail.cancelApprovalInFlight': 'Recalling…',
  'detail.cancelApprovalTooltip': 'Recall the pending approval request to unlock this record',
  'detail.cancelApprovalTooltipUnlocked': 'Recall the pending approval request',
  'detail.cancelApprovalFailed': 'Failed to recall approval',
  'detail.cancelApprovalUnavailable': 'Recalling approvals is not supported on this data source',
};

/**
 * Translation hook for detail view components.
 * Falls back to DETAIL_DEFAULT_TRANSLATIONS when no I18nProvider is available.
 */
export const useDetailTranslation = createSafeTranslationHook(
  DETAIL_DEFAULT_TRANSLATIONS,
  'detail.back',
);
