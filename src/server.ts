import app, { initDatabase } from './app';
import { config } from './config/env';

async function startServer(): Promise<void> {
  await initDatabase();

  app.listen(config.port, () => {
    console.log(`CampusHub backend listening on port ${config.port} (${config.nodeEnv})`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
