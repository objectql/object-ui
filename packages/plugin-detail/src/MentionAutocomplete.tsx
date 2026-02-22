/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn } from '@object-ui/components';
import type { Mention } from '@object-ui/types';

export interface MentionSuggestionItem {
  /** Entity ID */
  id: string;
  /** Display name */
  name: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Entity type */
  type: 'user' | 'team' | 'group';
}

export interface MentionAutocompleteProps {
  /** Search query (text after @) */
  query: string;
  /** Available suggestions */
  suggestions: MentionSuggestionItem[];
  /** Called when a suggestion is selected */
  onSelect: (item: MentionSuggestionItem) => void;
  /** Whether the dropdown is visible */
  visible?: boolean;
  /** Active/highlighted index */
  activeIndex?: number;
  className?: string;
}

/**
 * MentionAutocomplete — Dropdown for @mention autocomplete.
 * Filters suggestions by query and renders a selectable list.
 * Produces MentionSchema data on selection.
 */
export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  suggestions,
  onSelect,
  visible = true,
  activeIndex = 0,
  className,
}) => {
  const filtered = React.useMemo(() => {
    if (!query) return suggestions;
    const q = query.toLowerCase();
    return suggestions.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    );
  }, [query, suggestions]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-popover border rounded-md shadow-md z-50 max-h-48 overflow-y-auto w-56',
        className,
      )}
      role="listbox"
      aria-label="Mention suggestions"
    >
      {filtered.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={cn(
            'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent transition-colors',
            index === activeIndex && 'bg-accent',
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          {item.avatarUrl ? (
            <img
              src={item.avatarUrl}
              alt={item.name}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
              {item.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="truncate">{item.name}</span>
            {item.type !== 'user' && (
              <span className="ml-1 text-xs text-muted-foreground capitalize">({item.type})</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

/**
 * Helper to create a Mention object from a suggestion item.
 */
export function createMentionFromSuggestion(
  item: MentionSuggestionItem,
  offset: number,
  length: number,
): Mention {
  return {
    type: item.type,
    id: item.id,
    name: item.name,
    offset,
    length,
  };
}
