import { useState, type FormEvent } from 'react';

import { showToast } from '../ui/Toast.js';
import type { Member } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { Button } from '../ui/Button.js';

interface Props {
  onAdded: (m: Member) => void;
}

export default function MemberAddForm({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [githubId, setGithubId] = useState('');
  const [cohort, setCohort] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const member = await adminApi.members.create({
        githubId: githubId.trim() || undefined,
        cohort: cohort ? Number(cohort) : undefined,
      });
      onAdded(member);
      setGithubId('');
      setCohort('');
      setOpen(false);
      showToast('멤버 추가 완료');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '추가 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="md" className="mb-4">
        + 멤버 추가
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 flex gap-2 items-end flex-wrap bg-primary-50 p-3 rounded border border-primary-200"
    >
      <div>
        <label className="text-xs text-base-600 block mb-1">GitHub ID</label>
        <input
          value={githubId}
          onChange={(e) => setGithubId(e.target.value)}
          placeholder="예: torvalds"
          className="border border-base-300 rounded px-2 py-1.5 text-sm w-40"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-base-600 block mb-1">기수</label>
        <input
          type="number"
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
          placeholder="예: 9"
          className="border border-base-300 rounded px-2 py-1.5 text-sm w-20"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !githubId.trim()}
        className="bg-primary-600 text-white text-sm rounded px-3 py-1.5 hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? '추가 중...' : '추가'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-base-400 hover:text-base-600 px-2">
        취소
      </button>
    </form>
  );
}
