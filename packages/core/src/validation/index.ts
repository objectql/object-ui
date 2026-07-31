/**
 * @object-ui/core - Validation Module
 * 
 * Phase 3.5: Validation engine
 * Object-level validation. The rule vocabulary is owned by
 * `@objectstack/spec/data` and derived in `@object-ui/types`; canonicity is
 * carried by that derivation and its parity gate, not by this comment.
 */

export * from './validation-engine.js';
export * from './schema-validator.js';
export * from './validators/index.js';
