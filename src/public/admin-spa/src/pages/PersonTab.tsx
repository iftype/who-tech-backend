import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { Person, Member } from '../lib/types.js';

export default function PersonTab() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [linkingPersonId, setLinkingPersonId] = useState<number | null>(null);
  const [linkMemberId, setLinkMemberId] = useState('');

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ['persons'],
    queryFn: () => apiFetch<Person[]>('/admin/persons'),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', 'person-link'],
    queryFn: () => apiFetch<Member[]>('/admin/members'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<Person>('/admin/persons', {
        method: 'POST',
        body: JSON.stringify({ displayName: newName, note: newNote }),
      }),
    onSuccess: () => {
      setNewName('');
      setNewNote('');
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '생성 실패', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/persons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '삭제 실패', 'error'),
  });

  const linkMutation = useMutation({
    mutationFn: ({ personId, memberId }: { personId: number; memberId: number }) =>
      apiFetch(`/admin/persons/${personId}/members/${memberId}`, { method: 'POST' }),
    onSuccess: () => {
      setLinkingPersonId(null);
      setLinkMemberId('');
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '연결 실패', 'error'),
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ personId, memberId }: { personId: number; memberId: number }) =>
      apiFetch(`/admin/persons/${personId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '해제 실패', 'error'),
  });

  const unlinkedMembers = members.filter(
    (m) => !persons.some((p) => p.members.some((pm) => pm.id === m.id)),
  );

  if (isLoading) {
    return <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Person 생성</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="표시 이름"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="메모 (선택)"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!newName.trim() || createMutation.isPending}
            className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
          >
            생성
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Person 목록 ({persons.length})</h2>
        <div className="space-y-3">
          {persons.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{p.displayName ?? '(이름 없음)'}</span>
                  {p.note && <span className="text-xs text-gray-500 ml-2">{p.note}</span>}
                </div>
                <button
                  onClick={() => {
                    if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(p.id);
                  }}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  삭제
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {p.members.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded px-2 py-1"
                  >
                    {m.avatarUrl && (
                      <img src={m.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                    )}
                    {m.nickname ?? m.githubId}
                    <button
                      onClick={() => unlinkMutation.mutate({ personId: p.id, memberId: m.id })}
                      className="hover:text-red-500 ml-0.5"
                      title="연결 해제"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => {
                    setLinkingPersonId(linkingPersonId === p.id ? null : p.id);
                    setLinkMemberId('');
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + 멤버 연결
                </button>
              </div>

              {linkingPersonId === p.id && (
                <div className="flex gap-2 items-center">
                  <select
                    value={linkMemberId}
                    onChange={(e) => setLinkMemberId(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="">멤버 선택</option>
                    {unlinkedMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nickname ?? m.githubId} ({m.githubId})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const mid = Number(linkMemberId);
                      if (mid) linkMutation.mutate({ personId: p.id, memberId: mid });
                    }}
                    disabled={!linkMemberId}
                    className="bg-blue-600 text-white text-xs rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-40"
                  >
                    연결
                  </button>
                </div>
              )}
            </div>
          ))}
          {persons.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">Person 없음</div>
          )}
        </div>
      </section>
    </div>
  );
}
