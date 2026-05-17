const ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/[&<>"']/g, (ch) => ESCAPE[ch]);
}

export function cleanText(input, { trim = true } = {}) {
  if (typeof input !== 'string') return '';
  let s = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (trim) s = s.trim();
  return escapeHtml(s);
}
