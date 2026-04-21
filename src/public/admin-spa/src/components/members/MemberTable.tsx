import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { showToast } from '../ui/Toast.js';
import Modal from '../ui/Modal.js';
import CohortRoleBadges from './CohortRoleBadges.js';
import type { Member, BlogPost, MemberCohort } from '../../lib/types.js';

type SortKey = 'nickname' | 'cohort' | 'githubId' | '_count.submissions' | '_count.blogPosts';

interface Props {
  members: Member[];
  onRefresh: () => void;
}

interface CohortEditModal {
  member: Member;
}

export default function MemberTable({ members, onRefresh }: Props) {
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>('cohort');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [blogModal, setBlogModal] = useState<{ member: Member; posts: BlogPost[] } | null>(null);
  const [cohortModal, setCohortModal] = useState<CohortEditModal | null>(null);
  const [newCohortInput, setNewCohortInput] = useState('');
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const getValue = (m: Member, key: SortKey): unknown => {
    if (key === '_count.submissions') return m._count.submissions;
    if (key === '_count.blogPosts') return m._count.blogPosts;
    return m[key as keyof Member];
  };

  const sorted = [...members].sort((a, b) => {
    const av = getValue(a, sortKey);
    const bv = getValue(b, sortKey);
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const refreshProfile = async (member: Member) => {
    setRefreshing(member.id);
    try {
      await apiFetch(`/admin/members/${member.id}/refresh-profile`, { method: 'POST' });
      showToast(`${member.githubId} 새로고침 완료`);
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '새로고침 실패', 'error');
    } finally {
      setRefreshing(null);
    }
  };

  const deleteMember = async (member: Member) => {
    if (!confirm(`${member.githubId} 삭제하시겠습니까?`)) return;
    setDeleting(member.id);
    try {
      await apiFetch(`/admin/members/${member.id}`, { method: 'DELETE' });
      showToast('삭제 완료');
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const openBlogModal = async (member: Member) => {
    try {
      const posts = await apiFetch<BlogPost[]>(`/admin/members/${member.id}/blog-posts`);
      setBlogModal({ member, posts });
    } catch {
      showToast('블로그 포스트 로딩 실패', 'error');
    }
  };

  const deleteCohortMutation = useMutation({
    mutationFn: ({ memberId, cohort }: { memberId: number; cohort: number }) =>
      apiFetch(`/admin/members/${memberId}/cohorts/${cohort}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      onRefresh();
      showToast('기수 삭제 완료');
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '기수 삭제 실패', 'error'),
  });

  const addCohortMutation = useMutation({
    mutationFn: ({ memberId, cohort }: { memberId: number; cohort: number }) =>
      apiFetch(`/admin/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ cohort }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      onRefresh();
      setNewCohortInput('');
      showToast('기수 추가 완료');
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '기수 추가 실패', 'error'),
  });

  const handleAddCohort = () => {
    if (!cohortModal) return;
    const cohort = Number(newCohortInput);
    if (!cohort || isNaN(cohort)) {
      showToast('유효한 기수를 입력하세요', 'error');
      return;
    }
    addCohortMutation.mutate({ memberId: cohortModal.member.id, cohort });
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="text-left text-xs font-medium text-gray-500 px-3 py-2 cursor-pointer hover:text-gray-700 whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-8">#</th>
              <SortHeader label="닉네임" k="nickname" />
              <SortHeader label="GitHub" k="githubId" />
              <SortHeader label="기수/역할" k="cohort" />
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">블로그</th>
              <SortHeader label="제출" k="_count.submissions" />
              <SortHeader label="포스트" k="_count.blogPosts" />
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-400 text-xs">{m.id}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {m.avatarUrl && (
                      <img src={m.avatarUrl} className="w-6 h-6 rounded-full" alt="" loading="lazy" />
                    )}
                    <span className="font-medium text-gray-900">{m.nickname ?? m.githubId}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`https://github.com/${m.githubId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    {m.githubId}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => { setNewCohortInput(''); setCohortModal({ member: m }); }}
                    className="hover:opacity-70 transition-opacity"
                    title="기수/역할 편집"
                  >
                    <CohortRoleBadges cohorts={m.cohorts} />
                  </button>
                </td>
                <td className="px-3 py-2">
                  {m.blog ? (
                    <button
                      onClick={() => openBlogModal(m)}
                      className="text-xs text-blue-600 hover:underline max-w-[160px] truncate block text-left"
                      title={m.blog}
                    >
                      {m.blog.replace(/^https?:\/\//, '')}
                    </button>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 text-xs">{m._count.submissions}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{m._count.blogPosts}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => void refreshProfile(m)}
                      disabled={refreshing === m.id}
                      className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-40 px-1"
                      title="프로필 새로고침"
                    >
                      {refreshing === m.id ? '⟳' : '↺'}
                    </button>
                    <button
                      onClick={() => void deleteMember(m)}
                      disabled={deleting === m.id}
                      className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 px-1"
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">멤버 없음</div>
        )}
      </div>

      {/* 블로그 모달 */}
      <Modal
        open={!!blogModal}
        onClose={() => setBlogModal(null)}
        title={`${blogModal?.member.githubId} 블로그 포스트`}
      >
        {blogModal && (
          <div className="space-y-2">
            {blogModal.posts.length === 0 ? (
              <p className="text-gray-400 text-sm">포스트 없음</p>
            ) : (
              blogModal.posts.map((p) => (
                <div key={p.id} className="border border-gray-100 rounded p-2">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {p.title}
                  </a>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(p.publishedAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* 기수 편집 모달 */}
      <Modal
        open={!!cohortModal}
        onClose={() => setCohortModal(null)}
        title={`${cohortModal?.member.githubId} 기수 편집`}
      >
        {cohortModal && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">현재 기수</p>
              {cohortModal.member.cohorts.length === 0 ? (
                <p className="text-xs text-gray-400">기수 없음</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cohortModal.member.cohorts.map((c: MemberCohort) => (
                    <span
                      key={c.cohort}
                      className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded px-2 py-1"
                    >
                      {c.cohort}기
                      {c.roles.length > 0 && (
                        <span className="text-blue-400">({c.roles.join(', ')})</span>
                      )}
                      <button
                        onClick={() =>
                          deleteCohortMutation.mutate({
                            memberId: cohortModal.member.id,
                            cohort: c.cohort,
                          })
                        }
                        disabled={deleteCohortMutation.isPending}
                        className="hover:text-red-500 ml-0.5 disabled:opacity-40"
                        title="기수 삭제"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">기수 추가</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newCohortInput}
                  onChange={(e) => setNewCohortInput(e.target.value)}
                  placeholder="예: 9"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCohort(); }}
                />
                <button
                  onClick={handleAddCohort}
                  disabled={addCohortMutation.isPending || !newCohortInput}
                  className="bg-blue-600 text-white text-sm rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
