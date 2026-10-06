import { Router } from 'express';

import healthRouter from './health.routes';
import reservationRouter from './reservation.routes';
import resourceRouter from './resource.routes';

// All v1 routes get mounted here so app.ts only has to mount one router.
const apiV1Router: Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/resources', resourceRouter);
apiV1Router.use('/reservations', reservationRouter);

export default apiV1Router;
