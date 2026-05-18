import { validationError } from '../lib/errors.js';

export function validateLength(value, field, min, max) {
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
