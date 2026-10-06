import { NextFunction, Request, Response } from 'express';

import { sendError } from '../middleware/errorHandler';
import { DoubleBookingError, ValidationError } from '../services/errors';
import { createReservation, listActiveReservationsForUser } from '../services/reservation.service';
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
    const reservations: Reservation[] = await listActiveReservationsForUser(req.params.userId);
    res.status(200).json(reservations);
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    next(error);
  }
}
