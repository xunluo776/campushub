import app from './app';
import { config } from './config/env';
import { connectDatabase } from './config/database';

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    console.log('Connected to MongoDB');
  } catch (error) {
    // No local Mongo running is fine for now, the health endpoint still needs to answer.
    let message = 'unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    console.error(`MongoDB connection failed: ${message}`);
  }

  app.listen(config.port, () => {
    console.log(`CampusHub backend listening on port ${config.port} (${config.nodeEnv})`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
