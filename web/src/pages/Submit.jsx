import { useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../router.js';

export default function Submit({ showToast }) {
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [abstract, setAbstract] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const t = await api.createTalk({
        title: title.trim(),
        speaker_name: speaker.trim(),
        abstract: abstract.trim(),
      });
      showToast('Talk submitted');
      navigate(`/talks/${t.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const titleOk = title.trim().length >= 5 && title.trim().length <= 120;
  const speakerOk = speaker.trim().length >= 1 && speaker.trim().length <= 80;
  const abstractOk = abstract.trim().length >= 20 && abstract.trim().length <= 2000;
  const canSubmit = titleOk && speakerOk && abstractOk && !submitting;

  return (
    <section>
      <h2>Submit a talk</h2>
      <form className="card" onSubmit={onSubmit}>
        {error && <div className="error">{error}</div>}
        <div className="form-row">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="hint">{title.trim().length}/120 (min 5)</div>
        </div>
        <div className="form-row">
          <label htmlFor="speaker">Speaker name</label>
          <input
            id="speaker"
            maxLength={80}
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="abstract">Abstract</label>
          <textarea
            id="abstract"
            rows={6}
            maxLength={2000}
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            required
          />
          <div className="hint">{abstract.trim().length}/2000 (min 20)</div>
        </div>
        <div className="row">
          <button className="primary" type="submit" disabled={!canSubmit}>
            Submit talk
          </button>
          <a href="#/" className="muted">Cancel</a>
        </div>
      </form>
    </section>
  );
}
