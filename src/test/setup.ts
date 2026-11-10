import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// src/config/env.ts throws on import when these are missing, and a fresh clone has no
// .env. Set them before any test file imports the app. MONGO_URI is never actually used
// in tests, mongoose connects to the in-memory server below instead.
process.env.NODE_ENV = 'test';
if (process.env.PORT === undefined) {
  process.env.PORT = '0';
}
if (process.env.MONGO_URI === undefined) {
  process.env.MONGO_URI = 'mongodb://127.0.0.1:1/not-used-in-tests';
}

let mongoServer: MongoMemoryServer;

// One throwaway MongoDB per test file, so files can't see each other's data.
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  // The MongoDB driver (7.6) loads the os module with a dynamic import(), which Jest's
  // CommonJS sandbox doesn't support, so the connection handshake goes out without its
  // driver metadata and the server rejects it. Handing it os directly avoids that.
  await mongoose.connect(mongoServer.getUri(), { runtimeAdapters: { os } });
});

// Every test starts from empty collections.
afterEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
