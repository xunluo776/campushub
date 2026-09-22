import mongoose from 'mongoose';

import { config } from './env';

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
