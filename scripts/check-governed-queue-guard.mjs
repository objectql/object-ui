#!/usr/bin/env node

/**
 * check-governed-queue-guard — a governed-surface change may not reach `main`
 * through the merge queue without a human approval record on the pull request
 * it is landing from.
 *
 *   node scripts/check-governed-queue-guard.mjs               # in CI, from the event payload
 *   node scripts/check-governed-queue-guard.mjs --test <paths…>  # offline: "would these govern a PR?"
 *   node scripts/check-governed-queue-guard.mjs --self-test   # offline, no network, no git
 *
 * ## The measured incident this exists for (objectui#6596, ruling 2026-08-27)
 *
 * PR #6183 touched `AGENTS.md` and was correctly parked as a draft for the
 * maintainer to merge by hand. A GitHub MCP `update_pull_request` call passing
 * only `reviewers` silently also set `draft: false`; the pull request entered
 * the merge queue and landed as `5b3290fd5` with no human approval. Converting
 * it back to a draft afterwards did NOT dequeue it. The tool fact is
 * objectstack-ai/objectstack#12200; the incident record and the decision are
 * objectui#6325.
 *
 * Every layer that could have stopped it was a layer of seat discipline, and
 * the failure had no seat in it at all — a hidden side effect on a tool call
 * plus a queue that does not release what it has taken. The maintainer's ruling
 * (「同意，并继续」, accepting Option A + C on #6325) is that the rule stops
 * resting on discipline: this file is the refusal.
 *
 * ## ⭐ The split by EVENT — the single most load-bearing decision here
 *
 *   `merge_group`   → a governed diff whose pull request carries no AUTHORIZED
 *                     APPROVED review is a REFUSAL. The queue build is the last
 *                     thing between a speculative merge and `main`, and it is
 *                     the path the incident took.
 *   `pull_request`  → the identical finding is an EARLY WARNING that exits 0.
 *
 * The pull-request leg must not redden, and not out of politeness. A governed
 * PR sitting as a draft awaiting the maintainer's own merge is the CORRECT
 * terminal state of this regime, so a check that is red on it is red on the
 * healthy case, forever — and a permanently red check trains everyone to ignore
 * red. The sibling repository retired a gate for exactly that (objectstack's
 * 2026-08-18 ruling, 红灯常态化本身有毒). The queue build is the opposite: a
 * state a governed PR should never be in at all, so red there is red on the
 * anomaly.
 *
 * ⚠️ Stated out loud rather than discovered: this guard CANNOT stop a
 * maintainer merging a governed PR by hand, and does not try. A direct merge
 * produces no `merge_group` event. That is not a hole — under this regime the
 * human merge IS the review record. What it closes is the seat path: flip
 * ready → enqueue → the queue is the entire review, which is the shape of
 * #6183 exactly.
 *
 * ## What satisfies the queue leg
 *
 * A latest-decisive APPROVED review by an account in `GOVERNED_APPROVERS`, on
 * WHICHEVER commit it was left. DISMISSED and superseded approvals (a later
 * CHANGES_REQUESTED by the same reviewer) never count; an APPROVED review by an
 * account outside that set never counts; an empty or unreadable review list
 * fails closed. The predicate is the EXISTENCE OF A HUMAN APPROVAL RECORD, and
 * says nothing about which bytes it was given for.
 *
 * ⭐ That is a REVERSAL of this file's first predicate, which required the
 * review's `commit_id` to equal the pull request's current head. The maintainer
 * ruled it out in the live PM chat on 2026-09-04 — quoted verbatim and
 * untranslated, because rewriting a ruling is rewriting the ruling:
 *
 *     「你的门禁有问题，只需要有人工批准记录就行，不需要卡最新的提交。」
 *
 * It was ruled while objectui PR #7473 was being approved over and over by an
 * authorized approver as its head moved: every push after an approval turned it
 * stale and reopened the refusal, so the gate spent scarce human attention
 * re-approving bytes nobody disputed. ⛔ The sha pin is RETIRED, not softened —
 * no predicate here reads `commit_id`, there is no stale bucket, and the
 * pull-request head read that existed only to feed the pin is gone with it. An
 * inert "stale" reading kept for old times' sake would be a field that can never
 * be non-empty again, and a reader would take its presence as evidence that this
 * gate still measures staleness.
 *
 * ⚠️ The self-test below still WRITES a `commit_id` into its fixtures, and that
 * is deliberate rather than leftover: "the commit does not matter" is only
 * measurable on cases where the commits actually differ, so grepping this file
 * for `commit_id` finds the evidence, never a surviving comparison.
 *
 * ⚠️ The accepted cost, stated out loud rather than left to be discovered: a
 * push after an approval is no longer re-reviewed by this gate, so an approved
 * governed pull request can land carrying bytes its approver never read — the
 * maintainer accepts that, and the DRAFT remedy below (a human merge, which
 * does read the final bytes) is still the one this refusal prints first.
 *
 * The preferred remedy is NOT approval, and the refusal text says so first:
 * take the pull request out of the queue, convert it back to DRAFT, and leave
 * the merge to the maintainer.
 *
 * ⛔ An agent seat never submits an approving review on a governed-surface pull
 * request, under any account. Every seat in this repository writes under a
 * shared GitHub identity, so `GOVERNED_APPROVERS` is a technical control that
 * is only as good as that normative rule — the same class as the seat-side
 * no-merge rule, and the reason the DRAFT remedy is listed first. ⚠️ With the
 * pin retired that rule carries MORE weight, not less: one approval now clears
 * every later push on the same pull request.
 *
 * ## Ordering: the path test runs FIRST, and a clear diff costs zero API calls
 *
 * ⛔ Fail-open on an API error is wrong in this file — it exists because
 * everything else in the chain failed open — so an unreadable review list is a
 * REFUSAL with its own exit code, never a pass. But a diff touching nothing
 * governed must never be blocked by an API hiccup either. The two are
 * reconciled by ORDER, not by tolerance: `runGuard` decomposes the diff and
 * returns before constructing a single request when nothing governed is in it.
 * The self-test pins that with a `fetchReviews` that THROWS if it is called at
 * all — a spy, not a mock, because "we did not need the API" is the claim.
 *
 * ## Multi-PR merge groups, and the under-enumeration trap
 *
 * A merge group can carry SEVERAL pull requests. `merge_group.head_ref` names
 * only the LAST one, so keying the whole group's diff to it would check the
 * wrong PR's reviews — and in the direction that reads as compliance: PR B is
 * approved, PR A's governed diff rides in behind it. So the group is decomposed
 * PER COMMIT: each first-parent commit is one PR landing, its number read from
 * its subject, and every governed PR is judged on its OWN reviews. A commit
 * that touches a governed path and names no pull request is UNATTRIBUTED — its
 * own refusal, with its own exit code.
 *
 * ## Why this is objectui-native rather than a pinned port
 *
 * The sibling repository runs this mechanism already, and this file follows its
 * shape closely. It is NOT registered in `scripts/upstream-port-pin.json`, and
 * that is a measurement rather than a preference:
 *
 *   - Upstream splits the mechanism over two files, and the register half
 *     (`scripts/pm/check-governed-merges.mjs`, 2,614 lines) is mostly a
 *     multi-repo post-merge audit plus a provenance-recompute engine for
 *     GENERATED artifacts sitting inside governed paths. This repository has
 *     none of those artifacts: `.claude/workflows/` does not exist here, and
 *     `skills/` carries no generator output (no `references/_index.md`, no
 *     react-blocks contract) — measured on the tree this landed against. Every
 *     row of that register is inapplicable, so a port would carry ~1,500 lines
 *     of machinery that can never fire.
 *   - `scripts/check-upstream-port-parity.mjs` cannot express that. Its
 *     `validatePin` refuses a divergence whose `ported` side is empty
 *     (`files[0].divergences[0].ported is empty`, exit 2 — measured directly
 *     against the shipped function), so a pin has no way to declare a DELETION.
 *     A pinned port here is structurally impossible, not merely undesirable.
 *
 * So the divergence is declared in prose, where a reader can act on it, and the
 * obligation the pin would have carried is stated instead: when the sibling's
 * predicate changes, this file is a hand re-read, not an automatic re-sync.
 *
 * ## Exit codes — the refusal is impossible to read as clean
 *
 *   0  CLEAR    — nothing governed in the diff (no API call was made), or every
 *                 governed PR carries an authorized APPROVED review, or this is
 *                 the `pull_request` early warning.
 *   3  REFUSED  — governed, and at least one governed PR carries no authorized
 *                 APPROVED review (none at all, unauthorized account, dismissed
 *                 or superseded).
 *   4  REFUSED  — governed, and the review list could not be READ. Distinct
 *                 from 3 on purpose: "nobody approved" and "we could not find
 *                 out" are different facts and must be separable.
 *   5  REFUSED  — governed paths on a commit attributable to no pull request.
 *   1  CANNOT RUN — unusable event payload, unsupported event, unreadable git.
 *                 Still non-zero, still red: this file has no green that means
 *                 "did not look".
 *   2  BAD USAGE — `--test` with no paths. Not a verdict about a tree.
 *
 * ## What this file does NOT do
 *
 * It does not make itself a required context. That is a branch-protection
 * setting only the maintainer can flip. What this repository CAN write down is
 * `REQUIRED_CONTEXTS` in `scripts/dependabot-merge-gate.mjs` — its own answer
 * to "which checks are blocking" — and `CHECK_CONTEXT_NAME` below is registered
 * there. Until the live required set carries the same name, this guard REPORTS
 * on a queue build without stopping it; the self-test pins the registration and
 * the workflow's `name:` so the two can never drift apart silently.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

/** The exit contract, named so the header's table is machine-checkable. */
export const EXIT_CLEAR = 0;
export const EXIT_CANNOT_RUN = 1;
export const EXIT_BAD_USAGE = 2;
export const EXIT_REFUSED_UNAPPROVED = 3;
export const EXIT_REFUSED_UNREADABLE = 4;
export const EXIT_REFUSED_UNATTRIBUTED = 5;

