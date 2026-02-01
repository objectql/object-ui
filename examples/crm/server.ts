
import { ObjectKernel } from '@objectstack/core';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { InMemoryDriver } from '@objectstack/driver-memory';
import config from './objectstack.config';
import { pino } from 'pino';
import { ConsolePlugin } from './console-plugin';

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
    });

    // 1. Core Engine (ObjectQL)
    const qlPlugin = new ObjectQLPlugin();
    kernel.use(qlPlugin);

    // 2. Data Driver (Memory)
    const memoryDriver = new InMemoryDriver();
    const driverPlugin = new DriverPlugin(memoryDriver);
    kernel.use(driverPlugin);

    // 3. Application (crm_app from config)
    // The config export from defineStack is treated as an App Bundle or Manifest
    const appPlugin = new AppPlugin(config);
    kernel.use(appPlugin);

    // 4. HTTP Server
    const serverPlugin = new HonoServerPlugin({ port: 3000 });
    kernel.use(serverPlugin);

    // 5. Console Plugin
    const consolePlugin = new ConsolePlugin();
    kernel.use(consolePlugin);

    // Bootstrap
    await kernel.bootstrap();
    
    logger.info('✅ CRM Server is running on http://localhost:3000');
    logger.info('   GraphQL: http://localhost:3000/graphql');

  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
