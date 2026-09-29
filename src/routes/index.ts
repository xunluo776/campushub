import { Router } from 'express';

import healthRouter from './health.routes';
import reservationRouter from './reservation.routes';

// All v1 routes get mounted here so app.ts only has to mount one router.
const apiV1Router: Router = Router();

apiV1Router.use('/health', healthRouter);
// The reservation router carries its own /resources and /reservations paths.
apiV1Router.use('/', reservationRouter);

export default apiV1Router;
