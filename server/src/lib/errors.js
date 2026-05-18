export class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export const validationError = (message, field) =>
  new ApiError(400, 'VALIDATION_ERROR', message, field);

export const notFound = (message = 'Not found') =>
  new ApiError(404, 'NOT_FOUND', message);

export const rateLimited = (message = 'Too many requests') =>
  new ApiError(429, 'RATE_LIMITED', message);

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.field) body.error.field = err.field;
    return res.status(err.status).json(body);
  }
  console.error('[unhandled]', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
}
