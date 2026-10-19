import { getToken } from './auth.js';

export function createEventSource(path: string): EventSource {
  const token = getToken() ?? '';
  const sep = path.includes('?') ? '&' : '?';
  return new EventSource(`${path}${sep}token=${encodeURIComponent(token)}`);
}
