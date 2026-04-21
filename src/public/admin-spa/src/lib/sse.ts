export function createEventSource(path: string): EventSource {
  const token = localStorage.getItem('admin_token') ?? '';
  const sep = path.includes('?') ? '&' : '?';
  return new EventSource(`${path}${sep}token=${encodeURIComponent(token)}`);
}
