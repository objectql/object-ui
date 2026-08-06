import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// @ts-expect-error — plain-JS CI helper, intentionally untyped
import { fetchUrl, fetchRegistry, isRegistryEntry, cacheFileFor, cacheStats } from '../shadcn-sync.js';

/**
 * objectstack#5803 — the registry cache stored whatever came back.
 *
 * `fetchUrl` never looked at `res.statusCode`, and a non-JSON body was caught
 * and resolved as a raw string, so an egress allowlist answering
 * `403 Host not in allowlist: ui.shadcn.com…` resolved as if it were a
 * component. `fetchRegistry` then wrote it to disk unconditionally with a
 * one-hour TTL, and for the next hour every `pnpm shadcn:check` answered from
 * those 46 poisoned entries without retrying — reported, in the summary line,
 * as "46 cached, 0 fetched".
 *
 * The reproduction that motivated the fix, verbatim:
 *
 *     run 1: ✗ … Registry returned no usable file content   (46 errors)
 *            Registry: 0 cached, 46 fetched
 *     run 2: ✗ … Registry returned no usable file content   (46 errors)
 *            Registry: 46 cached, 0 fetched      <- never retried
 *
 * These tests are OFFLINE by construction: the shadcn registry is not
 * reachable from CI (nor from the sandbox this was written in), which is
 * exactly the condition that produced the bug. Every case below drives a local
 * `http` fixture server — a real socket, real status lines, real chunking —
 * with `http.get` injected in place of `https.get`. The status/parse logic
 * under test is transport-independent, so nothing is stubbed out.
 */

const REGISTRY_ENTRY = {
  name: 'button',
  type: 'registry:ui',
  files: [{ path: 'ui/button.tsx', content: 'export const Button = () => null\n' }],
};

/** What the sandbox's egress blocker actually returns, byte for byte. */
const EGRESS_BLOCK_BODY =
  'Host not in allowlist: ui.shadcn.com. Add this host to your network egress settings to allow access.';

type Responder = (req: http.IncomingMessage, res: http.ServerResponse) => void;

const respondJson =
  (body: unknown, code = 200): Responder =>
  (_req, res) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

const respondText =
  (code: number, body: string, contentType = 'text/plain'): Responder =>
  (_req, res) => {
    res.writeHead(code, { 'content-type': contentType });
    res.end(body);
  };

let server: http.Server;
let origin = '';
let requests = 0;
let respond: Responder = respondJson(REGISTRY_ENTRY);
let cacheDir = '';

const url = (name = 'button') => `${origin}/r/styles/default/${name}.json`;

/** `fetchRegistry` with the fixture server and a throwaway cache directory. */
const registry = (name: string, opts: Record<string, unknown> = {}) =>
  fetchRegistry(url(name), { cacheDir, get: http.get, ...opts });

const readCacheDir = () => fsp.readdir(cacheDir).catch(() => [] as string[]);

const writeCacheEntry = async (name: string, data: unknown, ageMs = 0) => {
  await fsp.mkdir(cacheDir, { recursive: true });
  await fsp.writeFile(
    cacheFileFor(url(name), cacheDir),
    JSON.stringify({ url: url(name), fetchedAt: Date.now() - ageMs, data }),
  );
};

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requests++;
    respond(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  requests = 0;
  respond = respondJson(REGISTRY_ENTRY);
  Object.assign(cacheStats, { hits: 0, misses: 0, failures: 0, evicted: 0 });
  cacheDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'shadcn-sync-cache-'));
});

afterEach(async () => {
  await fsp.rm(cacheDir, { recursive: true, force: true });
});

