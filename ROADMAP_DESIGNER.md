# Designer UX Analysis & Improvement Plan

> **Last Updated:** February 16, 2026
> **Package:** `@object-ui/plugin-designer`
> **Source:** `packages/plugin-designer/src/`

## Executive Summary

All 5 designers in `@object-ui/plugin-designer` have functional foundations — component
palettes, canvas rendering, selection state, and basic CRUD — but need significant UX
polish to reach enterprise quality. Key gaps identified across the suite:

| Gap | Severity | Affected |
|-----|----------|----------|
| No actual drag-and-drop interaction | 🔴 Critical | Page, DataModel, Process, Report |
| Undo/Redo buttons rendered but non-functional | 🔴 Critical | Page (others lack even buttons) |
| Missing keyboard shortcuts | 🟠 High | All designers |
| Incomplete/read-only property editors | 🟠 High | Page, Report, Process |
| Missing accessibility (ARIA roles & labels) | 🟠 High | All designers |
| Hardcoded English strings (no i18n) | 🟡 Medium | All designers |
| No empty-state guidance | 🟡 Medium | Page, DataModel, Process |
| No confirmation dialogs for destructive actions | 🟡 Medium | All designers |
| Limited canvas interaction (no zoom/pan controls) | 🟡 Medium | DataModel, Process, Report |
| No connection status UI for collaboration | 🟠 High | CollaborationProvider |

This document provides a per-designer breakdown with specific file/line references and a
phased implementation plan.

---

## 1. Cross-Cutting Issues (All Designers)

### 1.1 Accessibility (WCAG 2.1 AA)

**Current state:** Zero `aria-*` or `role` attributes exist across all designer source files.

| Issue | Details |
|-------|---------|
| Missing `aria-label` on icon-only buttons | Delete buttons (e.g., `PageDesigner.tsx:185–193`, `DataModelDesigner.tsx:192–200`, `ProcessDesigner.tsx:238–246`, `ReportDesigner.tsx:245–253`) render only `<Trash2>` icons with no accessible name. Toolbar buttons for undo/redo (`PageDesigner.tsx:131–136`) and add-element buttons in ReportDesigner (`ReportDesigner.tsx:180–214`) likewise lack labels. |
| Missing `role` attributes on interactive regions | Canvas containers (`PageDesigner.tsx:150`, `DataModelDesigner.tsx:119`, `ProcessDesigner.tsx:162`), toolbars (`PageDesigner.tsx:128`, `ProcessDesigner.tsx:122`), and side panels (`PageDesigner.tsx:101`, `ViewDesigner.tsx:286`) have no semantic roles. |
| No keyboard focus indicators | No `:focus-visible` ring utilities are applied to any interactive element. The `cursor-move` class on canvas components (`PageDesigner.tsx:168`) provides a visual hint but no keyboard equivalent. |
| No `tabIndex` management | Canvas items cannot be reached via Tab key. Panels have no landmark structure. |
| No screen reader announcements | State changes (component added, entity deleted, connection status) produce no live-region announcements. |

**Recommended fix pattern:**
```tsx
// Toolbar
<div role="toolbar" aria-label="Page designer tools">

// Icon-only button
<button aria-label="Delete component" ...>
  <Trash2 className="h-3 w-3" />
</button>

// Canvas region
<div role="region" aria-label="Design canvas" tabIndex={0}>
```

### 1.2 Keyboard Shortcuts

**Current state:** No `onKeyDown` handlers exist in any designer file. Zero keyboard event handling.

| Shortcut | Expected Behavior | Status |
|----------|-------------------|--------|
| `Delete` / `Backspace` | Remove selected item | ❌ Missing |
| `Ctrl+Z` / `Cmd+Z` | Undo | ❌ Missing |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo | ❌ Missing |
| `Escape` | Deselect current item | ❌ Missing |
| `Arrow keys` | Fine-grained positioning (canvas designers) | ❌ Missing |
| `Tab` | Cycle between panels | ❌ Missing (no tabIndex) |
| `Ctrl+S` / `Cmd+S` | Save (ViewDesigner) | ❌ Missing |

**Recommended implementation:** Add a `useDesignerKeyboard` hook that attaches to the root container's `onKeyDown` and dispatches to the appropriate handler based on the active selection state.

### 1.3 Undo/Redo System

**Current state:** `PageDesigner` renders Undo (`Undo2`) and Redo (`Redo2`) buttons at line 131–136 when `undoRedo` prop is `true` (default via `index.tsx:39`). However, these buttons have no `onClick` handler — they are purely decorative.

No other designer renders undo/redo controls, and none maintain a history stack.

**Recommended architecture:**
```
useDesignerHistory<T>(initialState: T) => {
  state: T,
  setState: (next: T) => void,  // pushes to undo stack
  undo: () => void,
  redo: () => void,
  canUndo: boolean,
  canRedo: boolean,
}
```

Integration point: `CollaborationProvider.sendOperation()` (`CollaborationProvider.tsx:157–178`) should emit undo/redo operations for collaborative replay.

### 1.4 Empty States

**Current state:** Minimal text-only empty states:

| Designer | Location | Current Text |
|----------|----------|-------------|
| PageDesigner | `PageDesigner.tsx:214–215` | "No components added yet" |
| ViewDesigner (columns) | `ViewDesigner.tsx:354–361` | Icon + "No columns added yet" + "Add fields from the left panel to design your view" |
| ViewDesigner (fields) | `ViewDesigner.tsx:290–291` | "All fields added" |
| DataModelDesigner | — | No empty state rendered |
| ProcessDesigner | — | No empty state rendered |
| ReportDesigner | — | No empty state rendered (sections always present) |

ViewDesigner's empty state (`ViewDesigner.tsx:354–361`) is the best example — it includes a `Columns3` icon, primary text, and a guiding subtitle. All other designers should follow this pattern.

**Recommended pattern:**
```tsx
<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
  <IconComponent className="h-12 w-12 mb-3 opacity-40" />
  <p className="font-medium">No entities yet</p>
  <p className="text-xs mt-1">Click "Add Entity" to start designing your data model</p>
</div>
```

### 1.5 Confirmation Dialogs

**Current state:** All delete operations execute immediately with no confirmation:

