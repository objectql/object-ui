/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button } from '@object-ui/components';
import { Send } from 'lucide-react';

export interface CommentInputProps {
  /** Called when a comment is submitted */
  onSubmit: (text: string) => void | Promise<void>;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  className?: string;
}

/**
 * CommentInput — Simple comment input component.
 * Renders a "Leave a comment" textarea with submit button.
 * Supports Ctrl+Enter to submit.
 */
export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  placeholder = 'Leave a comment…',
  disabled = false,
  className,
}) => {
  const [text, setText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    const value = text.trim();
    if (!value) return;
    setIsSubmitting(true);
    try {
      await onSubmit(value);
      setText('');
    } finally {
      setIsSubmitting(false);
    }
  }, [text, onSubmit]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className={cn('flex gap-2', className)}>
      <textarea
        className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSubmitting}
      />
      <Button
        size="icon"
        variant="default"
        onClick={handleSubmit}
        disabled={!text.trim() || isSubmitting || disabled}
        className="shrink-0 self-end"
        aria-label="Submit comment"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
};
