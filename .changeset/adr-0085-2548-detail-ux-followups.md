---
'@object-ui/plugin-detail': patch
'@object-ui/fields': patch
'@object-ui/i18n': patch
'@object-ui/app-shell': patch
---

Detail-page UX follow-ups from the ADR-0085 PR4 real-backend browser pass (framework#2548):

- **Highlight strip no longer repeats the record title.** A declared
  `highlightFields` list containing the title field rendered it as the first
  chip — truncated — directly under the identical page H1. `deriveHighlightFields`
  now resolves the title (`primaryField` / `nameField` / deprecated
  `displayNameField`, else the conventional display-field names) via the new
  exported `resolveTitleField` and filters it from declared lists before the
  4-chip cap, matching what the heuristic branch always did. app-shell's
  `RecordDetailView` synthParts (which pre-computes the list and bypasses the
  derivation) applies the same filter.
- **Per-field currency reaches the renderers.** The spec channel
  (`currencyConfig.defaultCurrency`) was dropped by the highlight-strip and
  detail-section field enrichment, so a spec-authored currency field could
  never show its symbol ("25,000,000" instead of "$25,000,000");
  `resolveFieldCurrency` reads it second after the designer-only bare
  `currency` key.
- **app-shell approvals fetches send the Bearer token.** The header badge
  poll, home-inbox count, and record-page approvals panel were cookie-only
  (new shared `bearerAuthHeaders()` util) — same split-origin failure mode as
  the console `approvalsApi` fix below.
- **`fieldGroups[].icon` / `description` reach detail pages.** The shared
  derivation (ADR-0085 §5) already passed them through; the detail synth
  dropped them. Sections now carry both, and `DetailSection` renders a real
  Lucide icon for identifier-shaped names (emoji/text values keep the
  historical text rendering).
- **Record meta footer stops dangling without an actor.** Seeded/system rows
  with `created_by: null` rendered "Created by · 10m ago"; the footer now
  falls back to actor-less labels ("Created / Updated"), with new i18n keys in
  all six locales (and the zh `createdBy`/`updatedBy` mistranslation fixed:
  创建人/更新人, not 创建于/更新于).
- **Select badges ellipsize instead of clipping mid-glyph.** In bounded
  containers (highlight-strip columns, grid cells) an overlong option label
  used to be cut at the container edge ("Technolog…"); badges now shrink with
  an inner truncate and expose the full label as a hover title. The highlight
  strip's hover title also prefers the option label over the raw stored value.

Console app (unversioned): `approvalsApi` now sends the stored Bearer token
like every other console call — cookie-only auth silently lost the approvals
surface on split-origin deployments where the SameSite cookie doesn't flow.