| Designer | Delete Handler | Cascade Risk |
|----------|---------------|--------------|
| PageDesigner | `handleDeleteComponent` (line 86) | None |
| ViewDesigner | `handleRemoveColumn` (line 153) | Loses filter/sort referencing that column |
| DataModelDesigner | `handleDeleteEntity` (line 77) | **Deletes all relationships** referencing the entity (lines 81–82) |
| ProcessDesigner | `handleDeleteNode` (line 83) | **Deletes all edges** connected to the node (lines 87–88) |
| ReportDesigner | `handleDeleteElement` (line 110) | None |

The DataModelDesigner and ProcessDesigner cases are especially dangerous — a single accidental click can destroy multiple related items with no undo path.

### 1.6 Internationalization (i18n)

**Current state:** All user-visible strings are hardcoded English. Examples:

- `"Components"` — `PageDesigner.tsx:102`
- `"Component Tree"` — `PageDesigner.tsx:210`
- `"No components added yet"` — `PageDesigner.tsx:215`
- `"Available Fields"` — `ViewDesigner.tsx:287`
- `"Cancel"` / `"Save View"` — `ViewDesigner.tsx:269, 277`
- `"Add Entity"` / `"Add Relationship"` — `DataModelDesigner.tsx:107, 112`
- `"Data Model Designer"` — `DataModelDesigner.tsx:99`
- `"Add Start Event"` / `"Add User Task"` — `ProcessDesigner.tsx:131, 137`
- `"Properties"` — `ReportDesigner.tsx:267`
- `"Select an element to view properties"` — `ReportDesigner.tsx:275`

**Recommendation:** All strings should be routed through the `resolveI18nLabel` utility from `@object-ui/core` (or a future `@object-ui/i18n` package) with a `designer.` namespace prefix.

### 1.7 Responsive Design

**Current state:** Side panels use fixed Tailwind width classes:

| Panel | File | Line | Class |
|-------|------|------|-------|
| PageDesigner — left palette | `PageDesigner.tsx` | 101 | `w-60` |
| PageDesigner — right tree | `PageDesigner.tsx` | 207 | `w-60` |
| ViewDesigner — left fields | `ViewDesigner.tsx` | 286 | `w-56` |
| ViewDesigner — right properties | `ViewDesigner.tsx` | 443 | `w-64` |
| DataModelDesigner — entity cards | `DataModelDesigner.tsx` | 173 | `w-60` |
| ReportDesigner — right properties | `ReportDesigner.tsx` | 266 | `w-56` |

None of these panels are collapsible, resizable, or responsive. On smaller viewports, the canvas area becomes unusably narrow.

**Recommendation:** Wrap panels in a `CollapsiblePanel` component with a toggle button. Use `min-w` and `max-w` constraints instead of fixed `w-*`, and add responsive breakpoints to auto-collapse panels below `lg`.

---

## 2. PageDesigner Analysis

**File:** `packages/plugin-designer/src/PageDesigner.tsx` (287 lines)
**Registration:** `index.tsx:29–43` as `'page-designer'`

### Current State

- Left panel: Component palette with 3 categories (Layout, Form, Data) — `lines 100–122`
- Center: Canvas with grid background, static component boxes — `lines 149–201`
- Toolbar: Undo/Redo buttons, Preview button, zoom percentage display — `lines 128–146`
- Right panel: Component tree with selection, read-only property display — `lines 206–256`
- Zoom state tracked (`useState` at line 61) and applied to canvas/components, but no UI controls to change it

### Issues (Priority Order)

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | 🔴 Critical | **No drag-and-drop** — Components show `cursor-move` (line 168) but have no drag handlers; they cannot be repositioned after placement | `lines 164–200` |
| 2 | 🔴 Critical | **Undo/Redo non-functional** — Buttons rendered (lines 131–136) with `title` but no `onClick` handler | `lines 131–136` |
| 3 | 🟠 High | **No zoom controls** — Zoom percentage displayed (line 145) but user cannot change it; no slider, buttons, or scroll-to-zoom | `line 61, 145` |
| 4 | 🟠 High | **No component resize handles** — Component size is set at creation (line 73) and never adjustable | `lines 72–74` |
| 5 | 🟠 High | **Property panel is read-only** — Shows Type, ID, Position, Size as plain text; no editable fields | `lines 233–256` |
| 6 | 🟡 Medium | **No keyboard shortcuts** — No `onKeyDown` handler on any element | entire file |
| 7 | 🟡 Medium | **Missing aria-labels** — Icon-only buttons (Undo, Redo, Preview, Delete) have `title` but no `aria-label` | `lines 131, 134, 140, 185–193` |
| 8 | 🟡 Medium | **Weak empty state** — "No components added yet" with no icon or guidance | `lines 213–216` |
| 9 | 🟢 Low | **No delete confirmation** — `handleDeleteComponent` (line 86) executes immediately | `lines 86–95` |
| 10 | 🟢 Low | **Fixed panel widths** — Both panels use `w-60` | `lines 101, 207` |

### Recommended Improvements (Implementable Now)

1. Add `aria-label` to all icon-only buttons (Undo, Redo, Preview, Delete per component)
2. Add `role="toolbar"` to the toolbar div, `role="region"` + `aria-label` to panels and canvas
3. Add `onKeyDown` on the root container: `Delete` → remove selected, `Escape` → deselect
4. Enhance empty state with an icon and instructional text
5. Add zoom increment/decrement buttons (`ZoomIn`, `ZoomOut` from lucide-react)
6. Add `onClick` stubs to Undo/Redo buttons (disabled state until history is implemented)

---

## 3. ViewDesigner Analysis

**File:** `packages/plugin-designer/src/ViewDesigner.tsx` (~550+ lines, largest designer)
**Registration:** `index.tsx:97–112` as `'view-designer'`

### Current State

This is the **most complete** designer:
- Left panel: Field palette showing unused fields with type badges — `lines 284–308`
- Center: View type selector (7 types with icons), view name input, column list — `lines 312–437`
- Right panel: 4-tab property editor (Columns, Filters, Sort, Options) — `lines 442–end`
- Save/Cancel buttons producing a full `ViewDesignerConfig` output — `lines 264–280`
- Column reorder via ArrowUp/ArrowDown buttons — dedicated handler functions
- Column visibility toggle, filter operators (`=`, `contains`, `>`, `<`, etc.), sort direction control

