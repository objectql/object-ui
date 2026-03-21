/**
 * Load application-specific translations for a given language from the API.
 *
 * The @objectstack/spec REST API (`/api/v1/i18n/translations/:locale`) wraps
 * its response in the standard envelope: `{ data: { locale, translations } }`.
 * We extract `data.translations` when present, and fall back to the raw JSON
 * for mock / local-dev environments that may return flat translation objects.
 */
export async function loadLanguage(lang: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`/api/v1/i18n/translations/${lang}`);
    if (!res.ok) {
      console.warn(`[i18n] Failed to load translations for '${lang}': HTTP ${res.status}`);
      return {};
    }
    const json = await res.json();
    // Unwrap the spec REST API envelope when present
    if (json?.data?.translations && typeof json.data.translations === 'object') {
      return json.data.translations as Record<string, unknown>;
    }
    // Fallback: mock server / local dev returns flat translation objects
    return json;
  } catch (err) {
    console.warn(`[i18n] Failed to load translations for '${lang}':`, err);
    return {};
  }
}
