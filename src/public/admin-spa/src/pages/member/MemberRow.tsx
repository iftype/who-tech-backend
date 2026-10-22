import type { Member } from '../../lib/types.js';
import { Td, Tr } from '../../components/ui/Table.js';
import { TRACK_OPTIONS } from './member-labels.js';
import { CohortPills, RssStatusIcon } from './MemberCells.js';
import { MemberRowActions } from './MemberRowActions.js';
import type { MemberActions } from './useMemberActions.js';
import type { MemberInlineEdit } from './useMemberInlineEdit.js';

interface Props {
  member: Member;
  edit: MemberInlineEdit;
  actions: MemberActions;
  onOpenCohorts: (member: Member) => void;
  onOpenSubmissions: (member: Member) => void;
  onOpenBlogPosts: (member: Member) => void;
}

export function MemberRow({ member: m, edit, actions, onOpenCohorts, onOpenSubmissions, onOpenBlogPosts }: Props) {
  return (
    <Tr>
      <Td density="compact">
        <div className="flex items-center gap-1.5">
          {m.avatarUrl && (
            <img src={m.avatarUrl} className="w-5 h-5 rounded-full flex-shrink-0" alt="" loading="lazy" />
          )}
          <div className="min-w-0">
            {edit.isEditing(m.id, 'manualNickname') ? (
              <div ref={edit.containerRef}>
                <input
                  ref={edit.inputRef}
                  type="text"
                  value={edit.editValue}
                  onChange={(e) => edit.setEditValue(e.target.value)}
                  onKeyDown={edit.handleKeyDown}
                  className="border border-primary-400 rounded px-1.5 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="닉네임"
                  disabled={edit.isSaving}
                />
              </div>
            ) : (
              <button
                onClick={() => edit.startEdit(m, 'manualNickname')}
                className="font-medium text-base-900 hover:text-primary-600 text-xs text-left truncate max-w-[80px] block"
                title={`${m.manualNickname ?? m.nickname ?? m.githubId} (${m.githubId})`}
              >
                {m.manualNickname ?? m.nickname ?? m.githubId}
              </button>
            )}
          </div>
        </div>
      </Td>
      <Td density="compact">
        <button
          onClick={() => onOpenCohorts(m)}
          className="hover:opacity-70 transition-opacity text-left"
          title="기수/역할 편집"
        >
          <CohortPills cohorts={m.cohorts} />
        </button>
      </Td>
      <Td density="compact">
        {edit.isEditing(m.id, 'track') ? (
          <div ref={edit.containerRef}>
            <select
              ref={edit.selectRef}
              value={edit.editValue}
              onChange={(e) => {
                edit.setEditValue(e.target.value);
                edit.saveNow(m.id, { track: e.target.value || null });
              }}
              onKeyDown={edit.handleKeyDown}
              className="border border-primary-400 rounded px-1 py-0.5 text-2xs focus:outline-none focus:ring-1 focus:ring-primary-500 w-16"
              disabled={edit.isSaving}
            >
              {TRACK_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t || '—'}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <button
            onClick={() => edit.startEdit(m, 'track')}
            className={`text-2xs px-1 py-0 rounded border whitespace-nowrap ${m.track ? 'bg-base-100 text-base-700 border-base-200 hover:bg-base-200' : 'text-base-300 border-transparent hover:text-primary-600'}`}
            title="트랙 편집"
          >
            {m.track || '—'}
          </button>
        )}
      </Td>
      <Td density="compact">
        {edit.isEditing(m.id, 'blog') ? (
          <div ref={edit.containerRef}>
            <input
              ref={edit.inputRef}
              type="text"
              value={edit.editValue}
              onChange={(e) => edit.setEditValue(e.target.value)}
              onKeyDown={edit.handleKeyDown}
              className="border border-primary-400 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="블로그 URL"
              disabled={edit.isSaving}
            />
          </div>
        ) : m.blog ? (
          <button
            onClick={() => edit.startEdit(m, 'blog')}
            className="text-2xs text-primary-600 hover:underline truncate block text-left max-w-[100px]"
            title={m.blog}
          >
            {m.blog.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </button>
        ) : (
          <button
            onClick={() => edit.startEdit(m, 'blog')}
            className="text-base-300 text-2xs hover:text-primary-600"
            title="블로그 추가"
          >
            —
          </button>
        )}
      </Td>
      <Td density="compact" className="text-center">
        <RssStatusIcon status={m.rssStatus} />
      </Td>
      <Td density="compact" className="text-center">
        <button
          onClick={() => onOpenSubmissions(m)}
          className="text-2xs text-base-600 hover:text-primary-600 font-medium"
          title="PR 확인"
          aria-label="PR 확인"
        >
          {m._count.submissions}
        </button>
      </Td>
      <Td density="compact" className="text-center">
        <button
          onClick={() => onOpenBlogPosts(m)}
          className="text-2xs text-base-600 hover:text-primary-600"
          title="블로그 글 보기"
          aria-label="블로그 글 보기"
        >
          {m._count.blogPosts}
        </button>
      </Td>
      <Td density="compact">
        <MemberRowActions member={m} actions={actions} />
      </Td>
    </Tr>
  );
}
