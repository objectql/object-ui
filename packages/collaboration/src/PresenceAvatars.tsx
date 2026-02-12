/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo } from 'react';
import type { PresenceUser } from './usePresence';

export interface PresenceAvatarsProps {
  /** Present users */
  users: PresenceUser[];
  /** Max avatars to show before "+N" */
  maxVisible?: number;
  /** Avatar size */
  size?: 'sm' | 'md' | 'lg';
  /** Show status indicators */
  showStatus?: boolean;
  /** Additional className */
  className?: string;
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 40,
} as const;

const statusColors: Record<PresenceUser['status'], string> = {
  active: '#22c55e',
  idle: '#f59e0b',
  away: '#94a3b8',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Avatar stack component showing active users with overflow indicator.
 *
 * Displays user avatars (or initials) in an overlapping stack,
 * with optional status indicators and a "+N" overflow badge.
 */
export function PresenceAvatars({
  users,
  maxVisible = 5,
  size = 'md',
  showStatus = true,
  className,
}: PresenceAvatarsProps): React.ReactElement {
  const px = sizeMap[size];
  const overlapOffset = Math.round(px * 0.3);
  const fontSize = Math.round(px * 0.35);
  const statusDotSize = Math.max(8, Math.round(px * 0.28));

  const visible = useMemo(() => users.slice(0, maxVisible), [users, maxVisible]);
  const overflowCount = Math.max(0, users.length - maxVisible);

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    flexDirection: 'row-reverse',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const avatarBaseStyle: React.CSSProperties = {
    width: `${px}px`,
    height: `${px}px`,
    borderRadius: '50%',
    border: '2px solid #fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${fontSize}px`,
    fontWeight: 600,
    color: '#fff',
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const overflowStyle: React.CSSProperties = {
    ...avatarBaseStyle,
    backgroundColor: '#e2e8f0',
    color: '#475569',
    marginLeft: `-${overlapOffset}px`,
  };

  const statusDotStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '-1px',
    right: '-1px',
    width: `${statusDotSize}px`,
    height: `${statusDotSize}px`,
    borderRadius: '50%',
    border: '2px solid #fff',
    boxSizing: 'border-box',
  };

  // Render in reverse order so the first user appears on top (z-index via DOM order with row-reverse)
  const reversedVisible = useMemo(() => [...visible].reverse(), [visible]);

  return React.createElement('div', {
    style: containerStyle,
    className,
    role: 'group',
    'aria-label': `${users.length} user${users.length !== 1 ? 's' : ''} present`,
  },
    // Overflow badge (rendered first because of row-reverse)
    overflowCount > 0 && React.createElement('div', {
      key: 'overflow',
      style: overflowStyle,
      title: `${overflowCount} more user${overflowCount !== 1 ? 's' : ''}`,
    }, `+${overflowCount}`),
    // Avatars
    reversedVisible.map((user, idx) =>
      React.createElement('div', {
        key: user.userId,
        style: {
          ...avatarBaseStyle,
          backgroundColor: user.color,
          marginLeft: idx > 0 || overflowCount > 0 ? `-${overlapOffset}px` : '0',
        },
        title: `${user.userName} (${user.status})`,
      },
        user.avatar
          ? React.createElement('img', {
              src: user.avatar,
              alt: user.userName,
              style: { width: '100%', height: '100%', objectFit: 'cover' as const },
            })
          : getInitials(user.userName),
        showStatus && React.createElement('span', {
          style: {
            ...statusDotStyle,
            backgroundColor: statusColors[user.status],
          },
        }),
      ),
    ),
  );
}