/**
 * The check-run name branch protection would pin, and the wiring it belongs to.
 * Declared HERE as well as in the YAML, deliberately and pinned in both
 * directions: the self-test reads the workflow and fails if the two disagree.
 * Renaming a job silently detaches a required context, and a name that lives in
 * exactly one place is a name nothing can pin.
 */
export const CHECK_CONTEXT_NAME = 'Governed Surface Queue Guard';
export const CHECK_WORKFLOW = 'governed-surface-guard.yml';
export const CHECK_JOB_ID = 'governed-surface-guard';

/** The events this guard understands, and what each one means to it. */
export const EVENT_MERGE_GROUP = 'merge_group';
export const EVENT_PULL_REQUEST = 'pull_request';

/**
 * The governed surface, verbatim from the 2026-08-18 definition the card
 * restates: `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `skills/**`, `docs/adr/**`.
 *
 * ⛔ This list is the WHOLE scope and widening it is a maintainer decision, not
 * an implementation detail. Two omissions are deliberate and worth naming so a
 * future reader does not read them as oversights:
 *
 *   - `.github/workflows/**` is NOT governed, so this guard does not govern its
 *     own workflow file. Making CI configuration governed is a strictly larger
 *     rule than the one ruled, and taking it here would be widening a
 *     governance gate past its own ruling.
 *   - `examples/**` and any vendored template copy of `AGENTS.md` stay out: the
 *     two root rows are EXACT matches, so `examples/AGENTS.md` is ordinary
 *     source.
 *
 * `prefix` rows match by path prefix; `exact` rows match the whole path. `glob`
 * is the spelling a human reads in a verdict, never a matcher.
 */
export const GOVERNED_SURFACES = Object.freeze([
  Object.freeze({ id: 'adr', prefix: 'docs/adr/', glob: 'docs/adr/**', what: 'architecture decision records' }),
  Object.freeze({ id: 'claude-tree', prefix: '.claude/', glob: '.claude/**', what: 'the agent instruction tree (skills, hooks, settings)' }),
  Object.freeze({ id: 'skills-catalog', prefix: 'skills/', glob: 'skills/**', what: 'the published skills catalog' }),
  Object.freeze({ id: 'agents-md', exact: 'AGENTS.md', glob: 'AGENTS.md', what: 'the repo-root agent instruction file' }),
  Object.freeze({ id: 'claude-md', exact: 'CLAUDE.md', glob: 'CLAUDE.md', what: 'the repo-root Claude instruction file' }),
]);

/**
 * The ONLY accounts whose APPROVED review satisfies the `merge_group` leg.
 *
 * ⭐ Single source: every rendering derives the names it prints from this array,
 * and nothing else in the repository restates them as data. Changing the set is
 * a one-line maintainer decision here and nowhere else.
 *
 * ⚠️ Provenance, stated because it is INHERITED rather than ruled for this
 * repository: these are the two accounts the sibling repository's maintainer
 * ruled authoritative for its own governed surface on 2026-08-27 (verbatim:
 * 「os-zhuang hotlong 批准算数」). objectui's own card rules the MECHANISM, not
 * the roster. The roster is carried across because it is the same maintainer
 * and the same governed surface, and it is flagged here — and in this change's
 * pull request — as the one line the maintainer should confirm or edit. Nothing
 * is blocked either way: the ruled remedy this guard prints FIRST is
 * back-to-draft plus a human merge, which needs no approver at all.
 */
export const GOVERNED_APPROVERS = Object.freeze(['os-zhuang', 'hotlong']);

/**
 * The governed slice of a path list, grouped by surface. Surfaces with no hit
 * are absent — `length === 0` IS the clean answer.
 */
export function governedPathsIn(paths) {
  const list = Array.isArray(paths) ? paths : [];
  return GOVERNED_SURFACES.map((surface) => ({
    ...surface,
    files: list.filter((p) => typeof p === 'string' && (surface.prefix ? p.startsWith(surface.prefix) : p === surface.exact)),
  })).filter((surface) => surface.files.length > 0);
}

/**
 * The seat-side answer: "would a pull request touching these paths be
 * governed?" Pure, so `--test` costs a process start and nothing else, and the
 * refusal text can hand a reader a command that answers the same question the
 * queue build answered.
 */
export function testVerdict(paths) {
  const list = (Array.isArray(paths) ? paths : []).filter((p) => typeof p === 'string' && p !== '');
  const matched = governedPathsIn(list);
  const hit = new Set(matched.flatMap((s) => s.files));
  return {
    governed: matched.length > 0,
    checked: list.length,
    surfacesChecked: GOVERNED_SURFACES.length,
    matched,
    hitPaths: [...hit],
    clearPaths: list.filter((p) => !hit.has(p)),
  };
}

/**
 * The pull-request number a mainline commit subject names, in either spelling
 * GitHub writes: a merge commit's `Merge pull request #N from …`, or a squash
 * commit's TRAILING `(#N)`. This repository squashes, so the trailing form is
 * the one that fires; a subject citing an issue mid-title keeps only the
 * trailing parenthetical, which is the pull request.
 */
export function pullNumberFromSubject(subject) {
  if (typeof subject !== 'string') return null;
  let m = /^Merge pull request #(\d+)\b/.exec(subject);
  if (m) return Number(m[1]);
  m = /\(#(\d+)\)\s*$/.exec(subject.trim());
  return m ? Number(m[1]) : null;
}

/**
 * The pull-request number a merge-queue head ref names, or null.
 *
 * GitHub writes `refs/heads/gh-readonly-queue/<base>/pr-<N>-<base_sha>`. The
 * `gh-readonly-queue/` segment is required rather than decorative: a plain
 * branch called `pr-12-abcdef1` is not a queue ref, and reading one as a pull
 * request number would attribute a diff to a pull request unrelated to it.
 *
 * The base-branch segment is `.+` rather than `[^/]+` because a base branch may
 * itself contain slashes; the trailing `pr-<n>-<sha>` anchor is what makes the
 * greedy match safe. ⚠️ In a MULTI-PR group this names only the LAST pull
 * request, so it is a fallback for single-commit groups and never the key the
 * whole group is judged on.
 */
export function pullNumberFromQueueRef(ref) {
  const m = /(?:^|\/)gh-readonly-queue\/.+\/pr-(\d+)-[0-9a-f]{7,40}$/.exec(String(ref ?? ''));
  return m ? Number(m[1]) : null;
}

/**
 * The shas and pull identity a workflow event carries. Pure, so every branch —
 * including the malformed payloads — is offline-testable.
 *
 * `ok: false` is never a quiet default: an event this guard cannot read is
 * `EXIT_CANNOT_RUN`, because "I could not tell what was being merged" must not
 * render as "nothing governed was being merged".
 */
export function resolveEventContext({ eventName, payload }) {
  if (eventName === EVENT_MERGE_GROUP) {
    const group = payload?.merge_group;
    if (!group?.base_sha || !group?.head_sha) {
      return { ok: false, reason: 'the merge_group payload carries no base_sha/head_sha — nothing to diff' };
    }
    return {
      ok: true,
      event: EVENT_MERGE_GROUP,
      baseSha: group.base_sha,
      headSha: group.head_sha,
      namedPull: pullNumberFromQueueRef(group.head_ref),
      label: `merge group on ${group.base_ref ?? 'main'}`,
    };
  }
  if (eventName === EVENT_PULL_REQUEST) {
    const pull = payload?.pull_request;
    if (!pull?.number || !pull?.base?.sha || !pull?.head?.sha) {
      return { ok: false, reason: 'the pull_request payload carries no number/base.sha/head.sha — nothing to diff' };
    }
    return {
      ok: true,
      event: EVENT_PULL_REQUEST,
      baseSha: pull.base.sha,
      headSha: pull.head.sha,
      namedPull: Number(pull.number),
      draft: pull.draft === true,
      label: `pull request #${pull.number}`,
    };
  }
  return {
    ok: false,
    reason:
      `unsupported event '${eventName ?? '(none)'}' — this guard reads ${EVENT_MERGE_GROUP} (the refusal) and ` +
      `${EVENT_PULL_REQUEST} (the early warning) only`,
  };
}

/**
 * Split the work in a diff into the pull requests that touched a governed
 * surface, plus the governed work no pull request can be found for.
 *
 * Pure. `rows` are `{ sha, subject, pr, paths }` — one per first-parent commit
 * in a merge group, or one synthetic row for a `pull_request` run. A row hitting
 * nothing governed is dropped entirely and costs nothing downstream; that is
 * what makes "a clear diff makes no API call" a property of the data flow
 * rather than a promise in a comment.
 */
export function decomposeGovernedWork(rows) {
  const byPull = new Map();
  const unattributed = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const surfaces = governedPathsIn(row?.paths ?? []);
    if (surfaces.length === 0) continue;
    const paths = surfaces.flatMap((s) => s.files);
    if (typeof row.pr !== 'number' || !Number.isInteger(row.pr) || row.pr <= 0) {
      unattributed.push({ sha: row.sha ?? null, subject: row.subject ?? '', paths });
      continue;
    }
    const seen = byPull.get(row.pr) ?? { pr: row.pr, paths: new Set(), shas: [] };
    for (const p of paths) seen.paths.add(p);
    if (row.sha) seen.shas.push(row.sha);
    byPull.set(row.pr, seen);
  }
  const governed = [...byPull.values()]
    .map((entry) => ({ pr: entry.pr, shas: entry.shas, paths: [...entry.paths], surfaces: governedPathsIn([...entry.paths]) }))
    .sort((a, b) => a.pr - b.pr);
  return { governed, unattributed };
}

/**
 * Does an APPROVED review exist on this pull request? The early-warning leg's
 * reading — any approver counts, no sha pin — because that leg never reddens
 * and so never needs the stricter, more expensive question.
 *
 * The reduction is LATEST-DECISIVE-PER-REVIEWER, matching how GitHub itself
 * computes a review decision: `COMMENTED` and `PENDING` carry no decision, and a
 * `DISMISSED` approval is not an approval any more. A reviewer who approved and
 * later requested changes must not still read as an approver — the naive
 * `reviews.some(r => r.state === 'APPROVED')` gets that wrong in the fail-open
 * direction, which is the one direction this file may not be wrong in.
 *
 * Pure; the array is expected in GitHub's chronological order, so last wins.
 */
