import { Router } from 'express';

import {
  getUserReservations,
  patchCancelReservation,
  patchConfirmReservation,
  postReservation,
} from '../controllers/reservation.controller';

// Mounted at /api/v1/reservations.
const reservationRouter: Router = Router();

reservationRouter.post('/', postReservation);
reservationRouter.get('/user/:userId', getUserReservations);
reservationRouter.patch('/:id/cancel', patchCancelReservation);
reservationRouter.patch('/:id/confirm', patchConfirmReservation);

export default reservationRouter;
