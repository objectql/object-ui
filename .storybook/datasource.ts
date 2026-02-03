/**
 * DataSource Helper for Storybook
 * 
 * Creates an ObjectStack data source adapter that connects to the 
 * MSW-backed API endpoints running in Storybook.
 */

import { ObjectStackAdapter } from '@object-ui/data-objectstack';

/**
 * Create a DataSource for use in Storybook stories.
 * This DataSource connects to the MSW mock server at /api/v1.
 */
export function createStorybookDataSource() {
  return new ObjectStackAdapter({
    baseUrl: '/',
    // No token needed for MSW
  });
}
