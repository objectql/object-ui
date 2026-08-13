---
'@object-ui/app-shell': patch
'@object-ui/auth': patch
'@object-ui/i18n': patch
---

Organization & invitation console: translate the English holdouts a zh session was left reading (#4474)

Three families of string, one sweep over `console/organizations/`:

- **Role names** now come from the single shared `ORG_ROLE_LABELS` map at every
  site. The role badges on the members and invitations pages were rendering the
  raw server identifier (`owner`) under a CSS `capitalize` that made it look like
  a label in English and left it untranslated everywhere else; the accept page
  did the same in its role row and inside its otherwise-translated sentence. The
  map's four `organization.roles.*` keys existed in no locale pack, so even the
  dropdown that did consult it fell through to English — all ten packs now carry
  them. An unrecognized role renders verbatim rather than blank.
- **Server-echoed errors** are mapped by better-auth's stable `code`, never by
  matching its English text. `createAuthClient` was dropping that code for every
  `organization.*` call while preserving it for sign-in/sign-up, so the console
  had nothing to key on; all sixteen organization methods now go through the same
  `toAuthError` helper. Messages are unchanged — the code simply stops being
  thrown away. An unmapped code still shows the server's own sentence.
- **Icon-only `aria-label`s** (member actions, copy invitation link, cancel
  invitation, and a fourth on the share-link copy button) are translated — for an
  icon-only control this is the only name a screen reader gets.
