export function computeDominantTrack(
  submissions: Array<{ status: string; missionRepo: { track: string | null } }>,
): string | null {
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
