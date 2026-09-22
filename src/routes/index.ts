import { Router } from 'express';

import healthRouter from './health.routes';

// All v1 routes get mounted here so app.ts only has to mount one router.
const apiV1Router: Router = Router();

apiV1Router.use('/health', healthRouter);

export default apiV1Router;
