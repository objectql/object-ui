/**
 * The runtime half of the objectui#6950 pin: the input the framework injects
 * still SERIALISES `binding: 'object'` into the manifest, `validateTree` still
 * RECORDS the binding site, and the serializer's boundary refuses the retired
 * `'field'` arm. The type-level half — `InjectedComponentInput`, the authoring
 * face's refusal, and the cast-free splice — is
 * `packages/types/src/__tests__/injected-component-input-6950.test.ts`; it
 * lives there because `@object-ui/types` may import neither this package nor
 * `@object-ui/core`, while this package lists core as a devDependency
 * (`render.test.tsx` already registers through it).
 *
 * ## Why the positive limbs are the half that matters
 *
 * "A registration that authors `binding` fails type-check" is satisfied by
 * deleting the marker. What makes the ruling a shape and not a deletion is
 * that the FRAMEWORK's write keeps working end to end: `Registry.register`
 * splices `ELEMENT_DATA_SOURCE_INPUT` for a renderer marked by
 * `elementDataSourceBlock()`, `manifestFromConfigs` forwards its `binding`,
 * and `validateTree` turns the prop into a binding site the server resolves.
 * The chain is driven through the real registry here — not a hand-built
 * config — so a splice that stopped carrying the marker would be seen where
 * it happens, not inferred from a fixture that never went through it.
 *
 * ## `'field'` (ADR-0049 enforce-or-remove)
 *
 * `RegistryConfigLike.inputs[].binding` was `'object' | 'field'`; every
 * `binding:` literal in `packages/`, `apps/` and `examples/` is `'object'`
 * (7 of 7 at the retiring merge-base) and nothing resolves a field binding.
 * The arm is retired at the boundary a registry config feeds the serializer
 * through; `ManifestInput.binding` (`types.ts`) is the manifest READER's
 * vocabulary and is deliberately not narrowed here. The `@ts-expect-error`
 * directives below are real enforcement — this package type-checks its tests
 * through `tsconfig.test.json`.
 */

import { describe, expect, it } from 'vitest';
import {
  ELEMENT_DATA_SOURCE_INPUT,
  ELEMENT_DATA_SOURCE_KEY,
  Registry,
  elementDataSourceBlock,
  type ComponentMeta,
} from '@object-ui/core';
import { manifestFromConfigs, validateTree, type RegistryConfigLike } from '../index.js';

const NS = 'pin6950';
const TYPE = `${NS}:probe`;

/** A registry holding ONE gate-wrapping block, registered the way a plugin does it. */
function registryWithProbe(): Registry {
  const registry = new Registry();
  const Probe = elementDataSourceBlock(() => null);
  registry.register('probe', Probe, {
    namespace: NS,
    tier: 'public',
    skipFallback: true,
    inputs: [{ name: 'object', type: 'string', required: true }],
  });
  return registry;
}

describe("the injected input still serialises `binding: 'object'` into the manifest (objectui#6950)", () => {
  it('reaches the manifest through the real registry, and survives JSON', () => {
    const manifest = manifestFromConfigs(registryWithProbe().getAllConfigs());
    const entry = manifest.components[TYPE];
    expect(entry).toBeDefined();

    const injected = entry.inputs.find((i) => i.name === ELEMENT_DATA_SOURCE_KEY);
    expect(injected).toMatchObject({ name: ELEMENT_DATA_SOURCE_KEY, type: 'object', binding: 'object' });

    // The artifact is JSON on disk — the marker must be a serialisable value,
    // not a type-only fact.
    const roundTripped = JSON.parse(JSON.stringify(manifest)) as typeof manifest;
    expect(
      roundTripped.components[TYPE].inputs.find((i) => i.name === ELEMENT_DATA_SOURCE_KEY)?.binding,
    ).toBe('object');
  });

  it('the marker comes from the injection, not from the authored input beside it', () => {
    const manifest = manifestFromConfigs(registryWithProbe().getAllConfigs());
    const authored = manifest.components[TYPE].inputs.find((i) => i.name === 'object');
    expect(authored).toBeDefined();
    expect(authored?.binding).toBeUndefined();
    // and the constant the splice copies is what carries it
    expect(ELEMENT_DATA_SOURCE_INPUT.binding).toBe('object');
  });
});

describe('`validateTree` still records the injected input as a binding site (objectui#6950)', () => {
  it('reports the `dataSource` prop as an object binding, with no `unknown-prop` beside it', () => {
    const manifest = manifestFromConfigs(registryWithProbe().getAllConfigs());
    const value = { object: 'account', view: 'all_accounts' };
    const result = validateTree(
      { type: TYPE, object: 'account', [ELEMENT_DATA_SOURCE_KEY]: value },
      manifest,
    );

    expect(result.bindings).toContainEqual({
      tag: TYPE,
      input: ELEMENT_DATA_SOURCE_KEY,
      kind: 'object',
      value,
    });
    // objectui#6678's defect was exactly this diagnostic on the one key that works.
    expect(result.diagnostics.filter((d) => d.code === 'unknown-prop')).toEqual([]);
    expect(result.requires).toEqual([NS]);
  });
});

describe("the serializer's boundary accepts 'object' and refuses the retired 'field' arm (ADR-0049, objectui#6950)", () => {
  it("forwards 'object' unchanged", () => {
    const config: RegistryConfigLike = {
      type: 'object-table',
      namespace: 'plugin-grid',
      inputs: [{ name: 'object', type: 'string', required: true, binding: 'object' }],
    };
    expect(manifestFromConfigs([config]).components['object-table'].inputs[0].binding).toBe('object');
  });

  it("is a type error on 'field'", () => {
    const config: RegistryConfigLike = {
      type: 'object-table',
      inputs: [
        {
          name: 'field',
          type: 'string',
          // @ts-expect-error `'field'` had zero writers and is retired (ADR-0049, objectui#6950)
          binding: 'field',
        },
      ],
    };
    expect(config.inputs).toHaveLength(1);
  });
});

describe('a registration that authors `binding` itself fails type-check at the registration door (objectui#6950)', () => {
  it("is an excess-property error on `register()`'s `meta.inputs`", () => {
    const registry = new Registry();
    const meta: ComponentMeta = {
      namespace: NS,
      skipFallback: true,
      inputs: [
        {
          name: 'object',
          type: 'string',
          // @ts-expect-error `binding` is not a `ComponentInput` member — the framework injects it (objectui#6950)
          binding: 'object',
        },
      ],
    };
    registry.register('authored', () => null, meta);
    expect(registry.getAllConfigs()).toHaveLength(1);
  });
});
