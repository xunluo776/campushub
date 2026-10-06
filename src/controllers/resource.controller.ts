import { NextFunction, Request, Response } from 'express';

import { sendError } from '../middleware/errorHandler';
import { ValidationError } from '../services/errors';
import { listResources } from '../services/resource.service';
import { Resource } from '../types/reservation';

// GET /api/v1/resources
export async function getResources(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resources: Resource[] = await listResources(req.query.type);
    res.status(200).json(resources);
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    next(error);
  }
}
