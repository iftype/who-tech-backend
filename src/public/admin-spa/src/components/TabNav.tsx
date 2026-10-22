import { useHashLocation } from '../hooks/useHashLocation.js';
import { tabVariants } from './ui/Tabs.js';

const TABS = [
  { path: '/members', label: '멤버' },
  { path: '/sync', label: '싱크' },
  { path: '/repos', label: '레포' },
  { path: '/blog', label: '블로그' },
  { path: '/archive', label: '아카이브' },
  { path: '/persons', label: 'Person' },
  { path: '/logs', label: '로그' },
  { path: '/settings', label: '설정' },
] as const;

// 좁은 화면: 가로 탭(줄을 바꾸지 않고 가로로 넘김), 넓은 화면: 사이드바 세로 목록
export function TabNav() {
  const [location, navigate] = useHashLocation();

  return (
    <nav
      aria-label="어드민 탭"
      className="flex overflow-x-auto border-t border-base-200 px-4 md:flex-col md:gap-0.5 md:overflow-visible md:border-t-0 md:px-2"
    >
      {TABS.map((tab) => {
        const active = location === tab.path || (location === '/' && tab.path === '/members');
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            aria-current={active ? 'page' : undefined}
            className={tabVariants({ active })}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
