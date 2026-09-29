import { NextFunction, Request, Response } from 'express';

import { sendError } from '../middleware/errorHandler';
import {
  DoubleBookingError,
  createReservation,
  listActiveReservationsForUser,
} from '../services/reservation.service';
import { CreateReservationInput, Reservation, ReservationStatus } from '../types/reservation';

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

// POST /api/v1/reservations
export async function postReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body: unknown = req.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      sendError(res, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
      return;
    }
    const payload = body as Record<string, unknown>;

    const resourceId = readString(payload, 'resourceId');
    if (resourceId === undefined) {
      sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'resourceId is required and must be a non-empty string.',
      );
      return;
    }

    const userId = readString(payload, 'userId');
    if (userId === undefined) {
      sendError(res, 400, 'VALIDATION_ERROR', 'userId is required and must be a non-empty string.');
      return;
    }

    const startTime = readString(payload, 'startTime');
    if (startTime === undefined || !isIsoDateTime(startTime)) {
      sendError(res, 400, 'VALIDATION_ERROR', 'startTime must be an ISO 8601 date-time string.');
      return;
    }

    const endTime = readString(payload, 'endTime');
    if (endTime === undefined || !isIsoDateTime(endTime)) {
      sendError(res, 400, 'VALIDATION_ERROR', 'endTime must be an ISO 8601 date-time string.');
      return;
    }

    if (Date.parse(endTime) <= Date.parse(startTime)) {
      sendError(res, 400, 'VALIDATION_ERROR', 'endTime must be later than startTime.');
      return;
    }

    // status is optional, the service defaults it to PENDING.
    let status: ReservationStatus | undefined = undefined;
    if (payload.status !== undefined) {
      const rawStatus = readString(payload, 'status');
      if (rawStatus === undefined || !ALLOWED_STATUSES.includes(rawStatus as ReservationStatus)) {
        sendError(res, 400, 'VALIDATION_ERROR', 'status must be PENDING, CONFIRMED or CANCELLED.');
        return;
      }
      status = rawStatus as ReservationStatus;
    }

    const input: CreateReservationInput = { resourceId, userId, startTime, endTime, status };
    const reservation: Reservation = await createReservation(input);
    res.status(201).json(reservation);
  } catch (error) {
    if (error instanceof DoubleBookingError) {
      sendError(res, 409, 'DOUBLE_BOOKING', error.message);
      return;
    }
    next(error);
  }
}

// GET /api/v1/reservations/user/:userId
export async function getUserReservations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.params.userId;
    if (typeof userId !== 'string' || userId.trim() === '') {
      sendError(res, 400, 'VALIDATION_ERROR', 'userId must be a non-empty string.');
      return;
    }

    const reservations: Reservation[] = await listActiveReservationsForUser(userId);
    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
}
