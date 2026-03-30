import { authHeaders, parseErrorResponse } from './http.js';
import { toast, escapeHtml } from './utils.js';
import { adminState } from './state.js';

let persons = [];

// ────────────────── 렌더 ──────────────────

function renderPersons() {
  const el = document.getElementById('person-list');
  if (!el) return;

  if (persons.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">등록된 Person 없음</p>';
    return;
  }

  el.innerHTML = persons
    .map((p) => {
      const memberChips = p.members
        .map(
          (m) =>
            `<span class="chip" style="cursor:default">
              ${escapeHtml(m.nickname ?? m.githubId)}
              <button title="연결 해제" onclick="unlinkPersonMember(${p.id}, ${m.id})"
                style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0 2px">✕</button>
            </span>`,
        )
        .join('');

      return `<div class="card" style="margin-bottom:8px;padding:12px 16px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <strong style="min-width:120px">${escapeHtml(p.displayName ?? `Person #${p.id}`)}</strong>
          ${p.note ? `<span style="color:var(--text-secondary);font-size:12px">${escapeHtml(p.note)}</span>` : ''}
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="btn-secondary" style="font-size:12px;padding:2px 8px"
              onclick="openLinkMemberModal(${p.id})">멤버 연결</button>
            <button class="btn-secondary" style="font-size:12px;padding:2px 8px"
              onclick="editPerson(${p.id})">편집</button>
            <button class="btn-danger" style="font-size:12px;padding:2px 8px"
              onclick="deletePerson(${p.id})">삭제</button>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">
          ${memberChips || '<span style="color:var(--text-muted);font-size:12px">연결된 멤버 없음</span>'}
        </div>
      </div>`;
    })
    .join('');
}

// ────────────────── 데이터 로드 ──────────────────

export async function loadPersons() {
  try {
    const res = await fetch('/admin/persons', { headers: authHeaders() });
    if (!res.ok) return parseErrorResponse(res);
    persons = await res.json();
    renderPersons();
  } catch (e) {
    toast(`Person 로드 실패: ${e?.message ?? e}`);
  }
}

// ────────────────── 생성 ──────────────────

export async function createPerson() {
  const displayName = document.getElementById('person-display-name')?.value.trim() || undefined;
  const note = document.getElementById('person-note')?.value.trim() || undefined;

  try {
    const res = await fetch('/admin/persons', {
      method: 'POST',
      headers: authHeaders('application/json'),
      body: JSON.stringify({ displayName, note }),
    });
    if (!res.ok) return parseErrorResponse(res);
    toast('Person 생성 완료');
    document.getElementById('person-display-name').value = '';
    document.getElementById('person-note').value = '';
    await loadPersons();
  } catch (e) {
    toast(`Person 생성 실패: ${e?.message ?? e}`);
  }
}

// ────────────────── 편집 (인라인 prompt) ──────────────────

export async function editPerson(id) {
  const person = persons.find((p) => p.id === id);
  if (!person) return;

  const displayName = window.prompt('표시 이름', person.displayName ?? '');
  if (displayName === null) return; // 취소
  const note = window.prompt('메모', person.note ?? '');
  if (note === null) return;

  try {
    const res = await fetch(`/admin/persons/${id}`, {
      method: 'PATCH',
      headers: authHeaders('application/json'),
      body: JSON.stringify({
        displayName: displayName.trim() || null,
        note: note.trim() || null,
      }),
    });
    if (!res.ok) return parseErrorResponse(res);
    toast('Person 수정 완료');
    await loadPersons();
  } catch (e) {
    toast(`Person 수정 실패: ${e?.message ?? e}`);
  }
}

// ────────────────── 삭제 ──────────────────

export async function deletePerson(id) {
  const person = persons.find((p) => p.id === id);
  const label = person?.displayName ?? `Person #${id}`;
  if (!window.confirm(`"${label}" Person을 삭제할까요?\n연결된 멤버의 personId는 해제됩니다.`)) return;

  try {
    const res = await fetch(`/admin/persons/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) return parseErrorResponse(res);
    toast('Person 삭제 완료');
    await loadPersons();
  } catch (e) {
    toast(`Person 삭제 실패: ${e?.message ?? e}`);
  }
}

// ────────────────── 멤버 연결 모달 ──────────────────

let _linkPersonId = null;

export function openLinkMemberModal(personId) {
  _linkPersonId = personId;
  const person = persons.find((p) => p.id === personId);
  document.getElementById('link-person-title').textContent =
    `멤버 연결 — ${person?.displayName ?? `Person #${personId}`}`;
  document.getElementById('link-member-input').value = '';
  document.getElementById('link-member-search-result').innerHTML = '';
  document.getElementById('person-link-modal').style.display = 'flex';
}

export function closeLinkMemberModal() {
  _linkPersonId = null;
  document.getElementById('person-link-modal').style.display = 'none';
}

export async function searchMembersForLink() {
  const q = document.getElementById('link-member-input').value.trim();
  if (!q) return;

  const res = await fetch(`/admin/members?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  if (!res.ok) { toast('멤버 검색 실패'); return; }
  const members = await res.json();

  const resultEl = document.getElementById('link-member-search-result');
  if (members.length === 0) { resultEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">검색 결과 없음</p>'; return; }

  resultEl.innerHTML = members.slice(0, 10).map((m) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border)">
      <img src="${escapeHtml(m.avatarUrl ?? '')}" style="width:28px;height:28px;border-radius:50%">
      <span style="flex:1">${escapeHtml(m.nickname ?? m.githubId)} <span style="color:var(--text-muted)">@${escapeHtml(m.githubId)}</span></span>
      <button class="btn-primary" style="font-size:12px;padding:2px 10px"
        onclick="linkPersonMember(${_linkPersonId}, ${m.id})">연결</button>
    </div>`
  ).join('');
}

export async function linkPersonMember(personId, memberId) {
  try {
    const res = await fetch(`/admin/persons/${personId}/members/${memberId}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) return parseErrorResponse(res);
    toast('멤버 연결 완료');
    closeLinkMemberModal();
    await loadPersons();
  } catch (e) {
    toast(`연결 실패: ${e?.message ?? e}`);
  }
}

export async function unlinkPersonMember(personId, memberId) {
  if (!window.confirm('연결을 해제할까요?')) return;
  try {
    const res = await fetch(`/admin/persons/${personId}/members/${memberId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) return parseErrorResponse(res);
    toast('연결 해제 완료');
    await loadPersons();
  } catch (e) {
    toast(`해제 실패: ${e?.message ?? e}`);
  }
}
