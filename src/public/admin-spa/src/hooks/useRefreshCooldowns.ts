import { useCallback, useEffect, useState } from 'react';

// 멤버별 프로필 새로고침 쿨다운. localStorage에 시작 시각(ms)을 저장해 새로고침 후에도 유지한다
export const COOLDOWN_MS = 60_000;
const KEY_PREFIX = 'profile-refresh-cooldown-';
const cooldownKey = (id: number) => `${KEY_PREFIX}${id}`;

function remainingSeconds(startedAt: number, now: number): number {
  return Math.ceil((startedAt + COOLDOWN_MS - now) / 1000);
}

/** 저장된 쿨다운 중 남은 것만 {memberId: 남은 초}로, 만료된 것은 지운다 */
export function loadCooldowns(): Record<number, number> {
  const now = Date.now();
  const result: Record<number, number> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(KEY_PREFIX)) {
      const id = Number(key.replace(KEY_PREFIX, ''));
      const remaining = remainingSeconds(Number(localStorage.getItem(key)), now);
      if (remaining > 0) result[id] = remaining;
      else localStorage.removeItem(key);
    }
  }
  return result;
}

export function useRefreshCooldowns() {
  const [cooldowns, setCooldowns] = useState<Record<number, number>>(loadCooldowns);

  // 1초마다 남은 시간을 다시 계산하고 끝난 쿨다운은 정리
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCooldowns((prev) => {
        const next: Record<number, number> = {};
        for (const [idStr] of Object.entries(prev)) {
          const id = Number(idStr);
          const key = cooldownKey(id);
          const remaining = remainingSeconds(Number(localStorage.getItem(key) ?? 0), now);
          if (remaining > 0) next[id] = remaining;
          else localStorage.removeItem(key);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /** 지금부터 쿨다운 시작. displaySeconds는 화면에 바로 보일 남은 초 (기본 전체 시간) */
  const startCooldown = useCallback((id: number, displaySeconds = Math.ceil(COOLDOWN_MS / 1000)) => {
    localStorage.setItem(cooldownKey(id), String(Date.now()));
    setCooldowns((prev) => ({ ...prev, [id]: displaySeconds }));
  }, []);

  return { cooldowns, startCooldown };
}
