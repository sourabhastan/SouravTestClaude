export default function Leaderboard({ items }) {
  if (!items?.length) {
    return <p className="muted">No votes yet — be the first.</p>;
  }
  return (
    <div className="leaderboard">
      <ol>
        {items.map((t) => (
          <li key={t.id}>
            <a className="talk-title" href={`#/talks/${t.id}`}>{t.title}</a>
            <span className="talk-votes">{t.vote_count}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
