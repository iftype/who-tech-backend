export function parsePreviousGithubIds(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

// 기존 이전 ID 목록(PreviousGithubId 테이블에서 읽은 값)에 현재 ID를 더하고 새 ID를 뺀다
export function mergePreviousGithubIds(
  existing: readonly string[],
  currentGithubId: string | null | undefined,
  nextGithubId: string,
): string | null {
  const merged = new Set(existing);
  if (currentGithubId && currentGithubId !== nextGithubId) {
    merged.add(currentGithubId);
  }
  merged.delete(nextGithubId);
  return merged.size > 0 ? JSON.stringify([...merged]) : null;
}

export function shouldRefreshProfile(profileFetchedAt: Date | null | undefined, staleHours = 24): boolean {
  if (!profileFetchedAt) return true;
  return Date.now() - profileFetchedAt.getTime() >= staleHours * 60 * 60 * 1000;
}
