import { useEffect, useState } from 'react';

function parse() {
  const hash = window.location.hash || '#/';
  const path = hash.replace(/^#/, '') || '/';
  return path;
}

export function useRoute() {
  const [path, setPath] = useState(parse);
  useEffect(() => {
    const onHash = () => setPath(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return path;
}

export function navigate(path) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

export function matchTalkDetail(path) {
  const m = path.match(/^\/talks\/(\d+)$/);
  return m ? Number(m[1]) : null;
}
