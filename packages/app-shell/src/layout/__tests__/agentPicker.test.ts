import { describe, it, expect } from 'vitest';
import { shouldShowAgentPicker, isAiDevUnlocked } from '../agentPicker';

const ask = { name: 'ask' };
const build = { name: 'build' };
const dataChat = { name: 'data_chat' }; // legacy alias of `ask`
const metadataAssistant = { name: 'metadata_assistant' }; // legacy alias of `build`
const custom = { name: 'sales_assistant' };

describe('isAiDevUnlocked', () => {
  it('is true only when the catalog serves BOTH an ask and a build agent', () => {
    expect(isAiDevUnlocked([ask, build])).toBe(true);
  });

  it('is alias-aware (legacy data_chat + metadata_assistant counts)', () => {
    expect(isAiDevUnlocked([dataChat, metadataAssistant])).toBe(true);
  });

  it('is false for a pure end-user catalog (ask only)', () => {
    expect(isAiDevUnlocked([ask])).toBe(false);
  });

  it('is false when only a build agent is present (no ask)', () => {
    expect(isAiDevUnlocked([build])).toBe(false);
  });

  it('is false for an empty catalog or custom-only agents', () => {
    expect(isAiDevUnlocked([])).toBe(false);
    expect(isAiDevUnlocked([custom])).toBe(false);
  });
});

describe('shouldShowAgentPicker', () => {
  describe('auto-reveal (no explicit override)', () => {
    it('shows when AI development is unlocked (ask + build)', () => {
      expect(shouldShowAgentPicker({ agents: [ask, build] })).toBe(true);
    });

    it('shows for the legacy alias catalog too', () => {
      expect(shouldShowAgentPicker({ agents: [dataChat, metadataAssistant] })).toBe(true);
    });

    it('stays hidden for a pure end-user app (ask only)', () => {
      expect(shouldShowAgentPicker({ agents: [ask] })).toBe(false);
    });

    it('stays hidden when only custom agents exist', () => {
      expect(shouldShowAgentPicker({ agents: [ask, custom] })).toBe(false);
    });

    it('is suppressed when AI Studio (authoring) is deployment-disabled', () => {
      expect(
        shouldShowAgentPicker({ agents: [ask, build], aiStudioEnabled: false }),
      ).toBe(false);
    });
  });

  describe('env opt-in (VITE_AI_SHOW_AGENT_PICKER)', () => {
    it('forces the picker on even for a single-agent end-user catalog', () => {
      expect(shouldShowAgentPicker({ agents: [ask], envOptIn: true })).toBe(true);
    });
  });

  describe('explicit prop wins outright', () => {
    it('true forces on even with an empty catalog', () => {
      expect(shouldShowAgentPicker({ agents: [], showAgentPickerProp: true })).toBe(true);
    });

    it('false forces off even when AI development is unlocked', () => {
      expect(
        shouldShowAgentPicker({ agents: [ask, build], showAgentPickerProp: false }),
      ).toBe(false);
    });

    it('false beats the env opt-in', () => {
      expect(
        shouldShowAgentPicker({ agents: [ask], showAgentPickerProp: false, envOptIn: true }),
      ).toBe(false);
    });
  });
});