export function approvalVerdict(reviews) {
  const decisive = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);
  const latest = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const state = String(review?.state ?? '').toUpperCase();
    if (!decisive.has(state)) continue;
    const login = review?.user?.login ?? `(unknown:${review?.id ?? latest.size})`;
    latest.set(login, state);
  }
  return {
    state: [...latest.values()].includes('APPROVED') ? 'approved' : 'unapproved',
    approvers: [...latest].filter(([, s]) => s === 'APPROVED').map(([login]) => login),
    changesRequestedBy: [...latest].filter(([, s]) => s === 'CHANGES_REQUESTED').map(([login]) => login),
    reviewsRead: Array.isArray(reviews) ? reviews.length : 0,
  };
}

/**
 * The `merge_group` predicate: does an account in `GOVERNED_APPROVERS` hold a
 * latest-decisive APPROVED review on this pull request?
 *
 * Same latest-decisive-per-reviewer reduction as `approvalVerdict`, plus the
 * authorization filter — which, now that the sha pin is retired, is the ONLY
 * thing separating the two legs' readings. `unauthorizedApprovers` (APPROVED,
 * not in the set) is reported separately so a queue log can be acted on rather
 * than merely obeyed.
 *
 * ⛔ There is deliberately no `commit_id` reading here and no `headSha`
 * parameter. Maintainer ruling 2026-09-04, quoted in full in the header's "What
 * satisfies the queue leg": a human approval record suffices and is never
 * pinned to the latest commit. The former `staleApprovers` bucket is RETIRED
 * rather than kept as an inert reading, because under this predicate every
 * authorized latest-decisive approval lands in `approvers` — the bucket could
 * never be non-empty again, and an always-empty field reads as evidence that
 * staleness is still being measured.
 *
 * ⚠️ An outstanding CHANGES_REQUESTED from ANOTHER reviewer does not flip the
 * verdict, and that is restraint rather than an oversight — the predicate is the
 * authorized approval record, and widening a governance gate past its own rule
 * is how gates acquire policy nobody agreed to. It is printed loudly instead.
 * (One from the SAME reviewer is a different thing entirely: it supersedes their
 * own approval in the reduction above, so it does flip the verdict.)
 *
 * Pure; the array is expected in GitHub's chronological order, so last wins.
 */
export function authorizedApprovalVerdict(reviews) {
  const decisive = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);
  const latest = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const state = String(review?.state ?? '').toUpperCase();
    if (!decisive.has(state)) continue;
    const login = review?.user?.login ?? `(unknown:${review?.id ?? latest.size})`;
    latest.set(login, state);
  }
  const approvers = [];
  const unauthorizedApprovers = [];
  for (const [login, state] of latest) {
    if (state !== 'APPROVED') continue;
    if (GOVERNED_APPROVERS.includes(login)) approvers.push(login);
    else unauthorizedApprovers.push(login);
  }
  return {
    state: approvers.length > 0 ? 'approved' : 'unapproved',
    approvers,
    unauthorizedApprovers,
    changesRequestedBy: [...latest].filter(([, s]) => s === 'CHANGES_REQUESTED').map(([login]) => login),
    reviewsRead: Array.isArray(reviews) ? reviews.length : 0,
  };
}

/** The refusal an unreadable review list produces. Never a pass — see the header. */
export function unreadableApproval(reason) {
  return { state: 'unreadable', approvers: [], changesRequestedBy: [], reviewsRead: 0, reason: String(reason ?? 'unknown error') };
}

/**
 * The verdict, as data. Pure — every branch of the decision is here, and the
 * renderer and the exit code both read it rather than re-deriving it.
 */
export function guardVerdict({ event, governed = [], unattributed = [], approvals = new Map(), apiCalls = 0 }) {
  const entries = governed.map((entry) => ({
    ...entry,
    approval: approvals.get(entry.pr) ?? unreadableApproval('no review reading was recorded for this pull request'),
  }));
  const base = { event, entries, unattributed, apiCalls, contextName: CHECK_CONTEXT_NAME };

  if (entries.length === 0 && unattributed.length === 0) {
    return { ...base, conclusion: 'clear', exitCode: EXIT_CLEAR, refusalKind: null };
  }
  // The early-warning run never reddens: a governed PR awaiting the maintainer's
  // own merge is this regime's healthy terminal state, and a check that is red
  // on the healthy case is a permanently red check (see the header).
  if (event !== EVENT_MERGE_GROUP) {
    return { ...base, conclusion: 'warned', exitCode: EXIT_CLEAR, refusalKind: null };
  }
  if (unattributed.length > 0) {
    return { ...base, conclusion: 'refused', exitCode: EXIT_REFUSED_UNATTRIBUTED, refusalKind: 'unattributed' };
  }
  if (entries.some((e) => e.approval.state === 'unreadable')) {
    return { ...base, conclusion: 'refused', exitCode: EXIT_REFUSED_UNREADABLE, refusalKind: 'unreadable' };
  }
  if (entries.some((e) => e.approval.state !== 'approved')) {
    return { ...base, conclusion: 'refused', exitCode: EXIT_REFUSED_UNAPPROVED, refusalKind: 'unapproved' };
  }
  return { ...base, conclusion: 'cleared', exitCode: EXIT_CLEAR, refusalKind: null };
}

/**
 * The words a reader gets. Every rendering names the exact paths that matched
 * and states what would satisfy the guard — a refusal a reader cannot act on is
 * a refusal they route around.
 */
export function renderGuardVerdict(verdict) {
  const lines = [];
  const surfaceLines = (entry) =>
    entry.surfaces.flatMap((s) => [
      `        ${s.glob} x${s.files.length} — ${s.what}`,
      ...s.files.slice(0, 12).map((f) => `          - ${f}`),
      ...(s.files.length > 12 ? [`          … and ${s.files.length - 12} more`] : []),
    ]);

  // Both legs read exactly one list now. The pull-request head read existed
  // only to feed the retired sha pin, so a label still naming it would be a log
  // line describing traffic that no longer happens — the shape a later reader
  // takes as evidence the pin is still live.
  const apiLabel = 'review lookup(s)';
  lines.push(
    `${CHECK_CONTEXT_NAME} — ${verdict.event} — ${verdict.entries.length} governed pull request(s), ` +
      `${verdict.unattributed.length} unattributed governed commit(s), ${verdict.apiCalls} ${apiLabel}.`,
  );

  if (verdict.conclusion === 'clear') {
    lines.push(
      '  ✅  CLEAR — the diff touches no governed surface, so this guard has nothing to judge.',
      `      Derived from GOVERNED_SURFACES in scripts/check-governed-queue-guard.mjs (${GOVERNED_SURFACES.length} surfaces),`,
      '      never from a restated list. ⛔ ZERO review lookups were made: the path test runs first and returns,',
      '      so a GitHub API outage can never block a diff that touches nothing governed.',
    );
    return lines.join('\n');
  }

  // The queue leg's verdict (`authorizedApprovalVerdict`) carries the
  // authorization split; the early-warning leg's `approvalVerdict` does not.
  // ⚠️ This replaces a `headSha !== undefined` test — a discriminator that went
  // away with the field the retired sha pin used to supply.
  const authorizedLeg = (approval) => Array.isArray(approval.unauthorizedApprovers);
  for (const entry of verdict.entries) {
    lines.push('', `  #${entry.pr} — governed:`);
    lines.push(...surfaceLines(entry));
    if (entry.approval.state === 'approved') {
      lines.push(
        authorizedLeg(entry.approval)
          ? `        ✅ authorized APPROVED review present, by: ${entry.approval.approvers.join(', ')} — a human approval record, on whichever commit it was left`
          : `        ✅ APPROVED review present, by: ${entry.approval.approvers.join(', ')}`,
      );
    } else if (entry.approval.state === 'unreadable') {
      lines.push(`        ⛔ the review list could NOT be read — ${entry.approval.reason}`);
    } else if (authorizedLeg(entry.approval)) {
      lines.push(
        `        ⛔ NO authorized APPROVED review on this pull request ` +
          `(${entry.approval.reviewsRead} review(s) read; authorized: ${GOVERNED_APPROVERS.join(', ')})`,
      );
      if ((entry.approval.unauthorizedApprovers ?? []).length > 0) {
        lines.push(
          `        ℹ️  APPROVED by account(s) outside GOVERNED_APPROVERS: ${entry.approval.unauthorizedApprovers.join(', ')} — never counts`,
        );
      }
    } else {
      lines.push(`        ⛔ NO approving review (${entry.approval.reviewsRead} review(s) read, none decisive-APPROVED)`);
    }
    if (entry.approval.changesRequestedBy.length > 0) {
      lines.push(
        `        ⚠️  outstanding CHANGES_REQUESTED from: ${entry.approval.changesRequestedBy.join(', ')}`,
        '            (informational — the predicate is an authorized APPROVED review record on this',
        '             pull request; this guard does not widen past its own rule)',
      );
    }
  }
  for (const row of verdict.unattributed) {
    lines.push(
      '',
      `  ⛔ UNATTRIBUTED — commit ${String(row.sha ?? '(unknown)').slice(0, 12)} touches a governed surface and names no pull request:`,
      `        subject: ${row.subject || '(empty)'}`,
      ...row.paths.slice(0, 12).map((p) => `          - ${p}`),
    );
  }

  lines.push('');
  if (verdict.conclusion === 'warned') {
    lines.push(
      '  ⚠️  EARLY WARNING, not a failure — this run is on the pull request, and this check is deliberately',
      '      GREEN here. A governed PR held as a draft for the maintainer to merge by hand IS this regime\'s',
      '      healthy end state, and a check that reddens on the healthy case is a permanently red check.',
      '',
      '      ⛔ What a seat must NOT do with this pull request: flip it ready, enqueue it, or arm auto-merge.',
      '         One governed path governs the WHOLE pull request — proportion is not a question.',
      '      ⚠️  A GitHub MCP `update_pull_request` call can set `draft: false` as a SIDE EFFECT of passing',
      '         only `reviewers` (objectstack-ai/objectstack#12200). That is how objectui#6183 left draft,',
      '         and converting back to a draft did NOT dequeue it. Do not send that call on this PR.',
      '',
      '      If it IS enqueued anyway, the merge-queue run of this same check REFUSES it unless every',
      '      governed pull request above carries an authorized APPROVED review by then.',
    );
    return lines.join('\n');
  }
  if (verdict.conclusion === 'cleared') {
    lines.push(
      '  ✅  CLEARED — every governed pull request in this merge group carries an APPROVED review by an',
      `      authorized approver (GOVERNED_APPROVERS: ${GOVERNED_APPROVERS.join(', ')}), regardless of which commit`,
      '      that review was left on — maintainer ruling 2026-09-04: a human approval record suffices and is',
      '      never pinned to the latest commit. A dismissed, superseded or unauthorized approval still never',
      '      counts. ⚠️ Accepted cost, stated rather than hidden: a push after the approval is NOT re-reviewed',
      '      here. ⛔ An agent seat never submits an approving review on a governed-surface pull request,',
      '      under any account — every seat here writes under a shared identity, so that rule is what this',
      '      technical control rests on.',
    );
    return lines.join('\n');
  }

  lines.push('  ⛔  REFUSED — this merge group must not land.');
  if (verdict.refusalKind === 'unattributed') {
    lines.push(
      '      A governed-surface change is in this merge group that cannot be attributed to any pull request,',
      '      so there is no review record it could possibly satisfy. Fail closed: a governed change nobody',
      '      can point at a reviewable pull request for is the most anomalous input this guard can receive.',
    );
  } else if (verdict.refusalKind === 'unreadable') {
    lines.push(
      '      The review list could not be READ for at least one governed pull request above. ⛔ This is a',
      '      refusal and not a pass, deliberately: this guard exists because every other layer in this chain',
      '      failed open. "Nobody approved" and "we could not find out" are different facts (exit 3 vs 4) and',
      '      neither of them is "approved". Re-run the job once the API is reachable.',
    );
  } else {
    lines.push(
      '      At least one governed pull request above carries NO authorized APPROVED review at all, and the',
      '      merge queue would have been the entire review — the shape of objectui#6183, which left draft',
      '      through a hidden tool side effect and landed as 5b3290fd5 unreviewed.',
    );
  }
  lines.push(
    '',
    '      What satisfies this check:',
    '        1. ⭐ PREFERRED — take the pull request out of the queue: convert it back to DRAFT (disarming',
    '           auto-merge alone does NOT dequeue it), and leave the merge to the maintainer. A human merge',
    '           IS the review record for a governed surface; that is the regime, not a workaround of it.',
    `        2. Or: obtain an APPROVED review by an authorized approver (GOVERNED_APPROVERS: ${GOVERNED_APPROVERS.join(', ')})`,
    '           on each governed pull request, then re-queue. ⭐ It does NOT have to be re-given after a later',
    '           push: maintainer ruling 2026-09-04 — a human approval record suffices and is never pinned to',
    '           the latest commit. ⛔ An agent seat never submits that approval, under any account.',
    '      Neither of those is "edit this check".',
    '',
    '      Verify any file list before acting: node scripts/check-governed-queue-guard.mjs --test <paths…>',
  );
  return lines.join('\n');
}

