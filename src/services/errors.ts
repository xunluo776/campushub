// Errors the services throw. They carry a machine readable code but no HTTP status,
// middleware/errorHandler.ts decides which status each class maps to.

// Base class so the error handler can tell "expected" errors apart from real bugs.
export class DomainError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

// Bad input, or input that points at something that doesn't exist (e.g. resourceId).
export class ValidationError extends DomainError {}

// The id is well formed but nothing in the database has it.
export class NotFoundError extends DomainError {}

// A new booking overlaps an existing one on the same resource.
export class DoubleBookingError extends DomainError {
  constructor(message: string) {
    super('DOUBLE_BOOKING', message);
  }
}

// The reservation exists but its current status doesn't allow the requested change,
// e.g. cancelling something that is already cancelled.
export class StatusTransitionError extends DomainError {
  constructor(message: string) {
    super('INVALID_STATUS_TRANSITION', message);
  }
}
