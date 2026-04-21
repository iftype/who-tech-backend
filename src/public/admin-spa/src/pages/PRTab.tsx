import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import type { Member, Submission } from '../lib/types.js';

type StatusFilter = '' | 'open' | 'merged' | 'closed';

export default function PRTab() {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members', 'prs'],
    queryFn: () => apiFetch<Member[]>('/admin/members'),
  });

  const { data: memberDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['member-detail', selectedMemberId],
    queryFn: () => apiFetch<Member>(`/admin/members/${selectedMemberId}`),
    enabled: selectedMemberId !== null,
  });

  const filteredSubmissions = (memberDetail?.submissions ?? []).filter((s: Submission) => {
    if (!statusFilter) return true;
    return s.status === statusFilter;
  });

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-green-100 text-green-700 border-green-200',
      merged: 'bg-purple-100 text-purple-700 border-purple-200',
      closed: 'bg-red-100 text-red-700 border-red-200',
    };
    return (
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${colors[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          멤버 선택 {!membersLoading && <span className="text-gray-400 font-normal">({members.length}명)</span>}
        </h2>
        {membersLoading ? (
          <div className="py-4 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">닉네임</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">GitHub</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">기수</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">PR 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedMemberId === m.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedMemberId(m.id)}
                  >
                    <td className="px-3 py-2 text-xs font-medium text-gray-900">
                      {m.avatarUrl && (
                        <img src={m.avatarUrl} className="w-5 h-5 rounded-full inline-block mr-1" alt="" loading="lazy" />
                      )}
                      {m.nickname ?? m.githubId}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{m.githubId}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {m.cohorts.map((c) => c.cohort).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{m._count.submissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedMemberId && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">
              {memberDetail?.nickname ?? memberDetail?.githubId}의 PR{' '}
              {!detailLoading && <span className="text-gray-400 font-normal">({filteredSubmissions.length}개)</span>}
            </h2>
            <div className="flex gap-1">
              {(['', 'open', 'merged', 'closed'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded border ${
                    statusFilter === s
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {s || '전체'}
                </button>
              ))}
            </div>
          </div>

          {detailLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">PR 없음</div>
          ) : (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">레포</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">PR 제목</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">상태</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">제출일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubmissions.map((s: Submission) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {s.missionRepo.name}
                        {s.missionRepo.track && (
                          <span className="text-gray-400 ml-1">({s.missionRepo.track})</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={s.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          #{s.prNumber} {s.title}
                        </a>
                      </td>
                      <td className="px-3 py-2">{statusBadge(s.status)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {new Date(s.submittedAt).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
