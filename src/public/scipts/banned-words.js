import { authHeaders } from './http.js';
import { escapeHtml, toast } from './utils.js';

export function loadBannedWords() {
  return fetch('/admin/banned-words', { headers: authHeaders() })
    .then((res) => res.json())
    .then((words) => {
      const list = document.getElementById('banned-words-list');
      if (!list) return;
      if (!words.length) {
        list.innerHTML = '<span class="muted">등록된 금지어가 없습니다.</span>';
        return;
      }
      list.innerHTML = words
        .map(
          (w) => `
          <div class="row" style="gap:8px;align-items:center;margin-bottom:4px">
            <span>${escapeHtml(w.word)}</span>
            <button class="btn-sm btn-danger" onclick="deleteBannedWord(${w.id})">삭제</button>
          </div>
        `,
        )
        .join('');
    })
    .catch(() => toast('금지어 목록을 불러오지 못했습니다.'));
}

export function addBannedWord() {
  const input = document.getElementById('new-banned-word');
  const word = input.value.trim();
  if (!word) return;

  fetch('/admin/banned-words', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ word }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('failed');
      input.value = '';
      toast('금지어 추가 완료');
      return loadBannedWords();
    })
    .catch(() => alert('금지어 추가에 실패했습니다.'));
}

export function deleteBannedWord(id) {
  fetch(`/admin/banned-words/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then((res) => {
      if (!res.ok) throw new Error('failed');
      toast('금지어 삭제 완료');
      return loadBannedWords();
    })
    .catch(() => alert('금지어 삭제에 실패했습니다.'));
}
