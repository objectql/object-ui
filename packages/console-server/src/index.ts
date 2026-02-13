/**
 * @object-ui/console-server
 *
 * ObjectStack Console Server Plugin.
 * Serves the ObjectUI Console as a Hono middleware in ObjectStack servers.
 *
 * @example
 * ```ts
 * import { ConsolePlugin } from '@object-ui/console-server';
 *
 * const consolePlugin = new ConsolePlugin();
 * await kernel.use(consolePlugin);
 * ```
 */

export { ConsolePlugin } from './console-plugin';
export type { ConsolePluginOptions } from './console-plugin';
