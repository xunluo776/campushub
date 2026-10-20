// Errors the services throw. They carry a machine readable code but no HTTP status,
// the controllers decide which status each one maps to.

// Bad input, or input that points at something that doesn't exist.
export class ValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

// A new booking overlaps an existing one on the same resource.
export class DoubleBookingError extends Error {
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'DoubleBookingError';
    this.code = 'DOUBLE_BOOKING';
  }
}

// The id is well formed but nothing in the database has it.
export class NotFoundError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.code = code;
  }
}

// The reservation exists but its current status doesn't allow the requested change,
// e.g. cancelling something that is already cancelled.
export class StatusTransitionError extends Error {
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'StatusTransitionError';
    this.code = 'INVALID_STATUS_TRANSITION';
  }
}
