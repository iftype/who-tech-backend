import { useState, useEffect } from 'react';

interface Toast { id: number; message: string; type: 'success' | 'error'; }

let toastListeners: ((t: Toast) => void)[] = [];
let nextId = 0;

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast: Toast = { id: nextId++, message, type };
  toastListeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter((fn) => fn !== handler); };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded shadow text-sm text-white ${t.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
