import { useState, useEffect, useCallback } from 'react';

function getHash(): string {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return hash;
}

export function useHashLocation(): [string, (path: string) => void] {
  const [location, setLocation] = useState(getHash);

  useEffect(() => {
    const handler = () => setLocation(getHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return [location, navigate];
}
