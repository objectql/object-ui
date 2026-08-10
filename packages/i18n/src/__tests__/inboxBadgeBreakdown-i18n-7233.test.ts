/**
 * `notifications.badge*` — the bell-badge breakdown strings (#7233).
 *
 * These three are interpolated with **named** placeholders (`{{total}}`,
 * `{{unread}}`, `{{approvals}}`) rather than i18next's `{{count}}`, because
 * `count` additionally drives plural-key resolution and these packs carry no
 * plural forms. A pack that spells the placeholder differently does not fail
 * loudly — i18next renders the literal `{{unread}}`, or an empty string — so
 * the placeholder name is pinned here alongside the key's existence.
 *
 * All ten packs are asserted: `all-locales-key-parity` already owns the key
 * SET, but not which placeholder a value spells, and a translated value is
 * exactly where `{{unread}}` quietly becomes `{{count}}`.
 */
import { describe, it, expect } from 'vitest';
import { builtInLocales } from '../locales';

const readPath = (node: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (acc, seg) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined,
      node,
    );

const CASES = [
  { key: 'notifications.badgeTotal', placeholder: 'total' },
  { key: 'notifications.badgeNotifications', placeholder: 'unread' },
  { key: 'notifications.badgeApprovals', placeholder: 'approvals' },
] as const;

const LOCALES = Object.keys(builtInLocales) as (keyof typeof builtInLocales)[];

describe.each(LOCALES)('%s notifications.badge* (#7233)', (code) => {
  it.each(CASES)('$key is a non-empty string carrying {{$placeholder}}', ({ key, placeholder }) => {
    const value = readPath(builtInLocales[code], key);
    expect(typeof value).toBe('string');
    expect((value as string).trim().length).toBeGreaterThan(0);
    expect(value as string).toContain(`{{${placeholder}}}`);
    // `count` would send i18next looking for `<key>_one` / `<key>_other`.
    expect(value as string).not.toContain('{{count}}');
  });
});
