/**
 * inboxGrouping — pure grouping/coalescing for the message center (#2765).
 *
 * The inbox lists every notification individually, so a recurring notification
 * (e.g. `showcase_scheduled_digest`, which fires once a minute) floods the
 * surface with identical rows and inflates the bell badge to "9+". Coalescing
 * repeats of the same `(topic, title)` into one expandable group is the durable
 * fix — the demo-data cadence only makes the gap loud.
 *
 * Kept here (not in InboxPopover.tsx) so it stays a plain unit-testable module
 * and the popover file only exports its component (Fast Refresh friendly).
 *
 * @module
 */

export interface InboxNotification {
  id: string;
  /** FK → sys_notification (L2 event) — keys the read-state receipt (ADR-0030). */
  notification_id?: string | null;
  receipt_id?: string | null;
  /** The notification topic (e.g. `project.digest`) — the primary group key. */
  type: string;
  title: string;
  body?: string | null;
  /** Deep-link target carried by the inbox materialization. */
  action_url?: string | null;
  source_object?: string | null;
  source_id?: string | null;
  actor_name?: string | null;
  is_read?: boolean;
  created_at?: string;
}

/**
 * A coalesced run of notifications sharing the same `(topic, title)`. A group
 * of one renders as an ordinary row; a group of many collapses behind a count
 * pill and expands to reveal its members.
 */
export interface NotificationGroup {
  /** Stable identity for React keys + expand state (topic + title, or a row id). */
  key: string;
  type: string;
  title: string;
  /** Members in input order — the caller passes them newest-first. */
  items: InboxNotification[];
  /** How many members are unread — drives the group's unread dot + mark-read. */
  unreadCount: number;
  /** Newest member's timestamp — what the collapsed header shows. */
  latestCreatedAt?: string;
}

/**
 * Coalesce a (newest-first) notification list into `(topic, title)` groups,
 * preserving first-seen order so the newest group stays on top. Rows missing
 * both a topic and a title fall back to a per-id key so they stand alone
 * instead of collapsing into a catch-all bucket.
 */
export function groupNotifications(list: InboxNotification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const byKey = new Map<string, NotificationGroup>();
  for (const n of list) {
    const topic = (n.type ?? '').trim();
    const title = (n.title ?? '').trim();
    // Compose (topic, title) with a NUL separator that can't occur in either,
    // so distinct pairs never collide. A row with neither keys off its id.
    const key = topic || title ? `${topic}\u0000${title}` : `__row__${n.id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, type: n.type, title: n.title, items: [], unreadCount: 0, latestCreatedAt: n.created_at };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(n);
    if (!n.is_read) group.unreadCount += 1;
    // Defensive: keep the max timestamp even if the input isn't perfectly sorted.
    if (n.created_at && (!group.latestCreatedAt || n.created_at > group.latestCreatedAt)) {
      group.latestCreatedAt = n.created_at;
    }
  }
  return groups;
}
