/**
 * Vercel Serverless Function Wrapper
 *
 * This file is committed to the repo and detected by Vercel pre-build.
 * It delegates to the bundled handler (_handler.js) generated during the build.
 *
 * The catch-all route [[...route]] captures all API requests and forwards them
 * to the ObjectStack kernel via Hono.
 */

export { default } from './_handler.js';
