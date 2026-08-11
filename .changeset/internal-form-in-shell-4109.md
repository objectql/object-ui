---
'@object-ui/console': minor
---

Internal `/forms/:name` renders inside the console shell, and an internal submit lands on the record it just created

A `type: 'form'` action navigates to `/forms/:name` (`ActionRunner.executeForm`). That route was declared at the TOP level of the console route tree, a sibling of the app-shell routes, so clicking a button inside an app dropped the user onto a bare form — no header, no navigation, no way back — while the URL still said they were in the console. It now renders inside the console's layout for app-independent authed pages, the same chrome `/home` and `/organizations` use. The route itself is unchanged: deep links to it keep working, because the missing chrome was the defect, not the navigation.

The second half is what happens after Submit. The post-submit default was `{ kind: 'thank-you' }` for both form modes, so a signed-in operator who had just created a record was shown the ANONYMOUS confirmation — "Your submission has been received" — with no link to the thing they had created. The default is now mode-aware: an internal submit navigates to the created record's page, while the public `/f/:slug` path keeps `thank-you`, which is the right answer for a visitor who has no console to be sent into. A form view that declares its own `submitBehavior` still wins in both modes, unchanged and untouched — the point of a default is that the corpus never has to opt out of a wrong one.

Landing on the record needs the created record's id, and that comes from the spec-declared `CreateDataResponse = { object, id, record }` returned by `POST /api/v1/data/:object`. Only that one declared key is read: `record.id` carries the same value, but reading both would be a second de-facto contract for one fact. A response that names no id — or a workspace where no app can host the record's page — falls back to confirming the submit rather than navigating somewhere broken, since the record really was created and silence would be the worse answer.

No authorable surface changed. The "land on the created record" behaviour is deliberately NOT a new `submitBehavior.kind`: the spec's union (`thank-you | redirect | continue | next-record`) is strict and stays exactly as it is, and nothing parses the new internal default out of metadata — it is only what the renderer does when an author declared nothing.
