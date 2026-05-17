import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLiveEvents } from '../sse.js';

function formatDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString();
}

export default function TalkDetail({ id, showToast }) {
  const [talk, setTalk] = useState(null);
  const [error, setError] = useState(null);
  const [voting, setVoting] = useState(false);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api.getTalk(id);
      setTalk(t);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useLiveEvents({
    vote: ({ talk_id, vote_count }) => {
      if (talk_id === id) setTalk((t) => (t ? { ...t, vote_count } : t));
    },
    comment: (c) => {
      if (c.talk_id === id) {
        setTalk((t) =>
          t ? { ...t, comments: [c, ...(t.comments || [])] } : t
        );
      }
    },
    poll: () => { load(); },
  });

  const onVote = async () => {
    setVoting(true);
    try {
      const r = await api.vote(id);
      setTalk((t) => (t ? { ...t, has_voted: true, vote_count: r.vote_count } : t));
      showToast('Vote recorded');
    } catch (e) {
      showToast(e.message || 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  const onComment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.addComment(id, { body: body.trim(), author_name: author.trim() });
      setBody('');
      showToast('Comment posted');
    } catch (err) {
      showToast(err.message || 'Comment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <div className="error">{error}</div>;
  if (!talk) return <p className="muted">Loading…</p>;

  return (
    <>
      <section>
        <a href="#/" className="muted">← All talks</a>
        <h2 style={{ marginTop: '0.5rem' }}>{talk.title}</h2>
        <p className="muted">by {talk.speaker_name}</p>
        <div className="card">
          <p className="abstract">{talk.abstract}</p>
          <div className="row" style={{ marginTop: '0.75rem' }}>
            <span className="vote-count">{talk.vote_count}</span>
            <span className="muted">votes</span>
            <div className="spacer" />
            {talk.has_voted ? (
              <span className="voted-pill">✓ You voted</span>
            ) : (
              <button className="primary" disabled={voting} onClick={onVote}>
                Vote for this talk
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2>Comments</h2>
        <form className="card" onSubmit={onComment}>
          <div className="form-row">
            <label htmlFor="author">Your name</label>
            <input
              id="author"
              maxLength={80}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="body">Comment</label>
            <textarea
              id="body"
              rows={3}
              maxLength={500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <div className="hint">{body.length}/500</div>
          </div>
          <button
            className="primary"
            type="submit"
            disabled={submitting || body.trim().length < 1 || author.trim().length < 1}
          >
            Post comment
          </button>
        </form>

        <div className="comments" style={{ marginTop: '1rem' }}>
          {(talk.comments || []).length === 0 ? (
            <p className="muted">No comments yet.</p>
          ) : (
            talk.comments.map((c) => (
              <div className="comment" key={c.id}>
                <span className="who">{c.author_name}</span>
                <span className="when">{formatDate(c.created_at)}</span>
                <div className="body">{c.body}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
