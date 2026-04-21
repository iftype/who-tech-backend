import { useHashLocation } from '../hooks/useHashLocation.js';

const TABS = [
  { path: '/members', label: '멤버' },
  { path: '/sync', label: '싱크' },
  { path: '/repos', label: '레포' },
  { path: '/blog', label: '블로그' },
  { path: '/settings', label: '설정' },
] as const;

export default function TabNav() {
  const [location, navigate] = useHashLocation();

  return (
    <nav className="flex border-b border-gray-200 bg-white px-4">
      {TABS.map((tab) => {
        const active = location === tab.path || (location === '/' && tab.path === '/members');
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
