import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  // Hook that is executed once before all tests
  async setup() {
    // Global setup if needed
  },
  
  // Hook that is executed before the test runner starts running tests
  async preVisit(page) {
    // Set up any global variables or configurations needed for tests
    await page.evaluate(() => {
      // Define __test global if it's being referenced by test infrastructure
      (window as any).__test = true;
    });
  },
  
  // Hook that is executed after the test runner finishes running tests  
  async postVisit(page) {
    // Clean up if needed
  },
};

export default config;
