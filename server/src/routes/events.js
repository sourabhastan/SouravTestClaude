import { Router } from 'express';
import { addClient } from '../lib/sse.js';

const router = Router();

router.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  addClient(res);
  const keepalive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 25000);
  req.on('close', () => clearInterval(keepalive));
});

export default router;
