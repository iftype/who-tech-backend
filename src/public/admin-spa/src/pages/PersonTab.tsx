import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Button } from '../components/ui/Button.js';
import { Select, TextInput } from '../components/ui/Field.js';
import { EmptyState, ErrorState, Panel, SectionTitle } from '../components/ui/Section.js';

export default function PersonTab() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [linkingPersonId, setLinkingPersonId] = useState<number | null>(null);
  const [linkMemberId, setLinkMemberId] = useState('');

  const {
    data: persons = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.persons(),
    queryFn: () => adminApi.persons.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.members.personLink(),
    queryFn: () => adminApi.members.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.persons.create({ displayName: newName, note: newNote }),
    onSuccess: () => {
      setNewName('');
      setNewNote('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons() });
    },
    meta: { errorMessage: '생성 실패' },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.persons.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons() });
    },
    meta: { errorMessage: '삭제 실패' },
  });

  const linkMutation = useMutation({
    mutationFn: ({ personId, memberId }: { personId: number; memberId: number }) =>
      adminApi.persons.linkMember(personId, memberId),
    onSuccess: () => {
      setLinkingPersonId(null);
      setLinkMemberId('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons() });
    },
    meta: { errorMessage: '연결 실패' },
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ personId, memberId }: { personId: number; memberId: number }) =>
      adminApi.persons.unlinkMember(personId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons() });
    },
    meta: { errorMessage: '해제 실패' },
  });

  const unlinkedMembers = members.filter((m) => !persons.some((p) => p.members.some((pm) => pm.id === m.id)));

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }
  if (isLoading) {
    return <EmptyState>로딩 중...</EmptyState>;
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle className="mb-3">Person 생성</SectionTitle>
        <div className="flex gap-2 flex-wrap">
          <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="표시 이름" />
          <TextInput
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="메모 (선택)"
            className="flex-1 min-w-[200px]"
          />
          <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>
            생성
          </Button>
        </div>
      </section>

      <section>
        <SectionTitle className="mb-3">Person 목록 ({persons.length})</SectionTitle>
        <div className="space-y-3">
          {persons.map((p) => (
            <Panel key={p.id} variant="card" className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-base-900">{p.displayName ?? '(이름 없음)'}</span>
                  {p.note && <span className="text-xs text-base-500 ml-2">{p.note}</span>}
                </div>
                <button
                  onClick={() => {
                    if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(p.id);
                  }}
                  className="text-xs text-base-400 hover:text-danger-500"
                >
                  삭제
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {p.members.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 bg-primary-50 border border-primary-200 text-primary-700 text-xs rounded px-2 py-1"
                  >
                    {m.avatarUrl && <img src={m.avatarUrl} className="w-4 h-4 rounded-full" alt="" />}
                    {m.nickname ?? m.githubId}
                    <button
                      onClick={() => unlinkMutation.mutate({ personId: p.id, memberId: m.id })}
                      className="hover:text-danger-500 ml-0.5"
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
                  className="text-xs text-primary-600 hover:underline"
                >
                  + 멤버 연결
                </button>
              </div>

              {linkingPersonId === p.id && (
                <div className="flex gap-2 items-center">
                  <Select value={linkMemberId} onChange={(e) => setLinkMemberId(e.target.value)} size="xs">
                    <option value="">멤버 선택</option>
                    {unlinkedMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nickname ?? m.githubId} ({m.githubId})
                      </option>
                    ))}
                  </Select>
                  <button
                    onClick={() => {
                      const mid = Number(linkMemberId);
                      if (mid) linkMutation.mutate({ personId: p.id, memberId: mid });
                    }}
                    disabled={!linkMemberId}
                    className="bg-primary-600 text-white text-xs rounded px-3 py-1 hover:bg-primary-700 disabled:opacity-40"
                  >
                    연결
                  </button>
                </div>
              )}
            </Panel>
          ))}
          {persons.length === 0 && <EmptyState size="md">Person 없음</EmptyState>}
        </div>
      </section>
    </div>
  );
}
