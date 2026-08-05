/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * InlineCreateRelated — the card header's close button needs an accessible
 * name (objectui#3411).
 *
 * Fourth of the family, and again a different class:
 *   - #3299 — the required STATE never reached the a11y tree;
 *   - #3341 — a label EXISTED but was never associated with its control;
 *   - #3381 — the search box had NO label, so its name fell through to the
 *     placeholder (a last-resort source, and one `dom-accessibility-api` does
 *     not implement at all);
 *   - this one — the close button had NO name source whatsoever. Its only
 *     child was a lucide `X`, and lucide-react defaults childless,
 *     a11y-prop-less icons to `aria-hidden="true"` (`hasA11yProp` in
 *     `lucide-react` 1.25.x), so the icon is excluded from the a11y tree and
 *     the computed name is the empty string — in every implementation, with no
 *     browser-side fallback of the kind the placeholder at least had. A screen
 *     reader announced a nameless "button". WCAG 4.1.2 / 2.4.6.
 *
 * Assertion shape (per the issue): the button is located STRUCTURALLY — it is
 * the only button inside the card header — and *then* asserted to have a name.
 * The deliberately avoided form is the indirect "no text-less button exists on
 * the card", which any unrelated change that removes or renames a button can
 * turn green without the close button ever gaining a name.
 *
 * Reverse verification (direction predicted before running, then confirmed):
 * plain before-red/after-green, because the name has exactly one source and no
 * downstream gate counts findings here. Run against the unfixed tree, all 7
 * cases fail — and the structural lookup itself still succeeds, so the failure
 * is the name and not a moved element:
 *   × names the card header close button
 *       expect(element).toHaveAccessibleName()
 *       Expected element to have accessible name: undefined
 *       Received: (empty)
 *   × exposes the close button to getByRole with its name
 *       Unable to find an accessible element with the role "button" and
 *       name `/^Close$/`
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { InlineCreateRelated } from '../InlineCreateRelated';
import type { InlineCreateRelatedProps } from '../InlineCreateRelated';

afterEach(cleanup);

const records = [
  { id: '1', label: 'Northwind Traders', description: 'Customer' },
  { id: '2', label: 'Contoso Ltd', description: 'Partner' },
];

/**
 * Mount and expand the card (collapsed, the component renders only its two
 * trigger buttons and no header at all).
 */
function openCard(
  props: Partial<InlineCreateRelatedProps> = {},
  via: 'create' | 'link' = 'create',
) {
  const utils = render(
    <InlineCreateRelated
      objectName="Contact"
      relationshipField="account_id"
      fields={[{ name: 'name', label: 'Name', type: 'string' }]}
      onCreateRecord={vi.fn()}
      onLinkRecord={vi.fn()}
      existingRecords={records}
      {...props}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: via === 'create' ? /New / : /Link Existing/ }),
  );
  return utils;
}

/**
 * The close button located WITHOUT reference to its name: the card header
 * renders one title span plus exactly one button, so the button is addressable
 * structurally. Every name assertion below starts from this handle, which is
 * what makes them direct — a lost name fails the assertion instead of quietly
 * losing its subject.
 */
function headerCloseButton(titleText = 'Create Contact'): HTMLElement {
  const title = screen.getByText(titleText);
  const buttons = within(title.parentElement!).getAllByRole('button');
  expect(buttons).toHaveLength(1);
  return buttons[0];
}

describe('InlineCreateRelated — card header close button accessible name (objectui#3411)', () => {
  it('names the card header close button', () => {
    openCard();

    // Pre-fix this computed to '' — the lucide X is aria-hidden and there is
    // no other name source on the button.
    const close = headerCloseButton();
    expect(close).toHaveAccessibleName();
    expect(close).toHaveAccessibleName('Close');
  });

  it('exposes the close button to getByRole with its name', () => {
    openCard();

    // The acceptance query from the issue. Anchored so it cannot be satisfied
    // by some other button whose name merely contains "Close".
    const close = screen.getByRole('button', { name: /^Close$/ });
    expect(close).toBe(headerCloseButton());
  });

  it('names the button that actually closes the card, not a look-alike', () => {
    // Ties the name to the behaviour: the named button must be the one that
    // collapses the card back to its triggers.
    openCard();
    expect(screen.getByText('Create Contact')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));

    expect(screen.queryByText('Create Contact')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Contact/ })).toBeInTheDocument();
  });

  it('keeps the icon decorative, so the name comes from the label alone', () => {
    openCard();

    const close = headerCloseButton();
    const icon = close.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    // The icon contributes nothing: strip the button of visible text and the
    // name is still there, i.e. it is not being read off any child.
    expect(close.textContent?.trim()).toBe('');
    expect(close).toHaveAccessibleName('Close');
  });

  it('names the close button on the link tab too', () => {
    // The header — and therefore the close button — is rendered above the
    // tabs, so the name must not depend on which tab opened the card.
    openCard({ onCreateRecord: undefined }, 'link');

    const close = headerCloseButton('Link Contact');
    expect(close).toHaveAccessibleName('Close');
    expect(screen.getByRole('button', { name: /^Close$/ })).toBe(close);
  });

  it('leaves every other button on the expanded card named as before', () => {
    // Guards the fix's blast radius: this card's other buttons already had
    // names from their text, and none of them may have become "Close".
    openCard();

    const named = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '');
    expect(named.filter((n) => n === 'Close')).toHaveLength(1);
    expect(named.every((n) => n.length > 0)).toBe(true);
    expect(named).toEqual(expect.arrayContaining(['Cancel', 'Create']));
  });

  it('names the close button of every instance when two lists share a page', () => {
    // A detail page renders one of these per related list. The name is a
    // constant, so both must carry it — this pins that it is on the element
    // and not, say, minted once from an id.
    render(
      <div>
        <div data-testid="list-a">
          <InlineCreateRelated
            objectName="Contact"
            relationshipField="account_id"
            fields={[]}
            onLinkRecord={vi.fn()}
            existingRecords={records}
          />
        </div>
        <div data-testid="list-b">
          <InlineCreateRelated
            objectName="Opportunity"
            relationshipField="account_id"
            fields={[]}
            onLinkRecord={vi.fn()}
            existingRecords={records}
          />
        </div>
      </div>,
    );
    const [triggerA, triggerB] = screen.getAllByRole('button', { name: /Link Existing/ });
    fireEvent.click(triggerA);
    fireEvent.click(triggerB);

    const closes = screen.getAllByRole('button', { name: /^Close$/ });
    expect(closes).toHaveLength(2);
    expect(within(screen.getByTestId('list-a')).getByRole('button', { name: /^Close$/ }))
      .toHaveAccessibleName('Close');
    expect(within(screen.getByTestId('list-b')).getByRole('button', { name: /^Close$/ }))
      .toHaveAccessibleName('Close');
  });
});
