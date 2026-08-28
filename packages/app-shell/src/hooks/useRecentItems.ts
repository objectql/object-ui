/**
 * useRecentItems — re-export shim
 *
 * The recent-items state has been migrated to a React Context so all consumers
 * share a single state instance and can be backed by an optional backend
 * persistence adapter. See `../context/RecentItemsProvider`.
 *
 * All existing imports of `useRecentItems` and `RecentItem` from this path
 * continue to work without any changes at the call sites.
 *
 * @module
 */

export { useRecentItems, type RecentItem } from '../context/RecentItemsProvider.js';
