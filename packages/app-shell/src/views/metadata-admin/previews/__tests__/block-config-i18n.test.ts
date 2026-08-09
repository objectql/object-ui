// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#3913 — every curated page-block label is a translation key that
 * BOTH locales define, and the key is the one its POSITION implies.
 *
 * ## What was broken
 *
 * `PageBlockInspector`'s chrome went through `t('engine.inspector.pageBlock.*')`
 * from the start; the panel's CONTENTS — the 152 field/option labels and 5
 * `addLabel`s of `block-config.ts` — were English literals handed straight to
 * the field components. A zh-CN admin opening any page block therefore read
 * 「属性」 over a stack of English field names: two languages in one panel, no
 * special data needed to reproduce.
 *
 * ## Why the assertions are two, not one
 *
 * "Does the key exist in both tables?" is the obvious check and it is not
 * enough. The keys are near-identical strings differing by one segment
 * (`…field.object-grid.columns` vs `…field.object-form.columns`), so the
 * realistic mistake when adding a block is not a typo — it is copy-pasting a
 * neighbouring block's key, which EXISTS in both locales and renders a plausible
 * label belonging to a different property. An existence-only check is green for
 * that, and the author reads a correct-looking panel that edits the wrong-named
 * field.
 *
 * So the key is DERIVED here from the label's position in `BLOCK_CONFIG` and
 * compared with what the table stores. Derivation is what makes the mistake
 * mechanically visible, and it is the reason the key shape is positional in the
 * first place rather than semantic.
 *
 *   field label          engine.inspector.pageBlock.field.<blockType>.<name>
 *   nested item label    engine.inspector.pageBlock.field.<blockType>.<array>.<name>
 *   array add button     engine.inspector.pageBlock.add.<blockType>.<name>
 *   select/color option  engine.inspector.pageBlock.option.<fieldName>.<value>
 *
 * Option keys omit the block type on purpose (so `format`'s number/currency/
 * percent are translated once and shared by `object-metric` and
 * `element:number`); field keys carry it on purpose, because the same English
 * word needs different Chinese per block — `element:button.label` is a button
 * caption 「按钮文字」 while `page:tabs.items.label` is a tab title 「标签」.
 *
 * Completeness is asserted through `t()` rather than by importing the tables:
 * `t()` returns the key unchanged on a miss, so `t(key, locale) === key` is
 * exactly "this locale has no translation" — measured through the same accessor
 * the component uses, not a private table this test would have to be given.
 */

import { describe, it, expect } from 'vitest';
import { BLOCK_CONFIG, type BlockPropField } from '../block-config';
import { t } from '../../i18n';

const PREFIX = 'engine.inspector.pageBlock';

/** One translatable label site: where it lives, what key that implies, what is stored. */
interface LabelSite {
  /** `field` | `add` | `option` — which key family. */
  family: 'field' | 'add' | 'option';
  /** The key the site's position implies. */
  derived: string;
  /** The key `block-config.ts` actually stores there. */
  stored: string;
  /** Human-readable position, for assertion messages. */
  where: string;
}

/** Walk BLOCK_CONFIG and derive a key for every label / addLabel / option label. */
function labelSites(): LabelSite[] {
  const sites: LabelSite[] = [];

  const walk = (f: BlockPropField, blockType: string, path: string[]) => {
    const dotted = [...path, f.name].join('.');
    sites.push({
      family: 'field',
      derived: `${PREFIX}.field.${blockType}.${dotted}`,
      stored: f.label,
      where: `${blockType}.${dotted} (label)`,
    });

    if (f.kind === 'array') {
      sites.push({
        family: 'add',
        derived: `${PREFIX}.add.${blockType}.${dotted}`,
        stored: f.addLabel,
        where: `${blockType}.${dotted} (addLabel)`,
      });
      for (const itf of f.itemFields) walk(itf, blockType, [...path, f.name]);
    }

    // `select` always has options; `color` may. Both render their labels.
    const options = (f as { options?: Array<{ value: string; label: string }> }).options;
    if (Array.isArray(options)) {
      for (const o of options) {
        sites.push({
          family: 'option',
          derived: `${PREFIX}.option.${f.name}.${o.value}`,
          stored: o.label,
          where: `${blockType}.${dotted} option=${o.value}`,
        });
      }
    }
  };

  for (const [blockType, fields] of Object.entries(BLOCK_CONFIG)) {
    for (const f of fields) walk(f, blockType, []);
  }
  return sites;
}

