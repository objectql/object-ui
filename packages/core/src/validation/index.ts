/**
 * @object-ui/core - Validation Module
 * 
 * Phase 3.5: Validation engine
 *
 * Object-level validation. The rule vocabulary is owned by
 * `@objectstack/spec/data` and derived in `@object-ui/types`; canonicity is
 * carried by that derivation and its parity gate, not by this comment.
 *
 * The object-level rule ENGINE (`validators/`) is @deprecated (#3110) — the
 * server is the single implementation of rule enforcement. Field/record SHAPE
 * validation (`schema-validator.js`, `validation-engine.js`) is unaffected: it
 * is client-side form validation, not a mirror of a server rule.
 */

export * from './required-presence.js';
export * from './server-owned-value.js';
export * from './validation-engine.js';
export * from './schema-validator.js';
export * from './validators/index.js';
