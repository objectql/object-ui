---
title: Slotted Pages
description: Customize record detail pages by overriding only the slots you care about — let the default synthesizer handle the rest.
---

# Slotted Pages

Every record detail page in ObjectUI is **synthesized from the object
definition by default** (see `buildDefaultPageSchema`). You get a
Lightning-style page — header, highlights, tabs, related lists,
history — without writing a single line of page schema.

When you want to customize part of that page, you have two options:

1. **Full page** (`kind: "full"`, the default): author the entire
   `regions[].components[]` tree. Total control, total responsibility
   — you re-author every region.
2. **Slotted page** (`kind: "slotted"`): provide overrides for only
   the slots you care about. The default-page synthesizer fills in
   every slot you didn't override.

For "I love the default page but want to customize just the header,"
slotted pages are the right tool.

## Slot menu (v1)

| Slot | Replaces |
|---|---|
| `header` | `page:header` |
| `actions` | `record:quick_actions` (the action bar) |
| `highlights` | The chips + chevron path strip |
| `details` | The Details tab body (other tabs stay synthesized) |
| `tabs` | The entire `page:tabs` node — use to add or reorder tabs (wins over `details`) |
| `discussion` | `record:discussion` (the inline conversation footer) |

Each slot accepts a single component schema or an array (arrays are
flattened in place). Each slot is a **full replacement at the slot
boundary** — there is no deep-merge or JSON-Patch in v1.

## Example: customize only the header

```ts
import type { Page } from '@objectstack/spec/ui';

export const AccountDetailPage: Page = {
  name: 'account_detail_page',
  label: 'Account Detail',
  type: 'record',
  object: 'account',
  kind: 'slotted',
  regions: [], // slotted pages don't author regions
  slots: {
    header: {
      type: 'page:header',
      id: 'account_header_slotted',
      properties: {
        title: '{name}',
        subtitle: '{industry} · {type}',
        eyebrow: 'ACCOUNT',
        icon: 'building-2',
        breadcrumb: true,
      },
    },
  },
};
```

Result: the account record page renders with your custom header, and
the synthesizer fills in the highlights, tabs, and discussion regions as
if you'd authored nothing else. The default tab strip is **Details** → one
tab per related list flagged `relatedList: 'primary'` on its relationship → a
shared **Related** tab for the rest → **History**; so promoting a child table to
its own tab is a one-word change on the relationship, not a page-authoring task.
`relatedLayout: 'tabs' | 'stack'` remains an app-level override (force
all-own-tabs / all-stacked).

Related lists are additionally gated on the current user's **object-level
read permission** for the child object: a relationship whose child the user
cannot read produces no section and no tab (and the `record:related_list`
renderer suppresses itself the same way on hand-authored pages). The server
always enforced data access — this keeps the UI from rendering an empty
grid with a "New" button that would be rejected on save.

## Header actions: inline vs. overflow

`page:header` renders the record's `record_header` actions (authored
business actions plus the host-injected system set — Edit / Share /
Delete) as a button row. Up to **`maxVisible`** actions render inline,
side by side (default **3** on desktop, **`mobileMaxVisible`**, default
**1**, on mobile); the rest collapse into a `⋯` "More actions" menu.

Which actions claim the inline slots is declared in metadata, using the
same rules as `action:bar`:

- **`order`** (number, default `0`) — actions are stable-sorted
  ascending before the split, so a lower `order` promotes an action
  into the inline slots and a higher `order` pushes it toward the `⋯`
  menu. The synthesized system actions use `order: 100+`, so authored
  business actions outrank them by default.
- **`variant: 'primary'`** — tie-break within equal `order`: a primary
  action outranks its unordered siblings without needing an explicit
  `order`.
- **`component: 'action:menu'`** — pins the action inside the `⋯` menu
  regardless of how few actions exist (the synthesized Share / Delete
  use this).

```ts
slots: {
  header: {
    type: 'page:header',
    properties: {
      title: '{name}',
      maxVisible: 4, // allow four inline buttons on this page
    },
  },
},
```

## Composing default + custom

When you want "the default actions plus one custom button," you have
to replace the whole `actions` slot — there's no append/insert
operation in v1. To avoid copying the synthesizer's internals,
`@object-ui/plugin-detail` exports the **sub-builders** the
synthesizer uses internally:

```ts
import {
  buildDefaultHeader,
  buildDefaultActions,
  buildDefaultHighlights,
  buildDefaultDetails,
  buildDefaultTabs,
  buildDefaultDiscussion,
} from '@object-ui/plugin-detail';
```

You can call them with the object definition (and any options you'd
normally pass to `buildDefaultPageSchema`) and spread the result into
your slot override.

## When to use slotted vs full

- **Slotted** — customizing 1–2 regions of an otherwise standard
  detail page. Most "I want a fancier header" / "add a banner" /
  "swap the Details layout" requests.
- **Full** — building a record page that doesn't look like the
  default at all (e.g. a multi-column dashboard-style record). Author
  every region yourself.

The two modes are mutually exclusive: a page either has `kind: "full"`
(default) and uses `regions[]`, or `kind: "slotted"` and uses
`slots`.

> **Note:** the default-page synthesizer is the only render path for
> record detail pages. The legacy monolithic DetailView fallback and its
> `renderViaSchema` kill-switch (`objectDef.detail.renderViaSchema`,
> `?renderViaSchema=0`) were removed by ADR-0085 PR4.
