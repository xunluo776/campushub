import { CreateReservationInput, Reservation } from '../types/reservation';

// Thrown when a new booking overlaps an existing one. The controller turns this into a
// 409, services do not know about status codes.
export class DoubleBookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DoubleBookingError';
  }
}

// In-memory store so the routes work without a database during local testing.
const reservations: Reservation[] = [];
let nextId = 1;

// Two slots overlap when each one starts before the other ends. Back to back bookings
// (one ends exactly when the next starts) are allowed.
function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

export async function createReservation(input: CreateReservationInput): Promise<Reservation> {
  const start = Date.parse(input.startTime);
  const end = Date.parse(input.endTime);

  for (const existing of reservations) {
    if (existing.resourceId !== input.resourceId) {
      continue;
    }
    if (existing.status === 'CANCELLED') {
      continue;
    }
    const existingStart = Date.parse(existing.startTime);
    const existingEnd = Date.parse(existing.endTime);
    if (overlaps(start, end, existingStart, existingEnd)) {
      throw new DoubleBookingError('Resource is already reserved for this time slot.');
    }
  }

  let status = input.status;
  if (status === undefined) {
    status = 'PENDING';
  }

  const reservation: Reservation = {
    id: `rsv-${String(nextId)}`,
    resourceId: input.resourceId,
    userId: input.userId,
    startTime: input.startTime,
    endTime: input.endTime,
    status: status,
  };
  nextId += 1;
  reservations.push(reservation);
  return reservation;
}

// Active means everything the student still holds, so cancelled bookings are left out.
export async function listActiveReservationsForUser(userId: string): Promise<Reservation[]> {
  const active: Reservation[] = [];
  for (const reservation of reservations) {
    if (reservation.userId === userId && reservation.status !== 'CANCELLED') {
      active.push(reservation);
    }
  }
  return active;
}
