import React, { useState, useEffect } from 'react';
import { Textarea, cn, EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { useFieldTranslation } from './useFieldTranslation.js';

/**
 * ObjectField - JSON object editor
 * Allows editing structured JSON data
 */
export function ObjectField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<any>) {
  const config = field;
  
  // Initialize string state based on value
  const getInitialJsonString = () => {
    if (value === undefined || value === null) return '';
    return JSON.stringify(value, null, 2);
  };
  
  const [jsonString, setJsonString] = useState(getInitialJsonString);
  // Named `parseError`, NOT `error`: `error` is the published validation slot
  // on the widget contract (#3222) and is destructured above.
  const [parseError, setParseError] = useState<string | null>(null);
  // objectui#6755 — this widget's ONE diagnostic sentence goes through the
  // package's locale channel, the same one 11 of its 55 widgets already read.
  // Called here, ABOVE the readonly early return below, so hook order is the
  // same on both branches (the `AddressField` discipline).
  const { t } = useFieldTranslation();

  // Sync internal string state when value changes externally
  // This is a controlled component pattern where we need to sync external changes
  useEffect(() => {
    try {
      if (value === undefined || value === null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for controlled component sync
        setJsonString('');
        return;
      }
      // Only update if the parsed internal state doesn't match the new value
      // This prevents cursor jumping/reformatting while typing valid JSON
      const currentParsed = jsonString ? JSON.parse(jsonString) : null;
      if (JSON.stringify(currentParsed) !== JSON.stringify(value)) {
        setJsonString(JSON.stringify(value, null, 2));
      }
    } catch {
      // Fallback if internal state was invalid JSON
      setJsonString(JSON.stringify(value, null, 2));
    }
  }, [value, jsonString]);

  if (readonly) {
    if (!value) return <EmptyValue />;
    return (
      <pre className={cn("text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-auto max-h-40", props.className)}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const str = e.target.value;
    setJsonString(str);
    setParseError(null);

    if (!str.trim()) {
      onChange(null);
      return;
    }

    try {
      const parsed = JSON.parse(str);
      onChange(parsed);
    } catch (e) {
      // Invalid JSON - don't propagate change to parent, but keep local state.
      // The sentence is produced HERE, when the draft is refused, rather than
      // at render: `LocationField`'s two arms carry data measured at refusal
      // time (the spec's complaint about the pair that was refused), and the
      // two widgets say their refusals the same way on purpose. The cost is
      // stated rather than hidden: a language switched WHILE a refusal is lit
      // leaves that one sentence in the language it was produced in until the
      // next keystroke.
      setParseError(t('fields.object.invalidJson'));
    }
  };

  return (
    <div className="space-y-1">
      <Textarea
        // DOM pass-through onto the real focusable control (objectui#3318).
        {...toDomProps(props)}
        value={jsonString}
        onChange={handleChange}
        placeholder={config?.placeholder || '{\n  "key": "value"\n}'}
        disabled={readonly || props.disabled}
        className={cn("font-mono text-xs", parseError ? "border-red-500 focus-visible:ring-red-500" : "", props.className)}
        rows={6}
        // AFTER the spread so this widget's own computation wins (#3222).
        // Invalid = the form's validation slot OR this widget's own unparsable
        // draft (which already draws the red border above).
        aria-invalid={!!error || !!parseError}
      />
      {parseError && <p className="text-xs text-red-500">{parseError}</p>}
    </div>
  );
}
