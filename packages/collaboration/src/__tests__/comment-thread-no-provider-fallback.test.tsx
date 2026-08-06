/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Every string objectstack#5506 / objectui#3424 moved into the locale packs
 * still resolves to ENGLISH when no `I18nProvider` is mounted.
 *
 * `CommentThread` is exported for standalone use and its host may mount no
 * ObjectUI shell at all. Routing a literal through `t()` without a working
 * default is exactly how a label turns into a raw dotted key
 * (`collaboration.reply`) in someone else's app — and it would do so silently,
 * because `fallbackLng: 'en'` never fires when there is no i18next instance to
 * fall back inside of. `COLLAB_DEFAULT_TRANSLATIONS` is the thing that has to
 * hold, and this file is what holds it.
 *
 * ── Directions: predicted first, then corrected by the run ────────────────
 * **Every** assertion in this file is GREEN on BOTH sides of the change.
 * That is the invariant, not a missing test: the English copy is supposed to
 * be byte-identical before and after, so a flip would mean the copy moved.
 * What this file catches is a break introduced by *this* change — a key wired
 * into the component but missing (or mis-spelled) in
 * `COLLAB_DEFAULT_TRANSLATIONS` goes red here and nowhere else.
 *
 * One prediction was wrong and is recorded rather than dropped: the singular
 * comment count was expected to be red-before, on the assumption that the
 * header glued a bare `s` on with no singular branch — the way `page:tabs`'
 * badge did in objectui#3423 ("1 items"). `origin/main` in fact reads
 * `` `${n} comment${n !== 1 ? 's' : ''}` `` and already produced correct
 * English, so that case is green on both sides like the rest. The real defect
 * in those two sites is that the plural RULE was compiled into the component
 * and no locale could apply its own; the `de` cases in
 * `comment-thread-i18n.test.tsx` are what pin that.
 *
 * ── Why this is its own FILE, not a describe block ────────────────────────
 * `createI18n` calls `instance.use(initReactI18next)`, and `initReactI18next`
 * registers that instance as **react-i18next's module-global default**. The
 * registration survives unmount and `cleanup()`. So the moment any test in a
 * file mounts `<I18nProvider config={{ defaultLanguage: 'zh' }}>`, every later
 * "no provider" render in that same file silently resolves against the Chinese
 * instance — a file that looks green while asserting nothing about the
 * fallback, or a baffling red where a provider-less thread renders 中文.
 *
 * Vitest's `dom` project runs with `isolate: true`, so a file that never mounts
 * a provider gets a genuinely clean global. Keep it that way: **do not import
 * or mount `I18nProvider` here.** (Importing `@object-ui/i18n` for a pure
 * helper would be safe — nothing calls `createI18n` at module scope — but the
 * cheapest way to keep that true is to not import it at all.)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CommentThread, type Comment } from '../CommentThread';
import { COLLAB_DEFAULT_TRANSLATIONS } from '../useCollaborationTranslation';

const alice = { id: 'u_alice', name: 'Alice Chen' };
const bob = { id: 'u_bob', name: 'Bob Ito' };

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

const comments: Comment[] = [
  { id: 'c1', author: alice, content: 'First pass looks good.', mentions: [], createdAt: minutesAgo(0) },
  {
    id: 'c2',
    author: bob,
    content: 'Agreed.',
    mentions: [],
    createdAt: minutesAgo(7),
    updatedAt: minutesAgo(6),
    reactions: { '👍': [alice.id, bob.id], '❤️': [alice.id] },
  },
];

function renderBare(overrides: Record<string, unknown> = {}) {
  return render(
    <CommentThread
      threadId="t_1"
      comments={comments}
      currentUser={alice}
      onAddComment={() => {}}
      onEditComment={() => {}}
      onDeleteComment={() => {}}
      onResolve={() => {}}
      onReaction={() => {}}
      {...overrides}
    />,
  );
}

afterEach(() => cleanup());