### Issues (Priority Order)

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | 🟠 High | **No drag-to-reorder** — Column reordering uses up/down buttons only; no drag handle despite `GripVertical` import (line 12) | `lines 367–436` |
| 2 | 🟠 High | **No keyboard shortcuts** — No `Ctrl+S` to save, no `Escape` to cancel | entire file |
| 3 | 🟡 Medium | **Column width has no validation** — Free-text input for column `width` accepts any string with no min/max/pattern check | right panel column tab |
| 4 | 🟡 Medium | **Missing ARIA on tabs** — Tab buttons (lines 446–459) have no `role="tablist"`, `role="tab"`, or `aria-selected` | `lines 445–460` |
| 5 | 🟡 Medium | **No undo/redo** — Column additions, removals, reorders have no history | entire file |
| 6 | 🟢 Low | **Plain empty states** — `"All fields added"` (line 291) is functional but lacks visual emphasis | `lines 289–292` |
| 7 | 🟢 Low | **No transition animations** — Column add/remove/reorder is instant with no visual feedback | entire file |

### Recommended Improvements (Implementable Now)

1. Add `role="tablist"` to the tab container (`line 445`), `role="tab"` + `aria-selected` to each tab button
2. Add `role="tabpanel"` to the active tab content area
3. Add `aria-label` to icon-only buttons (eye/eyeOff visibility, arrows, delete)
4. Add `aria-label` to the view type buttons for screen readers
5. Improve `"All fields added"` empty state with a checkmark icon and different styling

---

## 4. DataModelDesigner Analysis

**File:** `packages/plugin-designer/src/DataModelDesigner.tsx` (225 lines)
**Registration:** `index.tsx:45–59` as `'data-model-designer'`

### Current State

- Toolbar: Database icon, "Add Entity" button, "Add Relationship" button — `lines 96–116`
- Canvas: Grid background (`radial-gradient`) with SVG overlay for relationship lines — `lines 119–166`
- Entity cards: Color-coded headers, field list with type/key/required indicators — `lines 168–218`
- Relationship lines: SVG `<line>` elements with optional labels, dashed for many-to-many — `lines 137–165`
- Delete: Cascading delete removes entity + all referencing relationships — `lines 77–91`

### Issues (Priority Order)

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | 🔴 Critical | **No drag-to-move** — Entity cards have `absolute` positioning (line 178) but no drag handlers; position is set only at creation (line 69) | `lines 168–218` |
| 2 | 🔴 Critical | **"Add Relationship" non-functional** — Button rendered (lines 109–113) but has no `onClick` handler | `lines 109–113` |
| 3 | 🟠 High | **SVG lines not interactive** — Relationship lines are inside a `pointer-events-none` SVG (line 133); cannot be clicked, edited, or deleted | `lines 132–166` |
| 4 | 🟠 High | **Entity labels not editable** — Label is displayed (line 190) but not editable in-place; set only at creation time as `"New Entity N"` (line 63) | `line 63, 190` |
| 5 | 🟠 High | **No zoom/pan** — Canvas has fixed dimensions (`canvas.width`/`canvas.height`) with overflow scroll (line 119) but no zoom controls | `lines 119–130` |
| 6 | 🟡 Medium | **No keyboard shortcuts** — No key handlers | entire file |
| 7 | 🟡 Medium | **No delete confirmation** — Entity deletion cascades to relationships (lines 81–82) with zero warning | `lines 77–91` |
| 8 | 🟡 Medium | **Missing accessibility** — Zero ARIA attributes | entire file |
| 9 | 🟡 Medium | **No empty state** — When no entities exist, the canvas is just an empty grid with no guidance | `lines 119–221` |
| 10 | 🟢 Low | **Emoji for field indicators** — Uses `🔑` for primary key (line 211) instead of a Lucide icon | `line 211` |

### Recommended Improvements (Implementable Now)

1. Add `aria-label` to "Add Entity", "Add Relationship", and all delete buttons
2. Add `role="region"` + `aria-label="ER diagram canvas"` to the canvas container
3. Add a `title` tooltip or `disabled` state to the "Add Relationship" button explaining it is not yet functional
4. Add `onKeyDown` on the root: `Delete` → remove selected entity (with future confirmation), `Escape` → deselect
5. Add empty state rendering when `entities.length === 0`
6. Replace 🔑 emoji with `<Key>` Lucide icon for consistency

---

## 5. ProcessDesigner Analysis

**File:** `packages/plugin-designer/src/ProcessDesigner.tsx` (254 lines)
**Registration:** `index.tsx:61–77` as `'process-designer'`

### Current State

- Toolbar: Process name, quick-add buttons for 4 node types (Start, Task, Gateway, End) — `lines 121–158`
- Canvas: Grid background with SVG edge overlay using arrowhead markers — `lines 161–210`
- Nodes: Color-coded shapes (green circle, blue rectangle, yellow diamond, red circle) — `lines 97–116, 212–248`
- Edges: SVG `<line>` elements with `markerEnd="url(#arrowhead)"` — `lines 192–209`
- Delete: Cascading delete removes node + connected edges — `lines 83–95`

### Issues (Priority Order)

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | 🔴 Critical | **No edge creation UI** — Edges are only renderable from initial data; users cannot draw connections between nodes | entire file |
| 2 | 🔴 Critical | **No drag-to-move** — Nodes are positioned absolutely (lines 217–219) but have no drag handlers | `lines 213–248` |
| 3 | 🟠 High | **No node property editing** — Clicking a node selects it (line 221) but there is no property panel to edit node label, type, or assignee | entire file |
| 4 | 🟠 High | **No conditional flow UI** — Edges have no condition labels, expression editors, or visual differentiation for conditional vs. default flows | `lines 192–209` |
| 5 | 🟠 High | **No lane/swimlane rendering** — BPMN lanes are not supported despite being a core BPMN 2.0 concept | entire file |
| 6 | 🟡 Medium | **No keyboard shortcuts** — No key handlers | entire file |
| 7 | 🟡 Medium | **Hardcoded colors** — Node styles use hardcoded Tailwind colors (e.g., `bg-green-100`, `bg-blue-100`) instead of theme tokens | `lines 97–116` |
| 8 | 🟡 Medium | **Missing accessibility** — SVG has `pointer-events-none` (line 176); no ARIA attributes anywhere | `lines 175–176` |
| 9 | 🟡 Medium | **No empty state** — Empty canvas shows nothing | `lines 161–250` |
| 10 | 🟢 Low | **No process validation** — No checks for orphaned nodes, missing start/end events, or unreachable paths | entire file |

