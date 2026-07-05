---
"@object-ui/app-shell": minor
"@object-ui/plugin-view": patch
---

Studio package-create dogfood follow-ups (framework#2615 — P2 wizard + P3 polish):

- **Package-id wizard feedback.** The three package wizards (switcher create,
  landing create, landing duplicate) share a new `PackageIdInput`: illegal
  characters are still normalized away, but no longer silently — a notice
  says what was removed — a reverse-domain format hint shows while the id
  doesn't parse, and a CJK-only name that yields no id suggestion is told to
  type one manually instead of leaving the id box mysteriously empty.
- **Records-grid duplicate "Actions" column.** A field literally named
  `actions` is now dropped from the Studio grid's data columns, so it no
  longer collides with the always-pinned row-actions column (it stays
  editable in the form designer).
- **Record-create verb consistency.** The `ObjectView` toolbar create button
  resolved a hardcoded English "Create"; it now uses the same
  `console.objectView.new` ("New" / 新建) key as the runtime object pages so
  Studio and the running app agree.
- **Branded cold-load splash.** The console's pre-auth loading gate rendered a
  bare "Loading…"; it now shows the branded, boot-safe `LoadingScreen`.
- **Picklist option editor.** Value/label inputs and CJK option labels no
  longer truncate — the six controls that shared one cramped row are split
  into a two-row layout so the inputs get the full panel width.
- **Draft-save confirmation.** The Data pillar's "Save draft" now shows a
  success toast and a "last saved HH:MM" indicator, matching the App and
  Automations pillars.
