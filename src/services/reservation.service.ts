import { isObjectIdOrHexString } from 'mongoose';

import { ReservationDocument, ReservationModel } from '../models/Reservation.model';
import { ResourceModel } from '../models/Resource.model';
import { CreateReservationInput, Reservation, ReservationStatus } from '../types/reservation';
import { DoubleBookingError, ValidationError } from './errors';

// ISO 8601 date-time, which is what format: date-time means in the contract.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const ALLOWED_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED'];

function readString(payload: Record<string, unknown>, field: string): string | undefined {
  const value = payload[field];
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return undefined;
}

function isIsoDateTime(value: string): boolean {
  if (!ISO_DATE_TIME.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

// Checks the raw request body against the contract and returns a typed input.
// Throws ValidationError on the first problem it finds.
function parseReservationInput(body: unknown): CreateReservationInput {
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

  // Two slots overlap when each one starts before the other ends. Back to back bookings
  // (one ends exactly when the next starts) are allowed. Cancelled ones don't count.
  const conflict = await ReservationModel.exists({
    resourceId: input.resourceId,
    status: { $ne: 'CANCELLED' },
    startTime: { $lt: end },
    endTime: { $gt: start },
  });
  if (conflict !== null) {
    throw new DoubleBookingError('Resource is already reserved for this time slot.');
  }

  let status = input.status;
  if (status === undefined) {
    status = 'PENDING';
  }

  const doc = await ReservationModel.create({
    resourceId: input.resourceId,
    userId: input.userId,
    startTime: start,
    endTime: end,
    status: status,
  });
  return toReservation(doc);
}

// Active means everything the student still holds, so cancelled bookings are left out.
export async function listActiveReservationsForUser(userId: unknown): Promise<Reservation[]> {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new ValidationError('VALIDATION_ERROR', 'userId must be a non-empty string.');
  }

  const docs = await ReservationModel.find({ userId: userId, status: { $ne: 'CANCELLED' } }).sort({
    startTime: 1,
  });

  const active: Reservation[] = [];
  for (const doc of docs) {
    active.push(toReservation(doc));
  }
  return active;
}
