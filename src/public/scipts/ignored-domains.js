import { authHeaders } from './http.js';
import { escapeHtml, toast } from './utils.js';

export function loadIgnoredDomains() {
  return fetch('/admin/ignored-domains', { headers: authHeaders() })
    .then((res) => res.json())
    .then((domains) => {
      const list = document.getElementById('ignored-domains-list');
      if (!list) return;
      if (!domains.length) {
        list.innerHTML = '<span class="muted">등록된 무시 도메인이 없습니다.</span>';
        return;
      }
      list.innerHTML = domains
        .map(
          (d) => `
          <div class="row" style="gap:8px;align-items:center;margin-bottom:4px">
            <span>${escapeHtml(d.domain)}</span>
            <button class="btn-sm btn-danger" onclick="deleteIgnoredDomain(${d.id})">삭제</button>
          </div>
        `,
        )
        .join('');
    })
    .catch(() => toast('무시 도메인 목록을 불러오지 못했습니다.'));
}

export function addIgnoredDomain() {
  const input = document.getElementById('new-ignored-domain');
  const domain = input.value.trim();
  if (!domain) return;

  fetch('/admin/ignored-domains', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ domain }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('failed');
      input.value = '';
      toast('도메인 추가 완료');
      return loadIgnoredDomains();
    })
    .catch(() => alert('도메인 추가에 실패했습니다.'));
}

export function deleteIgnoredDomain(id) {
  fetch(`/admin/ignored-domains/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then((res) => {
      if (!res.ok) throw new Error('failed');
      toast('도메인 삭제 완료');
      return loadIgnoredDomains();
    })
    .catch(() => alert('도메인 삭제에 실패했습니다.'));
}