describe('CommentThread with no I18nProvider — English fallback (objectstack#5506)', () => {
  it('renders the header, sort control and resolve button in English', () => {
    renderBare();

    expect(screen.getByText('2 comments')).toBeTruthy();
    expect(screen.getByLabelText('Sort comments')).toBeTruthy();
    expect(screen.getByText('Oldest')).toBeTruthy();
    expect(screen.getByText('Newest')).toBeTruthy();
    expect(screen.getByText('Resolve')).toBeTruthy();
  });

  it('renders relative timestamps and the edited marker in English', () => {
    renderBare();

    expect(screen.getByText('just now')).toBeTruthy();
    expect(screen.getByText('7m ago')).toBeTruthy();
    expect(screen.getByText('(edited)')).toBeTruthy();
  });

  it('renders reaction tooltips and per-comment actions in English', () => {
    renderBare();

    expect(screen.getByTitle('2 reactions')).toBeTruthy();
    expect(screen.getByTitle('1 reaction')).toBeTruthy();
    expect(screen.getByTitle('Add thumbs up')).toBeTruthy();
    expect(screen.getAllByText('Reply').length).toBeGreaterThan(0);
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('renders the inline editor and reply banner in English', () => {
    renderBare();

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();

    fireEvent.click(screen.getAllByText('Reply')[0]);
    expect(screen.getByText('Replying to Bob Ito...')).toBeTruthy();
  });

  it('renders the composer in English', () => {
    renderBare();

    expect(screen.getByPlaceholderText('Add a comment... (use @ to mention)')).toBeTruthy();
    expect(screen.getByText('Send')).toBeTruthy();
  });

  it('appends the resolved marker in English', () => {
    renderBare({ resolved: true });

    expect(screen.getByText('2 comments · Resolved')).toBeTruthy();
    expect(screen.getByText('Reopen')).toBeTruthy();
  });

  /**
   * A copy pin, green on both sides — see the file header for why this was
   * expected to be the one red-before case and is not.
   */
  it('has a real English singular for a one-comment thread', () => {
    renderBare({ comments: [comments[0]] });

    expect(screen.getByText('1 comment')).toBeTruthy();
    expect(screen.queryByText('1 comments')).toBeNull();
  });

  /**
   * The failure mode this whole file exists to catch: a key wired into the
   * component but absent from the defaults map renders as its own dotted name.
   */
  it('never renders a raw i18n key', () => {
    const { container } = renderBare({ resolved: true });

    expect(container.textContent).not.toMatch(/collaboration\.\w+/);
    expect(container.textContent).not.toMatch(/common\.\w+/);
    expect(container.innerHTML).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe('COLLAB_DEFAULT_TRANSLATIONS is the package-wide English source', () => {
  /**
   * The defaults map is the *only* English copy left in the package, so an
   * empty or half-populated map would make every assertion above pass for the
   * wrong reason (a key that resolves to itself still "renders").
   */
  it('covers every key the thread asks for, with no placeholder-only values', () => {
    const keys = Object.keys(COLLAB_DEFAULT_TRANSLATIONS);

    expect(keys.length).toBeGreaterThanOrEqual(25);
    expect(keys).toContain('collaboration.reactionCount');
    expect(keys).toContain('collaboration.reactionCountOne');
    // The shared action words are borrowed from `common`, not re-spelled.
    expect(keys).toContain('common.save');
    expect(keys.some((k) => k.startsWith('collaboration.save'))).toBe(false);

    for (const [key, value] of Object.entries(COLLAB_DEFAULT_TRANSLATIONS)) {
      expect(value, `${key} has no English copy`).toBeTruthy();
      expect(value, `${key} is just its own key`).not.toBe(key);
    }
  });

  /**
   * The reaction tooltip must NOT be `detail.reactionCount`, which carries an
   * `{{emoji}}` this call site has no value for.
   */
  it('keeps the reaction tooltip free of an {{emoji}} placeholder', () => {
    expect(COLLAB_DEFAULT_TRANSLATIONS['collaboration.reactionCount']).toBe('{{count}} reactions');
    expect(COLLAB_DEFAULT_TRANSLATIONS['collaboration.reactionCountOne']).toBe('{{count}} reaction');
  });
});