/**
 * The orchestrator, with its one IO dependency injected.
 *
 * ⭐ The early return below is the ordering guarantee expressed as control flow:
 * nothing governed ⇒ verdict, before `fetchReviews` exists as a possibility. The
 * self-test passes a `fetchReviews` that THROWS, so "a clear diff costs zero API
 * calls" is measured rather than asserted.
 *
 * ⛔ There is no `fetchPullHead` parameter any more. The queue leg needed the
 * pull request's current head sha only to pin an approval against it, and the
 * 2026-09-04 ruling retired that pin; a read whose result feeds no verdict is a
 * cost and a failure mode bought for nothing.
 */
export async function runGuard({ event, rows, fetchReviews }) {
  const { governed, unattributed } = decomposeGovernedWork(rows);
  if (governed.length === 0 && unattributed.length === 0) {
    return guardVerdict({ event, governed, unattributed, apiCalls: 0 });
  }
  const approvals = new Map();
  let apiCalls = 0;
  for (const entry of governed) {
    try {
      // Both legs read the SAME one list; they differ only in the predicate
      // applied to it — the queue leg requires an authorized approver, the
      // early warning takes any. One read per governed pull request, so an
      // unreadable list is the single API failure mode either leg can have.
      apiCalls += 1;
      const reviews = await fetchReviews(entry.pr);
      approvals.set(entry.pr, event === EVENT_MERGE_GROUP ? authorizedApprovalVerdict(reviews) : approvalVerdict(reviews));
    } catch (error) {
      approvals.set(entry.pr, unreadableApproval(String(error?.message ?? error).split('\n')[0]));
    }
  }
  return guardVerdict({ event, governed, unattributed, approvals, apiCalls });
}

// -- git (diff decomposition; zero API) -------------------------------------

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Is `rev` an object this checkout actually has? A missing sha is a hard failure, never an empty diff. */
function hasRev(root, rev) {
  try {
    git(root, ['cat-file', '-e', `${rev}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first-parent commits between `baseSha` and `headSha`, each with the paths
 * it changed and the pull request its subject names. One row per pull-request
 * landing in a merge group; see the header on why the group is decomposed
 * rather than keyed to `head_ref`.
 */
export function enumerateRows(root, baseSha, headSha, fallbackPull = null) {
  const log = git(root, ['log', '--first-parent', '--format=%H%x09%s', `${baseSha}..${headSha}`]);
  const commits = log
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => {
      const [sha, ...rest] = l.split('\t');
      return { sha, subject: rest.join('\t') };
    });
  return commits.map((commit) => ({
    ...commit,
    // The fallback is only unambiguous when the range holds exactly one commit;
    // in a multi-PR group `head_ref` names the LAST pull request, and applying
    // it to an earlier commit attributes a governed diff to the wrong one.
    pr: pullNumberFromSubject(commit.subject) ?? (commits.length === 1 ? fallbackPull : null),
    paths: git(root, ['diff-tree', '-r', '--no-commit-id', '--no-renames', '--name-only', '-m', '--first-parent', commit.sha])
      .split('\n')
      .filter((p) => p !== ''),
  }));
}

// -- the GitHub read (the review list — the only API surface) ---------------

function apiHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Every review on a pull request, paginated. Throws on any non-2xx — the caller
 * turns a throw into a REFUSAL, never into a pass, so there is no tolerant
 * branch to get wrong here.
 */
export function makeReviewReader({ apiUrl, slug, token, fetchImpl = fetch, perPage = 100, maxPages = 10 }) {
  return async function fetchReviews(pull) {
    const all = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${apiUrl}/repos/${slug}/pulls/${pull}/reviews?per_page=${perPage}&page=${page}`;
      const res = await fetchImpl(url, { headers: apiHeaders(token) });
      if (!res.ok) throw new Error(`GET /repos/${slug}/pulls/${pull}/reviews answered HTTP ${res.status}`);
      const batch = await res.json();
      if (!Array.isArray(batch)) throw new Error(`the reviews endpoint answered a non-array body for #${pull}`);
      all.push(...batch);
      if (batch.length < perPage) return all;
    }
    throw new Error(`#${pull} has more than ${perPage * maxPages} reviews — refusing to judge a truncated list`);
  };
}

// ⛔ There is no pull-request HEAD reader here any more, and its absence is a
// decision rather than an omission: it existed only to supply the sha an
// approval was pinned against, and the 2026-09-04 ruling retired that pin. The
// review list is now the whole API surface of this guard.

// -- the seat-side `--test` predicate ---------------------------------------

/** The words `--test` prints. Pure, so the self-test reads them without a process. */
export function renderTestVerdict(verdict) {
  const lines = [];
  if (!verdict.governed) {
    lines.push(
      `✅ NOT GOVERNED — ${verdict.checked} path(s) checked against ${verdict.surfacesChecked} governed surface(s); none matched.`,
      '   An ordinary pull request: the normal review and merge-queue route applies.',
    );
    return lines.join('\n');
  }
  lines.push(`⛔ GOVERNED — ${verdict.hitPaths.length} of ${verdict.checked} path(s) are on a governed surface:`);
  for (const surface of verdict.matched) {
    lines.push(`   ${surface.glob} x${surface.files.length} — ${surface.what}`);
    for (const file of surface.files.slice(0, 12)) lines.push(`     - ${file}`);
    if (surface.files.length > 12) lines.push(`     … and ${surface.files.length - 12} more`);
  }
  lines.push(
    '',
    '   One governed path governs the WHOLE pull request — proportion is not a question.',
    '   ⛔ Do not flip it ready, enqueue it, or arm auto-merge. Park it as a DRAFT and leave the merge',
    '      to the maintainer; a human merge IS the review record for a governed surface.',
    `   The merge-queue run of "${CHECK_CONTEXT_NAME}" refuses this diff unless an APPROVED review by an`,
    `   authorized approver (GOVERNED_APPROVERS: ${GOVERNED_APPROVERS.join(', ')}) is on the pull request — on`,
    '   whichever commit it was left (maintainer ruling 2026-09-04).',
  );
  return lines.join('\n');
}

// -- CLI --------------------------------------------------------------------

function runTestMode(argv) {
  const paths = argv.slice(argv.indexOf('--test') + 1).filter((a) => !a.startsWith('--'));
  if (paths.length === 0) {
    console.error(
      'check-governed-queue-guard --test needs at least one path.\n' +
        '  node scripts/check-governed-queue-guard.mjs --test AGENTS.md packages/core/src/index.ts\n' +
        'Refusing to answer "not governed" about an empty list: a question nobody asked must not read as a clearance.',
    );
    return EXIT_BAD_USAGE;
  }
  const verdict = testVerdict(paths);
  console.log(renderTestVerdict(verdict));
  return verdict.governed ? EXIT_REFUSED_UNAPPROVED : EXIT_CLEAR;
}

async function main() {
  const env = process.env;
  const eventName = env.GITHUB_EVENT_NAME;
  let payload;
  try {
    payload = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? '', 'utf8'));
  } catch (error) {
    console.error(
      `⛔ ${CHECK_CONTEXT_NAME}: could not read GITHUB_EVENT_PATH (${String(error?.message ?? error).split('\n')[0]}).\n` +
        '   This guard reads the workflow event payload and nothing else; without it there is no diff to judge,\n' +
        '   and "could not look" must never exit 0 here.',
    );
    return EXIT_CANNOT_RUN;
  }

  const context = resolveEventContext({ eventName, payload });
  if (!context.ok) {
    console.error(`⛔ ${CHECK_CONTEXT_NAME}: ${context.reason}.`);
    return EXIT_CANNOT_RUN;
  }

  for (const rev of [context.baseSha, context.headSha]) {
    if (!hasRev(repoRoot, rev)) {
      console.error(
        `⛔ ${CHECK_CONTEXT_NAME}: ${rev} is not in this checkout, so the diff cannot be read.\n` +
          '   The job must check out with `fetch-depth: 0`; a truncated history answers a governed-surface\n' +
          '   question with silence, and silence reads as compliance.',
      );
      return EXIT_CANNOT_RUN;
    }
  }

  let rows;
  try {
    const mergeBase = git(repoRoot, ['merge-base', context.baseSha, context.headSha]).trim();
    rows = enumerateRows(repoRoot, mergeBase, context.headSha, context.namedPull);
  } catch (error) {
    console.error(`⛔ ${CHECK_CONTEXT_NAME}: could not read the diff (${String(error?.message ?? error).split('\n')[0]}).`);
    return EXIT_CANNOT_RUN;
  }

  const slug = env.GITHUB_REPOSITORY ?? 'objectstack-ai/objectui';
  const reader = {
    apiUrl: (env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/+$/, ''),
    slug,
    token: env.GITHUB_TOKEN || env.GH_TOKEN || null,
  };

  const verdict = await runGuard({
    event: context.event,
    rows,
    fetchReviews: makeReviewReader(reader),
  });
  const report = [`${context.label} — ${rows.length} commit(s) in range`, renderGuardVerdict(verdict)].join('\n');
  console.log(report);

  // The step summary is where a reader actually looks at a red queue build.
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, `## ${CHECK_CONTEXT_NAME}\n\n\`\`\`text\n${report}\n\`\`\`\n`);
    } catch {
      /* a summary that cannot be written changes no verdict */
    }
  }
  return verdict.exitCode;
}

