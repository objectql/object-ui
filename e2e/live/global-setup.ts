import { request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Live-e2e auth: sign in against the real ObjectStack backend (better-auth) and
 * persist a Playwright storageState the tests reuse. The console adapter sends a
 * Bearer token read from localStorage `auth-session-token`, so we inject that on
 * the APP origin; we also keep the better-auth session cookie for the API origin.
 */
const APP = process.env.LIVE_APP_URL || 'http://localhost:5180';
const API = process.env.LIVE_API_URL || 'http://localhost:3000';
const EMAIL = process.env.LIVE_EMAIL || 'admin@objectos.ai';
const PASSWORD = process.env.LIVE_PASSWORD || 'admin123';
const STATE_PATH = 'e2e/live/.auth/state.json';

export default async function globalSetup() {
  const ctx = await request.newContext();
  let res;
  try {
    res = await ctx.post(`${API}/api/v1/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    throw new Error(
      `Live backend unreachable at ${API} (${e?.message}). Start it (e.g. \`objectstack serve --dev\` in examples/app-showcase) before running live e2e.`,
    );
  }
  if (!res.ok()) {
    throw new Error(`Live sign-in failed (${res.status()}) at ${API}: ${await res.text()}`);
  }
  const token = res.headers()['set-auth-token'];
  if (!token) throw new Error('Sign-in succeeded but no `set-auth-token` header was returned.');

  const apiState = await ctx.storageState(); // carries the better-auth session cookie
  await ctx.dispose();

  const state = {
    cookies: apiState.cookies,
    origins: [{ origin: APP, localStorage: [{ name: 'auth-session-token', value: token }] }],
  };
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[live-e2e] authenticated as ${EMAIL}; storageState written to ${STATE_PATH}`);
}
