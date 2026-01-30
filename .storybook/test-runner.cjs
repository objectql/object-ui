/**
 * @type {import('@storybook/test-runner').TestRunnerConfig}
 */
module.exports = {
  async preVisit(page) {
    // Inject __test global as a no-op function to satisfy test-runner expectations
    // The test-runner expects __test to be a function, not a boolean value
    // This addresses the error: "page.evaluate: TypeError: __test is not a function"
    await page.evaluate(() => {
      window.__test = () => {};
    });
  },
};
