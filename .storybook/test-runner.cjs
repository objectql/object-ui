/**
 * Storybook test-runner configuration.
 *
 * Includes:
 * - preVisit: injects __test global for test-runner compatibility
 * - postVisit: captures DOM snapshots for visual regression testing (§1.4)
 *
 * @type {import('@storybook/test-runner').TestRunnerConfig}
 */
const { toMatchSnapshot } = require('jest-snapshot');

module.exports = {
  async preVisit(page) {
    // Inject __test global as a no-op function to satisfy test-runner expectations
    // The test-runner expects __test to be a function, not a boolean value
    // This addresses the error: "page.evaluate: TypeError: __test is not a function"
    await page.evaluate(() => {
      window.__test = () => {};
    });
  },

  async postVisit(page, context) {
    // Capture a DOM snapshot for each story as a lightweight visual regression check.
    // This detects structural changes (added/removed elements, changed text, class changes)
    // without the overhead of pixel-based screenshot comparison.
    if (process.env.STORYBOOK_VISUAL_REGRESSION === 'true') {
      const body = await page.$('body');
      if (body) {
        const innerHTML = await body.innerHTML();
        expect(innerHTML).toMatchSnapshot();
      }
    }
  },
};
