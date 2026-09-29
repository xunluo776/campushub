import { NextFunction, Request, Response } from 'express';

import { sendError } from '../middleware/errorHandler';
import { listResources } from '../services/resource.service';
import { Resource } from '../types/reservation';

// GET /api/v1/resources
// The contract allows an optional type filter, and it has to be a non-empty string when
// the client sends it.
export async function getResources(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawType = req.query.type;
    let type: string | undefined = undefined;

    if (rawType !== undefined) {
      if (typeof rawType !== 'string' || rawType.trim() === '') {
        sendError(res, 400, 'VALIDATION_ERROR', 'type must be a non-empty string when provided.');
        return;
      }
      type = rawType;
    }

    const resources: Resource[] = await listResources(type);
    res.status(200).json(resources);
  } catch (error) {
    next(error);
  }
}
