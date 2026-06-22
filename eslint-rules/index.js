/**
 * ObjectUI local ESLint plugin — testability ratchet rules (ADR-0054 Phase 5).
 */
import noSyntheticEventTrigger from './no-synthetic-event-trigger.js';

export default {
  rules: {
    'no-synthetic-event-trigger': noSyntheticEventTrigger,
  },
};
