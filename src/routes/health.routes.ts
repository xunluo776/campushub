import { Router } from 'express';

import { getHealth } from '../controllers/health.controller';

// Route definitions only, mapped straight to a controller.
const healthRouter: Router = Router();

healthRouter.get('/', getHealth);

export default healthRouter;