if (isEntrypoint(import.meta.url) && !process.argv.includes('--self-test')) {
  process.exitCode = process.argv.includes('--test') ? runTestMode(process.argv) : await main();
}

// -- self-test (offline: pure functions + replay fixtures; no network, no git) --

/**
 * The measured incident this guard descends from, with its real surface.
 * Predicted direction, and the whole point of pinning it: it is REFUSED on
 * `merge_group` with no approving review, and it is a GREEN early warning on
 * `pull_request`. A fixture that passed the queue leg would mean this guard
 * would not have stopped the thing it was built to stop.
 */
const REPLAYS = [
  {
    name: 'objectui#6183 — a governed AGENTS.md PR left draft through an update_pull_request side effect, queued, and merged as 5b3290fd5 with zero reviews',
    pr: 6183,
    subject: 'docs(agents): seat protocol updates (#6183)',
    files: ['AGENTS.md'],
  },
  {
    name: 'the same shape on the instruction tree — a .claude/** change mixed with ordinary source',
    pr: 6184,
    subject: 'chore(hooks): tighten a PreToolUse guard (#6184)',
    files: ['.claude/hooks/guard-shared-stash.sh', 'packages/core/src/index.ts'],
  },
  {
    name: 'the published skills catalog, the surface the domain label routes on',
    pr: 6185,
    subject: 'docs(skill): rewrite the composition rules (#6185)',
    files: ['skills/objectui/rules/composition.md', 'skills/objectui/SKILL.md'],
  },
  {
    name: 'an architecture decision record',
    pr: 6186,
    subject: 'docs(adr): record the governed-surface decision (#6186)',
    files: ['docs/adr/0099-example.md'],
  },
];

