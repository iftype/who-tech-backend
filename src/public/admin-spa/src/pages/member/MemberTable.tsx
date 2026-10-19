import { useState } from 'react';

import { showToast } from '../../components/ui/Toast.js';
import type { Member } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { useSortableData } from '../../hooks/useSortableData.js';
import { Table, TableFrame, TBody, THead, Th } from '../../components/ui/Table.js';
import { EmptyState } from '../../components/ui/Section.js';
import { MemberRow } from './MemberRow.js';
import { MemberBlogPostsModal, type BlogPostsModalState } from './MemberBlogPostsModal.js';
import { MemberCohortModal } from './MemberCohortModal.js';
import { MemberSubmissionsModal, type SubmissionsModalState } from './MemberSubmissionsModal.js';
import { useMemberActions } from './useMemberActions.js';
import { useMemberInlineEdit } from './useMemberInlineEdit.js';

type SortKey = 'nickname' | 'cohort' | 'githubId' | '_count.submissions' | '_count.blogPosts';

interface Props {
  members: Member[];
  onRefresh: () => void;
}

const getSortValue = (m: Member, key: SortKey): unknown => {
  if (key === '_count.submissions') return m._count.submissions;
  if (key === '_count.blogPosts') return m._count.blogPosts;
  return m[key as keyof Member];
};

// 렌더 안에서 만들면 다시 그릴 때마다 머리 칸이 새로 붙어 클릭이 사라질 수 있어 밖에 둔다
function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <Th density="compact" size="11" className="cursor-pointer hover:text-base-700 whitespace-nowrap" onClick={onClick}>
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : ''}
    </Th>
  );
}

export function MemberTable({ members, onRefresh }: Props) {
  const { sorted, sortKey, sortDir, toggle } = useSortableData(members, {
    initialKey: 'cohort' as SortKey,
    initialDir: 'desc',
    getValue: getSortValue,
  });
  const edit = useMemberInlineEdit();
  const actions = useMemberActions(onRefresh);
  const [blogModal, setBlogModal] = useState<BlogPostsModalState | null>(null);
  const [prModal, setPrModal] = useState<SubmissionsModalState | null>(null);
  const [cohortModal, setCohortModal] = useState<Member | null>(null);

  const openBlogModal = async (member: Member) => {
    try {
      const result = await adminApi.members.blogPosts(member.id);
      setBlogModal({ member, posts: [...result.latest, ...result.archive] });
    } catch {
      showToast('블로그 포스트 로딩 실패', 'error');
    }
  };

  const openPRModal = async (member: Member) => {
    if (member._count.submissions === 0) {
      showToast('제출 내역이 없습니다', 'error');
      return;
    }
    try {
      const detail = await adminApi.members.detail(member.id);
      setPrModal({ member: detail, submissions: detail.submissions ?? [] });
    } catch {
      showToast('PR 로딩 실패', 'error');
    }
  };

  const sortHeader = (label: string, k: SortKey) => (
    <SortHeader label={label} active={sortKey === k} dir={sortDir} onClick={() => toggle(k)} />
  );

  return (
    <>
      <TableFrame className="max-h-[60vh] overflow-y-auto">
        <Table size="xs">
          <THead className="sticky top-0 z-10">
            <tr>
              <Th density="compact" size="11">
                프로필
              </Th>
              <Th density="compact" size="11">
                기수/역할
              </Th>
              <Th density="compact" size="11">
                트랙
              </Th>
              <Th density="compact" size="11">
                블로그
              </Th>
              <Th density="compact" size="11" className="w-6">
                RSS
              </Th>
              {sortHeader('제출', '_count.submissions')}
              {sortHeader('글', '_count.blogPosts')}
              <Th density="compact" size="11">
                작업
              </Th>
            </tr>
          </THead>
          <TBody>
            {sorted.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                edit={edit}
                actions={actions}
                onOpenCohorts={setCohortModal}
                onOpenSubmissions={(member) => void openPRModal(member)}
                onOpenBlogPosts={(member) => void openBlogModal(member)}
              />
            ))}
          </TBody>
        </Table>
        {sorted.length === 0 && <EmptyState>멤버 없음</EmptyState>}
      </TableFrame>

      <MemberSubmissionsModal state={prModal} onChange={setPrModal} onRefresh={onRefresh} />
      <MemberBlogPostsModal state={blogModal} onClose={() => setBlogModal(null)} />
      {cohortModal && <MemberCohortModal member={cohortModal} onChange={setCohortModal} onRefresh={onRefresh} />}
    </>
  );
}
