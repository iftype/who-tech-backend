import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { showToast } from '../ui/Toast.js';
import Modal from '../ui/Modal.js';
import type { Member, BlogPost, MemberCohort, Submission } from '../../lib/types.js';

type SortKey = 'nickname' | 'cohort' | 'githubId' | '_count.submissions' | '_count.blogPosts';

interface Props {
  members: Member[];
  onRefresh: () => void;
}

const TRACK_OPTIONS = ['', 'frontend', 'backend', 'android'] as const;
const ROLE_OPTIONS = ['crew', 'coach', 'reviewer'] as const;
const ROLE_LABELS: Record<string, string> = { crew: '크루', coach: '코치', reviewer: '리뷰어' };

const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY = (id: number) => `profile-refresh-cooldown-${id}`;

function loadCooldowns(): Record<number, number> {
  const now = Date.now();
  const result: Record<number, number> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('profile-refresh-cooldown-')) {
      const id = Number(key.replace('profile-refresh-cooldown-', ''));
      const ts = Number(localStorage.getItem(key));
      const remaining = Math.ceil((ts + COOLDOWN_MS - now) / 1000);
      if (remaining > 0) result[id] = remaining;
      else localStorage.removeItem(key);
    }
  }
  return result;
}

export default function MemberTable({ members, onRefresh }: Props) {
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>('cohort');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [blogModal, setBlogModal] = useState<{ member: Member; posts: BlogPost[] } | null>(null);
  const [prModal, setPrModal] = useState<{ member: Member; submissions: Submission[] } | null>(null);
  const [cohortModal, setCohortModal] = useState<Member | null>(null);
  const [newCohortInput, setNewCohortInput] = useState('');
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [recalculating, setRecalculating] = useState<number | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<number, number>>(loadCooldowns);

  const [editCell, setEditCell] = useState<{ memberId: number; field: 'manualNickname' | 'blog' | 'track' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const editSelectRef = useRef<HTMLSelectElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: number; data: Record<string, unknown> }) =>
      apiFetch(`/admin/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      onRefresh();
      showToast('수정 완료');
      setEditCell(null);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '수정 실패', 'error'),
  });

  const updateCohortRolesMutation = useMutation({
    mutationFn: ({ memberId, cohort, roles }: { memberId: number; cohort: number; roles: string[] }) =>
      apiFetch(`/admin/members/${memberId}`, { method: 'PATCH', body: JSON.stringify({ cohort, roles }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      onRefresh();
      showToast('역할 수정 완료');
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '역할 수정 실패', 'error'),
  });

  const startEdit = useCallback((member: Member, field: 'manualNickname' | 'blog' | 'track') => {
    setEditCell({ memberId: member.id, field });
    if (field === 'manualNickname') setEditValue(member.manualNickname ?? '');
    else if (field === 'blog') setEditValue(member.blog ?? '');
    else if (field === 'track') setEditValue(member.track ?? '');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editCell) return;
    const data: Record<string, unknown> = {};
    if (editCell.field === 'track') data.track = editValue || null;
    else data[editCell.field] = editValue || null;
    updateMemberMutation.mutate({ memberId: editCell.memberId, data });
  }, [editCell, editValue, updateMemberMutation]);

  const cancelEdit = useCallback(() => { setEditCell(null); setEditValue(''); }, []);

  useEffect(() => {
    if (!editCell) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (editContainerRef.current && !editContainerRef.current.contains(e.target as Node)) saveEdit();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editCell, saveEdit]);

  useEffect(() => {
    if (editCell?.field === 'manualNickname' || editCell?.field === 'blog') {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    } else if (editCell?.field === 'track') editSelectRef.current?.focus();
  }, [editCell]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCooldowns((prev) => {
        const next: Record<number, number> = {};
        for (const [idStr] of Object.entries(prev)) {
          const id = Number(idStr);
          const key = COOLDOWN_KEY(id);
          const ts = Number(localStorage.getItem(key) ?? 0);
          const remaining = Math.ceil((ts + COOLDOWN_MS - now) / 1000);
          if (remaining > 0) next[id] = remaining;
          else localStorage.removeItem(key);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

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
    const remaining = cooldowns[member.id];
    if (remaining && remaining > 0) {
      showToast(`${remaining}초 후에 다시 시도해주세요`, 'error');
      return;
    }
    setRefreshing(member.id);
    try {
      await apiFetch(`/admin/members/${member.id}/refresh-profile`, { method: 'POST' });
      localStorage.setItem(COOLDOWN_KEY(member.id), String(Date.now()));
      setCooldowns((prev) => ({ ...prev, [member.id]: Math.ceil(COOLDOWN_MS / 1000) }));
      showToast(`${member.githubId} 새로고침 완료`);
      onRefresh();
    } catch (e) {
      const err = e as Error & { remainingSeconds?: number };
      if (err.remainingSeconds && err.remainingSeconds > 0) {
        localStorage.setItem(COOLDOWN_KEY(member.id), String(Date.now()));
        setCooldowns((prev) => ({ ...prev, [member.id]: err.remainingSeconds! }));
        showToast(`${err.remainingSeconds}초 후에 다시 시도해주세요`, 'error');
      } else {
        showToast(err.message || '새로고침 실패', 'error');
      }
    } finally { setRefreshing(null); }
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
    } finally { setDeleting(null); }
  };

  const recalculateCohorts = async (member: Member) => {
    if (!confirm(`${member.githubId}의 기수를 submissions 기준으로 재계산합니다. 계속하시겠습니까?`)) return;
    setRecalculating(member.id);
    try {
      await apiFetch(`/admin/members/${member.id}/recalculate-cohorts`, { method: 'POST' });
      showToast('기수 재계산 완료');
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '기수 재계산 실패', 'error');
    } finally { setRecalculating(null); }
  };

  const openBlogModal = async (member: Member) => {
    try {
      const posts = await apiFetch<BlogPost[]>(`/admin/members/${member.id}/blog-posts`);
      setBlogModal({ member, posts });
    } catch { showToast('블로그 포스트 로딩 실패', 'error'); }
  };

  const openPRModal = async (member: Member) => {
    if (member._count.submissions === 0) { showToast('제출 내역이 없습니다', 'error'); return; }
    try {
      const detail = await apiFetch<Member>(`/admin/members/${member.id}`);
      setPrModal({ member: detail, submissions: detail.submissions ?? [] });
    } catch { showToast('PR 로딩 실패', 'error'); }
  };

  const deleteCohortMutation = useMutation({
    mutationFn: ({ memberId, cohort }: { memberId: number; cohort: number }) =>
      apiFetch(`/admin/members/${memberId}/cohorts/${cohort}`, { method: 'DELETE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['members'] }); onRefresh(); showToast('기수 삭제 완료'); },
    onError: (e) => showToast(e instanceof Error ? e.message : '기수 삭제 실패', 'error'),
  });

  const addCohortMutation = useMutation({
    mutationFn: ({ memberId, cohort }: { memberId: number; cohort: number }) =>
      apiFetch(`/admin/members/${memberId}`, { method: 'PATCH', body: JSON.stringify({ cohort }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['members'] }); onRefresh(); setNewCohortInput(''); showToast('기수 추가 완료'); },
    onError: (e) => showToast(e instanceof Error ? e.message : '기수 추가 실패', 'error'),
  });

  const handleAddCohort = () => {
    if (!cohortModal) return;
    const cohort = Number(newCohortInput);
    if (!cohort || isNaN(cohort)) { showToast('유효한 기수를 입력하세요', 'error'); return; }
    addCohortMutation.mutate({ memberId: cohortModal.id, cohort });
  };

  const toggleCohortRole = (memberId: number, cohort: number, currentRoles: string[], role: string) => {
    const next = currentRoles.includes(role) ? currentRoles.filter((r) => r !== role) : [...currentRoles, role];
    updateCohortRolesMutation.mutate({ memberId, cohort, roles: next });
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="text-left text-[11px] font-medium text-gray-500 px-1.5 py-1 cursor-pointer hover:text-gray-700 whitespace-nowrap" onClick={() => toggleSort(k)}>
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <>
      <div className="overflow-x-auto rounded border border-gray-200 max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left text-[11px] font-medium text-gray-500 px-1.5 py-1">프로필</th>
              <th className="text-left text-[11px] font-medium text-gray-500 px-1.5 py-1">기수/역할</th>
              <th className="text-left text-[11px] font-medium text-gray-500 px-1.5 py-1">트랙</th>
              <th className="text-left text-[11px] font-medium text-gray-500 px-1.5 py-1">블로그</th>
              <th className="text-left text-[11px] font-medium text-gray-500 px-1.5 py-1 w-6">RSS</th>
              <SortHeader label="제출" k="_count.submissions" />
              <SortHeader label="글" k="_count.blogPosts" />
              <th className="text-left text-[11px] font-medium text-gray-500 px-1.5 py-1">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-1.5 py-1">
                  <div className="flex items-center gap-1.5">
                    {m.avatarUrl && <img src={m.avatarUrl} className="w-5 h-5 rounded-full flex-shrink-0" alt="" loading="lazy" />}
                    <div className="min-w-0">
                      {editCell?.memberId === m.id && editCell.field === 'manualNickname' ? (
                        <div ref={editContainerRef}>
                          <input ref={editInputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown}
                            className="border border-blue-400 rounded px-1.5 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="닉네임" disabled={updateMemberMutation.isPending} />
                        </div>
                      ) : (
                        <button onClick={() => startEdit(m, 'manualNickname')} className="font-medium text-gray-900 hover:text-blue-600 text-xs text-left truncate max-w-[80px] block" title={`${m.manualNickname ?? m.nickname ?? m.githubId} (${m.githubId})`}>
                          {m.manualNickname ?? m.nickname ?? m.githubId}
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-1.5 py-1">
                  <button onClick={() => { setNewCohortInput(''); setCohortModal(m); }} className="hover:opacity-70 transition-opacity text-left" title="기수/역할 편집">
                    {m.cohorts.length === 0 ? <span className="text-gray-300 text-[10px]">—</span> : (
                      <div className="flex flex-wrap gap-0.5">
                        {m.cohorts.map((c) => (
                          <span key={c.cohort} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1 py-0 whitespace-nowrap">
                            {c.cohort}기{c.roles.length > 0 && <span className="text-blue-400 ml-0.5">({c.roles.map((r) => ROLE_LABELS[r] ?? r).join(',')})</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </td>
                <td className="px-1.5 py-1">
                  {editCell?.memberId === m.id && editCell.field === 'track' ? (
                    <div ref={editContainerRef}>
                      <select ref={editSelectRef} value={editValue} onChange={(e) => { setEditValue(e.target.value); const data: Record<string, unknown> = { track: e.target.value || null }; updateMemberMutation.mutate({ memberId: m.id, data }); }} onKeyDown={handleKeyDown}
                        className="border border-blue-400 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 w-16" disabled={updateMemberMutation.isPending}>
                        {TRACK_OPTIONS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
                      </select>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(m, 'track')} className={`text-[10px] px-1 py-0 rounded border whitespace-nowrap ${m.track ? 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200' : 'text-gray-300 border-transparent hover:text-blue-600'}`} title="트랙 편집">{m.track || '—'}</button>
                  )}
                </td>
                <td className="px-1.5 py-1">
                  {editCell?.memberId === m.id && editCell.field === 'blog' ? (
                    <div ref={editContainerRef}>
                      <input ref={editInputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown}
                        className="border border-blue-400 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="블로그 URL" disabled={updateMemberMutation.isPending} />
                    </div>
                  ) : m.blog ? (
                    <button onClick={() => startEdit(m, 'blog')} className="text-[10px] text-blue-600 hover:underline truncate block text-left max-w-[100px]" title={m.blog}>{m.blog.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</button>
                  ) : (
                    <button onClick={() => startEdit(m, 'blog')} className="text-gray-300 text-[10px] hover:text-blue-600" title="블로그 추가">—</button>
                  )}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {m.rssStatus === 'ok' ? (
                    <span className="text-[10px] text-green-600" title="RSS 정상">✅</span>
                  ) : m.rssStatus === 'error' ? (
                    <span className="text-[10px] text-red-500" title="RSS 오류">❌</span>
                  ) : (
                    <span className="text-[10px] text-gray-300" title="RSS 미설정">—</span>
                  )}
                </td>
                <td className="px-1.5 py-1 text-center">
                  <button onClick={() => void openPRModal(m)} className="text-[10px] text-gray-600 hover:text-blue-600 font-medium" title="PR 확인">{m._count.submissions}</button>
                </td>
                <td className="px-1.5 py-1 text-center">
                  <button onClick={() => void openBlogModal(m)} className="text-[10px] text-gray-600 hover:text-blue-600" title="블로그 글 보기">{m._count.blogPosts}</button>
                </td>
                <td className="px-1.5 py-1">
                  <div className="flex gap-0.5">
                    <button onClick={() => void refreshProfile(m)} disabled={refreshing === m.id || !!(cooldowns[m.id] && cooldowns[m.id] > 0)} className="text-[10px] text-gray-500 hover:text-blue-600 disabled:opacity-40 px-0.5 min-w-[20px]" title={cooldowns[m.id] ? `${cooldowns[m.id]}초 후 가능` : '프로필 새로고침'}>{refreshing === m.id ? '⟳' : cooldowns[m.id] ? `${cooldowns[m.id]}s` : '↺'}</button>
                    <button onClick={() => void recalculateCohorts(m)} disabled={recalculating === m.id} className="text-[10px] text-gray-500 hover:text-amber-600 disabled:opacity-40 px-0.5" title="기수 재계산">{recalculating === m.id ? '⟳' : '⚡'}</button>
                    <button onClick={() => void deleteMember(m)} disabled={deleting === m.id} className="text-[10px] text-gray-400 hover:text-red-500 disabled:opacity-40 px-0.5" title="삭제">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <div className="py-12 text-center text-gray-400 text-sm">멤버 없음</div>}
      </div>

      <Modal open={!!prModal} onClose={() => setPrModal(null)} title={`${prModal?.member.nickname ?? prModal?.member.githubId} 제출 내역`}>
        {prModal && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {prModal.submissions.length === 0 ? <p className="text-gray-400 text-sm">제출 내역 없음</p> : prModal.submissions.map((s) => (
              <div key={s.id} className="border border-gray-100 rounded p-2">
                <div className="flex items-center gap-2">
                  <a href={s.prUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">#{s.prNumber} {s.title}</a>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${s.status === 'merged' ? 'bg-purple-100 text-purple-700 border-purple-200' : s.status === 'open' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{s.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{s.missionRepo.name} · {new Date(s.submittedAt).toLocaleDateString('ko-KR')}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!blogModal} onClose={() => setBlogModal(null)} title={`${blogModal?.member.githubId} 블로그 포스트`}>
        {blogModal && (
          <div className="space-y-2">
            {blogModal.posts.length === 0 ? <p className="text-gray-400 text-sm">포스트 없음</p> : blogModal.posts.map((p) => (
              <div key={p.id} className="border border-gray-100 rounded p-2">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{p.title}</a>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(p.publishedAt).toLocaleDateString('ko-KR')}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!cohortModal} onClose={() => setCohortModal(null)} title={`${cohortModal?.githubId} 기수/역할`}>
        {cohortModal && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-2">현재 기수</p>
              {cohortModal.cohorts.length === 0 ? <p className="text-xs text-gray-400">기수 없음</p> : (
                <div className="space-y-1.5">
                  {cohortModal.cohorts.map((c: MemberCohort) => (
                    <div key={c.cohort} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                      <span className="text-xs font-semibold text-gray-700 w-8">{c.cohort}기</span>
                      <div className="flex gap-1 flex-wrap">
                        {ROLE_OPTIONS.map((role) => (
                          <button
                            key={role}
                            onClick={() => toggleCohortRole(cohortModal.id, c.cohort, c.roles, role)}
                            disabled={updateCohortRolesMutation.isPending}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${c.roles.includes(role) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                          >
                            {ROLE_LABELS[role]}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => deleteCohortMutation.mutate({ memberId: cohortModal.id, cohort: c.cohort })} disabled={deleteCohortMutation.isPending}
                        className="text-[10px] text-gray-400 hover:text-red-500 ml-auto disabled:opacity-40" title="기수 삭제">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">기수 추가</p>
              <div className="flex gap-2">
                <input type="number" value={newCohortInput} onChange={(e) => setNewCohortInput(e.target.value)} placeholder="예: 9"
                  className="border border-gray-300 rounded px-2 py-1 text-xs w-20" onKeyDown={(e) => { if (e.key === 'Enter') handleAddCohort(); }} />
                <button onClick={handleAddCohort} disabled={addCohortMutation.isPending || !newCohortInput}
                  className="bg-blue-600 text-white text-xs rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-40">추가</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
