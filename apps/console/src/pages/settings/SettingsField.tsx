/**
 * <SettingsField> — one row of a settings page. Translates a single
 * Specifier into the matching shadcn primitive.
 *
 * Pure UI: receives `value`, `onChange`, `locked`, and `resolved`
 * (which carries provenance and lock state).
 */

import { cloneElement, isValidElement, useId, type ReactElement } from 'react';
import {
  Input,
  Textarea,
  Switch,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  RadioGroup,
  RadioGroupItem,
  Checkbox,
  Alert,
  AlertTitle,
  AlertDescription,
  Separator,
  Badge,
  Button,
} from '@object-ui/components';
import { ChevronRight, Info } from 'lucide-react';
import { getIcon } from '../../utils/getIcon';
import { EnvLockBadge } from './EnvLockBadge';
import { resolveLabel, type Specifier, type ResolvedSettingValue } from './types';
import type { SettingsLabelHelpers } from './useSettingsLabel';

export interface SettingsFieldProps {
  spec: Specifier;
  resolved?: ResolvedSettingValue;
  value: unknown;
  onChange: (next: unknown) => void;
  onAction?: () => void;
  /** Whether the whole page is in a saving state. */
  saving?: boolean;
  /** True when the specifier should appear disabled (env-locked or saving). */
  locked?: boolean;
  /** i18n helpers bound to the parent settings namespace. */
  labels?: SettingsLabelHelpers;
  /**
   * Server-side rejection for THIS field, from the last failed save
   * (objectstack#4224). Already localized by the server — rendered verbatim,
   * not re-worded here.
   *
   * Replaces the help text while present, rather than stacking below it: the
   * two occupy the same slot and say the same kind of thing, and a description
   * sitting under a red error reads as if the field has two states at once.
   */
  error?: string;
}

function InheritanceBadges({
  resolved,
  labels,
}: {
  resolved: ResolvedSettingValue;
  labels?: SettingsLabelHelpers;
}) {
  const chain = resolved.cascadeChain;
  if (!chain || chain.length === 0) return null;

  const effective = chain.find((e) => e.effective) ?? chain[chain.length - 1];
  const upperWithValue = chain.find(
    (e) => e !== effective && e.value !== null && e.value !== undefined,
  );

  const sourceText = (scope: ResolvedSettingValue['source']) =>
    labels?.sourceLabel?.(scope) ?? scope;

  // "Inherited from <upper>" — effective value came from an upper scope.
  if (
    effective.scope !== 'default' &&
    effective.scope !== 'user' &&
    effective.scope !== 'tenant'
  ) {
    // global/env: show as inherited for downstream scopes
    return (
      <Badge variant="outline" className="text-blue-700 border-blue-300 text-[10px]">
        Inherited from {sourceText(effective.scope)}
      </Badge>
    );
  }

  // "Overrides <upper>" — local value shadows an upper-scope value.
  if (upperWithValue) {
    return (
      <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">
        Overrides {sourceText(upperWithValue.scope)}
      </Badge>
    );
  }

  return null;
}

function FieldHeader({
  spec,
  resolved,
  labelText,
  labels,
}: {
  spec: Specifier;
  resolved?: ResolvedSettingValue;
  labelText: string;
  labels?: SettingsLabelHelpers;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm font-medium">
        {labelText}
        {spec.required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {spec.deprecated ? (
        <Badge variant="outline" className="text-amber-700 border-amber-300">
          Deprecated{spec.replacedBy ? ` → ${spec.replacedBy}` : ''}
        </Badge>
      ) : null}
      {resolved?.locked ? <EnvLockBadge reason={resolved.lockedReason} /> : null}
      {resolved && !resolved.locked ? (
        <InheritanceBadges resolved={resolved} labels={labels} />
      ) : null}
      {resolved?.source && resolved.source !== 'default' && !resolved.locked ? (
        <span className="text-[11px] text-muted-foreground">
          {labels?.sourceLabel?.(resolved.source) ?? resolved.source}
        </span>
      ) : null}
    </div>
  );
}

function FieldDescription({ description }: { description?: string }) {
  if (!description) return null;
  return <p className="text-xs text-muted-foreground mt-1">{description}</p>;
}

/**
 * The server's rejection for this field, in the slot the help text normally
 * occupies (objectstack#4224).
 *
 * `role="alert"` so a screen reader announces it when it appears after a save
 * attempt — the sighted cue is colour, which is not a cue at all for everyone.
 * The `id` is what the input points `aria-describedby` at, so the association
 * survives for assistive tech rather than being purely visual adjacency.
 */
function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}

