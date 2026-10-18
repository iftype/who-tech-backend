type TrackedSubmission = { status: string; missionRepo: { track: string | null } };

export function computeDominantTrack(submissions: TrackedSubmission[]): string | null {
  const freq = new Map<string, number>();
  for (const s of submissions) {
    if (s.status === 'closed') continue;
    const track = s.missionRepo.track;
    if (!track) continue;
    freq.set(track, (freq.get(track) ?? 0) + 1);
  }
  if (freq.size === 0) return null;
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]![0];
}

/**
 * 표시용 트랙 요약.
 * track: 수동 지정 트랙 > 제출 기반 추론 트랙
 * tracks: 수동·추론 트랙과 (closed 제외) 제출 레포 트랙의 합집합
 */
export function summarizeTracks(
  explicitTrack: string | null,
  submissions: TrackedSubmission[],
): { track: string | null; tracks: string[] } {
  const inferredTrack = computeDominantTrack(submissions);
  return {
    track: explicitTrack ?? inferredTrack ?? null,
    tracks: [
      ...new Set([
        ...(explicitTrack ? [explicitTrack] : []),
        ...(inferredTrack ? [inferredTrack] : []),
        ...submissions
          .filter((s) => s.status !== 'closed')
          .map((s) => s.missionRepo.track)
          .filter((t): t is string => t !== null),
      ]),
    ],
  };
}
