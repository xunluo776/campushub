import { Request, Response } from 'express';

import { getHealthStatus } from '../services/health.service';
import { HealthStatus } from '../types/health.types';

// Request/response and status code handling only. No database access here.
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health: HealthStatus = await getHealthStatus();
  res.status(200).json(health);
}
