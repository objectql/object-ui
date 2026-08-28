---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Studio's `新建对象` asks for the record-sharing baseline, and an unauthored one is reported before Publish rather than by it.

Creating an object through Studio collected exactly two things — display name and
identifier — and saved a draft that declared no `sharingModel`. The draft saved
happily, the form designer worked, and the object was then refused at 发布 →
全部发布 by `security-owd-unset`: a required decision the surface never asked
for, delivered by failing, as English ADR prose in a toast that then vanished on
a timer. The one actionable word in it named a control three clicks away that
nothing routed to.

The publish gate is correct and is unchanged — an org-wide default has to be an
authored decision, not an accident. What changes is when the console asks and
when it answers:

- **The create dialog asks.** A third field collects the baseline, pre-selected
  to `private` and glossed with the Settings tab's own strings, so a new object
  is publishable by construction. `buildObjectSkeleton` now takes the value as a
  required parameter — a future create path cannot omit the baseline without
  failing to type-check. `controlled_by_parent` is deliberately not offered at
  creation: it derives access from a master relation a brand-new object does not
  have yet, so offering it would trade one publish refusal for another.
- **The review sheet reports it.** The pending-changes panel now runs the
  framework's own `validateSecurityPosture` over the pending object drafts and
  names any blocking finding, with its fix-it hint, next to the Publish button.
  It mirrors the producer's rule rather than re-deriving it, and it reports
  without blocking — the server door stays the authority.
- **The Settings tab stops calling an unset baseline safe.** It described unset
  as "defaults to Private", which answers what the runtime does and not whether
  the object can ship. It now reads as the publish-blocking problem it is,
  styled like the external-wider warning beside it.
