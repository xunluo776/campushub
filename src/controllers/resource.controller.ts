import { Request, Response } from 'express';

import { Resource } from '../../shared/types';
import { listResources } from '../services/resource.service';

// GET /api/v1/resources. Errors go to middleware/errorHandler.ts (see the reservation
// controller for why there's no try/catch).
export async function getResources(req: Request, res: Response): Promise<void> {
  const resources: Resource[] = await listResources(req.query.type, req.query.isAvailable);
  res.status(200).json(resources);
}
