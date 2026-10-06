import express, { Application } from 'express';

import { connectDatabase } from './config/database';
import { config } from './config/env';
import apiV1Router from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();

app.use(express.json());

app.use('/api/v1', apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);

// Connects to MongoDB using MONGO_URI from src/config. A failed connection is logged
// instead of thrown so the app still boots and /health can report the database state.
export async function initDatabase(): Promise<boolean> {
  try {
    await connectDatabase();
    console.log(`Connected to MongoDB (${config.nodeEnv})`);
    return true;
  } catch (error) {
    let message = 'unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    console.error(`MongoDB connection failed: ${message}`);
    return false;
  }
}

export default app;
