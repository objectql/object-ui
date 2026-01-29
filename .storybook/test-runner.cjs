/**
 * @type {import('@storybook/test-runner').TestRunnerConfig}
 */
module.exports = {
  async preVisit(page) {
    // Inject __test global to prevent ReferenceError during test execution
    // This addresses the error: "page.evaluate: ReferenceError: __test is not defined"
    // that occurs when running Storybook test-runner smoke tests
    await page.evaluate(() => {
      window.__test = true;
    });
  },
};
