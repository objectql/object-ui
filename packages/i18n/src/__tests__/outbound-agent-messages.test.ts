// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Guard: the strings the console SENDS to the AI agent must not be translated
 * into arbitrary locales.
 *
 * Most `console.ai.*` keys are labels and should be localized everywhere. Four
 * are not labels — they are the message text a button transmits to the agent,
 * and the cloud confirm gate (`service-ai-studio` `confirm-gate.ts`
 * `APPROVAL_RE`) decides whether that text counts as approval. It recognises
 * Chinese and English. Nothing else.
 *
 * So `AiChatPage` picks them by the language of the CONVERSATION, not the UI:
 *
 *     const planApproveMessage = convZh
 *       ? '确认，开始搭建。'                                   // matches the gate
 *       : t('console.ai.planApproveMessage', { defaultValue: … });
 *
 * That `t()` call is expected to MISS in every non-Chinese pack and fall
 * through to its English `defaultValue`. Add a German translation and a German
 * user's "Build it" click starts sending German, the gate stops matching, and
 * the agent re-proposes instead of building — the button looks inert while
 * nothing visibly errors. objectui#2900 shipped exactly that for
 * `changesConfirmMessage`; this test is why it can't happen twice.
 *
 * If the gate ever learns more languages, delete the offending entry here in
 * the same change that teaches it — not before.
 */
import { describe, it, expect } from 'vitest';
import { en, zh, ja, ko, de, fr, es, pt, ru, ar } from '../locales';

const OUTBOUND_KEYS = [
  'console.ai.planApproveMessage',
  'console.ai.planApproveDefaultsMessage',
  'console.ai.planAnswerMessage',
  'console.ai.changesConfirmMessage',
] as const;

const GATE_LOCALES: Record<string, unknown> = { en, zh };
const NON_GATE_LOCALES: Record<string, unknown> = { ja, ko, de, fr, es, pt, ru, ar };

function lookup(pack: unknown, dotted: string): unknown {
  return dotted
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], pack);
}

describe('outbound agent messages stay on gate-recognised languages', () => {
  it.each(Object.keys(NON_GATE_LOCALES))(
    'the %s pack defines none of them, so t() falls through to the English default',
    (lang) => {
      const offenders = OUTBOUND_KEYS.filter(
        (k) => lookup(NON_GATE_LOCALES[lang], k) !== undefined,
      );
      expect(offenders).toEqual([]);
    },
  );

  it.each(Object.keys(GATE_LOCALES))('the %s pack defines all of them', (lang) => {
    for (const k of OUTBOUND_KEYS) {
      expect(typeof lookup(GATE_LOCALES[lang], k)).toBe('string');
    }
  });

  it('every OTHER console.ai key IS localized — this guard is narrow on purpose', () => {
    // Guards against over-correcting: the fix for the outbound keys must not
    // become a reason to leave the surrounding labels untranslated.
    const aiLabels = Object.keys((en as any).console.ai).filter(
      (k) => typeof (en as any).console.ai[k] === 'string',
    );
    const outboundLeaf = new Set(OUTBOUND_KEYS.map((k) => k.split('.').pop()));
    const labels = aiLabels.filter((k) => !outboundLeaf.has(k));
    expect(labels.length).toBeGreaterThan(20);
    for (const k of labels) {
      expect((de as any).console.ai[k], `de is missing console.ai.${k}`).toBeTypeOf('string');
    }
  });
});