describe('fetchUrl — the response status is part of the contract', () => {
  it('resolves the parsed JSON of a 2xx registry response', async () => {
    respond = respondJson(REGISTRY_ENTRY);
    await expect(fetchUrl(url(), { get: http.get })).resolves.toEqual(REGISTRY_ENTRY);
  });

  it('rejects a 403 egress block, with the status and the body in the message', async () => {
    respond = respondText(403, EGRESS_BLOCK_BODY);
    // Before the fix this RESOLVED with the string below, which then flowed
    // into the cache. The status is in the message because "it failed" is not
    // actionable on its own — 403 says "allowlist", 502 says "try again".
    await expect(fetchUrl(url(), { get: http.get })).rejects.toThrow(/HTTP 403/);
    await expect(fetchUrl(url(), { get: http.get })).rejects.toThrow(/Host not in allowlist/);
  });

  it('rejects a 502 HTML error page instead of resolving its markup', async () => {
    respond = respondText(502, '<html><body><h1>502 Bad Gateway</h1></body></html>', 'text/html');
    await expect(fetchUrl(url(), { get: http.get })).rejects.toThrow(/HTTP 502/);
  });

  it('rejects a 200 whose body is not JSON', async () => {
    // A captive-portal / proxy interstitial: the status says fine, the body is
    // HTML. `data.files?.[0]?.content` reads `undefined` on a string, so this
    // used to surface as "no usable file content" rather than as a fetch error.
    respond = respondText(200, '<!doctype html><title>Sign in</title>', 'text/html');
    await expect(fetchUrl(url(), { get: http.get })).rejects.toThrow(/Malformed JSON \(HTTP 200\)/);
  });

  it('rejects a redirect rather than following it into an interstitial', async () => {
    respond = (_req, res) => {
      res.writeHead(302, { location: 'https://example.invalid/login' });
      res.end();
    };
    await expect(fetchUrl(url(), { get: http.get })).rejects.toThrow(/HTTP 302/);
  });

  it('decodes a body whose multi-byte character is split across chunks', async () => {
    // Pins `res.setEncoding('utf-8')`. Concatenating raw Buffers stringifies
    // each chunk alone, so a character split at the boundary becomes U+FFFD and
    // the payload silently changes — which, now that a parse failure is fatal,
    // would be a hard error on a component containing any non-ASCII text.
    const entry = { files: [{ path: 'ui/x.tsx', content: 'const label = "关闭"\n' }] };
    const payload = Buffer.from(JSON.stringify(entry), 'utf-8');
    const splitAt = payload.indexOf(Buffer.from('关', 'utf-8')) + 1; // mid-character
    respond = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write(payload.subarray(0, splitAt));
      res.end(payload.subarray(splitAt));
    };
    await expect(fetchUrl(url(), { get: http.get })).resolves.toEqual(entry);
  });
});

describe('isRegistryEntry — what is allowed onto disk', () => {
  it.each([
    ['a registry entry', REGISTRY_ENTRY, true],
    ['the egress block text', EGRESS_BLOCK_BODY, false],
    ['a JSON error envelope', { error: 'not found' }, false],
    ['an entry with no files', { name: 'button', files: [] }, false],
    ['an entry whose content is blank', { files: [{ path: 'ui/x.tsx', content: '   \n' }] }, false],
    ['an entry whose content is missing', { files: [{ path: 'ui/x.tsx' }] }, false],
    ['null', null, false],
    ['undefined', undefined, false],
  ])('%s -> %s', (_label, data, expected) => {
    expect(isRegistryEntry(data)).toBe(expected);
  });
});

