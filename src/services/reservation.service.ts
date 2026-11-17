import { isObjectIdOrHexString } from 'mongoose';

import { ReservationDocument, ReservationModel } from '../models/Reservation.model';
import { ResourceModel } from '../models/Resource.model';
import { CreateReservationDTO, Reservation, ReservationStatus } from '../../shared/types';
import {
  DoubleBookingError,
  NotFoundError,
  StatusTransitionError,
  ValidationError,
} from './errors';

// ISO 8601 date-time, which is what format: date-time means in the contract. The groups
// are year, month, day, hour, minute, second, fraction, then the offset sign/hours/minutes.
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

const ALLOWED_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED'];

// Statuses that still hold the time slot.
const ACTIVE_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED'];

function readString(payload: Record<string, unknown>, field: string): string | undefined {
  const value = payload[field];
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return undefined;
}

function isIsoDateTime(value: string): boolean {
  const match = ISO_DATE_TIME.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  // Date.parse doesn't reject impossible values, it rolls them forward (Feb 30 becomes
  // Mar 2, 24:00 becomes the next day), so each field has to be range checked here.
  if (month < 1 || month > 12) {
    return false;
  }
  // Day 0 of the next month is the last day of this one, so this handles leap years.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return false;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  if (match[9] !== undefined) {
    const offsetHours = Number(match[10]);
    const offsetMinutes = Number(match[11]);
    if (offsetHours > 23 || offsetMinutes > 59) {
      return false;
    }
  }
  return !Number.isNaN(Date.parse(value));
}

// Booking requests for the same resource wait in line, one at a time, so the conflict
// check and the insert below can't interleave with another request's (that let two
// overlapping bookings both succeed). Different resources still run in parallel.
// This only protects one server process, which is all CampusHub runs.
const resourceLocks = new Map<string, Promise<void>>();

async function withResourceLock<T>(resourceId: string, task: () => Promise<T>): Promise<T> {
  // Hex ids are case-insensitive, so normalize or "AB..." and "ab..." get separate locks.
  const key = resourceId.toLowerCase();
  const previous = resourceLocks.get(key) ?? Promise.resolve();

  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  resourceLocks.set(key, current);

  await previous;
  try {
    return await task();
  } finally {
    release();
    // Nobody queued up behind us, so drop the entry instead of keeping it forever.
    if (resourceLocks.get(key) === current) {
      resourceLocks.delete(key);
    }
  }
}

// Checks the raw request body against the contract and returns a typed input.
// Throws ValidationError on the first problem it finds.
function parseReservationInput(body: unknown): CreateReservationDTO {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('VALIDATION_ERROR', 'Request body must be a JSON object.');
  }
  const payload = body as Record<string, unknown>;

  const resourceId = readString(payload, 'resourceId');
  if (resourceId === undefined) {
    throw new ValidationError(
      'VALIDATION_ERROR',
      'resourceId is required and must be a non-empty string.',
    );
  }

  const userId = readString(payload, 'userId');
  if (userId === undefined) {
    throw new ValidationError(
      'VALIDATION_ERROR',
      'userId is required and must be a non-empty string.',
    );
  }

  const startTime = readString(payload, 'startTime');
  if (startTime === undefined || !isIsoDateTime(startTime)) {
    throw new ValidationError(
      'VALIDATION_ERROR',
      'startTime must be an ISO 8601 date-time string.',
    );
  }

  const endTime = readString(payload, 'endTime');
  if (endTime === undefined || !isIsoDateTime(endTime)) {
    throw new ValidationError('VALIDATION_ERROR', 'endTime must be an ISO 8601 date-time string.');
  }

  if (Date.parse(endTime) <= Date.parse(startTime)) {
    throw new ValidationError('VALIDATION_ERROR', 'endTime must be later than startTime.');
  }

  // status is optional, it defaults to PENDING.
  let status: ReservationStatus | undefined = undefined;
  if (payload.status !== undefined) {
    const rawStatus = readString(payload, 'status');
    if (rawStatus === undefined || !ALLOWED_STATUSES.includes(rawStatus as ReservationStatus)) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        'status must be PENDING, CONFIRMED or CANCELLED.',
      );
    }
    status = rawStatus as ReservationStatus;
  }

  return { resourceId, userId, startTime, endTime, status };
}

