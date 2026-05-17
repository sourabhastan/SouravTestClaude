import { useEffect, useRef } from 'react';

export function useLiveEvents(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let es;
    let pollTimer;
    let stopped = false;

    function connectSse() {
      try {
        es = new EventSource('/api/events');
        for (const name of ['vote', 'comment', 'talk_created']) {
          es.addEventListener(name, (e) => {
            try {
              const data = JSON.parse(e.data);
              handlersRef.current[name]?.(data);
            } catch {}
          });
        }
        es.onerror = () => {
          es?.close();
          if (!stopped) startPolling();
        };
      } catch {
        startPolling();
      }
    }

    function startPolling() {
      pollTimer = setInterval(() => {
        handlersRef.current.poll?.();
      }, 5000);
    }

    if (typeof EventSource !== 'undefined') connectSse();
    else startPolling();

    return () => {
      stopped = true;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);
}