### Recommended Improvements (Implementable Now)

1. Add `aria-label` to all toolbar buttons and delete buttons
2. Add `role="region"` + `aria-label="Process diagram canvas"` to the canvas container
3. Add `onKeyDown` on root: `Delete` → remove selected node, `Escape` → deselect
4. Add empty state when `nodes.length === 0`
5. Add `title` attributes to toolbar buttons documenting node type semantics

---

## 6. ReportDesigner Analysis

**File:** `packages/plugin-designer/src/ReportDesigner.tsx` (283 lines)
**Registration:** `index.tsx:79–95` as `'report-designer'`

### Current State

- Toolbar: Report name, object name, page size selector (A4/A3/Letter/Legal/Tabloid), orientation — `lines ~140–165`
- Canvas: White page with sections (Header, Page Header, Group Header, Detail, Group Footer, Page Footer, Footer) — `lines ~166–260`
- Elements: Absolutely positioned within sections with type-specific labels — `lines 220–256`
- Add buttons: 5 icon-only buttons per section (Text, Field, Image, Chart, Table) — `lines 178–215`
- Property panel: Shows only `Element ID: {selectedElement}` — `lines 265–280`
- Delete: Small destructive circle button on selected element — `lines 244–254`

### Issues (Priority Order)

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | 🔴 Critical | **Elements not draggable** — Positioned with `style={{ left, top }}` (lines 229–234) but have no drag interaction; position fixed at creation | `lines 220–256` |
| 2 | 🔴 Critical | **No element resize handles** — Width/height set at creation and never adjustable | `lines 229–234` |
| 3 | 🟠 High | **Property panel nearly empty** — Only shows `Element ID: {selectedElement}` (line 271); does not display or allow editing of element type, text content, field binding, dimensions, font, or style | `lines 268–277` |
| 4 | 🟠 High | **Section heights not adjustable** — Section `height` is used directly (line 219) with no resize handle or input | `line 219` |
| 5 | 🟡 Medium | **No keyboard shortcuts** — No key handlers | entire file |
| 6 | 🟡 Medium | **Add buttons are small and cramped** — 5 buttons with `p-0.5` padding in a tight row (lines 179–215); easy to misclick | `lines 179–215` |
| 7 | 🟡 Medium | **Missing accessibility** — Icon-only add buttons have `title` but no `aria-label`; no roles on canvas or panels | `lines 180–214, 265–280` |
| 8 | 🟡 Medium | **Emoji for element indicators** — Uses 🖼, 📊, 📋 emojis for Image, Chart, Table elements (lines 240–242) | `lines 240–242` |
| 9 | 🟢 Low | **No page margin indicators** — Margins are tracked in state but not visualized on the canvas | `margins` state |
| 10 | 🟢 Low | **Inline styles on elements** — `style={{ left, top, width, height }}` (lines 229–234) is necessary for absolute positioning but conflicts with Tailwind-only rule; consider a utility wrapper | `lines 229–234` |

### Recommended Improvements (Implementable Now)

1. Add `aria-label` to all icon-only add buttons and delete buttons
2. Expand property panel to show element type, position (x, y), size (w, h), and type-specific properties (text for text elements, field name for field elements)
3. Add `role="region"` to canvas and property panel
4. Add `onKeyDown` on root: `Delete` → remove selected element, `Escape` → deselect
5. Replace emoji indicators with Lucide icons (`ImageIcon`, `BarChart3`, `Table2`) — these are already imported (line 16 area)
6. Increase add-button hit targets from `p-0.5` to `p-1`

---

## 7. CollaborationProvider Analysis

