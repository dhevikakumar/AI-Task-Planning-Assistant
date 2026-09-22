import cors from 'cors';
import express from 'express';
import { connectDatabase, ensureDatabaseSchema } from './config/db.js';
import { env } from './config/env.js';
import aiRoutes from './routes/ai.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import tasksRoutes from './routes/tasks.routes.js';

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/tasks', tasksRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  try {
    const databaseReady = await connectDatabase();

    if (databaseReady) {
      await ensureDatabaseSchema();
    }
  } catch (error) {
    console.warn(
      `PostgreSQL is not reachable yet. The API will still start. ${error.message}`,
    );
  }

  app.listen(env.port, () => {
    console.log(`AItasks API listening on http://localhost:${env.port}`);
  });
}

start();
