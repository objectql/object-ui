/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage, cn } from '@object-ui/components';
import { Check } from 'lucide-react';
import {
  getPersonName,
  getPersonInitials,
  getPersonSubtitle,
  getPersonAvatarUrl,
} from './personDisplay';

/**
 * A rich, single-line candidate row for the search-first PeoplePicker:
 * avatar (image with initials fallback) + name + subtitle (department · email).
 * The subtitle is what lets search stand in for an org tree — it disambiguates
 * same-named people inline. Selectable/toggleable; a Check marks the selected
 * state for both single- and multi-select.
 */
export interface PersonRowProps {
  record: any;
  /** Field holding the display name. Default `name`. */
  displayField?: string;
  /** Dotted field paths joined with " · " for the secondary line. */
  subtitleFields?: string[];
  /** Field holding the avatar image URL. Default `image`. */
  avatarField?: string;
  selected?: boolean;
  onSelect?: (record: any) => void;
  className?: string;
}

export function PersonRow({
  record,
  displayField = 'name',
  subtitleFields,
  avatarField = 'image',
  selected = false,
  onSelect,
  className,
}: PersonRowProps) {
  const name = getPersonName(record, displayField);
  const subtitle = getPersonSubtitle(record, subtitleFields);
  const avatarUrl = getPersonAvatarUrl(record, avatarField);
  const initials = getPersonInitials(name);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(record)}
      aria-pressed={selected}
      data-testid="person-row"
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors',
        'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
        selected && 'bg-accent',
        className,
      )}
    >
      <Avatar className="size-9 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name || '—'}</div>
        {subtitle && (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
    </button>
  );
}