**File:** `packages/plugin-designer/src/CollaborationProvider.tsx` (216 lines)
**Registration:** Exported but not registered in `ComponentRegistry` (it's a provider, not a visual component)

### Current State

- WebSocket connection management with URL validation (`ws:`/`wss:` only) — `lines 72–80`
- Connection state machine: `disconnected` → `connecting` → `connected` / `error` — `line 61`
- Presence tracking: Remote users via `'presence'` WebSocket messages — `lines 101–104`
- Operation broadcasting: `sendOperation()` sends `CollaborationOperation` via WebSocket — `lines 157–178`
- Auto-reconnect: On `ws.onclose`, reconnects after `autoSaveInterval` delay — `lines 113–119`
- User color generation: Hash-based color from 8-color palette — `lines 206–216`
- React context: `CollabCtx` provider + `useCollaboration()` hook — `lines 27, 199–201`

### Issues (Priority Order)

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | 🔴 Critical | **No connection status UI** — `connectionState` is tracked (line 61) but no visual component is exported for designers to show connection status | entire file |
| 2 | 🟠 High | **Error states not surfaced** — `ws.onerror` sets state to `'error'` (lines 122–124) but no error message or recovery UI is provided | `lines 122–124` |
| 3 | 🟠 High | **No conflict resolution UI** — When concurrent operations conflict, there is no merge strategy or user-facing resolution dialog | entire file |
| 4 | 🟡 Medium | **Only 8 user colors** — `generateColor` uses 8 hardcoded colors (lines 207–210); sessions with >8 users will have duplicates | `lines 206–216` |
| 5 | 🟡 Medium | **No presence cursor implementation** — `users` array is provided but no cursor-position component renders remote user cursors on the canvas | `lines 142–153` |
| 6 | 🟡 Medium | **No version history display** — `versionCount` is tracked (line 62, 188) but no UI exists to browse or restore versions | `lines 62, 188` |
| 7 | 🟢 Low | **No heartbeat/keep-alive** — Connection relies solely on WebSocket protocol ping/pong; no application-level heartbeat | entire file |
| 8 | 🟢 Low | **No typing indicators** — No mechanism to broadcast or display "user is editing" state | entire file |

### Recommended Improvements (Implementable Now)

1. **Export a `ConnectionStatusIndicator` component** — A small pill/badge showing connection state:
   ```tsx
   export function ConnectionStatusIndicator() {
     const collab = useCollaboration();
     if (!collab) return null;
     const colors = { connected: 'bg-green-500', connecting: 'bg-yellow-500', error: 'bg-red-500', disconnected: 'bg-gray-400' };
     return (
       <div className="flex items-center gap-1.5 text-xs">
         <div className={cn('h-2 w-2 rounded-full', colors[collab.connectionState])} />
         <span className="capitalize">{collab.connectionState}</span>
       </div>
     );
   }
   ```
2. **Expand color palette to 16+ colors** for better user differentiation
3. **Document the integration pattern** — How each designer should wire `sendOperation()` to its state changes and render remote presence

---

## 8. Implementation Phases

### Phase 1: Accessibility & Polish (Current Sprint)

- [x] Add `aria-label` to all icon-only buttons across all 5 designers
- [x] Add `role` attributes (`toolbar`, `region`, `tablist`, `tab`, `tabpanel`) to interactive containers
- [x] Add `aria-selected` to ViewDesigner tab buttons
- [x] Add keyboard shortcut handler (`Delete`, `Escape`) to all designers
- [x] Improve empty states with icons and guidance text in PageDesigner, DataModelDesigner, ProcessDesigner
- [x] Add zoom increment/decrement buttons to PageDesigner
- [x] Expand ReportDesigner property panel to show element type and basic properties
- [x] Export `ConnectionStatusIndicator` from CollaborationProvider
- [x] Disable or add tooltip to DataModelDesigner "Add Relationship" button
- [x] Replace emoji indicators (🔑, 🖼, 📊, 📋) with Lucide icons

**Estimated effort:** 3–5 developer days

### Phase 2: Interaction Layer (Next Sprint)

- [ ] Implement drag-and-drop for canvas elements using `@dnd-kit/core` (shared with `@object-ui/react`'s `DndProvider`)
  - PageDesigner: Component drag-to-reorder and drag-to-position
  - ViewDesigner: Column drag-to-reorder
  - DataModelDesigner: Entity drag-to-move
  - ProcessDesigner: Node drag-to-move
  - ReportDesigner: Element drag-to-reposition within sections
- [ ] Implement undo/redo via `useDesignerHistory` hook (command pattern with undo/redo stacks)
- [ ] Add confirmation dialogs for destructive actions (delete entity with cascade, delete node with cascade)
- [ ] Implement edge creation UI in ProcessDesigner (click source port → click target port)
- [ ] Add inline editing for entity labels in DataModelDesigner
- [ ] Add property editing for node labels/types in ProcessDesigner

**Estimated effort:** 8–12 developer days

### Phase 3: Advanced Features (Q2 2026)

- [ ] Full property editors for all designers:
  - PageDesigner: Component props editor (type-aware)
  - ProcessDesigner: Task assignment, timer config, script editor
  - ReportDesigner: Font/color/alignment controls, expression builder for calculated fields
- [ ] i18n integration: Route all hardcoded strings through `resolveI18nLabel` with `designer.*` namespace
- [ ] Canvas pan/zoom with minimap:
  - Scroll-to-zoom, Ctrl+drag to pan
  - Minimap in bottom-right corner showing viewport position
- [ ] Auto-layout algorithms:
  - DataModelDesigner: Force-directed layout for entity positioning
  - ProcessDesigner: Dagre/ELK layout for workflow arrangement
- [ ] Copy/paste support (`Ctrl+C`/`Ctrl+V`) for components, entities, nodes
- [ ] Multi-select (`Ctrl+Click`, `Shift+Click`) and bulk operations (delete, move, align)
- [ ] Responsive panel layout with collapsible panels and saved panel state

**Estimated effort:** 15–25 developer days

### Phase 4: Collaboration Integration (Q3 2026)

- [ ] Wire `CollaborationProvider` into each designer's state management
  - Each state mutation calls `sendOperation()` with a typed operation payload
  - Remote operations applied to local state via operation transformer
- [ ] Live cursor positions:
  - Export `PresenceCursors` component rendering colored cursors with user name labels
  - Each designer broadcasts cursor position on `mousemove` (throttled to 50ms)
- [ ] Operation-based undo/redo sync:
  - Local undo generates an inverse operation broadcast to collaborators
  - Remote undo operations are applied in order
- [ ] Conflict resolution UI:
  - Detect conflicting operations (e.g., two users editing the same entity)
  - Show merge dialog with "Keep mine" / "Keep theirs" / "Merge" options
- [ ] Version history browser:
  - Timeline UI showing operation history
  - Click to preview any past version
  - "Restore to this version" action

**Estimated effort:** 20–30 developer days

---

## 9. Success Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|---------|----------------|----------------|----------------|
| WCAG 2.1 AA compliance | 0% | 80% | 95% | 100% |
| Keyboard navigable | ❌ No | ⚠️ Partial | ✅ Full | ✅ Full |
| Undo/Redo functional | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| Drag-and-drop functional | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| i18n ready | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Responsive panels | ❌ No | ❌ No | ⚠️ Partial | ✅ Yes |
| Collaboration connected | ❌ No | ⚠️ Status only | ⚠️ Status only | ✅ Full |
| Property editors complete | ~15% | ~25% | ~50% | ~90% |
| Empty state guidance | 1/5 | 5/5 | 5/5 | 5/5 |
| Confirmation on destructive actions | 0/5 | 0/5 | 5/5 | 5/5 |

---

## 10. Field Type Evaluation for Form Designer

> **Last Updated:** February 16, 2026
> **Related Packages:** `@object-ui/fields`, `@object-ui/types`, `@object-ui/plugin-designer`

### 10.1 Overview

The `@object-ui/fields` package provides **36 field widget implementations** covering
text, numeric, date/time, selection, file, contact, computed, and visual field types.
The `@object-ui/types` package defines **35 typed metadata interfaces** in
`field-types.ts` plus a `FieldMetadata` union type. However, the designer components
in `@object-ui/plugin-designer` expose only a **fraction** of these field types to
users, creating a significant gap between available capabilities and designer UX.

### 10.2 Complete Field Type Inventory

The table below catalogs all field types available in `@object-ui/fields`, their
corresponding type definitions in `@object-ui/types`, and their current status in
each designer.

#### Category: Basic Text

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `text` | `TextField.tsx` | `TextFieldMetadata` | `TextCellRenderer` | `field:text` | ✅ Default | `input` |
| `textarea` | `TextAreaField.tsx` | `TextareaFieldMetadata` | `TextCellRenderer` | `field:textarea` | ❌ | `textarea` |
| `markdown` | `RichTextField.tsx` | `MarkdownFieldMetadata` | `TextCellRenderer` | `field:markdown` | ❌ | ❌ |
| `html` | `RichTextField.tsx` | `HtmlFieldMetadata` | `TextCellRenderer` | `field:html` | ❌ | ❌ |
| `code` | `CodeField.tsx` | `CodeFieldMetadata` | — | — | ❌ | ❌ |

#### Category: Numeric

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `number` | `NumberField.tsx` | `NumberFieldMetadata` | `NumberCellRenderer` | `field:number` | ❌ | ❌ |
| `currency` | `CurrencyField.tsx` | `CurrencyFieldMetadata` | `CurrencyCellRenderer` | `field:currency` | ❌ | ❌ |
| `percent` | `PercentField.tsx` | `PercentFieldMetadata` | `PercentCellRenderer` | `field:percent` | ❌ | ❌ |
| `slider` | `SliderField.tsx` | `SliderFieldMetadata` | — | — | ❌ | ❌ |
| `rating` | `RatingField.tsx` | `RatingFieldMetadata` | — | — | ❌ | ❌ |

#### Category: Date & Time

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `date` | `DateField.tsx` | `DateFieldMetadata` | `DateCellRenderer` | `field:date` | ❌ | ❌ |
| `datetime` | `DateTimeField.tsx` | `DateTimeFieldMetadata` | `DateTimeCellRenderer` | `field:datetime` | ✅ (default entity) | ❌ |
| `time` | `TimeField.tsx` | `TimeFieldMetadata` | `TextCellRenderer` | `field:time` | ❌ | ❌ |

#### Category: Selection & Lookup

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `boolean` | `BooleanField.tsx` | `BooleanFieldMetadata` | `BooleanCellRenderer` | `field:boolean` | ❌ | `checkbox` |
| `select` | `SelectField.tsx` | `SelectFieldMetadata` | `SelectCellRenderer` | `field:select` | ❌ | `select` |
| `lookup` | `LookupField.tsx` | `LookupFieldMetadata` | `LookupCellRenderer` | `field:lookup` | ❌ | ❌ |
| `master_detail` | `MasterDetailField.tsx` | `MasterDetailFieldMetadata` | `LookupCellRenderer` | `field:master_detail` | ❌ | ❌ |

#### Category: Contact & Identity

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `email` | `EmailField.tsx` | `EmailFieldMetadata` | `EmailCellRenderer` | `field:email` | ❌ | ❌ |
| `phone` | `PhoneField.tsx` | `PhoneFieldMetadata` | `PhoneCellRenderer` | `field:phone` | ❌ | ❌ |
| `url` | `UrlField.tsx` | `UrlFieldMetadata` | `UrlCellRenderer` | `field:url` | ❌ | ❌ |
| `password` | `PasswordField.tsx` | `PasswordFieldMetadata` | *(masked)* | `field:password` | ❌ | ❌ |
| `user` | `UserField.tsx` | `UserFieldMetadata` | `UserCellRenderer` | — | ❌ | ❌ |
| `avatar` | `AvatarField.tsx` | `AvatarFieldMetadata` | — | — | ❌ | ❌ |

#### Category: File & Media

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `file` | `FileField.tsx` | `FileFieldMetadata` | `FileCellRenderer` | `field:file` | ❌ | ❌ |
| `image` | `ImageField.tsx` | `ImageFieldMetadata` | `ImageCellRenderer` | `field:image` | ❌ | ❌ |
| `signature` | `SignatureField.tsx` | `SignatureFieldMetadata` | — | — | ❌ | ❌ |
| `qrcode` | `QRCodeField.tsx` | `QRCodeFieldMetadata` | — | — | ❌ | ❌ |

#### Category: Location & Address

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `location` | `LocationField.tsx` | `LocationFieldMetadata` | `TextCellRenderer` | `field:location` | ❌ | ❌ |
| `address` | `AddressField.tsx` | `AddressFieldMetadata` | — | — | ❌ | ❌ |
| `geolocation` | `GeolocationField.tsx` | `GeolocationFieldMetadata` | — | — | ❌ | ❌ |

#### Category: Computed & Auto-generated

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `formula` | `FormulaField.tsx` | `FormulaFieldMetadata` | `FormulaCellRenderer` | `field:formula` | ❌ | ❌ |
| `summary` | `SummaryField.tsx` | `SummaryFieldMetadata` | `FormulaCellRenderer` | `field:summary` | ❌ | ❌ |
| `auto_number` | `AutoNumberField.tsx` | `AutoNumberFieldMetadata` | `TextCellRenderer` | `field:auto_number` | ❌ | ❌ |

#### Category: Complex & Visual

| Field Type | Widget File | Type Interface | Cell Renderer | Form Mapper | DataModel | Page Palette |
|------------|-------------|----------------|---------------|-------------|-----------|--------------|
| `object` | `ObjectField.tsx` | `ObjectFieldMetadata` | *[Object]* | — | ❌ | ❌ |
| `vector` | `VectorField.tsx` | `VectorFieldMetadata` | *[Vector]* | — | ❌ | ❌ |
| `grid` | `GridField.tsx` | `GridFieldMetadata` | *[Grid]* | — | ❌ | ❌ |
| `color` | `ColorField.tsx` | `ColorFieldMetadata` | — | — | ❌ | ❌ |

### 10.3 Gap Analysis by Designer

#### DataModelDesigner

**Current state:** When a field is added via `handleAddField` (`DataModelDesigner.tsx:258`),
the type is hardcoded to `'text'`. The field type is displayed as a plain text label
(`DataModelDesigner.tsx:712`) but there is **no UI to change the field type** after
creation. The inline editing mode (`DataModelDesigner.tsx:273–306`) only supports
editing the field name.

**`DataModelField.type`** in `@object-ui/types` (`designer.ts:156`) is typed as a
generic `string`, not a union of valid `@object-ui/fields` types. This means:
- No TypeScript-level validation of field type values
- No autocomplete assistance for developers
- No compile-time guarantee that a field type maps to an existing widget

**Key gaps:**
1. No field type selector dropdown when adding/editing fields
2. No reuse of `FieldMetadata` union type from `@object-ui/types/field-types.ts`
3. No visual distinction between field types (icons, colors, badges)
4. Default entity template only includes `uuid` and `datetime` — no standard business fields

#### PageDesigner

**Current state:** The `DEFAULT_PALETTE` (`PageDesigner.tsx:740–773`) contains 14
generic component types across 3 categories (Layout, Form, Data). The Form category
has only 5 items: `input`, `textarea`, `select`, `checkbox`, `button`.

**Key gaps:**
1. Form palette uses generic HTML-like type names (`input`, `checkbox`) rather than
   `@object-ui/fields` type names (`text`, `boolean`, `email`, `phone`)
2. Missing a dedicated **Fields** palette category showcasing all 36 field widgets
3. No mapping between palette items and `@object-ui/fields` `FieldWidgetProps` interface
4. No preview rendering using actual field widgets from `@object-ui/fields`

#### ViewDesigner

**Current state:** The ViewDesigner shows field types as plain text badges
(`ViewDesigner.tsx:533`). It relies on the `availableFields` prop to receive
`Array<{ name: string; label: string; type: string }>` from the parent. Type display
is the most complete among designers, but still lacks visual indicators.

**Key gaps:**
1. Field type badges are plain text with no icons or colors per type
2. No field type grouping/categorization in the Available Fields panel
3. No type-specific column configuration (e.g., currency format, date format)

### 10.4 Recommended `DESIGNER_FIELD_TYPES` Constant

A centralized constant should be created to define all available field types for
designer selection, leveraging the `FieldMetadata` union type from `@object-ui/types`.

**Proposed location:** `packages/plugin-designer/src/constants/fieldTypes.ts`

```typescript
import type { LucideIcon } from 'lucide-react';
import {
  Type, Hash, Calendar, Clock, ToggleLeft, List,
  Link, Mail, Phone, Globe, Lock, File, Image,
  MapPin, Home, Navigation, Calculator, Sigma, Binary,
  User, Palette, Code2, Star, PenTool, QrCode,
  Grid3X3, Braces, Database as DatabaseIcon, SlidersHorizontal,
} from 'lucide-react';

export interface DesignerFieldTypeOption {
  /** Field type identifier — matches @object-ui/fields registry key */
  type: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Category for grouping in palette/dropdown */
  category: 'text' | 'number' | 'datetime' | 'selection' | 'contact'
           | 'file' | 'location' | 'computed' | 'complex' | 'visual';
  /** Short description for tooltips */
  description: string;
}

export const DESIGNER_FIELD_TYPES: DesignerFieldTypeOption[] = [
  // Text
  { type: 'text', label: 'Text', icon: Type, category: 'text',
    description: 'Single-line text input' },
  { type: 'textarea', label: 'Long Text', icon: Type, category: 'text',
    description: 'Multi-line text area' },
  { type: 'markdown', label: 'Markdown', icon: Code2, category: 'text',
    description: 'Markdown-formatted rich text' },
  { type: 'html', label: 'Rich Text', icon: Code2, category: 'text',
    description: 'HTML rich text editor' },
  { type: 'code', label: 'Code', icon: Code2, category: 'text',
    description: 'Code editor with syntax highlighting' },

  // Number
  { type: 'number', label: 'Number', icon: Hash, category: 'number',
    description: 'Numeric input with precision control' },
  { type: 'currency', label: 'Currency', icon: Hash, category: 'number',
    description: 'Monetary value with currency symbol' },
  { type: 'percent', label: 'Percent', icon: Hash, category: 'number',
    description: 'Percentage value with progress bar' },
  { type: 'slider', label: 'Slider', icon: SlidersHorizontal, category: 'number',
    description: 'Numeric range slider' },
  { type: 'rating', label: 'Rating', icon: Star, category: 'number',
    description: 'Star rating input' },

  // Date & Time
  { type: 'date', label: 'Date', icon: Calendar, category: 'datetime',
    description: 'Date picker' },
  { type: 'datetime', label: 'Date & Time', icon: Calendar, category: 'datetime',
    description: 'Date and time picker' },
  { type: 'time', label: 'Time', icon: Clock, category: 'datetime',
    description: 'Time picker' },

  // Selection
  { type: 'boolean', label: 'Boolean', icon: ToggleLeft, category: 'selection',
    description: 'True/false toggle' },
  { type: 'select', label: 'Select', icon: List, category: 'selection',
    description: 'Dropdown with predefined options' },
  { type: 'lookup', label: 'Lookup', icon: Link, category: 'selection',
    description: 'Reference to another object' },
  { type: 'master_detail', label: 'Master-Detail', icon: Link, category: 'selection',
    description: 'Parent-child relationship with cascade delete' },

  // Contact
  { type: 'email', label: 'Email', icon: Mail, category: 'contact',
    description: 'Email address with validation' },
  { type: 'phone', label: 'Phone', icon: Phone, category: 'contact',
    description: 'Phone number input' },
  { type: 'url', label: 'URL', icon: Globe, category: 'contact',
    description: 'Web address with validation' },
  { type: 'password', label: 'Password', icon: Lock, category: 'contact',
    description: 'Masked password input' },
  { type: 'user', label: 'User', icon: User, category: 'contact',
    description: 'User reference with avatar' },
  { type: 'avatar', label: 'Avatar', icon: User, category: 'contact',
    description: 'User avatar image' },

  // File & Media
  { type: 'file', label: 'File', icon: File, category: 'file',
    description: 'File upload with type/size validation' },
  { type: 'image', label: 'Image', icon: Image, category: 'file',
    description: 'Image upload with preview' },
  { type: 'signature', label: 'Signature', icon: PenTool, category: 'file',
    description: 'Digital signature capture' },
  { type: 'qrcode', label: 'QR Code', icon: QrCode, category: 'file',
    description: 'QR code generator/scanner' },

  // Location
  { type: 'location', label: 'Location', icon: MapPin, category: 'location',
    description: 'Map-based location picker' },
  { type: 'address', label: 'Address', icon: Home, category: 'location',
    description: 'Structured address fields' },
  { type: 'geolocation', label: 'Geolocation', icon: Navigation, category: 'location',
    description: 'GPS coordinates input' },

  // Computed
  { type: 'formula', label: 'Formula', icon: Calculator, category: 'computed',
    description: 'Calculated field from expression' },
  { type: 'summary', label: 'Summary', icon: Sigma, category: 'computed',
    description: 'Roll-up aggregation from related records' },
  { type: 'auto_number', label: 'Auto Number', icon: Binary, category: 'computed',
    description: 'Auto-incrementing number' },

  // Complex
  { type: 'object', label: 'Object', icon: Braces, category: 'complex',
    description: 'Nested JSON object' },
  { type: 'vector', label: 'Vector', icon: DatabaseIcon, category: 'complex',
    description: 'Embedding vector for AI/ML' },
  { type: 'grid', label: 'Grid', icon: Grid3X3, category: 'complex',
    description: 'Inline sub-table/spreadsheet' },
  { type: 'color', label: 'Color', icon: Palette, category: 'visual',
    description: 'Color picker' },
];
```

### 10.5 Integration Plan per Designer

#### DataModelDesigner — Field Type Selector

Add a `<select>` dropdown next to each field's type display, populated from
`DESIGNER_FIELD_TYPES`. When a field type is changed, update the entity's field
array via `pushState()`.

**Implementation points:**
- Replace the read-only `{field.type}` span (`DataModelDesigner.tsx:712`) with a
  `<select>` element grouped by `category`
- Add an `onChangeFieldType(entityId, fieldIndex, newType)` handler
- Show field type icons in the property editor panel when an entity is selected
- Update the type of `DataModelField.type` in `@object-ui/types/designer.ts` to
  reference the `FieldMetadata` union's type discriminant for type safety

#### PageDesigner — Fields Palette Category

Add a fourth palette category **"Fields"** to `DEFAULT_PALETTE`, populated from
`DESIGNER_FIELD_TYPES`. Each palette item should map to the corresponding
`@object-ui/fields` widget via `ComponentRegistry.resolve('field:<type>')`.

**Proposed palette addition:**
```typescript
{
  name: 'fields',
  label: 'Fields',
  items: DESIGNER_FIELD_TYPES.map(ft => ({
    type: `field:${ft.type}`,
    label: ft.label,
    icon: ft.icon.name,
    defaultSize: { width: 300, height: 60 },
    defaultProps: { fieldType: ft.type },
  })),
}
```

**Implementation points:**
- Import `DESIGNER_FIELD_TYPES` from `./constants/fieldTypes`
- Render field type icons in palette items
- When a field palette item is dropped on canvas, the component renders the
  actual field widget from `@object-ui/fields` via `ComponentRegistry`
- The property editor should expose field-type-specific props (e.g., `currency`
  for currency fields, `options` for select fields)

#### ViewDesigner — Field Type Badges with Icons

Enhance the Available Fields panel (`ViewDesigner.tsx:520–537`) to show field
type icons from `DESIGNER_FIELD_TYPES` alongside field names, and group fields
by category.

**Implementation points:**
- Import field type icons from `DESIGNER_FIELD_TYPES`
- Replace plain text type badge with icon + colored badge
- Optionally group available fields by field type category

### 10.6 Type Safety Recommendations

1. **Add `FieldTypeName` type to `@object-ui/types`:**
   ```typescript
   export type FieldTypeName = FieldMetadata['type'];
   // Results in: 'text' | 'textarea' | 'markdown' | 'html' | 'number' | ...
   ```

2. **Update `DataModelField.type` in `designer.ts`:**
   ```typescript
   import type { FieldTypeName } from './field-types';

   export interface DataModelField {
     name: string;
     label?: string;
     type: FieldTypeName;  // Changed from generic `string`
     // ...
   }
   ```

3. **Update `mapFieldTypeToFormType` in `@object-ui/fields`** to cover all 36
   field types (currently missing: `color`, `slider`, `rating`, `code`, `avatar`,
   `address`, `geolocation`, `signature`, `qrcode`).

### 10.7 Priority & Phasing

| Priority | Task | Effort |
|----------|------|--------|
| 🔴 P0 | Create `DESIGNER_FIELD_TYPES` constant | 0.5 day |
| 🔴 P0 | Add field type selector dropdown to DataModelDesigner | 1 day |
| 🟠 P1 | Add Fields palette category to PageDesigner | 1 day |
| 🟠 P1 | Add `FieldTypeName` type and update `DataModelField` | 0.5 day |
| 🟡 P2 | Enhance ViewDesigner field type badges with icons | 0.5 day |
| 🟡 P2 | Complete `mapFieldTypeToFormType` for all 36 types | 0.5 day |
| 🟢 P3 | Type-specific property editors per field type | 3–5 days |

**Total estimated effort:** 7–9.5 developer days

---

## Appendix A: File Reference Index

| File | Lines | Component | Registration ID |
|------|-------|-----------|-----------------|
| `packages/plugin-designer/src/PageDesigner.tsx` | 287 | `PageDesigner` | `page-designer` |
| `packages/plugin-designer/src/ViewDesigner.tsx` | ~550+ | `ViewDesigner` | `view-designer` |
| `packages/plugin-designer/src/DataModelDesigner.tsx` | 225 | `DataModelDesigner` | `data-model-designer` |
| `packages/plugin-designer/src/ProcessDesigner.tsx` | 254 | `ProcessDesigner` | `process-designer` |
| `packages/plugin-designer/src/ReportDesigner.tsx` | 283 | `ReportDesigner` | `report-designer` |
| `packages/plugin-designer/src/CollaborationProvider.tsx` | 216 | `CollaborationProvider` | *(not registered — provider only)* |
| `packages/plugin-designer/src/index.tsx` | 113 | *(barrel exports + registration)* | — |

## Appendix B: Shared Dependencies

All designers share these patterns that should be considered when implementing improvements:

- **`cn()` utility** — Each designer file defines its own `cn()` function (e.g., `PageDesigner.tsx:20–22`). This should be extracted to a shared utility.
- **Lucide icons** — All designers import from `lucide-react`. Icon-only buttons should consistently use `aria-label`.
- **`@object-ui/types`** — Type definitions for `DesignerComponent`, `ViewDesignerColumn`, `CollaborationConfig`, etc. Any new interfaces (e.g., `DesignerHistoryState`) should be added here.
- **`@object-ui/core` ComponentRegistry** — All visual designers are registered (`index.tsx`). New exported components (e.g., `ConnectionStatusIndicator`) should also be registered.
