---
'@object-ui/plugin-gantt': patch
'@object-ui/i18n': patch
---

An illegal gantt dependency link now says why it was refused, instead of doing nothing

Dragging a dependency onto a target the gantt refuses — itself, a locked row, a group row, or one that would close a dependency cycle — produced no feedback of any kind: no toast, no dialog, no cursor change, no target outline, not even a console warning. The guard was right and completely invisible, so a user drawing a legitimate-looking dependency got a dead interaction and no way to learn the constraint. The rejection was silent in both places it could have shown: a refused bar never became the drop target, so it got no hover treatment at all, and the release handler only ran its body when a target *had* been registered, so the drop itself was a no-op.

Both halves are now wired, and both read the **same** verdict. `canReceiveLink`'s four-branch boolean became `classifyLinkTarget`, which returns which branch refused (or `null`), with the boolean derived from it. The hover affordance and the drop toast are two consumers of that one classification, so the reason a user is shown cannot drift from the reason the link was actually refused — there is no second classifier to disagree. The branch names are the leaves of the new `gantt.link.rejected.*` keys, so a branch added later without a message surfaces as a missing key rather than as a plausible-but-wrong sentence.

During the drag, a refused bar under the pointer gets `cursor: not-allowed` and a destructive outline; on release it raises a toast naming the reason. Four messages, one per branch, in all ten packs. Both the cursor and the outline are driven from inline `style` rather than utility classes, matching the bar's existing read-only cursor three lines away and for the same reason recorded there: `cursor-not-allowed` and the ring alpha utilities are not emitted in the prebuilt components CSS, so a class would look correct in a DOM test and render nothing in a browser.

Deliberately unchanged: a host veto through `onBeforeDependencyCreate` stays silent. That rejection carries a reason only the host knows, and the gantt has none to show — surfacing it means exposing a rejection-reason output on the public component, which is a separate contract rather than a rider on this one. The four built-in reasons are the gantt's own policy and are the only ones it can explain.

One of the four, `group`, has no end-to-end path today: a `type: 'group'` row renders no bar, so the drag can never target it. The message is kept anyway — without it the branch would render a raw key on screen if it ever did fire — and the test pins the reachability fact, so it goes red the day group rows gain a bar. Filed as objectui#4209.
