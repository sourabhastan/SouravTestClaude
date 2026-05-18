import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { ensureDb } from './db.js';
import { visitorCookie } from './middleware/visitorCookie.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './lib/errors.js';
import talksRoutes from './routes/talks.js';
import leaderboardRoutes from './routes/leaderboard.js';
import healthzRoutes from './routes/healthz.js';
import eventsRoutes from './routes/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.use(async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (e) {
    next(e);
  }
});

app.use(visitorCookie);
app.use(rateLimit);

app.use('/api', healthzRoutes);
app.use('/api', eventsRoutes);
app.use('/api', talksRoutes);
app.use('/api', leaderboardRoutes);

const staticDir = resolve(__dirname, '../../web/dist');
if (!process.env.VERCEL && existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(staticDir, 'index.html'));
  });
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  }
  next();
});

app.use(errorHandler);

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, () => {
    console.log(`[talks] listening on http://localhost:${PORT}`);
  });
}

export default app;
