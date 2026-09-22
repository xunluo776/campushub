import { NextFunction, Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ status: 'error', message: `Route not found: ${req.originalUrl}` });
}

// Central error handler. Registered last in app.ts so everything funnels here.
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  let message = 'Internal server error';
  if (error instanceof Error) {
    message = error.message;
  }
  console.error('Unhandled error:', message);

  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ status: 'error', message });
}
