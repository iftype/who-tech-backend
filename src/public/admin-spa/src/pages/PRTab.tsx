import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Submission } from '../lib/types.js';
import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Table, TableFrame, TBody, THead, Td, Th } from '../components/ui/Table.js';

type StatusFilter = '' | 'open' | 'merged' | 'closed';

export default function PRTab() {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(() => {
    const saved = localStorage.getItem('prtab-selected-member');
    return saved ? Number(saved) : null;
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  useEffect(() => {
    if (selectedMemberId !== null) {
      localStorage.setItem('prtab-selected-member', String(selectedMemberId));
    } else {
      localStorage.removeItem('prtab-selected-member');
    }
  }, [selectedMemberId]);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.members.prs(),
    queryFn: () => adminApi.members.list(),
  });

  const { data: memberDetail, isLoading: detailLoading } = useQuery({
    queryKey: queryKeys.members.detail(selectedMemberId),
    // enabled 조건으로 selectedMemberId가 있을 때만 실행된다
    queryFn: () => adminApi.members.detail(selectedMemberId!),
    enabled: selectedMemberId !== null,
  });

  const filteredSubmissions = (memberDetail?.submissions ?? []).filter((s: Submission) => {
    if (!statusFilter) return true;
    return s.status === statusFilter;
  });

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-success-100 text-success-700 border-success-200',
      merged: 'bg-accent-100 text-accent-700 border-accent-200',
      closed: 'bg-danger-100 text-danger-700 border-danger-200',
    };
    return (
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${colors[status] ?? 'bg-base-100 text-base-500 border-base-200'}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-base-700 mb-2">
          멤버 선택 {!membersLoading && <span className="text-base-400 font-normal">({members.length}명)</span>}
        </h2>
        {membersLoading ? (
          <div className="py-4 text-center text-base-400 text-sm">로딩 중...</div>
        ) : (
          <TableFrame>
            <Table>
              <THead>
                <tr>
                  <Th>닉네임</Th>
                  <Th>GitHub</Th>
                  <Th>기수</Th>
                  <Th>PR 수</Th>
                </tr>
              </THead>
              <TBody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className={`cursor-pointer hover:bg-base-50 ${selectedMemberId === m.id ? 'bg-primary-50' : ''}`}
                    onClick={() => setSelectedMemberId(m.id)}
                  >
                    <Td className="text-xs font-medium text-base-900">
                      {m.avatarUrl && (
                        <img
                          src={m.avatarUrl}
                          className="w-5 h-5 rounded-full inline-block mr-1"
                          alt=""
                          loading="lazy"
                        />
                      )}
                      {m.nickname ?? m.githubId}
                    </Td>
                    <Td className="text-xs text-base-600">{m.githubId}</Td>
                    <Td className="text-xs text-base-500">{m.cohorts.map((c) => c.cohort).join(', ') || '—'}</Td>
                    <Td className="text-xs text-base-600">{m._count.submissions}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        )}
      </div>

      {selectedMemberId && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-base-700">
              {memberDetail?.nickname ?? memberDetail?.githubId}의 PR{' '}
              {!detailLoading && <span className="text-base-400 font-normal">({filteredSubmissions.length}개)</span>}
            </h2>
            <div className="flex gap-1">
              {(['', 'open', 'merged', 'closed'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded border ${
                    statusFilter === s
                      ? 'bg-base-800 text-white border-base-800'
                      : 'border-base-300 text-base-600 hover:border-base-400'
                  }`}
                >
                  {s || '전체'}
                </button>
              ))}
            </div>
          </div>

          {detailLoading ? (
            <div className="py-8 text-center text-base-400 text-sm">로딩 중...</div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-8 text-center text-base-400 text-sm">PR 없음</div>
          ) : (
            <TableFrame>
              <Table>
                <THead>
                  <tr>
                    <Th>레포</Th>
                    <Th>PR 제목</Th>
                    <Th>상태</Th>
                    <Th>제출일</Th>
                  </tr>
                </THead>
                <TBody>
                  {filteredSubmissions.map((s: Submission) => (
                    <tr key={s.id} className="hover:bg-base-50">
                      <Td className="text-xs text-base-600">
                        {s.missionRepo.name}
                        {s.missionRepo.track && <span className="text-base-400 ml-1">({s.missionRepo.track})</span>}
                      </Td>
                      <Td>
                        <a
                          href={s.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:underline"
                        >
                          #{s.prNumber} {s.title}
                        </a>
                      </Td>
                      <Td>{statusBadge(s.status)}</Td>
                      <Td className="text-xs text-base-500">{new Date(s.submittedAt).toLocaleDateString('ko-KR')}</Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          )}
        </div>
      )}
    </div>
  );
}
