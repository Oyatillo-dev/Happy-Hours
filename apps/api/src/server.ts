import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { startScheduler } from './jobs/scheduler.js';

const app = await buildApp();
const stopScheduler = config.JOBS_ENABLED ? startScheduler(app.log) : () => {};

const shutdown = async () => {
  stopScheduler();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
