import mongoose from 'mongoose';

import { config } from './env';

// Without this, queries made while Mongo is down sit in a buffer for 10 seconds before
// failing. Turning it off makes them fail right away so the API returns a 500 quickly.
mongoose.set('bufferCommands', false);

// Connects to MongoDB. The server can still boot without it, we just log the failure
// so the health endpoint stays reachable during local development.
export async function connectDatabase(): Promise<void> {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
}

export function getDatabaseState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const current = states[mongoose.connection.readyState];
  if (current === undefined) {
    return 'unknown';
  }
  return current;
}
