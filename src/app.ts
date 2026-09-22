import express, { Application } from 'express';

import apiV1Router from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();

app.use(express.json());

app.use('/api/v1', apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
