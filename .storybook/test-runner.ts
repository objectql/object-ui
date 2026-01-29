import type { TestRunnerConfig } from '@storybook/test-runner';

// Extend Window interface to include __test property
// Note: This variable is referenced in test-runner's page.evaluate calls
// but not directly in our codebase. It appears to be expected by the test environment.
declare global {
  interface Window {
    __test?: boolean;
  }
}

const config: TestRunnerConfig = {
  async preVisit(page) {
    // Inject __test global to prevent ReferenceError during test execution
    // This addresses the error: "page.evaluate: ReferenceError: __test is not defined"
    // that occurs when running Storybook test-runner smoke tests
    await page.evaluate(() => {
      window.__test = true;
    });
  },
};

export default config;