export async function selfTest() {
  let checked = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    checked += 1;
    if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  };
  const row = (pr, files, sha = 'a'.repeat(40), subject = `x (#${pr})`) => ({ sha, subject, pr, paths: files });
  const approved = (...logins) => logins.map((login) => ({ state: 'APPROVED', user: { login } }));
  const HEAD = 'f'.repeat(40);
  const OLD = '0'.repeat(40);
  const approvedAt = (login, sha) => ({ state: 'APPROVED', user: { login }, commit_id: sha });
  // HEAD and OLD are both KEPT although no sha is compared any more: "the
  // commit does not matter" is only measured by cases where the commit differs.
  const authorizedPass = (login = GOVERNED_APPROVERS[0]) => authorizedApprovalVerdict([approvedAt(login, HEAD)]);
  const run = (event, rows, approvals = new Map()) => {
    const { governed, unattributed } = decomposeGovernedWork(rows);
    return guardVerdict({ event, governed, unattributed, approvals, apiCalls: governed.length });
  };

  // -- the governed surface IS the ruled definition, in both directions ------
  //
  // The card restates the 2026-08-18 definition as five surfaces. Pinning the
  // membership BOTH ways is what stops a sixth being added here instead of by a
  // maintainer, and a fifth being dropped by an edit nobody reads.
  assert('the-register-declares-exactly-the-five-ruled-surfaces', GOVERNED_SURFACES.length === 5, String(GOVERNED_SURFACES.length));
  assert(
    'and-they-are-the-ruled-globs-verbatim',
    GOVERNED_SURFACES.map((s) => s.glob).join() === 'docs/adr/**,.claude/**,skills/**,AGENTS.md,CLAUDE.md',
    GOVERNED_SURFACES.map((s) => s.glob).join(),
  );
  for (const surface of GOVERNED_SURFACES) {
    const sample = surface.prefix ? `${surface.prefix}sample.md` : surface.exact;
    const { governed } = decomposeGovernedWork([row(1, [sample])]);
    assert(`the-register-drives-the-verdict-for-${surface.id}`, governed.length === 1 && governed[0].paths.includes(sample), sample);
  }
  // The two exact rows are EXACT: a vendored or example copy is ordinary source.
  assert('an-example-copy-of-AGENTS.md-is-not-the-governed-one', governedPathsIn(['examples/AGENTS.md']).length === 0);
  assert('a-near-miss-adr-directory-is-not-governed', governedPathsIn(['docs/adrs/z.md', 'docs/adr-notes.md']).length === 0);
  // ⛔ The widening this guard deliberately does NOT take: it does not govern
  // its own workflow, and pinning that keeps the scope honest against a future
  // edit that quietly promotes CI config to a governed surface.
  assert('this-guards-own-workflow-is-NOT-governed', governedPathsIn([`.github/workflows/${CHECK_WORKFLOW}`, 'scripts/check-governed-queue-guard.mjs']).length === 0);
  assert('ordinary-source-is-not-governed', governedPathsIn(['packages/core/src/index.ts', 'content/docs/guide/x.md', 'package.json']).length === 0);

  // -- the exit contract as a table ------------------------------------------
  assert('exit-clear-is-0', EXIT_CLEAR === 0);
  assert('exit-cannot-run-is-1', EXIT_CANNOT_RUN === 1);
  assert('exit-bad-usage-is-2', EXIT_BAD_USAGE === 2);
  assert(
    'the-three-refusals-are-distinct-non-zero-codes',
    new Set([EXIT_REFUSED_UNAPPROVED, EXIT_REFUSED_UNREADABLE, EXIT_REFUSED_UNATTRIBUTED]).size === 3 &&
      ![EXIT_REFUSED_UNAPPROVED, EXIT_REFUSED_UNREADABLE, EXIT_REFUSED_UNATTRIBUTED].includes(0),
  );

  // -- the merge-queue head ref ----------------------------------------------
  assert('queue-ref-yields-its-pr', pullNumberFromQueueRef('refs/heads/gh-readonly-queue/main/pr-6183-484ae0019cd') === 6183);
  assert('queue-ref-without-the-refs-prefix-too', pullNumberFromQueueRef('gh-readonly-queue/main/pr-42-abcdef1') === 42);
  assert('a-base-branch-with-a-slash-is-still-read', pullNumberFromQueueRef('refs/heads/gh-readonly-queue/release/v5/pr-7-abcdef1') === 7);
  assert('an-ordinary-branch-that-merely-looks-like-one-is-NOT-a-queue-ref', pullNumberFromQueueRef('refs/heads/pr-12-abcdef1') === null);
  assert('a-plain-branch-is-null', pullNumberFromQueueRef('refs/heads/claude/issue-1-x') === null);
  assert('nonsense-is-null-never-a-number', pullNumberFromQueueRef(undefined) === null && pullNumberFromQueueRef('') === null);

  // -- the subject parser (this repo squashes, so the trailing form fires) ----
  assert('a-squash-subject-yields-its-pr', pullNumberFromSubject('fix(grid): read the policy first (#6722)') === 6722);
  assert('a-merge-commit-subject-does-too', pullNumberFromSubject('Merge pull request #6722 from claude/x') === 6722);
  assert(
    'a-subject-citing-an-issue-mid-title-keeps-only-the-trailing-parenthetical',
    pullNumberFromSubject('fix(plugin-detail): re-key three fetch effects (#6697) (#6725)') === 6725,
  );
  assert('a-subject-naming-no-pr-is-null', pullNumberFromSubject('chore: direct work') === null && pullNumberFromSubject(undefined) === null);

  // -- event payloads, including the malformed ones ---------------------------
  const mg = resolveEventContext({
    eventName: 'merge_group',
    payload: { merge_group: { base_sha: 'b'.repeat(40), head_sha: 'h'.repeat(40), head_ref: 'refs/heads/gh-readonly-queue/main/pr-99-abcdef1', base_ref: 'refs/heads/main' } },
  });
  assert('a-merge_group-payload-resolves-to-its-shas-and-named-pr', mg.ok && mg.event === 'merge_group' && mg.namedPull === 99, JSON.stringify(mg));
  const pr = resolveEventContext({
    eventName: 'pull_request',
    payload: { pull_request: { number: 123, draft: true, base: { sha: 'b'.repeat(40) }, head: { sha: 'h'.repeat(40) } } },
  });
  assert('a-pull_request-payload-resolves-to-its-number-and-draft-state', pr.ok && pr.namedPull === 123 && pr.draft === true, JSON.stringify(pr));
  assert('a-merge_group-with-no-shas-CANNOT-RUN-never-reads-as-an-empty-diff', resolveEventContext({ eventName: 'merge_group', payload: { merge_group: {} } }).ok === false);
  assert('a-pull_request-with-no-head-sha-CANNOT-RUN', resolveEventContext({ eventName: 'pull_request', payload: { pull_request: { number: 1, base: { sha: 'x' } } } }).ok === false);
  const unsupported = resolveEventContext({ eventName: 'push', payload: {} });
  assert('an-unsupported-event-CANNOT-RUN-and-names-both-events-it-does-read', !unsupported.ok && /merge_group/.test(unsupported.reason) && /pull_request/.test(unsupported.reason), unsupported.reason);

  // -- the any-approver predicate (the early-warning leg's) -------------------
  assert('an-approval-is-an-approval', approvalVerdict(approved('hotlong')).state === 'approved');
  assert('no-reviews-at-all-is-unapproved', approvalVerdict([]).state === 'unapproved');
  assert('a-COMMENTED-review-is-not-an-approval', approvalVerdict([{ state: 'COMMENTED', user: { login: 'a' } }]).state === 'unapproved');
  // ⭐ The fail-open direction a naive `.some(r => r.state === 'APPROVED')` gets
  // wrong, and the only direction this file may not be wrong in.
  assert(
    'an-approval-later-superseded-by-CHANGES_REQUESTED-is-NOT-an-approval',
    approvalVerdict([
      { state: 'APPROVED', user: { login: 'a' } },
      { state: 'CHANGES_REQUESTED', user: { login: 'a' } },
    ]).state === 'unapproved',
  );
  assert(
    'a-CHANGES_REQUESTED-later-superseded-by-an-approval-IS-an-approval',
    approvalVerdict([
      { state: 'CHANGES_REQUESTED', user: { login: 'a' } },
      { state: 'APPROVED', user: { login: 'a' } },
    ]).state === 'approved',
  );
  assert('a-DISMISSED-approval-is-not-an-approval', approvalVerdict([{ state: 'DISMISSED', user: { login: 'a' } }]).state === 'unapproved');
  assert(
    'one-reviewers-changes-request-does-not-erase-anothers-approval-but-IS-reported',
    (() => {
      const v = approvalVerdict([...approved('a'), { state: 'CHANGES_REQUESTED', user: { login: 'b' } }]);
      return v.state === 'approved' && v.changesRequestedBy.join() === 'b';
    })(),
  );
  assert('the-state-comparison-is-case-insensitive-the-API-has-shipped-both', approvalVerdict([{ state: 'approved', user: { login: 'a' } }]).state === 'approved');

  // -- the authorized predicate (the queue leg's) ----------------------------
  //
  // ⭐ Maintainer ruling 2026-09-04, pinned in BOTH directions: an authorized
  // approval counts on whichever commit it was left, and every way an approval
  // never counted still never counts. The first three cases are the ones that
  // used to assert the opposite; they are flips, not additions.
  assert('the-authorized-set-is-the-two-carried-accounts', GOVERNED_APPROVERS.join() === 'os-zhuang,hotlong');
  for (const login of GOVERNED_APPROVERS) {
    assert(`an-authorized-approval-counts: ${login}`, authorizedApprovalVerdict([approvedAt(login, HEAD)]).state === 'approved');
  }
  const older = authorizedApprovalVerdict([approvedAt(GOVERNED_APPROVERS[0], OLD)]);
  assert(
    'an-authorized-approval-left-on-an-OLDER-commit-COUNTS-the-2026-09-04-ruling',
    older.state === 'approved' && older.approvers.join() === GOVERNED_APPROVERS[0],
    JSON.stringify(older),
  );
  assert(
    'an-authorized-approval-with-NO-commit_id-counts-a-human-record-is-not-a-sha',
    authorizedApprovalVerdict(approved(GOVERNED_APPROVERS[0])).state === 'approved',
  );
  const outsider = authorizedApprovalVerdict([approvedAt('not-authorized', HEAD)]);
  assert('an-unauthorized-approval-never-counts', outsider.state === 'unapproved' && outsider.unauthorizedApprovers.join() === 'not-authorized');
  assert(
    'an-authorized-approval-later-superseded-by-CHANGES_REQUESTED-never-counts',
    authorizedApprovalVerdict([approvedAt(GOVERNED_APPROVERS[0], HEAD), { state: 'CHANGES_REQUESTED', user: { login: GOVERNED_APPROVERS[0] }, commit_id: HEAD }]).state === 'unapproved',
  );
  assert(
    'a-DISMISSED-authorized-approval-never-counts',
    authorizedApprovalVerdict([approvedAt(GOVERNED_APPROVERS[1], HEAD), { state: 'DISMISSED', user: { login: GOVERNED_APPROVERS[1] }, commit_id: HEAD }]).state === 'unapproved',
  );
  assert('no-reviews-at-all-is-unapproved-under-the-authorized-predicate-too', authorizedApprovalVerdict([]).state === 'unapproved');
  assert(
    'an-unauthorized-approval-does-not-mask-an-authorized-one',
    authorizedApprovalVerdict([approvedAt('not-authorized', HEAD), approvedAt(GOVERNED_APPROVERS[1], HEAD)]).approvers.join() === GOVERNED_APPROVERS[1],
  );
  assert(
    'an-authorized-approval-on-an-UNPARSABLE-commit_id-counts-too-nothing-reads-a-sha-any-more',
    authorizedApprovalVerdict([{ state: 'APPROVED', user: { login: GOVERNED_APPROVERS[0] }, commit_id: 'not-a-sha' }]).state === 'approved',
  );
  assert(
    'only-DECISIVE-states-carry-a-decision-COMMENTED-and-PENDING-are-not-approvals',
    authorizedApprovalVerdict([
      { state: 'COMMENTED', user: { login: GOVERNED_APPROVERS[0] } },
      { state: 'PENDING', user: { login: GOVERNED_APPROVERS[1] } },
    ]).state === 'unapproved',
  );

  // -- decomposition, and the multi-PR group trap ----------------------------
  const clearRows = [row(1, ['packages/core/src/index.ts', 'content/docs/guide/x.md'])];
  assert('a-clear-diff-decomposes-to-nothing', decomposeGovernedWork(clearRows).governed.length === 0 && decomposeGovernedWork(clearRows).unattributed.length === 0);
  const mixed = decomposeGovernedWork([row(5, ['AGENTS.md', 'packages/core/src/index.ts'])]);
  assert('a-mixed-diff-governs-the-whole-pr-and-lists-only-the-governed-paths', mixed.governed[0].paths.join() === 'AGENTS.md', JSON.stringify(mixed.governed[0].paths));
  const batched = decomposeGovernedWork([row(11, ['docs/adr/0099-x.md'], 'a'.repeat(40)), row(12, ['packages/core/src/x.ts'], 'b'.repeat(40))]);
  assert('a-batched-group-attributes-the-governed-diff-to-ITS-OWN-pr-not-the-last-one', batched.governed.length === 1 && batched.governed[0].pr === 11, JSON.stringify(batched.governed.map((g) => g.pr)));
  const twoGoverned = decomposeGovernedWork([row(11, ['AGENTS.md']), row(12, ['skills/objectui/SKILL.md'], 'b'.repeat(40))]);
  assert('two-governed-prs-in-one-group-are-both-carried', twoGoverned.governed.map((g) => g.pr).join() === '11,12');
  const unattributed = decomposeGovernedWork([{ sha: 'c'.repeat(40), subject: 'chore: direct work', pr: null, paths: ['CLAUDE.md'] }]);
  assert('a-governed-commit-naming-no-pr-is-UNATTRIBUTED-never-dropped', unattributed.unattributed.length === 1 && unattributed.governed.length === 0);
  assert('an-UNGOVERNED-commit-naming-no-pr-is-simply-not-our-business', decomposeGovernedWork([{ sha: 'd'.repeat(40), subject: 'x', pr: null, paths: ['README.md'] }]).unattributed.length === 0);

  // -- the verdict table, both events ----------------------------------------
  const clearV = run('merge_group', clearRows);
  assert('a-clear-merge-group-is-CLEAR-and-exits-0', clearV.conclusion === 'clear' && clearV.exitCode === EXIT_CLEAR);
  assert('and-it-made-zero-review-lookups', clearV.apiCalls === 0);
  const refusedV = run('merge_group', [row(6183, ['AGENTS.md'])], new Map([[6183, authorizedApprovalVerdict([])]]));
  assert('an-unapproved-governed-merge-group-is-REFUSED-with-code-3', refusedV.conclusion === 'refused' && refusedV.exitCode === EXIT_REFUSED_UNAPPROVED);
  const clearedV = run('merge_group', [row(6183, ['AGENTS.md'])], new Map([[6183, authorizedPass()]]));
  assert('an-authorized-approval-CLEARS-the-merge-group-and-exits-0', clearedV.conclusion === 'cleared' && clearedV.exitCode === EXIT_CLEAR);
  const olderV = run('merge_group', [row(6183, ['AGENTS.md'])], new Map([[6183, authorizedApprovalVerdict([approvedAt(GOVERNED_APPROVERS[0], OLD)])]]));
  assert('an-approval-left-on-an-OLDER-commit-CLEARS-the-merge-group-too', olderV.conclusion === 'cleared' && olderV.exitCode === EXIT_CLEAR);
  const outsiderV = run('merge_group', [row(6183, ['AGENTS.md'])], new Map([[6183, authorizedApprovalVerdict([approvedAt('not-authorized', HEAD)])]]));
  assert('an-unauthorized-account-approval-REFUSES-the-merge-group-with-code-3', outsiderV.conclusion === 'refused' && outsiderV.exitCode === EXIT_REFUSED_UNAPPROVED);
  const unreadableV = run('merge_group', [row(6183, ['AGENTS.md'])], new Map([[6183, unreadableApproval('HTTP 502')]]));
  assert('an-unreadable-review-list-is-a-REFUSAL-not-a-pass', unreadableV.conclusion === 'refused' && unreadableV.exitCode === EXIT_REFUSED_UNREADABLE);
  const missingV = run('merge_group', [row(6183, ['AGENTS.md'])]);
  assert('a-governed-pr-with-NO-recorded-reading-refuses-too-there-is-no-default-pass', missingV.exitCode === EXIT_REFUSED_UNREADABLE);
  const unattrV = run('merge_group', [{ sha: 'c'.repeat(40), subject: 'chore: x', pr: null, paths: ['CLAUDE.md'] }]);
  assert('an-unattributed-governed-commit-is-REFUSED-with-its-own-code', unattrV.conclusion === 'refused' && unattrV.exitCode === EXIT_REFUSED_UNATTRIBUTED);
  const partial = run(
    'merge_group',
    [row(11, ['AGENTS.md']), row(12, ['skills/objectui/SKILL.md'], 'b'.repeat(40))],
    new Map([[11, authorizedPass()], [12, authorizedApprovalVerdict([])]]),
  );
  assert('one-approved-pr-does-NOT-carry-an-unapproved-sibling-through-the-same-group', partial.exitCode === EXIT_REFUSED_UNAPPROVED);

  // -- the pull_request leg is an EARLY WARNING and never reddens -------------
  const warnedV = run('pull_request', [row(6183, ['AGENTS.md'])], new Map([[6183, approvalVerdict([])]]));
  assert('a-governed-unapproved-PULL-REQUEST-is-WARNED-not-refused', warnedV.conclusion === 'warned' && warnedV.exitCode === EXIT_CLEAR);
  assert(
    'the-pr-leg-never-reddens-under-ANY-approval-state-that-is-the-permanently-red-poison',
    ['unapproved', 'unreadable', 'approved'].every(
      (state) => run('pull_request', [row(1, ['AGENTS.md'])], new Map([[1, { state, approvers: [], changesRequestedBy: [], reviewsRead: 0 }]])).exitCode === EXIT_CLEAR,
    ),
  );
  assert('and-an-unattributed-governed-commit-does-not-redden-a-pr-run-either', run('pull_request', [{ sha: 'c'.repeat(40), subject: 'x', pr: null, paths: ['CLAUDE.md'] }]).exitCode === EXIT_CLEAR);

  // -- the replay fixtures ---------------------------------------------------
  for (const replay of REPLAYS) {
    const rows = [row(replay.pr, replay.files, 'e'.repeat(40), replay.subject)];
    const queued = run('merge_group', rows, new Map([[replay.pr, authorizedApprovalVerdict([])]]));
    assert(`replay-REFUSES-at-the-queue: ${replay.name}`, queued.exitCode === EXIT_REFUSED_UNAPPROVED, JSON.stringify(queued.conclusion));
    const early = run('pull_request', rows, new Map([[replay.pr, approvalVerdict([])]]));
    assert(`replay-only-WARNS-on-the-pr: ${replay.name}`, early.conclusion === 'warned' && early.exitCode === EXIT_CLEAR);
    const text = renderGuardVerdict(queued);
    assert(`replay-names-its-governed-paths: ${replay.name}`, replay.files.filter((f) => governedPathsIn([f]).length > 0).every((f) => text.includes(f)), text);
    // The subject the fixture carries is the one `enumerateRows` would parse,
    // so the attribution leg is exercised on the same string a queue build sees.
    assert(`replay-subject-attributes-to-its-own-pr: ${replay.name}`, pullNumberFromSubject(replay.subject) === replay.pr, replay.subject);
  }

  // -- ⭐ the ordering guarantee, measured with a spy that THROWS -------------
  //
  // "The path test runs first and a clear diff makes no API call" is a claim
  // about control flow, so it is tested by making the API impossible to touch.
  // A mock returning [] would have passed against a version that called it.
  let apiTouched = 0;
  const explode = () => {
    apiTouched += 1;
    throw new Error('the API must not be reached for a diff that touches nothing governed');
  };
  let orderedClear = null;
  let orderedThrow = null;
  try {
    orderedClear = await runGuard({ event: 'merge_group', rows: clearRows, fetchReviews: explode });
  } catch (error) {
    orderedThrow = String(error?.message ?? error);
  }
  assert(
    'a-clear-diff-NEVER-constructs-a-review-request',
    apiTouched === 0 && orderedThrow === null && orderedClear?.exitCode === EXIT_CLEAR && orderedClear?.conclusion === 'clear',
    `apiTouched=${apiTouched} threw=${orderedThrow ?? 'no'}`,
  );
  // …and the other half: a governed diff DOES reach the review read, so the
  // case above proves an ordering rather than a dead code path. The review list
  // it gets carries an approval left on an OLDER commit — the ruled direction,
  // measured end to end rather than only on the pure predicate.
  const trace = [];
  const traced = await runGuard({
    event: 'merge_group',
    rows: [row(1, ['AGENTS.md'])],
    fetchReviews: () => {
      trace.push('reviews');
      return [approvedAt(GOVERNED_APPROVERS[0], OLD)];
    },
  });
  assert('a-governed-queue-diff-reads-the-review-list-and-nothing-else', trace.join() === 'reviews', trace.join());
  assert(
    'the-authorized-predicate-is-wired-end-to-end-an-approval-on-an-OLDER-commit-CLEARS',
    traced.conclusion === 'cleared' && traced.exitCode === EXIT_CLEAR && traced.apiCalls === 1,
    JSON.stringify({ conclusion: traced.conclusion, apiCalls: traced.apiCalls }),
  );
  const tracedOutsider = await runGuard({
    event: 'merge_group',
    rows: [row(1, ['AGENTS.md'])],
    fetchReviews: () => [approvedAt('not-authorized', HEAD)],
  });
  assert('the-authorized-predicate-is-wired-end-to-end-an-unauthorized-approval-still-REFUSES', tracedOutsider.exitCode === EXIT_REFUSED_UNAPPROVED);
  // The two legs read the same list and differ only in the predicate: the queue
  // leg requires an authorized approver, the early warning takes any. Asserting
  // both halves in one case is what makes "the legs still differ" measured.
  const prLeg = await runGuard({
    event: 'pull_request',
    rows: [row(1, ['AGENTS.md'])],
    fetchReviews: () => approved('anyone'),
  });
  assert(
    'the-pr-leg-keeps-the-ANY-approver-reading-while-the-queue-leg-requires-an-authorized-one',
    prLeg.conclusion === 'warned' && prLeg.apiCalls === 1 &&
      renderGuardVerdict(prLeg).includes('✅ APPROVED review present, by: anyone') &&
      renderGuardVerdict(prLeg).includes('1 review lookup(s).') &&
      authorizedApprovalVerdict(approved('anyone')).state === 'unapproved',
    renderGuardVerdict(prLeg),
  );
  // A throwing reader on a GOVERNED diff becomes a refusal, never a pass — and
  // `runGuard` must CONTAIN the throw rather than propagate it, so this is
  // caught too: an escaping error would abort every case after it, and an
  // aborted self-test hides the failures it already collected.
  let thrown = null;
  let thrownEscaped = null;
  try {
    thrown = await runGuard({
      event: 'merge_group',
      rows: [row(1, ['AGENTS.md'])],
      fetchReviews: () => {
        throw new Error('HTTP 403');
      },
    });
  } catch (error) {
    thrownEscaped = String(error?.message ?? error);
  }
  assert(
    'a-throwing-review-read-on-a-governed-diff-REFUSES-and-the-throw-never-escapes',
    thrownEscaped === null && thrown?.exitCode === EXIT_REFUSED_UNREADABLE && /403/.test(renderGuardVerdict(thrown)),
    thrownEscaped ? `escaped: ${thrownEscaped}` : renderGuardVerdict(thrown),
  );
  // ⭐ The retired head read, measured rather than assumed. This case replaces
  // the one that pinned "an unreadable PR head refuses with exit 4 before the
  // review request is built": that ordering existed only because the sha pin
  // needed a head, and a mechanism removed by a ruling must be checked ABSENT,
  // not left to be inferred from the code reading clean. One governed pull
  // request now costs exactly ONE lookup, and it is the review list.
  let readsPerPull = 0;
  const oneRead = await runGuard({
    event: 'merge_group',
    rows: [row(1, ['AGENTS.md'])],
    fetchReviews: () => {
      readsPerPull += 1;
      return [approvedAt(GOVERNED_APPROVERS[0], OLD)];
    },
  });
  assert(
    'the-queue-leg-costs-exactly-ONE-review-lookup-per-governed-pr-the-head-read-is-retired',
    readsPerPull === 1 && oneRead.apiCalls === 1 && oneRead.conclusion === 'cleared',
    `readsPerPull=${readsPerPull} apiCalls=${oneRead.apiCalls} conclusion=${oneRead.conclusion}`,
  );

  // -- the words a reader acts on --------------------------------------------
  const refusalText = renderGuardVerdict(refusedV);
  assert('a-refusal-names-the-exact-paths-that-matched', refusalText.includes('AGENTS.md'), refusalText);
  assert('a-refusal-names-the-pull-request', refusalText.includes('#6183'), refusalText);
  assert('a-refusal-states-what-would-satisfy-it', /What satisfies this check/.test(refusalText) && /DRAFT/.test(refusalText) && /APPROVED review/.test(refusalText), refusalText);
  assert('a-refusal-names-the-preferred-remedy-first-and-it-is-DEQUEUE-not-approve', refusalText.indexOf('DRAFT') < refusalText.indexOf('obtain an APPROVED review'), refusalText);
  assert('a-refusal-forecloses-the-edit-the-check-remedy', /Neither of those is "edit this check"/.test(refusalText), refusalText);
  assert('a-refusal-carries-the-runnable-derivation-command', refusalText.includes('check-governed-queue-guard.mjs --test'), refusalText);
  assert('a-refusal-names-the-incident-it-descends-from', /6183/.test(refusalText) && /5b3290fd5/.test(refusalText), refusalText);
  const clearText = renderGuardVerdict(clearV);
  assert('a-clear-run-says-it-cost-zero-lookups', /ZERO review lookups/.test(clearText), clearText);
  assert('a-clear-run-points-at-the-register-rather-than-listing-surfaces', clearText.includes('GOVERNED_SURFACES') && !clearText.includes('docs/adr/**'), clearText);
  const warnText = renderGuardVerdict(warnedV);
  assert('the-warning-says-out-loud-that-it-is-deliberately-green', /EARLY WARNING/.test(warnText) && /GREEN here/.test(warnText), warnText);
  assert('the-warning-tells-a-seat-what-not-to-do', /flip it ready, enqueue it, or arm auto-merge/.test(warnText), warnText);
  // ⭐ The warning names the exact mechanism of the incident, because the seat
  // reading it is the seat about to make the same call.
  assert('the-warning-names-the-hidden-draft-false-side-effect', /draft: false/.test(warnText) && /update_pull_request/.test(warnText), warnText);
  assert('the-warning-forecasts-the-queue-refusal', /REFUSES it/.test(warnText), warnText);
  assert('an-outstanding-changes-request-is-reported-even-though-it-does-not-flip-the-verdict', /CHANGES_REQUESTED from: b/.test(renderGuardVerdict(run('merge_group', [row(1, ['AGENTS.md'])], new Map([[1, approvalVerdict([...approved('a'), { state: 'CHANGES_REQUESTED', user: { login: 'b' } }])]])))));
  const kinds = [refusedV, unreadableV, unattrV].map((v) => renderGuardVerdict(v));
  assert('the-three-refusal-kinds-render-three-different-explanations', new Set(kinds).size === 3);
  assert('the-unreadable-refusal-says-it-is-deliberately-not-a-pass', /refusal and not a pass/.test(kinds[1]), kinds[1]);
  assert(
    'the-refusal-remedy-names-every-authorized-approver-from-the-constant',
    GOVERNED_APPROVERS.every((login) => refusalText.includes(login)) && refusalText.includes('GOVERNED_APPROVERS'),
    refusalText,
  );
  assert('the-refusal-remedy-states-the-agent-no-approve-prohibition', /An agent seat never submits that approval/.test(refusalText), refusalText);
  const olderText = renderGuardVerdict(olderV);
  assert(
    'an-older-commit-approval-renders-as-CLEARED-and-nothing-in-the-output-calls-it-stale',
    /CLEARED/.test(olderText) && olderText.includes(GOVERNED_APPROVERS[0]) && !/STALE/i.test(olderText) && !olderText.includes(OLD.slice(0, 12)),
    olderText,
  );
  assert(
    'an-unauthorized-refusal-says-the-approval-never-counts',
    /APPROVED by account\(s\) outside GOVERNED_APPROVERS: not-authorized — never counts/.test(renderGuardVerdict(outsiderV)),
    renderGuardVerdict(outsiderV),
  );
  const clearedText = renderGuardVerdict(clearedV);
  assert(
    'the-cleared-summary-states-the-ruled-predicate-and-derives-its-accounts-from-the-constant',
    /regardless of which commit/.test(clearedText) && /2026-09-04/.test(clearedText) && GOVERNED_APPROVERS.every((login) => clearedText.includes(login)),
    clearedText,
  );
  assert(
    'an-authorized-pass-names-the-approver-and-pins-NO-head-sha',
    clearedText.includes(`by: ${GOVERNED_APPROVERS[0]}`) && !clearedText.includes(HEAD.slice(0, 12)),
    clearedText,
  );

  // -- the seat-side `--test` predicate --------------------------------------
  const governedTest = testVerdict(['AGENTS.md', 'packages/core/src/index.ts']);
  assert('--test-reports-a-mixed-diff-as-GOVERNED', governedTest.governed && governedTest.hitPaths.join() === 'AGENTS.md' && governedTest.clearPaths.join() === 'packages/core/src/index.ts');
  const clearTest = testVerdict(['packages/core/src/index.ts', 'package.json']);
  assert('--test-reports-an-ordinary-diff-as-NOT-GOVERNED', !clearTest.governed && clearTest.checked === 2);
  const governedTestText = renderTestVerdict(governedTest);
  assert('--test-names-the-surface-and-the-file', /GOVERNED/.test(governedTestText) && governedTestText.includes('AGENTS.md') && governedTestText.includes('the repo-root agent instruction file'), governedTestText);
  assert('--test-prescribes-the-draft-remedy', /DRAFT/.test(governedTestText) && /human merge IS the review record/.test(governedTestText), governedTestText);
  assert('--test-names-the-check-a-queue-build-would-run', governedTestText.includes(CHECK_CONTEXT_NAME), governedTestText);
  assert('--test-on-a-clear-list-says-the-normal-route-applies', /NOT GOVERNED/.test(renderTestVerdict(clearTest)), renderTestVerdict(clearTest));
  // Empty input is BAD USAGE, not a clearance: `--test` with no paths would
  // otherwise print "not governed" about a question nobody asked.
  assert('--test-with-no-paths-is-BAD-USAGE-not-a-clearance', runTestMode(['node', 'x', '--test']) === EXIT_BAD_USAGE);

  // -- the WIRING pins: the workflow and the required-context register --------
  //
  // Without these, renaming the job detaches the context this repository has
  // written down as blocking, and the name declared here becomes a name nothing
  // publishes. Read from disk on purpose: a constant asserting against itself
  // proves nothing.
  try {
    const wf = readFileSync(join(repoRoot, '.github', 'workflows', CHECK_WORKFLOW), 'utf8');
    assert('the-workflow-exists-and-declares-the-job-id-this-file-names', wf.includes(`\n  ${CHECK_JOB_ID}:\n`), CHECK_JOB_ID);
    assert('the-workflow-publishes-EXACTLY-the-context-name-this-file-declares', wf.includes(`name: ${CHECK_CONTEXT_NAME}\n`), CHECK_CONTEXT_NAME);
    assert('the-workflow-triggers-on-merge_group-the-leg-that-actually-refuses', /^ {2}merge_group:\s*$/m.test(wf), 'merge_group trigger absent');
    assert('the-workflow-triggers-on-pull_request-the-early-warning-leg', /^ {2}pull_request:\s*$/m.test(wf), 'pull_request trigger absent');
    // ⭐ `ready_for_review` is the addition that matters: flipping a governed
    // draft to ready is the first move of the exact sequence #6183 took, and it
    // is NOT in GitHub's default `types:` set. Naming `types:` REPLACES the
    // default set rather than extending it, so all four are restated.
    assert('the-workflow-re-fires-on-ready_for_review-the-first-move-of-the-incident', /types:\s*\[opened, synchronize, reopened, ready_for_review\]/.test(wf), 'ready_for_review absent from types');
    assert('the-workflow-invokes-THIS-script', wf.includes('scripts/check-governed-queue-guard.mjs'), 'invocation absent');
    assert('the-workflow-runs-the-self-test-before-the-live-judgment', wf.indexOf('--self-test') < wf.indexOf('GITHUB_TOKEN'), 'the self-test does not precede the live step');
    assert('the-workflow-checks-out-full-history-a-truncated-diff-answers-with-silence', /fetch-depth:\s*0/.test(wf), 'fetch-depth: 0 absent');
    assert('the-workflow-declares-pull-requests-read-the-only-scope-the-review-read-needs', /pull-requests:\s*read/.test(wf), 'pull-requests: read absent');
    // ⛔ A skipped job counts as SUCCESS in branch protection, so a path filter
    // would hand the queue a green verdict for a diff the filter mis-scoped —
    // on the one check whose entire job is to refuse. The path test belongs
    // INSIDE the script, where "nothing governed" costs zero API calls.
    assert('the-workflow-carries-no-paths-filter-a-skipped-guard-counts-as-SUCCESS', !/^\s*paths(-ignore)?:/m.test(wf), 'a paths filter would make this guard skippable');
  } catch (error) {
    assert('the-workflow-file-is-readable', false, String(error?.message ?? error).split('\n')[0]);
  }
  try {
    const gate = readFileSync(join(repoRoot, 'scripts', 'dependabot-merge-gate.mjs'), 'utf8');
    assert(
      'this-repository-has-written-the-context-down-as-blocking',
      gate.includes(`'${CHECK_CONTEXT_NAME}'`),
      `${CHECK_CONTEXT_NAME} is absent from scripts/dependabot-merge-gate.mjs — REQUIRED_CONTEXTS is this repo's own answer to "which checks are blocking", and a guard outside it is a guard the queue floor cannot derive`,
    );
  } catch (error) {
    assert('the-required-context-register-is-readable', false, String(error?.message ?? error).split('\n')[0]);
  }

  for (const f of failures) console.error(`  x ${f}`);
  if (failures.length > 0) {
    console.error(`FAIL check-governed-queue-guard self-test: ${failures.length} of ${checked} case(s) failed.`);
    return 1;
  }
  console.log(
    `OK check-governed-queue-guard self-test: ${checked} cases pass ` +
      '(the five ruled surfaces pinned in both directions including the widenings NOT taken, the queue/PR ' +
      'event split, latest-decisive approval reduction, the authorized-approval-record predicate on the queue ' +
      'leg per the 2026-09-04 ruling — counts on an OLDER commit, on no commit_id and on an unparsable one; ' +
      'never for an unauthorized, dismissed, superseded, non-decisive or absent review — with the PR leg ' +
      'still taking any approver, multi-PR group decomposition, four replayed governed shapes, the zero-API ' +
      'ordering guarantee measured with throwing spies, the retired head read measured ABSENT at one lookup ' +
      'per governed PR, the unreadable-review-list refusal, the seat-side --test predicate, and the workflow ' +
      '+ required-context wiring pins).',
  );
  return 0;
}

if (isEntrypoint(import.meta.url) && process.argv.includes('--self-test')) {
  process.exit(await selfTest());
}
