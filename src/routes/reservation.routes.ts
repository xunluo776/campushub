import { Router } from 'express';

import { getResources } from '../controllers/resource.controller';
import { getUserReservations, postReservation } from '../controllers/reservation.controller';

// The three endpoints defined in docs/openapi.yaml. Paths are relative to /api/v1, which
// is where this router is mounted.
const reservationRouter: Router = Router();

reservationRouter.get('/resources', getResources);
reservationRouter.post('/reservations', postReservation);
reservationRouter.get('/reservations/user/:userId', getUserReservations);

export default reservationRouter;
