/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `CommentThread` speaks the session language — objectstack#5506 / objectui#3424.
 *
 * The whole package shipped its copy as English literals, so a `zh` console
 * rendered a Chinese shell around an English comment thread: "3 comments",
 * "Reply", "Resolve", "just now", "Add a comment... (use @ to mention)".
 *
 * ── Directions: predicted first, then corrected by the run ────────────────
 * Reverting `CommentThread.tsx` to `origin/main` and keeping this file turns
 * all 13 `zh` / `de` / `ja` cases RED and leaves all 4 `en` cases GREEN.
 *
 * The `en` cases being green on BOTH sides is the point, not a gap: the
 * English copy must survive the move into the locale packs, and a case that
 * flipped would mean the copy changed under us.
 *
 * One prediction was WRONG and is recorded here rather than quietly dropped.
 * The `en` singular case (`1 comment`) was expected to be red-before, on the
 * assumption that the header glued a bare `s` on with no singular branch —
 * the way `page:tabs`' count badge did in objectstack#5506's earlier half
 * (objectui#3423), where a one-row list announced "1 items". It does not:
 * `origin/main` reads `` `${n} comment${n !== 1 ? 's' : ''}` `` and the
 * reaction tooltip reads `n === 1 ? '1 reaction' : …`, so both already
 * produced correct English. The defect they carry is different — the plural
 * RULE is compiled into the component, so no locale can apply its own (ru
 * needs three forms, ja needs none, and neither could ever be expressed).
 * The `de` case above is what actually pins that, and the `en` singular cases
 * stay as green-both-sides copy pins.
 *
 * The provider-less English fallback is asserted in
 * `comment-thread-no-provider-fallback.test.tsx` and cannot live here — see
 * that file's header for the react-i18next global-instance reason.
 */

import type { ComponentProps } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import { CommentThread, type Comment } from '../CommentThread';

const alice = { id: 'u_alice', name: 'Alice Chen' };
const bob = { id: 'u_bob', name: 'Bob Ito' };

/** Ages chosen to land squarely inside each bucket, never on a boundary. */
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

const baseComments: Comment[] = [
  {
    id: 'c1',
    author: alice,
    content: 'First pass looks good.',
    mentions: [],
    createdAt: minutesAgo(0),
  },
  {
    id: 'c2',
    author: bob,
    content: 'Agreed.',
    mentions: [],
    createdAt: minutesAgo(5),
    updatedAt: minutesAgo(4),
    reactions: { '👍': [alice.id, bob.id], '❤️': [alice.id] },
  },
];

function renderThread(
  language: string,
  overrides: Partial<ComponentProps<typeof CommentThread>> = {},
) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      <CommentThread
        threadId="t_1"
        comments={baseComments}
        currentUser={alice}
        onAddComment={() => {}}
        onEditComment={() => {}}
        onDeleteComment={() => {}}
        onResolve={() => {}}
        onReaction={() => {}}
        {...overrides}
      />
    </I18nProvider>,
  );
}

afterEach(() => cleanup());

describe('CommentThread header (objectstack#5506)', () => {
  it('counts, sorts and resolves in English under an en session', () => {
    renderThread('en');

    expect(screen.getByText('2 comments')).toBeTruthy();
    expect(screen.getByLabelText('Sort comments')).toBeTruthy();
    expect(screen.getByText('Oldest')).toBeTruthy();
    expect(screen.getByText('Newest')).toBeTruthy();
    expect(screen.getByText('Resolve')).toBeTruthy();
  });

  it('counts, sorts and resolves in Chinese under a zh session', () => {
    renderThread('zh');

    expect(screen.getByText('2 条评论')).toBeTruthy();
    expect(screen.getByLabelText('评论排序')).toBeTruthy();
    expect(screen.getByText('最早优先')).toBeTruthy();
    expect(screen.getByText('最新优先')).toBeTruthy();
    expect(screen.getByText('标记已解决')).toBeTruthy();
    // The English literals are gone, not merely shadowed.
    expect(screen.queryByText('2 comments')).toBeNull();
    expect(screen.queryByLabelText('Sort comments')).toBeNull();
  });

  it('appends the resolved marker in the session language', () => {
    renderThread('zh', { resolved: true });

    expect(screen.getByText('2 条评论 · 已解决')).toBeTruthy();
    // Resolved threads offer "reopen", not "resolve".
    expect(screen.getByText('重新打开')).toBeTruthy();
  });

  /**
   * German is the load-bearing plural case: unlike zh it HAS a distinct
   * singular, so a collapsed one-key scheme would show up right here.
   */
  it('splits singular and plural under a de session', () => {
    renderThread('de', { comments: [baseComments[0]] });
    expect(screen.getByText('1 Kommentar')).toBeTruthy();
    cleanup();

    renderThread('de');
    expect(screen.getByText('2 Kommentare')).toBeTruthy();
  });

  /**
   * Green on both sides — a copy pin, not a demonstration of the bug. See the
   * file header: `origin/main` did have a singular branch here, contrary to
   * the prediction this test was first written under.
   */
  it('has a real English singular for a one-comment thread', () => {
    renderThread('en', { comments: [baseComments[0]] });

    expect(screen.getByText('1 comment')).toBeTruthy();
    expect(screen.queryByText('1 comments')).toBeNull();
  });
});

