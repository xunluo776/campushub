import { Router } from 'express';

import { getResources } from '../controllers/resource.controller';

// Mounted at /api/v1/resources.
const resourceRouter: Router = Router();

resourceRouter.get('/', getResources);

export default resourceRouter;
