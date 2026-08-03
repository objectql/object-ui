/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * `record:chatter` / `record:discussion` — Salesforce-style social feed for
 * the current record. The renderer is a thin wrapper around
 * `RecordChatterPanel`; it pulls feed items + mutation handlers from the
 * surrounding `DiscussionContext` (mounted by `RecordDetailView` or any
 * other host shell that owns the feed). When no DiscussionContext is
 * present the panel renders an empty feed so the page still composes
 * correctly in standalone previews.
 */

import React from 'react';
import { useRecordContext, useDiscussionContext } from '@object-ui/react';
import type { RecordChatterComponentProps } from '@object-ui/types';
import { RecordChatterPanel } from '../RecordChatterPanel';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordChatterRendererProps {
  schema?: RecordChatterComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordChatterRenderer: React.FC<RecordChatterRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  useRecordContext();
  const discussion = useDiscussionContext();
  const { designer } = splitDesigner(props);

  // Merge schema-supplied config (position, feed sub-config) with sane
  // defaults that match the auto-appended panel used by RecordDetailView
  // — so an author-placed `record:discussion` looks identical to the
  // fallback the host injects when no component is present.
  const config = {
    position: 'bottom',
    collapsible: false,
    feed: {
      enableReactions: true,
      enableThreading: true,
      showCommentInput: true,
    },
    ...(schema as any),
  } as any;

  return (
    <div className={className} {...designer}>
      <RecordChatterPanel
        items={(discussion?.items as any) || []}
        config={config}
        // The host that owns the fetch produces this (app-shell
        // `RecordDetailView`); without it a hand-placed `record:chatter` /
        // `record:discussion` spends the whole fetch claiming the record has
        // no comments (objectui#3209 — #3205 added the render branch, this
        // is the signal that reaches it). `record:activity` reads the same
        // field off the same context; no second idiom.
        loading={discussion?.loading}
        onAddComment={discussion?.onAddComment as any}
        onAddReply={discussion?.onAddReply as any}
        onToggleReaction={discussion?.onToggleReaction as any}
        mentionSuggestions={discussion?.mentionSuggestions as any}
        onUploadAttachments={discussion?.onUploadAttachments as any}
      />
    </div>
  );
};

export default RecordChatterRenderer;
