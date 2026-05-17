import { randomUUID } from 'node:crypto';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function visitorCookie(req, res, next) {
  let id = req.cookies?.visitor_id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = randomUUID();
    res.cookie('visitor_id', id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: ONE_YEAR_MS,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  req.visitorId = id;
  next();
}
