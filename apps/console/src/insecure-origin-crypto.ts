/**
 * `crypto.randomUUID` fallback for INSECURE ORIGINS (objectui#4563).
 *
 * ## Why this exists at all
 *
 * `crypto.randomUUID` is exposed only in [secure contexts][mdn] — HTTPS, or
 * `http://localhost`. Serve the console over plain HTTP from anything else —
 * `http://192.168.1.20:4001/_console/`, the ordinary way a second device on
 * the LAN reaches a dev box — and the browser simply does not provide the
 * method. `window.isSecureContext` is `false` on that origin, and every
 * unguarded `crypto.randomUUID()` call throws
 *
 *     TypeError: crypto.randomUUID is not a function
 *
 * which the console's list views take straight into the ErrorBoundary.
 *
 * [mdn]: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
 *
 * ## Why a GLOBAL shim and not a shared `newId()` helper
 *
 * A helper only fixes call sites that agree to import it. The call sites that
 * crash do not: at the time of writing the console's own dependency graph
 * carries UNGUARDED `crypto.randomUUID()` calls in five packages — the census
 * is in the PR for #4563, and `packages/plugin-view`'s `parseTriplet`
 * (`config/view-config-utils.ts`) is on the list-view filter path that the
 * report reproduces. The reporter's stack additionally attributes the throwing
 * frame to a VENDORED chunk, i.e. code this repository does not author at all.
 * Guaranteeing the platform method is the only fix that reaches every caller,
 * in-repo and vendored alike, without editing any of them.
 *
 * So the call sites deliberately stay as they are. They are correct code: they
 * call a standard platform API. What was missing is the platform.
 *
 * ## Guarded on ABSENCE
 *
 * `installRandomUuidShim` never replaces a working implementation — a real
 * browser's native `randomUUID` (a CSPRNG) must always win over anything this
 * module can build. The shim is installed only when the method is missing,
 * which on a secure origin is never.
 *
 * ## Where the randomness comes from
 *
 * `crypto.getRandomValues` is NOT secure-context-gated, so it is present on the
 * exact origins where `randomUUID` is not. The fallback therefore keeps
 * cryptographic-quality randomness and only rebuilds the RFC 4122 formatting
 * around it. When `getRandomValues` is missing too we install NOTHING and
 * report `'unavailable'` rather than degrade to `Math.random()`: a
 * predictable-id generator that silently claims to be `crypto` is worse than
 * the honest absence. Surfacing that state to the user is a separate concern
 * (objectui#4570).
 */

/** `0x00`–`0xff` as zero-padded hex pairs — built once, indexed per byte. */
const HEX_OCTETS: readonly string[] = Array.from({ length: 256 }, (_unused, index) =>
  (index + 0x100).toString(16).slice(1)
);

/** What `installRandomUuidShim` did, for tests and for callers that log. */
export type RandomUuidShimOutcome =
  /** A working `randomUUID` was already there; it was left untouched. */
  | 'native'
  /** `randomUUID` was missing and the fallback is now in place. */
  | 'installed'
  /** No usable entropy source (or no target); nothing was changed. */
  | 'unavailable';

/** Fills the passed buffer with cryptographically strong random bytes. */
export type GetRandomValues = (buffer: Uint8Array) => unknown;

/**
 * Build one RFC 4122 §4.4 version-4 UUID from `getRandomValues`.
 *
 * 122 random bits, with the 6 fixed bits the format requires: the version
 * nibble (`4`) in the high half of byte 6, and the variant bits (`10`) in the
 * top two bits of byte 8. Rendered canonically as 8-4-4-4-12 lowercase hex.
 */
export function randomUuidV4(getRandomValues: GetRandomValues): string {
  const bytes = new Uint8Array(16);
  getRandomValues(bytes);

  // Version 4: high nibble of octet 6 := 0100.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  // Variant RFC 4122: top two bits of octet 8 := 10.
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = (index: number): string => HEX_OCTETS[bytes[index] ?? 0] ?? '00';

  return (
    hex(0) + hex(1) + hex(2) + hex(3) +
    '-' +
    hex(4) + hex(5) +
    '-' +
    hex(6) + hex(7) +
    '-' +
    hex(8) + hex(9) +
    '-' +
    hex(10) + hex(11) + hex(12) + hex(13) + hex(14) + hex(15)
  );
}

/**
 * Guarantee `randomUUID` on the given `Crypto`-shaped object.
 *
 * Absence-guarded: a callable `randomUUID` already present is reported as
 * `'native'` and left strictly alone (identity-preserving — the test pins it).
 *
 * The property is defined rather than assigned so the shim also works if a host
 * ever exposes `crypto` as a getter-only accessor whose instance still accepts
 * own properties; plain assignment is kept as the fallback path, and a target
 * that refuses both is reported honestly instead of being assumed to have
 * worked.
 *
 * Idempotent: a second call sees its own installation and returns `'native'`.
 *
 * @param target Defaults to `globalThis.crypto`.
 */
export function installRandomUuidShim(
  target: unknown = typeof globalThis === 'undefined' ? undefined : globalThis.crypto
): RandomUuidShimOutcome {
  if (target === null || (typeof target !== 'object' && typeof target !== 'function')) {
    return 'unavailable';
  }

  const cryptoLike = target as { randomUUID?: unknown; getRandomValues?: unknown };

  // Never override a working implementation.
  if (typeof cryptoLike.randomUUID === 'function') return 'native';

  const getRandomValues = cryptoLike.getRandomValues;
  if (typeof getRandomValues !== 'function') return 'unavailable';

  const bound: GetRandomValues = (buffer) =>
    (getRandomValues as GetRandomValues).call(cryptoLike, buffer);
  const fallback = (): string => randomUuidV4(bound);

  try {
    Object.defineProperty(cryptoLike, 'randomUUID', {
      value: fallback,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    try {
      cryptoLike.randomUUID = fallback;
    } catch {
      return 'unavailable';
    }
  }

  return typeof cryptoLike.randomUUID === 'function' ? 'installed' : 'unavailable';
}

/**
 * Module-evaluation side effect — this is what actually fixes the console.
 *
 * `apps/console/index.html` loads this module from a `script type="module"`
 * placed BEFORE the `/src/main.tsx` entry. Module scripts are deferred and run
 * in document order, so this executes before the application's first import and
 * therefore before every consumer in the console's graph.
 * `insecure-origin-crypto.placement.test.ts` pins that ordering.
 */
export const consoleRandomUuidShimOutcome: RandomUuidShimOutcome = installRandomUuidShim();
