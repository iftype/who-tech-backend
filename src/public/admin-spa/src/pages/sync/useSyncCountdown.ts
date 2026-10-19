import { useEffect, useState } from 'react';

const getNextSyncTime = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next;
};

const formatRemainingTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${seconds}초`;
};

// 다음 정각(블로그 자동 싱크)까지 남은 시간을 1초마다 갱신한다
export function useSyncCountdown() {
  const [remainingTime, setRemainingTime] = useState('');

  useEffect(() => {
    const updateRemaining = () => setRemainingTime(formatRemainingTime(getNextSyncTime().getTime() - Date.now()));
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, []);

  return remainingTime;
}
