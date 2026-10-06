import { NextFunction, Request, Response } from 'express';

import { ErrorResponse } from '../types/reservation';

// Every failure the API returns uses the ErrorResponse shape from docs/openapi.yaml.
export function sendError(res: Response, status: number, code: string, message: string): void {
  const payload: ErrorResponse = { code, message };
  res.status(status).json(payload);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.originalUrl}`);
}

// Central error handler. Registered last in app.ts so everything funnels here.
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // express.json() throws this when the body isn't valid JSON. That's the client's
  // fault, so it's a 400 like any other bad body, not a 500.
  if (
    !res.headersSent &&
    error instanceof SyntaxError &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Request body must be valid JSON.');
    return;
  }

  let message = 'Internal server error';
  if (error instanceof Error) {
    message = error.message;
  }
  console.error('Unhandled error:', message);

  if (res.headersSent) {
    next(error);
    return;
  }
  sendError(res, 500, 'INTERNAL_ERROR', message);
}
