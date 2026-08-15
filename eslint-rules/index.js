/**
 * ObjectUI local ESLint plugin — testability + type-discipline ratchet rules.
 */
import noSyntheticEventTrigger from './no-synthetic-event-trigger.js';
import noInlineSpecConfig from './no-inline-spec-config.js';
import noTryCatchAroundHook from './no-try-catch-around-hook.js';
import noDynamicImportInTestHook from './no-dynamic-import-in-test-hook.js';
import noQueryParamsUnderOptions from './no-query-params-under-options.js';
import buttonHasType from './button-has-type.js';

export default {
  rules: {
    'no-synthetic-event-trigger': noSyntheticEventTrigger,
    'no-inline-spec-config': noInlineSpecConfig,
    'no-try-catch-around-hook': noTryCatchAroundHook,
    'no-dynamic-import-in-test-hook': noDynamicImportInTestHook,
    'no-query-params-under-options': noQueryParamsUnderOptions,
    'button-has-type': buttonHasType,
  },
};
