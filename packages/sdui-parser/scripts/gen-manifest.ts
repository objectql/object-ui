/**
 * Build-time codegen (ADR-0080 M4): serialize the registry's PUBLIC tier into
 *   - sdui.manifest.json   (the contract — save-gate + parser whitelist)
 *   - sdui-intrinsics.d.ts (the JSX type surface for authoring)
 *   - sdui-blocks.md       (the human 清单)
 *
 * PREREQUISITE: all plugins must be registered before this runs — import the
 * app's plugin barrel first so getPublicConfigs() sees the full set, e.g.:
 *   import '@object-ui/console/register-all';   // side-effectful registration
 * Then run with tsx. Mirrors the build-skill-docs pattern.
 */
import { writeFileSync } from 'node:fs';
import { ComponentRegistry } from '@object-ui/core';
import { generateBlockList, generateDts, manifestFromConfigs, type RegistryConfigLike } from '../src/index.js';

export function buildArtifacts(outDir: string): void {
  const configs = ComponentRegistry.getPublicConfigs() as unknown as RegistryConfigLike[];
  const manifest = manifestFromConfigs(configs);
  writeFileSync(`${outDir}/sdui.manifest.json`, JSON.stringify(manifest, null, 2));
  writeFileSync(`${outDir}/sdui-intrinsics.d.ts`, generateDts(manifest));
  writeFileSync(`${outDir}/sdui-blocks.md`, generateBlockList(manifest));
  console.log(`wrote ${Object.keys(manifest.components).length} public blocks -> ${outDir}`);
}
