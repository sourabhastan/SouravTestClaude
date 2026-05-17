export default function TalkCard({ talk, onVote, voting }) {
  return (
    <article className="card talk-card">
      <div>
        <h3>
          <a href={`#/talks/${talk.id}`}>{talk.title}</a>
        </h3>
        <div className="speaker">by {talk.speaker_name}</div>
      </div>
      <div className="meta">
        <span className="vote-count" aria-label="votes">
          {talk.vote_count}
        </span>
        {talk.has_voted ? (
          <span className="voted-pill" title="You voted on this talk">
            ✓ Voted
          </span>
        ) : (
          <button
            className="primary"
            disabled={voting}
            onClick={() => onVote(talk.id)}
          >
            Vote
          </button>
        )}
      </div>
    </article>
  );
}