describe('CommentThread relative timestamps (objectstack#5506)', () => {
  it('reads English relative ages under an en session', () => {
    renderThread('en', {
      comments: [
        { ...baseComments[0], id: 'a', createdAt: minutesAgo(0) },
        { ...baseComments[0], id: 'b', createdAt: minutesAgo(7) },
        { ...baseComments[0], id: 'c', createdAt: minutesAgo(3 * 60) },
        { ...baseComments[0], id: 'd', createdAt: minutesAgo(2 * 24 * 60) },
      ],
    });

    expect(screen.getByText('just now')).toBeTruthy();
    expect(screen.getByText('7m ago')).toBeTruthy();
    expect(screen.getByText('3h ago')).toBeTruthy();
    expect(screen.getByText('2d ago')).toBeTruthy();
  });

  it('reads Chinese relative ages under a zh session', () => {
    renderThread('zh', {
      comments: [
        { ...baseComments[0], id: 'a', createdAt: minutesAgo(0) },
        { ...baseComments[0], id: 'b', createdAt: minutesAgo(7) },
        { ...baseComments[0], id: 'c', createdAt: minutesAgo(3 * 60) },
        { ...baseComments[0], id: 'd', createdAt: minutesAgo(2 * 24 * 60) },
      ],
    });

    expect(screen.getByText('刚刚')).toBeTruthy();
    expect(screen.getByText('7 分钟前')).toBeTruthy();
    expect(screen.getByText('3 小时前')).toBeTruthy();
    expect(screen.getByText('2 天前')).toBeTruthy();
    expect(screen.queryByText('just now')).toBeNull();
    expect(screen.queryByText('7m ago')).toBeNull();
  });

  it('marks an edited comment in the session language', () => {
    renderThread('ja');
    expect(screen.getByText('(編集済み)')).toBeTruthy();
    expect(screen.queryByText('(edited)')).toBeNull();
  });
});

describe('CommentThread reaction tooltip (objectstack#5506)', () => {
  /**
   * The tooltip gets its OWN key pair. `detail.reactionCount` interpolates an
   * `{{emoji}}`, and here the emoji is the chip's visible label with nothing to
   * hand that placeholder — reuse would leave a literal `{{emoji}}` in the
   * accessible name. These assertions are what pins that.
   */
  it('names reaction chips in English, with singular and plural', () => {
    renderThread('en');

    expect(screen.getByTitle('2 reactions')).toBeTruthy();
    expect(screen.getByTitle('1 reaction')).toBeTruthy();
    expect(screen.getByTitle('Add thumbs up')).toBeTruthy();
  });

  it('names reaction chips in the session language', () => {
    renderThread('zh');

    expect(screen.getByTitle('2 个回应')).toBeTruthy();
    expect(screen.getByTitle('点赞')).toBeTruthy();
    expect(screen.queryByTitle('2 reactions')).toBeNull();
    expect(screen.queryByTitle('Add thumbs up')).toBeNull();
  });

  it('never leaks an unresolved placeholder into the tooltip', () => {
    renderThread('de');

    const tooltips = Array.from(document.querySelectorAll('[title]')).map((n) =>
      n.getAttribute('title'),
    );
    expect(tooltips).toContain('2 Reaktionen');
    expect(tooltips).toContain('1 Reaktion');
    // The bug reuse of `detail.reactionCount` would have produced.
    expect(tooltips.some((v) => v?.includes('{{'))).toBe(false);
  });
});

describe('CommentThread per-comment actions (objectstack#5506)', () => {
  it('labels reply / edit / delete in the session language', () => {
    renderThread('zh');

    expect(screen.getAllByText('回复').length).toBeGreaterThan(0);
    expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
    expect(screen.getAllByText('删除').length).toBeGreaterThan(0);
    expect(screen.queryByText('Reply')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('labels the inline editor save / cancel in the session language', () => {
    renderThread('zh');

    // Only the current user's own comment offers Edit; c1 is Alice's.
    fireEvent.click(screen.getAllByText('编辑')[0]);

    expect(screen.getByText('保存')).toBeTruthy();
    expect(screen.getByText('取消')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('translates the reply banner, interpolating the author name', () => {
    renderThread('zh');

    fireEvent.click(screen.getAllByText('回复')[0]);

    expect(screen.getByText('正在回复 Alice Chen…')).toBeTruthy();
    expect(screen.queryByText('Replying to Alice Chen...')).toBeNull();
  });

  /**
   * The no-author half of the banner: the comment being replied to is gone
   * (deleted by someone else mid-reply — the collaboration case this package
   * exists for), so there is no `{{name}}` to interpolate and a separate whole
   * sentence is used instead of substituting a noun.
   */
  it('translates the reply banner when the target comment vanished', () => {
    const { rerender } = renderThread('zh');

    fireEvent.click(screen.getAllByText('回复')[0]);
    rerender(
      <I18nProvider config={{ defaultLanguage: 'zh', detectBrowserLanguage: false }}>
        <CommentThread
          threadId="t_1"
          comments={[]}
          currentUser={alice}
          onAddComment={() => {}}
          onEditComment={() => {}}
          onDeleteComment={() => {}}
          onResolve={() => {}}
          onReaction={() => {}}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('正在回复该评论…')).toBeTruthy();
    expect(screen.queryByText('Replying to comment...')).toBeNull();
  });
});

describe('CommentThread composer (objectstack#5506)', () => {
  it('translates the placeholder and the send button', () => {
    renderThread('zh');

    expect(screen.getByPlaceholderText('添加评论…(输入 @ 提及他人)')).toBeTruthy();
    expect(screen.getByText('发送')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Add a comment... (use @ to mention)')).toBeNull();
    expect(screen.queryByText('Send')).toBeNull();
  });

  it('keeps the English copy under an en session', () => {
    renderThread('en');

    expect(screen.getByPlaceholderText('Add a comment... (use @ to mention)')).toBeTruthy();
    expect(screen.getByText('Send')).toBeTruthy();
  });

  it('translates the placeholder for ja too', () => {
    renderThread('ja');

    expect(screen.getByPlaceholderText('コメントを追加…(@ でメンション)')).toBeTruthy();
    expect(screen.getByText('送信')).toBeTruthy();
  });
});
