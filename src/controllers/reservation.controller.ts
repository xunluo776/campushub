import { NextFunction, Request, Response } from 'express';

import { sendError } from '../middleware/errorHandler';
import {
  DoubleBookingError,
  NotFoundError,
  StatusTransitionError,
  ValidationError,
} from '../services/errors';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  listReservationsForUser,
} from '../services/reservation.service';
import { Reservation } from '../types/reservation';

// POST /api/v1/reservations
export async function postReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reservation: Reservation = await createReservation(req.body);
    res.status(201).json(reservation);
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    if (error instanceof DoubleBookingError) {
      sendError(res, 409, error.code, error.message);
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
    const reservations: Reservation[] = await listReservationsForUser(req.params.userId);
    res.status(200).json(reservations);
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    next(error);
  }
}

// PATCH /api/v1/reservations/:id/cancel
export async function patchCancelReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reservation: Reservation = await cancelReservation(req.params.id);
    res.status(200).json(reservation);
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    if (error instanceof NotFoundError) {
      sendError(res, 404, error.code, error.message);
      return;
    }
    if (error instanceof StatusTransitionError) {
      sendError(res, 409, error.code, error.message);
      return;
    }
    next(error);
  }
}

// PATCH /api/v1/reservations/:id/confirm
export async function patchConfirmReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reservation: Reservation = await confirmReservation(req.params.id);
    res.status(200).json(reservation);
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    if (error instanceof NotFoundError) {
      sendError(res, 404, error.code, error.message);
      return;
    }
    if (error instanceof StatusTransitionError) {
      sendError(res, 409, error.code, error.message);
      return;
    }
    next(error);
  }
}
