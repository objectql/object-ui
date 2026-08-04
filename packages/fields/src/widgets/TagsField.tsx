import React from 'react';
import { Badge, Input, EmptyValue, cn } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';

/**
 * TagsField - free-form list of string tags. Type a value and press Enter (or
 * comma) to add it; click a tag's × to remove it. The stored value is a
 * string[]. Used for the `tags` field type.
 */
export function TagsField({ value, onChange, field, readonly, className, error, ...props }: FieldWidgetComponentProps<string[]>) {
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
        // DOM pass-through onto the real focusable control (objectui#3318):
        // the whitelist spread carries the form renderer's id /
        // aria-describedby to the input the user actually types in.
        {...toDomProps(props)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(draft)}
        disabled={props.disabled}
        placeholder={tags.length === 0 ? '输入后回车添加…' : ''}
        className="h-7 flex-1 border-0 bg-transparent p-0 px-1 shadow-none focus-visible:ring-0 min-w-[8ch]"
        // AFTER the spread so this widget's own computation wins (the #3222
        // discipline): `error` is the published validation slot, and
        // `!!undefined` yields an explicit "false" — a valid field SAYS it is
        // valid rather than staying mute.
        aria-invalid={!!error}
      />
    </div>
  );
}
