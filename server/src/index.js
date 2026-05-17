import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { visitorCookie } from './middleware/visitorCookie.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './lib/errors.js';
import talksRoutes from './routes/talks.js';
import leaderboardRoutes from './routes/leaderboard.js';
import healthzRoutes from './routes/healthz.js';
import eventsRoutes from './routes/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use(visitorCookie);
app.use(rateLimit);

app.use('/api', healthzRoutes);
app.use('/api', eventsRoutes);
app.use('/api', talksRoutes);
app.use('/api', leaderboardRoutes);

const staticDir = resolve(__dirname, '../../web/dist');
if (existsSync(staticDir)) {
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

app.listen(PORT, () => {
  console.log(`[talks] listening on http://localhost:${PORT}`);
});
