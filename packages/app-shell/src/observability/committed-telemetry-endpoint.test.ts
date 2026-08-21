/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 */

/**
 * objectui#5522 — no committed `.env*` file may carry a third-party telemetry
 * endpoint, or turn PII collection on by default.
 *
 * Why this is a test and not a review note: `@object-ui/console` publishes a
 * PRE-BUILT SPA (`files: ["dist"]`, `prepublishOnly: pnpm build`). ONE
 * artifact, built once from `apps/console/.env.production`, is what the hosted
 * SaaS console AND the on-premises / air-gapped EE images all embed. Vite
 * inlines every `VITE_*` defined there into that bundle as a frozen object
 * literal, so a DSN committed in the tree is a live telemetry endpoint
 * compiled into the artifact that lands inside customer networks — and it
 * cannot be switched off afterwards, because the `VITE_SENTRY_ENABLED` kill
 * switch is read off that same frozen literal and is `undefined` forever on a
 * build that never defined it.
 *
 * Measured, not hypothetical: an air-gapped EE deployment sent 14 Sentry
 * envelopes per session to sentry.io carrying IP + User-Agent PII, with no way
 * for the customer to stop it (objectstack-ai/cloud#1508). The `.env` file was
 * the mechanism, so the `.env` files are what this guards.
 *
 * Deployments that WANT reporting inject `VITE_SENTRY_DSN` from their own
 * deploy environment at build time, exactly as they already inject
 * `VITE_SERVER_URL`.
 *
 * This lives beside `sentry.ts` rather than in `apps/console` for one
 * measured reason: Vite's `server.fs.deny` blocks `.env*` from `?raw` imports
 * ("Denied ID …/.env.production?raw"), and the console's tsconfig is
 * browser-only (`types` without `node`), so it can read the file neither way.
 * app-shell's tsconfig carries `"types": ["node", "vite/client"]`.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Every committed file whose basename is `.env`, `.env.production`, etc. */
function committedEnvFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out
    .split('\0')
    .filter(Boolean)
    .filter((file) => /^\.env(\..+)?$/.test(path.basename(file)))
    // `.env.example` / `.env.sample` exist to SHOW the shape, so a placeholder
    // assignment there is the point rather than a leak. None exist today; the
    // filter is here so adding one does not force a weakening of the rules.
    .filter((file) => !/\.(example|sample|template)$/.test(file));
}

/** Assignments actually IN EFFECT — comments and blanks excluded. */
export function parseEnv(text: string): { key: string; value: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const eq = line.indexOf('=');
      return eq === -1
        ? { key: line, value: '' }
        : { key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
    });
}

/** Rule set. Returns a human-readable reason per offending assignment. */
export function violationsIn(text: string): string[] {
  const reasons: string[] = [];
  for (const { key, value } of parseEnv(text)) {
    if (/DSN$/i.test(key) && value !== '') {
      reasons.push(`${key} commits a DSN (${value.slice(0, 24)}…)`);
    }
    // Catches the endpoint arriving under a different key, or smuggled into a
    // tunnel/transport option, which a DSN-key-only rule would miss.
    if (/sentry\.io|\.ingest\./i.test(value)) {
      reasons.push(`${key} names a third-party telemetry host`);
    }
    if (/SEND_DEFAULT_PII$/i.test(key) && value.toLowerCase() === 'true') {
      reasons.push(`${key}=true turns on IP + User-Agent collection by default`);
    }
  }
  return reasons;
}

const envFiles = committedEnvFiles();

describe('committed .env files carry no third-party telemetry endpoint', () => {
  // ── Vacuum guards ─────────────────────────────────────────────────────────
  // Every assertion below is an ABSENCE, which a checker that silently found
  // or parsed nothing would satisfy perfectly. These fail first if the file
  // discovery, the path, or the parser ever stops returning real content.
  it('found the committed env files (guards the absence assertions)', () => {
    expect(envFiles.length).toBeGreaterThan(0);
    expect(envFiles).toContain('apps/console/.env.production');
  });

  it('parses real assignments out of the console production env', () => {
    const parsed = parseEnv(readFileSync(path.join(repoRoot, 'apps/console/.env.production'), 'utf8'));
    expect(parsed.map((entry) => entry.key)).toContain('VITE_SERVER_URL');
    expect(parsed.find((entry) => entry.key === 'VITE_USE_MOCK_SERVER')?.value).toBe('false');
  });

  it('flags an offending file — proving the rules can actually fire', () => {
    // Counter-probe for the checker itself. Without it, a rule set that
    // matched nothing at all would report the tree clean forever.
    expect(violationsIn('VITE_SENTRY_DSN=https://k@o1.ingest.us.sentry.io/2')).not.toEqual([]);
    expect(violationsIn('VITE_SENTRY_SEND_DEFAULT_PII=true')).not.toEqual([]);
    expect(violationsIn('SOME_TUNNEL=https://relay.ingest.sentry.io/x')).not.toEqual([]);
    // …and does not fire on the commentary that documents the recipe.
    expect(violationsIn('# VITE_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<p>')).toEqual([]);
    expect(violationsIn('VITE_SERVER_URL=\nVITE_USE_MOCK_SERVER=false')).toEqual([]);
  });

  it.each(envFiles)('%s', (file) => {
    const reasons = violationsIn(readFileSync(path.join(repoRoot, file), 'utf8'));
    expect(
      reasons,
      `${file} would be inlined into the published pre-built SPA, which on-premises and ` +
        'air-gapped deployments embed and cannot switch off. Inject it from the deploy ' +
        'environment of the build that wants reporting instead.',
    ).toEqual([]);
  });
});
