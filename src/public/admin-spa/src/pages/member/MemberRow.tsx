import type { Member } from '../../lib/types.js';
import { Td } from '../../components/ui/Table.js';
import { ROLE_LABELS, TRACK_OPTIONS } from './member-labels.js';
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
  const { cooldowns, refreshing, resyncing, recalculating } = actions;

  return (
    <tr className="hover:bg-base-50">
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
          {m.cohorts.length === 0 ? (
            <span className="text-base-300 text-[10px]">—</span>
          ) : (
            <div className="flex flex-wrap gap-0.5">
              {m.cohorts.map((c) => (
                <span
                  key={c.cohort}
                  className="text-[10px] bg-primary-50 text-primary-700 border border-primary-200 rounded px-1 py-0 whitespace-nowrap"
                >
                  {c.cohort}기
                  {c.roles.length > 0 && (
                    <span className="text-primary-400 ml-0.5">
                      ({c.roles.map((r) => ROLE_LABELS[r] ?? r).join(',')})
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
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
              className="border border-primary-400 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-500 w-16"
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
            className={`text-[10px] px-1 py-0 rounded border whitespace-nowrap ${m.track ? 'bg-base-100 text-base-700 border-base-200 hover:bg-base-200' : 'text-base-300 border-transparent hover:text-primary-600'}`}
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
            className="text-[10px] text-primary-600 hover:underline truncate block text-left max-w-[100px]"
            title={m.blog}
          >
            {m.blog.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </button>
        ) : (
          <button
            onClick={() => edit.startEdit(m, 'blog')}
            className="text-base-300 text-[10px] hover:text-primary-600"
            title="블로그 추가"
          >
            —
          </button>
        )}
      </Td>
      <Td density="compact" className="text-center">
        {m.rssStatus === 'ok' ? (
          <span className="text-[10px] text-success-600" title="RSS 정상">
            ✅
          </span>
        ) : m.rssStatus === 'error' ? (
          <span className="text-[10px] text-danger-500" title="RSS 오류">
            ❌
          </span>
        ) : (
          <span className="text-[10px] text-base-300" title="RSS 미설정">
            —
          </span>
        )}
      </Td>
      <Td density="compact" className="text-center">
        <button
          onClick={() => onOpenSubmissions(m)}
          className="text-[10px] text-base-600 hover:text-primary-600 font-medium"
          title="PR 확인"
        >
          {m._count.submissions}
        </button>
      </Td>
      <Td density="compact" className="text-center">
        <button
          onClick={() => onOpenBlogPosts(m)}
          className="text-[10px] text-base-600 hover:text-primary-600"
          title="블로그 글 보기"
        >
          {m._count.blogPosts}
        </button>
      </Td>
      <Td density="compact">
        <div className="flex gap-0.5">
          <button
            onClick={() => void actions.refreshProfile(m)}
            disabled={refreshing === m.id || !!(cooldowns[m.id] && cooldowns[m.id] > 0)}
            className="text-[10px] text-base-500 hover:text-primary-600 disabled:opacity-40 px-0.5 min-w-[20px]"
            title={cooldowns[m.id] ? `${cooldowns[m.id]}초 후 가능` : '프로필 새로고침'}
          >
            {refreshing === m.id ? '⟳' : cooldowns[m.id] ? `${cooldowns[m.id]}s` : '↺'}
          </button>
          <button
            onClick={() => void actions.resyncSubmissions(m)}
            disabled={resyncing === m.id}
            className="text-[10px] text-base-500 hover:text-success-600 disabled:opacity-40 px-0.5"
            title="PR 재수집"
          >
            {resyncing === m.id ? '⟳' : '↻'}
          </button>
          <button
            onClick={() => void actions.recalculateCohorts(m)}
            disabled={recalculating === m.id}
            className="text-[10px] text-base-500 hover:text-warning-600 disabled:opacity-40 px-0.5"
            title="기수 재계산"
          >
            {recalculating === m.id ? '⟳' : '⚡'}
          </button>
          <button
            onClick={() => actions.deleteMember(m)}
            className="text-[10px] text-base-400 hover:text-danger-500 disabled:opacity-40 px-0.5"
            title="삭제"
          >
            ✕
          </button>
        </div>
      </Td>
    </tr>
  );
}
