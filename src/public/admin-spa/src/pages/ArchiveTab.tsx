import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export default function ArchiveTab() {
  const [cohort, setCohort] = useState('');
  const [track, setTrack] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['archive', cohort, track],
    queryFn: async () => {
      if (!cohort) return null;
      const params = new URLSearchParams({ cohort, format: 'md' });
      if (track) params.set('track', track);
      const res = await fetch(`/admin/archive?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.text();
    },
    enabled: !!cohort,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-xs text-gray-500 block mb-1">기수 (필수)</label>
          <input
            type="number"
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
            placeholder="예: 8"
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-20"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">트랙 (선택)</label>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            <option value="frontend">frontend</option>
            <option value="backend">backend</option>
            <option value="android">android</option>
          </select>
        </div>
      </div>

      {isLoading && <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>}

      {data && (
        <div className="bg-gray-900 rounded border border-gray-700 p-4 font-mono text-xs text-gray-300 max-h-[70vh] overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {data}
        </div>
      )}

      {!cohort && !data && (
        <div className="py-12 text-center text-gray-400 text-sm">기수를 입력하면 아카이브 마크다운이 표시됩니다</div>
      )}
    </div>
  );
}
