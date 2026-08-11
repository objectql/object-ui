/**
 * Load the list of locales this app actually ships (objectui#4039).
 *
 * The @objectstack/spec REST API (`GET /api/v1/i18n/locales`) answers with the
 * standard envelope wrapping locale *descriptors*, not bare codes:
 * `{ data: { locales: [{ code, label, isDefault }] } }` — the shape
 * `GetLocalesResponseSchema` declares and both serving surfaces (the runtime
 * dispatcher's `/i18n` domain and `service-i18n`'s own route) emit through the
 * shared `toLocaleDescriptors`. Only `code` is read here: that helper sets
 * `label` to the code itself, so the descriptor's label is not a display name
 * and the switcher names locales for itself.
 *
 * Sibling of {@link ./loadLanguage.ts} and deliberately the same shape — same
 * `VITE_SERVER_URL` base, same envelope-first / flat-fallback parse for mock
 * and local-dev servers, same degrade-quietly contract. A language menu is
 * never worth taking the console down for: every failure returns `[]`, which
 * the provider reads as "I don't know" and answers with the built-in packs.
 */

export async function loadLocales(): Promise<string[]> {
  try {
    const serverUrl = import.meta.env.VITE_SERVER_URL || '';
    const res = await fetch(`${serverUrl}/api/v1/i18n/locales`);
    if (!res.ok) {
      console.warn(`[i18n] Failed to load the app locale list: HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    // Unwrap the spec REST API envelope when present; mock / local-dev servers
    // may answer with the bare `{ locales: [...] }` body or a plain array.
    const raw = json?.data?.locales ?? json?.locales ?? json;
    if (!Array.isArray(raw)) {
      console.warn('[i18n] Unexpected /i18n/locales payload; ignoring.');
      return [];
    }
    const codes: string[] = [];
    for (const entry of raw) {
      // Descriptors are the contract; a bare string is tolerated only because
      // `getLocales()` hands back `string[]` and older mocks pass it straight
      // through — the very drift the shared descriptor mapping exists to stop.
      const code = typeof entry === 'string' ? entry : entry?.code;
      if (typeof code === 'string' && code.length > 0 && !codes.includes(code)) codes.push(code);
    }
    return codes;
  } catch (err) {
    console.warn('[i18n] Failed to load the app locale list:', err);
    return [];
  }
}
