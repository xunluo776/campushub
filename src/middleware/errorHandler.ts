import { NextFunction, Request, Response } from 'express';

import { ErrorResponse } from '../../shared/types';
import {
  DomainError,
  DoubleBookingError,
  NotFoundError,
  StatusTransitionError,
  ValidationError,
} from '../services/errors';

// Every failure the API returns uses the ErrorResponse shape from docs/openapi.yaml.
function sendError(res: Response, status: number, code: string, message: string): void {
  const payload: ErrorResponse = { code, message };
  res.status(status).json(payload);
}

// The one place that knows which service error means which HTTP status.
function statusForDomainError(error: DomainError): number {
  if (error instanceof ValidationError) {
    return 400;
  }
  if (error instanceof NotFoundError) {
    return 404;
  }
  if (error instanceof DoubleBookingError || error instanceof StatusTransitionError) {
    return 409;
  }
  // A DomainError subclass nobody mapped yet. Treat it as a server bug.
  return 500;
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.originalUrl}`);
}

// Central error handler, registered last in app.ts. Controllers don't catch anything:
// Express 5 forwards a rejected async handler straight to here.
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof DomainError) {
    sendError(res, statusForDomainError(error), error.code, error.message);
    return;
  }

  // express.json() throws this when the body isn't valid JSON. That's the client's
  // fault, so it's a 400 like any other bad body, not a 500.
  if (error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed') {
    sendError(res, 400, 'VALIDATION_ERROR', 'Request body must be valid JSON.');
    return;
  }

  let message = 'Internal server error';
  if (error instanceof Error) {
    message = error.message;
  }
  console.error('Unhandled error:', message);
  sendError(res, 500, 'INTERNAL_ERROR', message);
}
