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