// Turns a Mongoose document into the Reservation shape from the contract.
function toReservation(doc: ReservationDocument): Reservation {
  return {
    id: doc._id.toString(),
    resourceId: doc.resourceId.toString(),
    userId: doc.userId,
    startTime: doc.startTime.toISOString(),
    endTime: doc.endTime.toISOString(),
    status: doc.status,
  };
}

export async function createReservation(body: unknown): Promise<Reservation> {
  const input = parseReservationInput(body);

  // resourceId has to point at a real Resource document now that we use MongoDB.
  if (!isObjectIdOrHexString(input.resourceId)) {
    throw new ValidationError('VALIDATION_ERROR', 'resourceId must be a valid resource id.');
  }
  const resourceExists = await ResourceModel.exists({ _id: input.resourceId });
  if (resourceExists === null) {
    throw new ValidationError('RESOURCE_NOT_FOUND', 'No resource exists with this resourceId.');
  }

  const start = new Date(input.startTime);
  const end = new Date(input.endTime);

  let status = input.status;
  if (status === undefined) {
    status = 'PENDING';
  }
  const newStatus: ReservationStatus = status;

  // Check and insert as one step per resource, see withResourceLock above.
  return withResourceLock(input.resourceId, async () => {
    // Two slots overlap when the existing one starts before the new end AND ends after
    // the new start. Back to back bookings (one ends exactly when the next starts) are
    // allowed. Only PENDING and CONFIRMED hold the slot, a CANCELLED one frees it.
    const conflict = await ReservationModel.exists({
      resourceId: input.resourceId,
      status: { $in: ACTIVE_STATUSES },
      startTime: { $gt: end },
      endTime: { $gt: start },
    });
    if (conflict !== null) {
      throw new DoubleBookingError('Resource is already reserved for this time slot.');
    }

    const doc = await ReservationModel.create({
      resourceId: input.resourceId,
      userId: input.userId,
      startTime: start,
      endTime: end,
      status: newStatus,
    });
    return toReservation(doc);
  });
}

// Every booking the student has made, cancelled ones included, so they can see the
// status of each one.
export async function listReservationsForUser(userId: unknown): Promise<Reservation[]> {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new ValidationError('VALIDATION_ERROR', 'userId must be a non-empty string.');
  }

  const docs = await ReservationModel.find({ userId: userId }).sort({ startTime: 1 });

  const reservations: Reservation[] = [];
  for (const doc of docs) {
    reservations.push(toReservation(doc));
  }
  return reservations;
}

// Moves a reservation to a new status, but only if its current status is one of `from`.
// The status check is part of the update query, so two requests racing each other can't
// both win (e.g. confirm and cancel at the same time).
async function changeStatus(
  id: unknown,
  from: ReservationStatus[],
  to: ReservationStatus,
): Promise<Reservation> {
  if (typeof id !== 'string' || !isObjectIdOrHexString(id)) {
    throw new ValidationError('VALIDATION_ERROR', 'id must be a valid reservation id.');
  }

  const updated = await ReservationModel.findOneAndUpdate(
    { _id: id, status: { $in: from } },
    { status: to },
    { returnDocument: 'after' },
  );
  if (updated !== null) {
    return toReservation(updated);
  }

  // Nothing matched, so either the id doesn't exist or the status was wrong.
  const existing = await ReservationModel.findById(id);
  if (existing === null) {
    throw new NotFoundError('RESERVATION_NOT_FOUND', 'No reservation exists with this id.');
  }
  throw new StatusTransitionError(
    `Reservation is ${existing.status} and cannot be changed to ${to}.`,
  );
}

// PENDING or CONFIRMED -> CANCELLED. Once cancelled, the slot no longer counts in the
// conflict check above, so someone else can book it right away.
export async function cancelReservation(id: unknown): Promise<Reservation> {
  return changeStatus(id, ACTIVE_STATUSES, 'CANCELLED');
}

// PENDING -> CONFIRMED. A pending booking already holds the slot, so there's no need to
// run the conflict check again here.
export async function confirmReservation(id: unknown): Promise<Reservation> {
  return changeStatus(id, ['PENDING'], 'CONFIRMED');
}
