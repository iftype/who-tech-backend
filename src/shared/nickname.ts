import type { NicknameStat } from './types/index.js';

/**
 * PR 제목에서 한글 토큰만 추출한다.
 * 특수문자·숫자·영문·공백으로 분리하여 한글(가-힣)만 남긴다.
 */
export function extractNicknameTokens(title: string): string[] {
  return title
    .split(/[^가-힣]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function normalizeNickname(nickname: string): string {
  let s = nickname
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, ' ') // 괄호 제거: 빌리(정환희) → 빌리
    .trim()
    .replace(/^[\s\-,]*[\[({]*/, '') // 앞 특수문자 및 괄호 제거
    .replace(/[\])}]*[\s\-,]*$/, '') // 뒤 괄호 및 특수문자 제거
    .trim();

  while (/[!.,，]+$/.test(s)) {
    s = s.replace(/[!.,，]+$/g, '').trim();
  }

  // 한글 닉네임(쉼표·공백 포함)과 영문/숫자/하이픈 닉네임 모두 허용
  s = s.replace(/[^\s\-,0-9A-Za-z가-힣]/g, '');

  // Leading/trailing 특수문자(하이픈, 쉼표, 공백) 제거: "- 헤일리" → "헤일리"
  s = s.replace(/^[\s\-,]+/, '').replace(/[\s\-,]+$/, '');

  return s.trim();
}

function isNicknameStat(value: unknown): value is NicknameStat {
  if (typeof value !== 'object' || value === null) return false;
  const stat = value as Record<string, unknown>;
  return typeof stat['nickname'] === 'string' && typeof stat['count'] === 'number';
}

// Member.nicknameStats(JSON)를 읽는다. 형식이 틀린 값은 통계 없음으로 본다 — 검색 API 전체가 500이 되지 않도록 (ARCHITECTURE_PLAN F-4)
export function parseNicknameStats(value: string | null | undefined): NicknameStat[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isNicknameStat) : [];
  } catch {
    return [];
  }
}

export function stringifyNicknameStats(stats: NicknameStat[]): string | null {
  if (stats.length === 0) {
    return null;
  }

  return JSON.stringify(stats);
}

export function isValidNickname(nickname: string): boolean {
  if (nickname.length > 20) return false;
  return true;
}

/**
 * query가 멤버의 nicknameStats 상위 빈도 토큰(top N) 중 하나에 부분일치하면
 * 그 토큰의 빈도수(count)를, 매칭이 없으면 -1을 반환한다.
 *
 * 닉네임·실명은 PR 제목마다 반복돼 count가 높고, 미션 키워드("경주", "영화" 등)는
 * 낮다. 상위 N개만 매칭 대상으로 삼아 미션 키워드 오탐을 막는다.
 * 매칭은 단순 부분 문자열 포함("건형"→"조건형")이고, 빈도수가 곧 정렬 점수다.
 * 호출 측에서 빈도수 상위 N명만 추려 짧은 검색어(예: "김")에도 결과가 쏟아지지 않게 한다.
 */
export function scoreTopNicknameMatch(nicknameStatsValue: string | null | undefined, query: string, topN = 3): number {
  const q = query.trim();
  if (q.length === 0) return -1;

  const stats = parseNicknameStats(nicknameStatsValue);
  if (stats.length === 0) return -1;

  let best = -1;
  for (const stat of [...stats].sort((a, b) => b.count - a.count).slice(0, topN)) {
    if (stat.nickname.includes(q) && stat.count > best) best = stat.count;
  }
  return best;
}

export function mergeNicknameStat(
  existingValue: string | null | undefined,
  nickname: string,
  submittedAt: Date,
): NicknameStat[] {
  if (!isValidNickname(nickname)) return parseNicknameStats(existingValue);
  const stats = parseNicknameStats(existingValue);
  if (stats.some((item) => item.nickname === nickname)) {
    return sortNicknameStats(
      stats.map((item) =>
        item.nickname === nickname ? { ...item, count: item.count + 1, lastSeenAt: submittedAt.toISOString() } : item,
      ),
    );
  }

  return sortNicknameStats([...stats, { nickname, count: 1, lastSeenAt: submittedAt.toISOString() }]);
}

/**
 * 제출 제목들로 닉네임 통계를 처음부터 계산한다. 같은 제출을 몇 번 다시 계산해도 결과가 같다(멱등).
 * 예전에는 PR을 처리할 때마다 기존 통계에 +1을 해서, 같은 PR을 다시 처리하면(5분 겹침·재수집) 횟수가 부풀었다.
 * 오래된 제출부터 반영해 lastSeenAt이 가장 최근 제출 시각이 되게 한다
 */
export function computeNicknameStats(
  submissions: readonly { title: string; submittedAt: Date }[],
  bannedWords: ReadonlySet<string>,
): string | null {
  const ordered = [...submissions].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  let value: string | null = null;
  for (const submission of ordered) {
    for (const token of extractNicknameTokens(submission.title)) {
      if (!bannedWords.has(token)) value = JSON.stringify(mergeNicknameStat(value, token, submission.submittedAt));
    }
  }
  return value;
}

export function resolveDisplayNickname(
  manualNickname: string | null | undefined,
  nicknameStatsValue: string | null | undefined,
  fallbackNickname: string | null,
): string | null {
  if (manualNickname?.trim()) {
    return manualNickname.trim();
  }

  const stats = parseNicknameStats(nicknameStatsValue);
  if (stats.length > 0) {
    // 1위와 횟수가 같으면 지금 닉네임을 유지한다 (PR 제목에 닉네임과 실명을 같이 쓰면 둘이 동률이라
    // 계산 순서에 따라 실명으로 바뀌거나 싱크마다 오락가락할 수 있다)
    const current = fallbackNickname ? stats.find((stat) => stat.nickname === fallbackNickname) : undefined;
    if (current && current.count === stats[0]!.count) return current.nickname;
    return stats[0]!.nickname;
  }

  return fallbackNickname ? normalizeNickname(fallbackNickname) : null;
}

function sortNicknameStats(stats: NicknameStat[]): NicknameStat[] {
  return [...stats].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });
}
