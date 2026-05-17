import { useState } from 'react';
import { useRoute, matchTalkDetail } from './router.js';
import Home from './pages/Home.jsx';
import TalkDetail from './pages/TalkDetail.jsx';
import Submit from './pages/Submit.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const path = useRoute();
  const [toast, setToast] = useState('');
  const showToast = (m) => setToast(m);

  const talkId = matchTalkDetail(path);
  const onSubmitPage = path === '/submit';
  const onHome = path === '/' || (!talkId && !onSubmitPage);

  return (
    <>
      <header className="app">
        <div className="inner">
          <h1>Conference Talk Voting</h1>
          <nav>
            <a href="#/" className={onHome ? 'active' : ''}>Talks</a>
            <a href="#/submit" className={onSubmitPage ? 'active' : ''}>Submit a talk</a>
          </nav>
        </div>
      </header>
      <main>
        {talkId ? (
          <TalkDetail id={talkId} showToast={showToast} />
        ) : onSubmitPage ? (
          <Submit showToast={showToast} />
        ) : (
          <Home showToast={showToast} />
        )}
      </main>
      <Toast message={toast} onDone={() => setToast('')} />
    </>
  );
}
