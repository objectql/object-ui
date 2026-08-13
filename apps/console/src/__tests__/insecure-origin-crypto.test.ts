/**
 * objectui#4563 — `crypto.randomUUID` on insecure origins.
 *
 * The card's defect is a MISSING PLATFORM METHOD, so the tests are written
 * against that: the red-first case drives a REAL in-repo consumer
 * (`@object-ui/plugin-view`'s `parseSpecFilter`, whose `parseTriplet` mints
 * `crypto.randomUUID()` unguarded on the list-view filter path) on a crypto
 * object shaped exactly like an insecure origin's, and pins the resulting
 * message verbatim against the string the report quotes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSpecFilter } from '@object-ui/plugin-view';
import {
  randomUuidV4,
  installRandomUuidShim,
  type GetRandomValues,
} from '../insecure-origin-crypto';

/**
 * The real entropy source, captured BEFORE any test stubs the global — the
 * uniqueness sample must not be graded against a fake.
 */
const realGetRandomValues: GetRandomValues = (buffer) => globalThis.crypto.getRandomValues(buffer);

/** Canonical RFC 4122 v4, lowercase: version nibble `4`, variant `8|9|a|b`. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** What a browser hands you on `http://LAN-IP`: getRandomValues, no randomUUID. */
function insecureOriginCrypto(): { getRandomValues: GetRandomValues; randomUUID?: unknown } {
  return { getRandomValues: realGetRandomValues };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('randomUuidV4 — the generator', () => {
  it('renders the canonical 8-4-4-4-12 shape', () => {
    expect(randomUuidV4(realGetRandomValues)).toMatch(UUID_V4);
  });

  it('forces the version nibble and variant bits regardless of the entropy', () => {
    // All-ones and all-zeros entropy pin the SIX fixed bits exactly: only the
    // version nibble (octet 6 high half) and the variant (octet 8 top two bits)
    // may differ from the raw bytes.
    const ones: GetRandomValues = (buffer) => buffer.fill(0xff);
    const zeros: GetRandomValues = (buffer) => buffer.fill(0x00);

    expect(randomUuidV4(ones)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(randomUuidV4(zeros)).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('always reports version 4 and the RFC 4122 variant', () => {
    for (let i = 0; i < 200; i++) {
      const uuid = randomUuidV4(realGetRandomValues);
      expect(uuid).toMatch(UUID_V4);
      expect(uuid[14]).toBe('4');
      expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
    }
  });

  it('draws 16 bytes and does not repeat itself across a sample', () => {
    const widths: number[] = [];
    randomUuidV4((buffer) => {
      widths.push(buffer.length);
      return realGetRandomValues(buffer);
    });
    expect(widths).toEqual([16]);

    const sample = new Set(Array.from({ length: 1000 }, () => randomUuidV4(realGetRandomValues)));
    expect(sample.size).toBe(1000);
  });
});

describe('installRandomUuidShim — the installer', () => {
  it('installs onto an insecure-origin crypto that lacks randomUUID', () => {
    const cryptoLike = insecureOriginCrypto();
    expect('randomUUID' in cryptoLike).toBe(false);

    expect(installRandomUuidShim(cryptoLike)).toBe('installed');

    expect(typeof cryptoLike.randomUUID).toBe('function');
    expect((cryptoLike.randomUUID as () => string)()).toMatch(UUID_V4);
  });

  it('MUST NOT touch a native implementation — identity is preserved', () => {
    const native = (): string => '11111111-2222-4333-8444-555555555555';
    const cryptoLike = { randomUUID: native, getRandomValues: realGetRandomValues };

    expect(installRandomUuidShim(cryptoLike)).toBe('native');

    // Identity, not behaviour: the native function object itself is still there.
    expect(cryptoLike.randomUUID).toBe(native);
  });

  it('is idempotent — a second install keeps the first fallback', () => {
    const cryptoLike = insecureOriginCrypto();
    expect(installRandomUuidShim(cryptoLike)).toBe('installed');
    const first = cryptoLike.randomUUID;

    expect(installRandomUuidShim(cryptoLike)).toBe('native');
    expect(cryptoLike.randomUUID).toBe(first);
  });

  it('refuses to install without an entropy source instead of degrading', () => {
    // No getRandomValues => no cryptographic randomness available. We do NOT
    // fall back to Math.random: an id generator that only LOOKS like crypto is
    // worse than the honest absence. Surfacing this state to the user is
    // objectui#4570, deliberately not this shim's job.
    const cryptoLike: { randomUUID?: unknown } = {};
    expect(installRandomUuidShim(cryptoLike)).toBe('unavailable');
    expect('randomUUID' in cryptoLike).toBe(false);
  });

  it('reports unavailable rather than throwing when there is no crypto at all', () => {
    expect(installRandomUuidShim(undefined)).toBe('unavailable');
    expect(installRandomUuidShim(null)).toBe('unavailable');
  });

  it('defaults to globalThis.crypto', () => {
    const cryptoLike = insecureOriginCrypto();
    vi.stubGlobal('crypto', cryptoLike);

    expect(installRandomUuidShim()).toBe('installed');
    expect((globalThis.crypto.randomUUID as () => string)()).toMatch(UUID_V4);
  });
});

describe('the real consumer path (objectui#4563 repro)', () => {
  /**
   * RED-FIRST. `parseSpecFilter` -> `parseTriplet` calls `crypto.randomUUID()`
   * with no guard (packages/plugin-view/src/config/view-config-utils.ts). On an
   * insecure origin that is exactly the card's crash, and the message below is
   * the one the report quotes verbatim.
   */
  it('throws the card verbatim TypeError with no shim installed', () => {
    vi.stubGlobal('crypto', insecureOriginCrypto());

    let caught: unknown;
    try {
      parseSpecFilter([['name', '=', 'x']]);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TypeError);
    expect((caught as TypeError).message).toBe('crypto.randomUUID is not a function');
  });

  it('renders the same filter normally once the shim is installed', () => {
    const cryptoLike = insecureOriginCrypto();
    vi.stubGlobal('crypto', cryptoLike);
    expect(installRandomUuidShim(cryptoLike)).toBe('installed');

    const parsed = parseSpecFilter([['name', '=', 'x']]);

    expect(parsed.conditions).toHaveLength(1);
    expect(parsed.conditions[0]?.field).toBe('name');
    expect(parsed.conditions[0]?.id).toMatch(UUID_V4);
  });
});

describe('the module-evaluation side effect', () => {
  it('installs on import when the origin is insecure', async () => {
    vi.resetModules();
    vi.stubGlobal('crypto', insecureOriginCrypto());

    const module = await import('../insecure-origin-crypto');

    expect(module.consoleRandomUuidShimOutcome).toBe('installed');
    expect((globalThis.crypto.randomUUID as () => string)()).toMatch(UUID_V4);
  });

  it('leaves a secure origin untouched on import', async () => {
    const native = (): string => '11111111-2222-4333-8444-555555555555';
    vi.resetModules();
    vi.stubGlobal('crypto', { randomUUID: native, getRandomValues: realGetRandomValues });

    const module = await import('../insecure-origin-crypto');

    expect(module.consoleRandomUuidShimOutcome).toBe('native');
    expect(globalThis.crypto.randomUUID).toBe(native);
  });
});