const SITES = labelSites();

/**
 * Keys whose two locales are deliberately identical (an acronym, a symbol —
 * nothing to translate). EMPTY today, and it is a ledger rather than a rule: a
 * genuinely locale-invariant label is added here with its reason, so "the zh
 * column is a copy of the en column" stays a red build everywhere else.
 */
const LOCALE_INVARIANT = new Set<string>();

describe('block-config labels are translation keys (#3913)', () => {
  it('collects every label site — the walk itself is not empty', () => {
    // Guards the derivation: a refactor that stops finding labels would make
    // every per-site assertion below vacuous by iterating nothing.
    expect(SITES.length).toBeGreaterThan(150);
    const families = SITES.reduce<Record<string, number>>((acc, s) => {
      acc[s.family] = (acc[s.family] ?? 0) + 1;
      return acc;
    }, {});
    // 152 `label:` + 5 `addLabel:` literals at the time of the fix; option sites
    // are counted per USE, so shared option lists (`format`, `ALIGN_OPTS`) are
    // visited once per referencing field.
    expect(families.field).toBeGreaterThan(80);
    expect(families.add).toBe(5);
    expect(families.option).toBeGreaterThan(50);
  });

  it('stores exactly the key its position implies', () => {
    // The copy-paste guard. A neighbouring block's key exists in both locales,
    // so nothing else in this file would notice it.
    const wrong = SITES.filter((s) => s.stored !== s.derived).map(
      (s) => `${s.where}: stored '${s.stored}' but position implies '${s.derived}'`,
    );
    expect(wrong).toEqual([]);
  });

  it('no label is left as display text', () => {
    // Belt to the braces above: an English literal cannot even look like a key.
    const literals = SITES.filter((s) => !s.stored.startsWith(`${PREFIX}.`)).map(
      (s) => `${s.where}: '${s.stored}'`,
    );
    expect(literals).toEqual([]);
  });

  it('every key resolves in en-US', () => {
    const missing = SITES.filter((s) => t(s.derived, 'en-US') === s.derived).map((s) => s.derived);
    expect([...new Set(missing)]).toEqual([]);
  });

  it('every key resolves in zh-CN', () => {
    // The defect this issue filed, as a structural assertion: a field added to
    // BLOCK_CONFIG without a zh translation is red here rather than shipping as
    // an English box in a Chinese panel.
    const missing = SITES.filter((s) => t(s.derived, 'zh-CN') === s.derived).map((s) => s.derived);
    expect([...new Set(missing)]).toEqual([]);
  });

  it('zh-CN is actually translated, not a copy of en-US', () => {
    const untranslated = SITES.filter(
      (s) => !LOCALE_INVARIANT.has(s.derived) && t(s.derived, 'zh-CN') === t(s.derived, 'en-US'),
    ).map((s) => `${s.derived} = '${t(s.derived, 'en-US')}'`);
    // If a label really is locale-invariant, add it to LOCALE_INVARIANT above
    // with the reason — do not weaken this assertion.
    expect([...new Set(untranslated)]).toEqual([]);
  });

  it('one key never carries two different meanings', () => {
    // Option keys drop the block type, so the same key is reached from several
    // positions by design — but only ever for the same concept. Two positions
    // sharing a key while meaning different things would translate one of them
    // wrongly, and `t()` cannot tell.
    const byKey = new Map<string, Set<string>>();
    for (const s of SITES) {
      if (!byKey.has(s.derived)) byKey.set(s.derived, new Set());
      byKey.get(s.derived)!.add(s.family);
    }
    const crossFamily = [...byKey.entries()]
      .filter(([, families]) => families.size > 1)
      .map(([key, families]) => `${key}: ${[...families].join('+')}`);
    expect(crossFamily).toEqual([]);

    // A `field`/`add` key is positional and must therefore be unique outright;
    // only `option` keys may legitimately repeat.
    const positional = SITES.filter((s) => s.family !== 'option').map((s) => s.derived);
    expect(positional.length).toBe(new Set(positional).size);
  });
});

