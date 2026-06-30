/**
 * ObjectUI local ESLint plugin — testability + type-discipline ratchet rules.
 */
import noSyntheticEventTrigger from './no-synthetic-event-trigger.js';
import noInlineSpecConfig from './no-inline-spec-config.js';

export default {
  rules: {
    'no-synthetic-event-trigger': noSyntheticEventTrigger,
    'no-inline-spec-config': noInlineSpecConfig,
  },
};
