/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#5695 — `detectReplayOutcome` and its suppression contract.
 *
 * The replay envelope is the ordinary authoring envelope under a synthetic
 * `replay_<turn>_<i>` toolCallId (cloud `runApprovedProposalReplay`); the
 * failure stamp is cloud#1467's `publishFailed:true` + `publishOutcome` +
 * `publishError` over `status:'drafted'`. The dangerous shape is the failed
 * one: before this detector, `detectDraftResult` matched it and the chat
 * rendered a rolled-back publish as an ordinary successful draft card with a
 * live Publish button.
 */
import { describe, it, expect } from 'vitest';
import { detectReplayOutcome, uiMessagesToChatMessages } from '../mapMessages';

const FAILED = JSON.stringify({
  status: 'drafted',
  drafted: [{ type: 'view', name: 'k9qk_task.board' }],
  packageId: 'app.k9qk',
  publishFailed: true,
  publishOutcome: 'rolled_back',
  publishError: 'publish gate: dangling view reference\nsecond line of detail',
});

describe('detectReplayOutcome (objectui#5695)', () => {
  it('lifts a published replay', () => {
    expect(detectReplayOutcome('replay_t1_0', JSON.stringify({ status: 'published' }))).toEqual({
      kind: 'published',
    });
  });

  it('lifts a drafted replay with its packageId for the inline publish affordance', () => {
    expect(
      detectReplayOutcome(
        'replay_t1_0',
        JSON.stringify({ status: 'drafted', drafted: [{ type: 'view', name: 'v' }], packageId: 'app.k9qk' }),
      ),
    ).toEqual({ kind: 'drafted', packageId: 'app.k9qk' });
  });

  it('lifts a failed publish with the machine verdict and the FIRST line of publishError', () => {
    expect(detectReplayOutcome('replay_t1_0', FAILED)).toEqual({
      kind: 'failed',
      outcome: 'rolled_back',
      error: 'publish gate: dangling view reference',
      packageId: 'app.k9qk',
    });
  });

  it('ignores the same envelope under a NON-replay toolCallId — ordinary tool results keep their cards', () => {
    expect(detectReplayOutcome('call_abc', FAILED)).toBeUndefined();
    expect(detectReplayOutcome(undefined, FAILED)).toBeUndefined();
  });

  it('ignores replay results that are not authoring envelopes', () => {
    expect(detectReplayOutcome('replay_t1_0', JSON.stringify({ status: 'ok' }))).toBeUndefined();
    expect(detectReplayOutcome('replay_t1_0', 'plain text')).toBeUndefined();
  });
});

describe('replay suppression in the live mapper (objectui#5695)', () => {
  it('a failed replay carries replayOutcome and NO draftReview — never a live Publish button over a rollback', () => {
    const [msg] = uiMessagesToChatMessages([
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-update_metadata',
            toolCallId: 'replay_t1_0',
            state: 'output-available',
            output: FAILED,
          },
        ],
      },
    ] as never);
    const tool = msg.toolInvocations?.[0];
    expect(tool?.replayOutcome?.kind).toBe('failed');
    expect(tool?.draftReview).toBeUndefined();
  });

  it('the same drafted envelope under an ordinary id still produces the draft card', () => {
    const [msg] = uiMessagesToChatMessages([
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-update_metadata',
            toolCallId: 'call_1',
            state: 'output-available',
            output: JSON.stringify({
              status: 'drafted',
              drafted: [{ type: 'view', name: 'v' }],
              packageId: 'app.k9qk',
            }),
          },
        ],
      },
    ] as never);
    const tool = msg.toolInvocations?.[0];
    expect(tool?.draftReview?.items).toEqual([{ type: 'view', name: 'v' }]);
    expect(tool?.replayOutcome).toBeUndefined();
  });
});