/**
 * The English side must not have moved. `en-US` is this repo's baseline
 * language and the table is what the drift discipline protects, so the fix is
 * only correct if it changed WHERE the English text comes from and not the text
 * itself. Sampled across every field kind plus all five add buttons — the
 * remaining keys were substituted mechanically from the pre-change literals
 * (see the PR), which is why a sample is a regression pin here rather than the
 * proof of the migration.
 */
describe('en-US labels are unchanged by the key migration (#3913)', () => {
  const EXPECTED: Record<string, string> = {
    // object-picker / field-list / number / boolean
    'engine.inspector.pageBlock.field.object-grid.objectName': 'Object',
    'engine.inspector.pageBlock.field.object-grid.columns': 'Columns',
    'engine.inspector.pageBlock.field.object-grid.pageSize': 'Page size',
    'engine.inspector.pageBlock.field.object-grid.striped': 'Striped rows',
    // the same field NAME in another block, with different text — the case that
    // makes the key positional
    'engine.inspector.pageBlock.field.object-form.columns': 'Columns (grid layout)',
    'engine.inspector.pageBlock.field.element:definition-list.columns': 'Columns (1 or 2)',
    'engine.inspector.pageBlock.field.grid.columns': 'Columns',
    // text / json / color / field-picker
    'engine.inspector.pageBlock.field.element:image.src': 'Source URL',
    'engine.inspector.pageBlock.field.element:button.action': 'Action',
    'engine.inspector.pageBlock.field.object-metric.colorVariant': 'Color',
    'engine.inspector.pageBlock.field.object-kanban.groupField': 'Group by field',
    // string-list / array container
    'engine.inspector.pageBlock.field.record:quick_actions.actionNames': 'Action names',
    'engine.inspector.pageBlock.field.record:details.sections': 'Sections',
    // the #3819 label, whose wording is itself load-bearing
    'engine.inspector.pageBlock.field.record:details.sections.name': 'Name (i18n key)',
    // all five add buttons
    'engine.inspector.pageBlock.add.element:definition-list.items': 'Add item',
    'engine.inspector.pageBlock.add.page:tabs.items': 'Add tab',
    'engine.inspector.pageBlock.add.page:accordion.items': 'Add section',
    'engine.inspector.pageBlock.add.record:details.sections': 'Add section',
    'engine.inspector.pageBlock.add.record:path.stages': 'Add stage',
    // options, incl. the shared `format` list and the shared ALIGN_OPTS
    'engine.inspector.pageBlock.option.format.currency': 'Currency',
    'engine.inspector.pageBlock.option.align.center': 'Center',
    'engine.inspector.pageBlock.option.location.record_more': 'Record more menu',
    'engine.inspector.pageBlock.option.severity.warning': 'Warning',
  };

  it('renders the pre-change English text for every sampled key', () => {
    for (const [key, text] of Object.entries(EXPECTED)) {
      expect(t(key, 'en-US'), key).toBe(text);
    }
  });

  it('every sampled key is one the table really reaches', () => {
    // Without this, a renamed key would leave the sample above asserting
    // `t()`'s key-passthrough against itself and passing.
    const derived = new Set(SITES.map((s) => s.derived));
    const orphans = Object.keys(EXPECTED).filter((k) => !derived.has(k));
    expect(orphans).toEqual([]);
  });
});
