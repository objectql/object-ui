
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'path';

export class ConsolePlugin {
    name = 'com.objectstack.server.console';
    version = '1.0.0';

    async init(ctx: any) {
        // No init logic needed
    }

    async start(ctx: any) {
        const httpServer = ctx.getService('http-server');
        if (!httpServer) {
            ctx.logger.warn('HTTP Server not found, accessing console skipped');
            return;
        }
        
        // We know it's HonoHttpServer from @objectstack/plugin-hono-server
        // It has getRawApp()
        if (typeof httpServer.getRawApp === 'function') {
            const app = httpServer.getRawApp();
            
            ctx.logger.info('Registering Console UI at /console');
            
            // Path relative to where server.ts is run (examples/crm)
            // apps is ../../apps
            const consoleDist = path.resolve(process.cwd(), '../../apps/console/dist');
            
            // Serve static resources (JS, CSS, etc)
            // Hono serveStatic will look for the file in root
            // If we request /console/assets/foo.js, we want to serve /dist/assets/foo.js
            app.use('/console/*', serveStatic({ 
                root: consoleDist,
                rewriteRequestPath: (path: string) => path.replace(/^\/console/, '')
            }));

            // Fallback for SPA routing: any non-file request under /console returns index.html
            app.get('/console/*', serveStatic({ 
                root: consoleDist,
                rewriteRequestPath: () => '/index.html'
            }));
            
            ctx.logger.info(`✅ Console available at http://localhost:3000/console`);
        } else {
             ctx.logger.warn('HTTP Server does not support getRawApp()');
        }
    }
}
