/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useObjectTranslation } from '@object-ui/react';

/**
 * Create a safe translation hook with fallback to defaults.
 * Follows the same pattern as useGridTranslation / useListViewTranslation.
 *
 * @param defaults - Fallback English translations keyed by i18n key
 * @param testKey - A key to test if i18n is properly configured
 */
export function createSafeTranslationHook(
  defaults: Record<string, string>,
  testKey: string,
) {
  return function useSafeTranslation() {
    try {
      const result = useObjectTranslation();
      const testValue = result.t(testKey);
      if (testValue === testKey) {
        return {
          t: (key: string, options?: Record<string, unknown>) => {
            let value = defaults[key] || key;
            if (options) {
              for (const [k, v] of Object.entries(options)) {
                value = value.replace(`{{${k}}}`, String(v));
              }
            }
            return value;
          },
        };
      }
      return { t: result.t };
    } catch {
      return {
        t: (key: string, options?: Record<string, unknown>) => {
          let value = defaults[key] || key;
          if (options) {
            for (const [k, v] of Object.entries(options)) {
              value = value.replace(`{{${k}}}`, String(v));
            }
          }
          return value;
        },
      };
    }
  };
}

/**
 * Default English translations for detail view components.
 * Used as fallback when no I18nProvider is available.
 */
export const DETAIL_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'detail.back': 'Back',
  'detail.edit': 'Edit',
  'detail.editInline': 'Edit inline',
  'detail.save': 'Save',
  'detail.saveChanges': 'Save changes',
  'detail.editFieldsInline': 'Edit fields inline',
  'detail.share': 'Share',
  'detail.duplicate': 'Duplicate',
  'detail.export': 'Export',
  'detail.viewHistory': 'View history',
  'detail.delete': 'Delete',
  'detail.moreActions': 'More actions',
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
  'detail.activity': 'Activity',
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
  // Replies
  'detail.replyCount': '{{count}} reply',
  'detail.replyCountPlural': '{{count}} replies',
  'detail.replyPlaceholder': 'Reply…',
};

/**
 * Translation hook for detail view components.
 * Falls back to DETAIL_DEFAULT_TRANSLATIONS when no I18nProvider is available.
 */
export const useDetailTranslation = createSafeTranslationHook(
  DETAIL_DEFAULT_TRANSLATIONS,
  'detail.back',
);
