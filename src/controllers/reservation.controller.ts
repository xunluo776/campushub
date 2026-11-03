import { Request, Response } from 'express';

import { Reservation } from '../../shared/types';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  listReservationsForUser,
} from '../services/reservation.service';

// No try/catch in here on purpose. Express 5 passes a rejected promise to the error
// middleware, and middleware/errorHandler.ts maps service errors to 400/404/409.

// POST /api/v1/reservations
export async function postReservation(req: Request, res: Response): Promise<void> {
  const reservation: Reservation = await createReservation(req.body);
  res.status(201).json(reservation);
}

// GET /api/v1/reservations/user/:userId
export async function getUserReservations(req: Request, res: Response): Promise<void> {
  const reservations: Reservation[] = await listReservationsForUser(req.params.userId);
  res.status(200).json(reservations);
}

// PATCH /api/v1/reservations/:id/cancel
export async function patchCancelReservation(req: Request, res: Response): Promise<void> {
  const reservation: Reservation = await cancelReservation(req.params.id);
  res.status(200).json(reservation);
}

// PATCH /api/v1/reservations/:id/confirm
export async function patchConfirmReservation(req: Request, res: Response): Promise<void> {
  const reservation: Reservation = await confirmReservation(req.params.id);
  res.status(200).json(reservation);
}
