#!/usr/bin/env node
/**
 * Fails when a pending changeset declares a `major` bump.
 *
 * Why this is a gate and not a review note: every publishable package in this
 * repo sits in ONE `fixed` group (`.changeset/config.json`, 39 packages), and
 * changesets applies the highest bump in the group to all of it. So a single
 * `"@object-ui/layout": major` does not release one package as a major — it
 * carries the whole family to the next major and off `@objectstack`'s line.
 *
 * That matters because objectui's major is not its own count of breaking
 * changes: it is pinned to the `@objectstack` (spec/client/formula) major, so
 * that "same major ⇒ compatible" holds across the two repos (AGENTS.md
 * §版本号策略). objectui's own breaking changes ship as `minor` with the break
 * spelled out in the changeset body. The major moves exactly once per
 * objectstack major, deliberately.
 *
 * This ran for the first time against four pending changesets scoring `major`
 * (17 package entries between them) during the 17.x line — enough to publish
 * 39 packages as 18.0.0 against an `@objectstack` still on 17. The rule was
 * already written down; nothing executed it, and no workflow even looked at
 * `.changeset/**` (at the time `ci.yml` and `lint.yml` both listed it under
 * `paths-ignore` on their `pull_request` trigger, so a changeset-only PR started
 * nothing at all).
 *
 * That parenthetical is history, not today's shape: objectui#3523 step 2 deleted
 * `paths-ignore` from those two `pull_request` triggers and it remains ONLY on
 * `push`, so such a PR now starts both workflows and produces their contexts.
 * What skips is the expensive work inside them — the `Decide whether this change
 * needs a full run` step excludes markdown and `.changeset/**` and skips every
 * step below itself. So no gate in either workflow reads the changeset either
 * way, and this one, run by `.github/workflows/changeset-guard.yml` outside that
 * in-job switch, is still the only thing that judges such a PR. The conclusion
 * outlived its premise; objectui#3857 pinned the correction.
 *
 * The one legitimate major is the synchronized bump that follows objectstack
 * across ITS major. Set `OBJECTUI_ALLOW_MAJOR=1` for that release, and only
 * then.
 *
 * Run:  node scripts/check-changeset-no-major.mjs
 * Exit: 0 = no `major` declared, 1 = at least one `major` declared
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const changesetDir = resolve(root, '.changeset');

/** `.changeset/README.md` is documentation, not a changeset. */
const NOT_A_CHANGESET = new Set(['README.md']);

/**
 * Package/bump pairs from a changeset's YAML frontmatter — the block between
 * the leading `---` and the next `---`.
 *
 * Hand-parsed on purpose: this check runs in CI on a bare checkout with no
 * `pnpm install` (the job is a checkout plus a `node` invocation), so it may
 * not import a YAML parser or `@changesets/*`. The frontmatter dialect is
 * tiny and fully covered here — one `name: bump` per line, name optionally
 * quoted, `#` comments and blank lines ignored.
 *
 * @param {string} source raw file contents
 * @returns {{ pkg: string, bump: string, line: number }[]}
 */
export function parseFrontmatterBumps(source) {
  const lines = source.split(/\r?\n/);
  const open = lines.findIndex((line) => line.trim() === '---');
  if (open === -1) return [];

  const bumps = [];
  for (let i = open + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '---') break; // end of frontmatter
    const text = raw.trim();
    if (text === '' || text.startsWith('#')) continue;

    const match = text.match(
      /^(?:"([^"]+)"|'([^']+)'|([^:]+?))\s*:\s*(major|minor|patch)\s*$/
    );
    if (!match) continue;

    bumps.push({
      pkg: match[1] ?? match[2] ?? match[3],
      bump: match[4],
      line: i + 1, // 1-based, for a clickable `file:line`
    });
  }
  return bumps;
}

/**
 * @param {{ file: string, source: string }[]} changesets
 * @returns {{ file: string, pkg: string, line: number }[]} every `major` entry
 */
export function findMajorBumps(changesets) {
  return changesets.flatMap(({ file, source }) =>
    parseFrontmatterBumps(source)
      .filter(({ bump }) => bump === 'major')
      .map(({ pkg, line }) => ({ file, pkg, line }))
  );
}

/** Reads `.changeset/*.md`, minus the README. */
function readChangesets(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return []; // no `.changeset/` — nothing to police
  }
  return entries
    .filter((name) => name.endsWith('.md') && !NOT_A_CHANGESET.has(name))
    .sort()
    .map((name) => ({
      file: join('.changeset', name),
      source: readFileSync(join(dir, name), 'utf8'),
    }));
}

function main() {
  const offenders = findMajorBumps(readChangesets(changesetDir));

  if (offenders.length === 0) {
    console.log('✅  No changeset declares a `major` bump.');
    return 0;
  }

  if (process.env.OBJECTUI_ALLOW_MAJOR === '1') {
    console.log(
      `⚠️   OBJECTUI_ALLOW_MAJOR=1 — allowing ${offenders.length} \`major\` entr${
        offenders.length === 1 ? 'y' : 'ies'
      }.`
    );
    console.log(
      '    Only correct when this release follows `@objectstack` across its own major.'
    );
    return 0;
  }

  console.error('❌  A changeset declares a `major` bump:\n');
  for (const { file, pkg, line } of offenders) {
    console.error(`    • ${pkg}  (${file}:${line})`);
  }
  console.error(`
Every publishable package is in one \`fixed\` group, so ONE \`major\` publishes
all of them as the next major — objectui would leave the \`@objectstack\` major
it is pinned to, and "same major ⇒ compatible" would stop holding.

Fix: score it \`minor\` and describe the break in the changeset body (that is
the convention, not an oversight — see AGENTS.md §版本号策略).

Following \`@objectstack\` across its own major is the one exception; that
release sets OBJECTUI_ALLOW_MAJOR=1.
`);
  return 1;
}

// Only run when invoked as a script — the tests import the parser above.
if (isEntrypoint(import.meta.url)) {
  process.exit(main());
}
