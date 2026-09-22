import { config } from '../config/env';
import { getDatabaseState } from '../config/database';
import { HealthStatus } from '../types/health.types';

// Business logic only. No req/res and no status codes in here.
export async function getHealthStatus(): Promise<HealthStatus> {
  const health: HealthStatus = {
    status: 'ok',
    service: 'campushub-backend',
    environment: config.nodeEnv,
    database: getDatabaseState(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  return health;
}
