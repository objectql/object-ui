/**
 * objectui#8537 — deliberate network-escape fixture (b of two).
 *
 * This file is one half of the LIVE CONTROL for
 * `network-escape-worker-coverage-8537.test.ts`: that pin spawns a real vitest
 * on the `unit` project with both fixtures in ONE worker, and every file must go
 * red under the guard, naming itself. In the ordinary suite the escape below is
 * skipped — the fixture is inert unless the pin's child marker is set, so it
 * cannot red a normal run.
 *
 * The two fixtures are byte-identical apart from their tag, so a difference in
 * their outcome can only come from their POSITION in the worker.
 */
import { it } from 'vitest';

const IS_CHILD = process.env.OBJECTUI_ESCAPE_PIN_CHILD === '1';
const MARK = '__objectui_escape_pin_8537__';
const scope = globalThis as unknown as Record<string, unknown>;

it.skipIf(!IS_CHILD)('fixture b reaches a real socket, on purpose', async () => {
  // Leave a mark on the shared global object and report the other fixture's,
  // so the pin can see that both files ran in ONE worker and which came second.
  const seenOther = scope[MARK] === 'a' ? 'yes' : 'no';
  scope[MARK] = 'b';
  console.log(`ESCAPE_PIN_8537 file=b saw_other=${seenOther}`);
  // The `unit` project is a node environment: no `location`, so only an
  // ABSOLUTE URL at the escape origin can be an escape. Outcome irrelevant.
  await fetch('http://localhost:3000/__objectui_escape_pin_8537__/b').catch(() => undefined);
});