export function SettingsField(props: SettingsFieldProps) {
  const { spec, resolved, value, onChange, onAction, locked, saving, labels, error } = props;
  const id = useId();
  const disabled = Boolean(locked || saving);
  const literalLabel = resolveLabel(spec.label);
  // Field-scoped label/help/placeholder/option resolution. Falls back to the
  // manifest literal when no translation is registered, so a host that did not
  // ship a TranslationBundle still renders correctly.
  const fieldLabel = spec.key && labels
    ? labels.fieldLabel(spec.key, literalLabel)
    : literalLabel;
  const fieldHelp = spec.key && labels
    ? labels.fieldHelp(spec.key, spec.description)
    : spec.description;

  // -------- Layout-only --------

  if (spec.type === 'group') {
    const groupTitle = spec.id && labels ? labels.groupTitle(spec.id, literalLabel) : literalLabel;
    const groupDesc = spec.id && labels
      ? labels.groupDescription(spec.id, spec.description)
      : spec.description;
    return (
      <div className="pt-6 pb-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground/90">
          {groupTitle}
        </h3>
        {groupDesc ? (
          <p className="text-xs text-muted-foreground mt-1">{groupDesc}</p>
        ) : null}
        <Separator className="mt-3" />
      </div>
    );
  }

  if (spec.type === 'info_banner') {
    const variant = spec.bannerSeverity === 'error' ? 'destructive' : 'default';
    return (
      <Alert variant={variant as any} className="my-2">
        <Info className="h-4 w-4" />
        <AlertTitle>{literalLabel}</AlertTitle>
        {spec.bannerText ? <AlertDescription>{spec.bannerText}</AlertDescription> : null}
      </Alert>
    );
  }

  if (spec.type === 'child_pane') {
    return (
      <a
        href={`#/settings/${spec.childNamespace}`}
        className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 hover:bg-accent transition-colors"
      >
        <div>
          <div className="text-sm font-medium">{literalLabel}</div>
          {spec.description ? (
            <div className="text-xs text-muted-foreground">{spec.description}</div>
          ) : null}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </a>
    );
  }

  if (spec.type === 'title_value') {
    return (
      <div className="flex items-center justify-between py-2">
        <FieldHeader spec={spec} resolved={resolved} labelText={fieldLabel} labels={labels} />
        <span className="text-sm text-muted-foreground">{String(value ?? '—')}</span>
      </div>
    );
  }

  if (spec.type === 'action_button') {
    const Icon = spec.icon ? getIcon(spec.icon) : null;
    const actionId = spec.id ?? spec.key ?? 'test';
    const actionLabel = labels
      ? labels.actionLabel(actionId, literalLabel)
      : literalLabel;
    return (
      <div className="flex items-center justify-between py-3">
        <div>
          <div className="text-sm font-medium">{actionLabel}</div>
          {spec.description ? (
            <p className="text-xs text-muted-foreground mt-1">{spec.description}</p>
          ) : null}
        </div>
        <Button size="sm" variant="secondary" onClick={onAction} disabled={saving}>
          {Icon ? (
            // eslint-disable-next-line react-hooks/static-components -- getIcon returns a module-cached stable component per name, not one created during render
            <Icon className="h-4 w-4 mr-1.5" />
          ) : null}
          {actionLabel}
        </Button>
      </div>
    );
  }

  // -------- Inputs --------

  // Wired onto the control itself, not just rendered beside it: `aria-invalid`
  // is what announces "this one was rejected", and `aria-describedby` is what
  // ties the message to the input for a screen reader. Every input type goes
  // through `wrapper`, so marking it here covers all of them at once instead of
  // per-case (objectstack#4224).
  const errorId = `${id}-error`;
  const wrapper = (children: React.ReactNode) => (
    <div className="space-y-1.5 py-2">
      <FieldHeader spec={spec} resolved={resolved} labelText={fieldLabel} labels={labels} />
      {error && isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            'aria-invalid': true,
            'aria-describedby': errorId,
          })
        : children}
      {error ? (
        <FieldError id={errorId} message={error} />
      ) : (
        <FieldDescription description={fieldHelp} />
      )}
    </div>
  );

  const renderOptionLabel = (opt: { value: string | number | boolean; label: any }): string => {
    const literal = typeof opt.label === 'string' ? opt.label : opt.label?.defaultValue ?? String(opt.value);
    if (!spec.key || !labels) return literal;
    return labels.optionLabel(spec.key, String(opt.value), literal);
  };

  switch (spec.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return wrapper(
        <Input
          id={id}
          type={spec.type === 'email' ? 'email' : spec.type === 'url' ? 'url' : 'text'}
          value={(value as string | undefined) ?? ''}
          minLength={spec.minLength}
          maxLength={spec.maxLength}
          pattern={spec.pattern}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
    case 'password':
      return wrapper(
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          placeholder={value ? '••••••••' : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
    case 'textarea':
      return wrapper(
        <Textarea
          id={id}
          rows={spec.rows ?? 4}
          value={(value as string | undefined) ?? ''}
          minLength={spec.minLength}
          maxLength={spec.maxLength}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
    case 'number':
      return wrapper(
        <Input
          id={id}
          type="number"
          value={value as any}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />,
      );
    case 'toggle':
      return (
        <div className="flex items-center justify-between py-3">
          <div>
            <FieldHeader spec={spec} resolved={resolved} labelText={fieldLabel} labels={labels} />
            <FieldDescription description={fieldHelp} />
          </div>
          <Switch
            id={id}
            checked={Boolean(value)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );
    case 'select':
      return wrapper(
        <Select
          value={value == null ? undefined : String(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {spec.options?.map((opt) => (
              <SelectItem key={String(opt.value)} value={String(opt.value)}>
                {renderOptionLabel(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      );
    case 'radio':
      return wrapper(
        <RadioGroup
          value={value == null ? undefined : String(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          {spec.options?.map((opt) => (
            <div key={String(opt.value)} className="flex items-center space-x-2">
              <RadioGroupItem value={String(opt.value)} id={`${id}-${opt.value}`} />
              <Label htmlFor={`${id}-${opt.value}`} className="text-sm font-normal">
                {renderOptionLabel(opt)}
              </Label>
            </div>
          ))}
        </RadioGroup>,
      );
    case 'multiselect': {
      const arr = Array.isArray(value) ? (value as (string | number)[]) : [];
      return wrapper(
        <div className="grid grid-cols-2 gap-2">
          {spec.options?.map((opt) => {
            const v = String(opt.value);
            const checked = arr.map(String).includes(v);
            return (
              <label key={v} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(c) => {
                    const next = new Set(arr.map(String));
                    if (c) next.add(v); else next.delete(v);
                    onChange(Array.from(next));
                  }}
                />
                {renderOptionLabel(opt)}
              </label>
            );
          })}
        </div>,
      );
    }
    case 'slider':
      return wrapper(
        <div className="flex items-center gap-3">
          <Slider
            value={[Number(value ?? spec.min ?? 0)]}
            min={spec.min ?? 0}
            max={spec.max ?? 100}
            step={spec.step ?? 1}
            disabled={disabled}
            onValueChange={(v) => onChange(v[0])}
            className="flex-1"
          />
          <span className="text-sm tabular-nums w-12 text-right">{String(value ?? spec.min ?? 0)}</span>
        </div>,
      );
    case 'color':
      return wrapper(
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="color"
            value={(value as string | undefined) ?? '#000000'}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="w-16 h-9 p-1"
          />
          <Input
            value={(value as string | undefined) ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 font-mono text-sm"
          />
        </div>,
      );
    case 'json':
      return wrapper(
        <Textarea
          id={id}
          rows={spec.rows ?? 6}
          className="font-mono text-xs"
          value={typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
    default:
      return wrapper(<div className="text-sm text-muted-foreground">Unsupported specifier type: {spec.type}</div>);
  }
}
