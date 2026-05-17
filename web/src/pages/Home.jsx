import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLiveEvents } from '../sse.js';
import TalkCard from '../components/TalkCard.jsx';
import Leaderboard from '../components/Leaderboard.jsx';

export default function Home({ showToast }) {
  const [talks, setTalks] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [error, setError] = useState(null);
  const [voting, setVoting] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [t, l] = await Promise.all([api.listTalks(), api.leaderboard()]);
      setTalks(t);
      setLeaders(l);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useLiveEvents({
    vote: ({ talk_id, vote_count }) => {
      setTalks((cur) =>
        cur.map((t) => (t.id === talk_id ? { ...t, vote_count } : t))
      );
      api.leaderboard().then(setLeaders).catch(() => {});
    },
    talk_created: () => { refresh(); },
    poll: () => { refresh(); },
  });

  const onVote = async (id) => {
    setVoting(id);
    try {
      const r = await api.vote(id);
      setTalks((cur) =>
        cur.map((t) =>
          t.id === id ? { ...t, has_voted: true, vote_count: r.vote_count } : t
        )
      );
      showToast('Vote recorded');
    } catch (e) {
      showToast(e.message || 'Vote failed');
    } finally {
      setVoting(null);
    }
  };

  return (
    <>
      <section>
        <h2>Leaderboard</h2>
        <div className="card">
          <Leaderboard items={leaders} />
        </div>
      </section>
      <section>
        <h2>All talks</h2>
        {error && <div className="error">{error}</div>}
        <div className="talk-list">
          {talks.map((t) => (
            <TalkCard key={t.id} talk={t} onVote={onVote} voting={voting === t.id} />
          ))}
        </div>
      </section>
    </>
  );
}
