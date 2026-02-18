/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Input } from '@object-ui/components';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

export interface RecordNavigationEnhancedProps {
  currentIndex: number;
  totalRecords: number;
  recordIds: string[];
  onNavigate: (recordId: string) => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export const RecordNavigationEnhanced: React.FC<RecordNavigationEnhancedProps> = ({
  currentIndex,
  totalRecords,
  recordIds,
  onNavigate,
  onSearch,
  className,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const canGoFirst = currentIndex > 0;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalRecords - 1;
  const canGoLast = currentIndex < totalRecords - 1;

  const handleFirst = React.useCallback(() => {
    if (canGoFirst) onNavigate(recordIds[0]);
  }, [canGoFirst, onNavigate, recordIds]);

  const handlePrev = React.useCallback(() => {
    if (canGoPrev) onNavigate(recordIds[currentIndex - 1]);
  }, [canGoPrev, onNavigate, recordIds, currentIndex]);

  const handleNext = React.useCallback(() => {
    if (canGoNext) onNavigate(recordIds[currentIndex + 1]);
  }, [canGoNext, onNavigate, recordIds, currentIndex]);

  const handleLast = React.useCallback(() => {
    if (canGoLast) onNavigate(recordIds[recordIds.length - 1]);
  }, [canGoLast, onNavigate, recordIds]);

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      onSearch?.(value);
    },
    [onSearch],
  );

  const handleToggleSearch = React.useCallback(() => {
    setIsSearchOpen((prev) => {
      if (!prev) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } else {
        setSearchQuery('');
        onSearch?.('');
      }
      return !prev;
    });
  }, [onSearch]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // Allow search input to capture normal keys
      if (isEditable && e.target !== searchInputRef.current) return;
      // In search input, only handle navigation keys
      if (e.target === searchInputRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsSearchOpen(false);
          setSearchQuery('');
          onSearch?.('');
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case 'Home':
          e.preventDefault();
          if (canGoFirst) onNavigate(recordIds[0]);
          break;
        case 'End':
          e.preventDefault();
          if (canGoLast) onNavigate(recordIds[recordIds.length - 1]);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (canGoPrev) onNavigate(recordIds[currentIndex - 1]);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (canGoNext) onNavigate(recordIds[currentIndex + 1]);
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [currentIndex, recordIds, canGoFirst, canGoPrev, canGoNext, canGoLast, onNavigate, onSearch]);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* First */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={!canGoFirst}
        onClick={handleFirst}
        title="First record (Home)"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      {/* Prev */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={!canGoPrev}
        onClick={handlePrev}
        title="Previous record (←)"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Position indicator */}
      <span className="text-xs text-muted-foreground whitespace-nowrap px-1.5 tabular-nums">
        {totalRecords > 0 ? `${currentIndex + 1} of ${totalRecords}` : 'No records'}
      </span>

      {/* Next */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={!canGoNext}
        onClick={handleNext}
        title="Next record (→)"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Last */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={!canGoLast}
        onClick={handleLast}
        title="Last record (End)"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>

      {/* Search toggle */}
      {onSearch && (
        <>
          <Button
            variant={isSearchOpen ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={handleToggleSearch}
            title="Search while navigating"
          >
            <Search className="h-4 w-4" />
          </Button>

          {isSearchOpen && (
            <div className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search records…"
                value={searchQuery}
                onChange={handleSearchChange}
                className="h-8 w-48 text-sm"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
