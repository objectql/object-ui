/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Helpers that introspect a page schema tree without needing the React
 * runtime. Used by RecordDetailView to decide whether to auto-append
 * a discussion / chatter slot at the bottom of the page.
 */

const DISCUSSION_TYPES = new Set(['record:discussion', 'record:chatter']);
const ATTACHMENT_TYPES = new Set(['record:attachments']);
const APPROVAL_TYPES = new Set(['record:approvals']);

/**
 * Walks a page schema tree and returns true if any node's `type` is in
 * `types`.
 *
 * Recurses into:
 *  - `children`, `items`, `body`, `components`
 *  - `properties.children`, `properties.items`
 *  - `regions` (synth + full-Lightning pages nest components here)
 *
 * Cycles are guarded with a WeakSet.
 */
function hasNodeOfType(root: unknown, types: ReadonlySet<string>): boolean {
  const seen = new WeakSet<object>();
  const walk = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (seen.has(node)) return false;
    seen.add(node);
    if (Array.isArray(node)) return node.some(walk);
    const t = node?.type;
    if (typeof t === 'string' && types.has(t)) return true;
    const candidates: any[] = [
      node.children,
      node.items,
      node.body,
      node.components,
      node.properties?.children,
      node.properties?.items,
      // Synth + full-Lightning pages nest components inside
      // `regions[].components[]`. Without this branch the walker
      // fails to see the `record:discussion` baked in by
      // `buildDefaultPageSchema`, and the host appends a second
      // chatter panel on top of it.
      node.regions,
    ];
    return candidates.some(walk);
  };
  return walk(root);
}

/**
 * True when the page schema already places a `record:discussion` /
 * `record:chatter` node — the host must then skip its bottom auto-append.
 */
export function hasExplicitDiscussion(root: unknown): boolean {
  return hasNodeOfType(root, DISCUSSION_TYPES);
}

/**
 * True when the page schema already places a `record:attachments` node —
 * the synthesized default does whenever the object declares
 * `enable.files: true` (objectstack#4358). The host must then skip its
 * legacy bottom-of-page attachments append.
 */
export function hasExplicitAttachments(root: unknown): boolean {
  return hasNodeOfType(root, ATTACHMENT_TYPES);
}

/**
 * True when the page schema already places a `record:approvals` node — the
 * synthesized default does whenever the record has approval requests
 * (objectui#3461, an Approvals tab). The host must then skip its bottom
 * fallback append.
 */
export function hasExplicitApprovals(root: unknown): boolean {
  return hasNodeOfType(root, APPROVAL_TYPES);
}
