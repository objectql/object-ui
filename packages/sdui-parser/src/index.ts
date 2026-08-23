/**
 * @object-ui/sdui-parser — constrained JSX-source → SDUI SchemaNode tree (ADR-0080)
 *
 * Isomorphic, zero React. Run server-side as the authoritative save-time gate;
 * may also run client-side for live edit preview (re-validated on the server —
 * never the trust boundary). It PARSES; it never executes.
 */

export * from './types.js';
export { parseJsx, interpretBrace } from './parse.js';
export { HTML_TIER_NODE, isHtmlTierNode, markHtmlTierNode } from './provenance.js';
export { validateTree } from './validate.js';
export {
  checkDashboardWidgetOptions,
  CONSUMED_WIDGET_OPTION_KEYS,
  DASHBOARD_WIDGET_HOST_TYPES,
  UNCONSUMED_WIDGET_OPTION,
} from './dashboard-widget-options.js';
export { generateDts, propsName, generateBlockList } from './codegen.js';
export type { CodegenOptions } from './codegen.js';
export { inputTypeArms, canonicalizeInputType, MANIFEST_INPUT_TYPES } from './input-type.js';

import { parseJsx } from './parse.js';
import { validateTree } from './validate.js';
import { canonicalizeInputType } from './input-type.js';
import type { Diagnostic, Manifest, SchemaElement, ManifestValidationResult } from './types.js';

export interface CompileResult {
  tree: SchemaElement | null;
  diagnostics: Diagnostic[];
  requires: string[];
  bindings: ManifestValidationResult['bindings'];
  /** true when there are no error-severity diagnostics — the save gate's pass/fail */
  ok: boolean;
}

/**
 * The authoritative pipeline: parse (with the manifest's tags as the whitelist)
 * → validate against the manifest → derive `requires` + binding sites.
 */
export function compile(source: string, manifest: Manifest): CompileResult {
  const allowedTags = new Set(Object.keys(manifest.components));
  const parsed = parseJsx(source, { allowedTags });
  const validated = validateTree(parsed.tree, manifest);
  const diagnostics = [...parsed.diagnostics, ...validated.diagnostics];
  return {
    tree: parsed.tree,
    diagnostics,
    requires: validated.requires,
    bindings: validated.bindings,
    ok: !diagnostics.some((d) => d.severity === 'error'),
  };
}

/* ------------------------------------------------------------------ *
 * Registry → manifest adapter. Structural input (no @object-ui/core
 * dependency) so the package stays pure and hoistable to framework.
 * Feed it `ComponentRegistry.getAllConfigs()` (optionally filtered to
 * the `tier:'public'` set).
 * ------------------------------------------------------------------ */

export interface RegistryConfigLike {
  type: string;
  namespace?: string;
  isContainer?: boolean;
  /** ADR-0080 contract tier — only 'public' configs form the AI/contract surface. */
  tier?: 'public' | 'internal';
  label?: string;
  category?: string;
  inputs?: Array<{
    name: string;
    /**
     * One coarse kind, or the arms of a union (objectui#3832). Typed loosely
     * (`string`) on purpose — this interface is the STRUCTURAL boundary that
     * keeps this package free of a dependency on the registry, so an
     * off-vocabulary value has to be representable here and is normalized by
     * `canonicalizeInputType` on the way in.
     */
    type: string | string[];
    required?: boolean;
    enum?: Array<string | { value: unknown; label?: string }>;
    binding?: 'object' | 'field';
    description?: string;
  }>;
  /**
   * True when the registry entry is a pending lazy stub — registered, but its
   * plugin module has not been imported, so it carries metadata and no
   * `inputs`. See {@link assertFullyLoaded}.
   */
  lazy?: boolean;
}

/**
 * Build-time guard for the manifest generators.
 *
 * A manifest is the contract's frozen form: the parser's tag whitelist and the
 * save gate's prop validator both read it. So it has to be generated from
 * FULLY LOADED registrations. A `lazy: true` entry means the generator never
 * imported that plugin, and the block would be written out with empty
 * `inputs` — indistinguishable from a block that legitimately takes no props,
 * which turns every prop an author writes on it into an `unknown-prop`
 * diagnostic. Wrong quietly, in the artifact everything downstream trusts.
 *
 * The generators keep their own eager import list, so this is what catches it
 * drifting behind the app's registration list (objectui#2953 was the same
 * class of bug one layer down).
 */
export function assertFullyLoaded(configs: RegistryConfigLike[]): void {
  const stubs = configs.filter((c) => c.lazy).map((c) => c.type).sort();
  if (stubs.length === 0) return;
  throw new Error(
    `Manifest generation saw ${stubs.length} not-yet-loaded lazy block(s): ${stubs.join(', ')}.\n` +
      `A manifest must describe loaded registrations — these would be written out with no \`inputs\`, ` +
      `so every prop an author passes them would be reported as unknown.\n` +
      `Add an eager \`import\` of each block's plugin to the generator entry.`,
  );
}

/* The arm vocabulary and the two projections over it now live in
 * `input-type.ts` — `manifestFromConfigs` below, `validateTree` and the codegen
 * all read `ManifestInput.type` and must agree on how, since it holds one arm
 * or an array of them (objectui#3832). */

/**
 * Project registry configs into the SDUI manifest.
 *
 * ⚠️ Every field here is copied from what the registration **declared**. In
 * particular `inputs` is `config.inputs` verbatim — this function does not, and
 * cannot, observe whether the renderer behind the block reads any of them.
 *
 * Worth stating because of what consumes the output. The framework's
 * `check:react-blocks-declaration-parity` diffs this against the spec's zod
 * schemas, and while that check was named `check:react-conformance` it was read
 * — by its own file header — as confirming the components "ACTUALLY implement"
 * the spec's props. It never could: both sides of that diff are declarations,
 * and this is the side this file produces. Four blocks published an `objectName`
 * no renderer read and sailed through it green (objectstack#4413; corrected in
 * objectstack#4472). Evidence about the render path has to come from the render
 * path — see `apps/console/src/__tests__/public-block-binding-reach.test.tsx`.
 */
export function manifestFromConfigs(
  configs: RegistryConfigLike[],
  opts: { only?: Set<string>; publicOnly?: boolean } = {},
): Manifest {
  const components: Manifest['components'] = {};
  for (const c of configs) {
    if (opts.only && !opts.only.has(c.type)) continue;
    if (opts.publicOnly && c.tier !== 'public') continue;
    components[c.type] = {
      type: c.type,
      namespace: c.namespace,
      isContainer: c.isContainer,
      inputs: (c.inputs ?? []).map((i) => ({
        name: i.name,
        type: canonicalizeInputType(i.type),
        required: i.required,
        enum: i.enum,
        binding: i.binding,
        description: i.description,
      })),
    };
  }
  return { components };
}
