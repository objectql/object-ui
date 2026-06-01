import React from 'react';
import { Badge, Input, EmptyValue, cn } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * TagsField - free-form list of string tags. Type a value and press Enter (or
 * comma) to add it; click a tag's × to remove it. The stored value is a
 * string[]. Used for the `tags` field type.
 */
export function TagsField({ value, onChange, field, readonly, className, ...props }: FieldWidgetProps<string[]>) {
  const tags: string[] = Array.isArray(value) ? value : value == null ? [] : [value as unknown as string];
  const [draft, setDraft] = React.useState('');

  if (readonly) {
    if (tags.length === 0) return <EmptyValue />;
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
      </div>
    );
  }

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setDraft('');
  };

  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-1.5', className)}>
      {tags.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1">
          {t}
          <button
            type="button"
            onClick={() => removeTag(t)}
            className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(draft)}
        disabled={(props as any).disabled}
        placeholder={tags.length === 0 ? '输入后回车添加…' : ''}
        className="h-7 flex-1 border-0 bg-transparent p-0 px-1 shadow-none focus-visible:ring-0 min-w-[8ch]"
      />
    </div>
  );
}
