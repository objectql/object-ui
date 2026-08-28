---
---

Internal only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared.

Retires `InboxNotification.actor_name` (`packages/app-shell/src/layout/inboxGrouping.ts`),
which was dead at both ends. `mergeInboxRows`
(`packages/app-shell/src/hooks/sharedUserFeeds.ts`) is the single producer of every row
the bell and Home's action centre render and never mapped it; neither consumer read it;
and `sys_inbox_message` declares no actor column for it to have been mapped FROM. It was
the last declared-but-unfilled member of that interface after objectui#5190 removed the
sibling `source_object` / `source_id` pair.

**No published type surface changes.** `InboxNotification` is not reachable from
`@object-ui/app-shell`'s public entry: neither `src/index.ts` nor `src/layout/index.ts`
re-exports it, the built `dist/index.d.ts` does not name it, and the package `exports`
map offers only `.` and `./styles.css` — no deep subpath an external consumer could
import it through. The type is internal to the package, so removing an optional member
of it is not an externally observable narrowing and nothing user-visible ships. Runtime
behaviour is unchanged in both directions: no code path produced the field and no code
path read it.

Two pins keep it retired, in opposite directions — a TYPE PIN in
`layout/__tests__/inboxGrouping.test.ts` that fails if the field is re-declared, and a
runtime key-set pin in `hooks/__tests__/sharedInboxFeed.rowShape.test.tsx` that fails if
the producer is ever changed to spread raw `sys_inbox_message` columns through instead
of mapping them field by field.
