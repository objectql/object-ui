// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#7481 — the tool-step list read
 *
 *   ✓ 查看对象结构 ×3      已完成
 *   ✓ 读取元数据结构        已完成
 *   ✓ 列出对象 ×2          已完成
 *   ✓ Get authoring rules  已完成
 *
 * on a zh console: `get_authoring_rules` (cloud#1837) had no `chatbot.tool.*`
 * entry, so `humanizeToolName` fell through to its English title-caser — the
 * exact cloud#1658 symptom, one tool at a time, and it recurs every time the
 * cloud AI packages register a tool.
 *
 * The registry (`@objectstack/spec`'s `PLATFORM_TOOLS_BY_PACKAGE`) is the
 * contract, so it is what this suite reads. But the pinned spec LAGS the cloud
 * runtime — the five names in {@link AHEAD_OF_PIN} are registered by
 * `service-ai-studio` today and are not in the snapshot — and a step label the
 * user reads must not wait on a pin bump. So the coverage set is
 * `registry ∪ AHEAD_OF_PIN`, and a member of `AHEAD_OF_PIN` that the registry
 * has caught up with must be REMOVED from that list, which the last case here
 * enforces. That keeps the hand-held half shrinking rather than growing into a
 * second, permanent registry.
 *
 * The English pin is the other half. The packs' own comment states the rule —
 * "the `en` values are deliberately EQUAL to what that title-caser produces:
 * adding the key must not silently reword the English UI" — and nothing
 * checked it until now, so an `en` entry could quietly change what an English
 * console has always said.
 */
import { describe, it, expect } from 'vitest';
import * as specSystem from '@objectstack/spec/system';
import { builtInLocales } from '@object-ui/i18n';
import { humanizeToolName, toolTitleKey } from '../tool-display.js';

type LocaleCode = keyof typeof builtInLocales;
const LANGS = Object.keys(builtInLocales) as LocaleCode[];

const REGISTRY = (
  specSystem as { PLATFORM_TOOLS_BY_PACKAGE?: Readonly<Record<string, readonly string[]>> }
).PLATFORM_TOOLS_BY_PACKAGE;

/**
 * Tools the cloud AI runtime registers that the PINNED spec snapshot does not
 * list yet. Sourced from cloud `service-ai-studio`'s `plugin.ts` tool
 * definitions (`AUTHORING_RULE_`, `LOAD_TOOLS_`, `OPEN_RECORD_`, `FLOW_`).
 * Shrink this list on a pin bump — never grow it as a habit.
 */
const AHEAD_OF_PIN = ['get_authoring_rules', 'load_tools', 'open_record', 'test_flow', 'toggle_flow'] as const;

/** Every tool name that must carry a step label in every pack. */
const COVERED: string[] = [
  ...new Set([...Object.values(REGISTRY ?? {}).flat(), ...AHEAD_OF_PIN]),
].sort();

/** The pack's `chatbot.tool` block, reached through the one shape the reader uses. */
const toolsOf = (lang: LocaleCode) =>
  (builtInLocales[lang] as { chatbot?: { tool?: Record<string, string> } }).chatbot?.tool;

/** A `useSafeTranslate()` stand-in bound to one pack — a real value wins, else the fallback. */
const ttFrom = (lang: LocaleCode) => (key: string, fallback: string): string => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], builtInLocales[lang]);
  return typeof value === 'string' && value !== '' ? value : fallback;
};

describe('chatbot.tool.* covers every tool the runtime can show (objectui#7481)', () => {
  it('covers all ten built-in packs', () => {
    expect(LANGS).toHaveLength(10);
  });

  it('reads a non-empty coverage set', () => {
    // Guards against the whole suite going vacuously green if the spec export
    // disappears AND the hand-held list is emptied.
    expect(COVERED.length).toBeGreaterThanOrEqual(AHEAD_OF_PIN.length);
    expect(COVERED).toEqual(expect.arrayContaining([...AHEAD_OF_PIN]));
  });

  it.each(LANGS)('%s defines a non-empty label for every covered tool', (lang) => {
    const block = toolsOf(lang);
    expect(block, `${lang} has no chatbot.tool block`).toBeTruthy();
    const missing = COVERED.filter((name) => {
      const value = block![name];
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing, `${lang} is missing chatbot.tool entries`).toEqual([]);
  });

  it('the en labels are byte-equal to the English title-caser', () => {
    const en = toolsOf('en')!;
    for (const name of COVERED) {
      expect(en[name], `en.chatbot.tool.${name}`).toBe(humanizeToolName(name));
    }
  });

  it('AHEAD_OF_PIN carries only names the pinned registry still lacks', () => {
    // The moment `.objectstack-sha` advances past a tool's registry entry, the
    // hand-held list must lose it — otherwise this file becomes a second
    // registry that nobody keeps in sync.
    const inRegistry = new Set(Object.values(REGISTRY ?? {}).flat());
    const caughtUp = AHEAD_OF_PIN.filter((name) => inRegistry.has(name));
    expect(caughtUp, 'remove these from AHEAD_OF_PIN — the pinned spec now lists them').toEqual([]);
  });
});

describe('humanizeToolName resolves the newer tools through the pack (objectui#7481)', () => {
  it('zh: the card`s own step reads Chinese, not `Get authoring rules`', () => {
    expect(humanizeToolName('get_authoring_rules', ttFrom('zh'))).toBe('读取编写规范');
    expect(humanizeToolName('get_authoring_rules', ttFrom('zh'))).not.toBe('Get authoring rules');
  });

  it('zh: the other four newly-mapped tools resolve too', () => {
    const tt = ttFrom('zh');
    for (const name of AHEAD_OF_PIN) {
      expect(humanizeToolName(name, tt), name).toBe(toolsOf('zh')![name]);
    }
  });

  it('an UNKNOWN tool still degrades to the English title-caser', () => {
    // The optionality this whole seam was built on (cloud#1658): a custom or
    // third-party tool must be no worse off than before.
    expect(humanizeToolName('forecast_revenue', ttFrom('zh'))).toBe('Forecast revenue');
    expect(toolTitleKey('forecast_revenue')).toBe('chatbot.tool.forecast_revenue');
  });
});
