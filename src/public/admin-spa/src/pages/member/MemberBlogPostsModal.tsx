import { Modal } from '../../components/ui/Modal.js';
import type { BlogPost, Member } from '../../lib/types.js';
import { TextLink } from '../../components/ui/TextLink.js';

export interface BlogPostsModalState {
  member: Member;
  posts: BlogPost[];
}

export function MemberBlogPostsModal({ state, onClose }: { state: BlogPostsModalState | null; onClose: () => void }) {
  return (
    <Modal open={!!state} onClose={onClose} title={`${state?.member.githubId} 블로그 포스트`}>
      {state && (
        <div className="space-y-2">
          {state.posts.length === 0 ? (
            <p className="text-base-400 text-sm">포스트 없음</p>
          ) : (
            state.posts.map((p) => (
              <div key={p.id} className="border border-base-100 rounded p-2">
                <TextLink href={p.url} target="_blank" rel="noopener noreferrer" size="sm">
                  {p.title}
                </TextLink>
                <p className="text-xs text-base-400 mt-0.5">{new Date(p.publishedAt).toLocaleDateString('ko-KR')}</p>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
