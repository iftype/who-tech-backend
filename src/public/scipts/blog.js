import { addLog } from './logs.js';
import { authHeaders, parseErrorResponse } from './http.js';
import { toast } from './utils.js';
import { loadMembers } from './members.js';
import { loadStatus } from './workspace.js';

function pollBlogSyncJob(jobId, button) {
  const poll = () => {
    fetch(`/admin/blog/sync-jobs/${jobId}`, { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) return parseErrorResponse(response);
        return response.json();
      })
      .then((job) => {
        const progressText =
          job.progress && job.status !== 'queued'
            ? ` ${job.progress.percent}% (${job.progress.processed}/${job.progress.total || 0})`
            : '';
        document.getElementById('sync-result').textContent = `${job.message}${progressText}`;

        if (job.status === 'queued' || job.status === 'running') {
          button.textContent = job.status === 'queued' ? '대기 중...' : `${Math.max(job.progress?.percent ?? 0, 1)}%`;
          setTimeout(poll, 2000);
          return;
        }

        if (job.status === 'completed') {
          const result = job.result ?? { synced: 0, deleted: 0, failures: [], skipped: false };
          if (result.skipped) {
            toast('블로그 자동수집이 꺼져 있어 스킵됐습니다.');
            addLog('블로그 Sync 스킵 — blogSyncEnabled=false', 'info');
          } else {
            toast(`블로그 ${result.synced}건 수집, ${result.deleted}건 삭제`);
            addLog(`블로그 Sync 완료 — 수집 ${result.synced}건, 삭제 ${result.deleted}건`, 'ok');
            if (result.failures?.length) {
              result.failures.forEach((failure) => {
                const target = failure.rssUrl ?? failure.blog;
                addLog(`  └ ${failure.githubId} ${failure.step}: ${target} — ${failure.error}`, 'err');
              });
            }
          }
          Promise.all([loadMembers(), loadStatus()]);
          return;
        }

        const detail = job.error ?? job.message ?? '블로그 sync 실패';
        toast('블로그 sync 실패');
        addLog(`블로그 Sync 실패: ${detail}`, 'err');
      })
      .catch((err) => {
        const detail = err?.message ?? String(err);
        toast('블로그 sync 실패');
        addLog(`블로그 Sync 실패: ${detail}`, 'err');
      })
      .finally(() => {
        fetch(`/admin/blog/sync-jobs/${jobId}`, { headers: authHeaders() })
          .then((response) => (response.ok ? response.json() : null))
          .then((job) => {
            if (job?.status === 'queued' || job?.status === 'running') return;
            button.disabled = false;
            button.textContent = '블로그 Sync';
          })
          .catch(() => {
            button.disabled = false;
            button.textContent = '블로그 Sync';
          });
      });
  };

  poll();
}

export function triggerBlogSync() {
  const button = document.getElementById('blog-sync-btn');
  button.disabled = true;
  button.textContent = '대기 중...';
  addLog('블로그 Sync 중...', 'run');
  fetch('/admin/blog/sync', { method: 'POST', headers: authHeaders() })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      return response.json();
    })
    .then((job) => {
      addLog(`블로그 Sync 작업 등록 — ${job.id}`, 'info');
      pollBlogSyncJob(job.id, button);
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('블로그 sync 실패');
      addLog(`블로그 Sync 실패: ${detail}`, 'err');
      button.disabled = false;
      button.textContent = '블로그 Sync';
    });
}

export function triggerBlogBackfill() {
  const button = document.getElementById('blog-backfill-btn');
  button.disabled = true;
  button.textContent = '조회 중...';
  const cohortVal = document.getElementById('sync-cohort').value.trim();
  const cohortParam = cohortVal ? `&cohort=${encodeURIComponent(cohortVal)}` : '';
  addLog(`블로그 링크 백필 중${cohortVal ? ` (${cohortVal}기)` : ''}...`, 'run');
  fetch(`/admin/blog/backfill?limit=30${cohortParam}`, { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      const failureText =
        data.failures.length > 0
          ? ` / 실패 예시: ${data.failures.map((item) => `${item.githubId}(${item.reason})`).join(', ')}`
          : '';
      document.getElementById('sync-result').textContent =
        `블로그 링크 확인 ${data.checked}명, 저장 ${data.updated}명, 비어 있음 ${data.missing}명, 실패 ${data.failed}명${failureText}`;
      toast(`블로그 링크 백필 완료 (${data.updated}명 저장)`);
      addLog(
        `블로그 백필 완료 — 확인 ${data.checked}명, 저장 ${data.updated}명, 없음 ${data.missing}명, 실패 ${data.failed}명`,
        'ok',
      );
      return loadMembers();
    })
    .catch(() => {
      toast('블로그 링크 백필 실패');
      addLog('블로그 백필 실패', 'err');
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = '블로그 링크 백필';
    });
}
