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

function validateLength(value, field, min, max) {
  if (typeof value !== 'string') {
    throw validationError(`${field} is required`, field);
  }
  const len = value.trim().length;
  if (len < min) {
    throw validationError(`${field} must be at least ${min} characters`, field);
  }
  if (len > max) {
    throw validationError(`${field} must be at most ${max} characters`, field);
  }
}

export function validateTalkInput({ title, abstract, speaker_name }) {
  validateLength(title, 'title', 5, 120);
  validateLength(abstract, 'abstract', 20, 2000);
  validateLength(speaker_name, 'speaker_name', 1, 80);
}

export function validateCommentInput({ body, author_name }) {
  validateLength(body, 'body', 1, 500);
  validateLength(author_name, 'author_name', 1, 80);
}

export function errorResponseBody(err) {
  if (err instanceof ApiError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.field) body.error.field = err.field;
    return { status: err.status, body };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: 'Internal server error' } },
  };
}
