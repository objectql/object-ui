
import { ObjectKernel } from '@objectstack/core';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { AuthPlugin } from '@objectstack/plugin-auth';
import config from './objectstack.config';
import { pino } from 'pino';
import { ConsolePlugin } from '../../apps/console/plugin';

async function startServer() {
  const logger = pino({
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  });

  logger.info('Starting CRM Server...');

  try {
    // Initialize Kernel
    const kernel = new ObjectKernel({
      logger,
      skipSystemValidation: true
    });

    // 1. Core Engine (ObjectQL)
    const qlPlugin = new ObjectQLPlugin();
    await kernel.use(qlPlugin);

    // 2. Data Driver (Memory)
    const memoryDriver = new InMemoryDriver();
    const driverPlugin = new DriverPlugin(memoryDriver);
    await kernel.use(driverPlugin);

    // 3. Application (crm_app from config)
    // The config export from defineStack is treated as an App Bundle or Manifest
    const appPlugin = new AppPlugin(config);
    await kernel.use(appPlugin);

    // 4. Authentication (via @objectstack/plugin-auth)
    // NOTE: In production, always set AUTH_SECRET env var. The fallback is for local development only.
    const authPlugin = new AuthPlugin({
      secret: process.env.AUTH_SECRET || 'objectui-dev-secret',
      baseUrl: 'http://localhost:3000',
    });
    await kernel.use(authPlugin);

    // 5. HTTP Server
    const serverPlugin = new HonoServerPlugin({ port: 3000 });
    await kernel.use(serverPlugin);

    // 6. Console Plugin
    const consolePlugin = new ConsolePlugin();
    await kernel.use(consolePlugin);

    // Bootstrap
    await kernel.bootstrap();
    
    // Seed Data
    try {
      // Data is now seeded via manifest in objectstack.config.ts loaded by the app plugin
      // or handled by MSW in browser mode.
      // We can keep specific server-side seeding here if needed, but for now we rely on the manifest.
      logger.info('🌱 checking if data needs seeding...');

    } catch (e) {
      logger.error(e, 'Failed to seed data');
    }

    logger.info('✅ CRM Server is running on http://localhost:3000');
    logger.info('   GraphQL: http://localhost:3000/graphql');

  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
