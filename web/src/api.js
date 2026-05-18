async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  if (!res.ok) {
    const err = (data && data.error) || {
      code: 'HTTP_' + res.status,
      message: res.statusText || 'Request failed',
    };
    const e = new Error(err.message);
    e.code = err.code;
    e.field = err.field;
    e.status = res.status;
    throw e;
  }
  return data;
}

export const api = {
  listTalks: () => request('GET', '/api/talks'),
  getTalk: (id) => request('GET', `/api/talks/${id}`),
  createTalk: (input) => request('POST', '/api/talks', input),
  vote: (id) => request('POST', `/api/talks/${id}/vote`),
  addComment: (id, input) => request('POST', `/api/talks/${id}/comments`, input),
  leaderboard: () => request('GET', '/api/leaderboard'),
};
