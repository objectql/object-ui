---
'@object-ui/plugin-chatbot': minor
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Studio workbench and AI tool cards speak the author's language (objectui#7254)

- The Interfaces breadcrumb, canvas caption and navigation rail show the
  metadata label plus a translated kind; the internal `type · name` pair moves
  to the tooltip. An unlabelled nav leaf now falls back to its object name
  instead of rendering an empty row.
- The Studio top-bar package switcher reads the package's human name from
  either position the packages endpoint serves it in, instead of degrading a
  registry-shaped entry to its reverse-domain id.
- The dashboard property panel is localized: the spec's authoring form is
  overlaid through the platform's own `metadataForms.<type>` convention, so
  section headings, field labels, hints and the `header` composite's sub-fields
  render in Chinese (developer vocabulary such as "Tailwind units" is replaced
  with something an author can act on, not transliterated).
- AI tool cards: tool titles resolve through `chatbot.tool.<name>` (all thirty
  platform-provided tools, ten locale packs), the header status badge is
  localized, and the plan count strip is a real plural family instead of an
  English `+ "s"` concatenation.
- The tool card's header badge and its body badge now come from one producer:
  a proposal that has been confirmed, built or published no longer keeps a
  header reading "Awaiting Approval".