describe('fetchRegistry — only registry data is ever cached', () => {
  it('caches a well-formed entry and answers the next read from disk', async () => {
    await expect(registry('button')).resolves.toEqual(REGISTRY_ENTRY);
    expect(await readCacheDir()).toHaveLength(1);

    await expect(registry('button', { allowCache: true })).resolves.toEqual(REGISTRY_ENTRY);
    expect(requests).toBe(1); // the second call never left the process
    expect(cacheStats.hits).toBe(1);
  });

  it('writes nothing when the fetch is blocked with a 403', async () => {
    respond = respondText(403, EGRESS_BLOCK_BODY);
    await expect(registry('button', { allowCache: true })).rejects.toThrow(/HTTP 403/);
    expect(await readCacheDir()).toEqual([]);
    expect(cacheStats.failures).toBe(1);
    expect(cacheStats.misses).toBe(0);
  });

  it('writes nothing for a 200 that parses but is not a registry entry', async () => {
    // Handed back to the caller — `--check` reports "no usable file content" —
    // but barred from disk, so the next run still retries.
    respond = respondJson({ error: 'not found' });
    await expect(registry('button', { allowCache: true })).resolves.toEqual({ error: 'not found' });
    expect(await readCacheDir()).toEqual([]);
  });

  it('a blocked run does not turn the next run into a cache hit', async () => {
    // The reported symptom, reduced: run, run again, and the second must still
    // go to the network instead of reading "46 cached, 0 fetched".
    respond = respondText(403, EGRESS_BLOCK_BODY);
    await expect(registry('button', { allowCache: true })).rejects.toThrow(/HTTP 403/);
    await expect(registry('button', { allowCache: true })).rejects.toThrow(/HTTP 403/);
    expect(requests).toBe(2);
    expect(cacheStats.hits).toBe(0);
    expect(await readCacheDir()).toEqual([]);
  });

  it('never serves a poisoned entry left behind by an older build', async () => {
    // Read-side validation. Write-side alone would leave every already-poisoned
    // checkout serving this for the rest of its hour with no way out but to
    // wait (or to know that `--no-cache` exists).
    await writeCacheEntry('button', EGRESS_BLOCK_BODY);
    expect(await readCacheDir()).toHaveLength(1);

    await expect(registry('button', { allowCache: true })).resolves.toEqual(REGISTRY_ENTRY);
    expect(requests).toBe(1);
    expect(cacheStats.hits).toBe(0);
    expect(cacheStats.evicted).toBe(1);

    // …and the poison is gone, replaced by the real entry.
    const written = JSON.parse(await fsp.readFile(cacheFileFor(url('button'), cacheDir), 'utf-8'));
    expect(written.data).toEqual(REGISTRY_ENTRY);
  });

  it('evicts a poisoned entry even when the retry also fails', async () => {
    await writeCacheEntry('button', EGRESS_BLOCK_BODY);
    respond = respondText(403, EGRESS_BLOCK_BODY);

    await expect(registry('button', { allowCache: true })).rejects.toThrow(/HTTP 403/);
    expect(cacheStats.evicted).toBe(1);
    expect(await readCacheDir()).toEqual([]);
  });

  it('refetches a well-formed entry once it is older than the TTL', async () => {
    await writeCacheEntry('button', { files: [{ path: 'ui/button.tsx', content: 'old\n' }] }, 2 * 60 * 60 * 1000);
    await expect(registry('button', { allowCache: true })).resolves.toEqual(REGISTRY_ENTRY);
    expect(requests).toBe(1);
    // Expiry is not corruption: an aged-out entry is refetched, not evicted.
    expect(cacheStats.evicted).toBe(0);
  });

  it('does not read the cache unless allowCache is set (--update stays live)', async () => {
    await writeCacheEntry('button', REGISTRY_ENTRY);
    await expect(registry('button')).resolves.toEqual(REGISTRY_ENTRY);
    expect(requests).toBe(1);
    expect(cacheStats.hits).toBe(0);
  });
});

describe('the CLI still runs when the file is the entry point', () => {
  // `main()` is now behind an `invokedAsCli()` guard so importing this module
  // (everything above) does not execute the CLI. Get that guard wrong and
  // `pnpm shadcn:check` becomes a silent no-op that exits 0 — so it is pinned
  // by actually running the script.
  it('node scripts/shadcn-sync.js --list prints the component list', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const result = spawnSync(process.execPath, ['scripts/shadcn-sync.js', '--list'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 60_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Component List');
    expect(result.stdout).toContain('Custom ObjectUI Components:');
  });
});
