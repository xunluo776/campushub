import { Router } from 'express';

import { getUserReservations, postReservation } from '../controllers/reservation.controller';

// Mounted at /api/v1/reservations.
const reservationRouter: Router = Router();

reservationRouter.post('/', postReservation);
reservationRouter.get('/user/:userId', getUserReservations);

export default reservationRouter;
