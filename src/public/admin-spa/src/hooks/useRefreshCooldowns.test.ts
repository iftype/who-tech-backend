import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COOLDOWN_MS, loadCooldowns, useRefreshCooldowns } from './useRefreshCooldowns';

const NOW = new Date('2026-10-18T12:00:00Z').getTime();

describe('useRefreshCooldowns', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should load active cooldowns and drop expired ones', () => {
    localStorage.setItem('profile-refresh-cooldown-1', String(NOW - 10_000)); // 50초 남음
    localStorage.setItem('profile-refresh-cooldown-2', String(NOW - COOLDOWN_MS)); // 만료
    localStorage.setItem('other-key', 'x');

    expect(loadCooldowns()).toEqual({ 1: 50 });
    expect(localStorage.getItem('profile-refresh-cooldown-2')).toBeNull();
    expect(localStorage.getItem('other-key')).toBe('x');
  });

  it('should start a cooldown, persist it, and count down every second', () => {
    const { result } = renderHook(() => useRefreshCooldowns());

    act(() => result.current.startCooldown(7));
    expect(result.current.cooldowns).toEqual({ 7: 60 });
    expect(localStorage.getItem('profile-refresh-cooldown-7')).toBe(String(NOW));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.cooldowns).toEqual({ 7: 59 });

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(result.current.cooldowns).toEqual({});
    expect(localStorage.getItem('profile-refresh-cooldown-7')).toBeNull();
  });

  it('should show the given remaining seconds until the next tick', () => {
    const { result } = renderHook(() => useRefreshCooldowns());

    act(() => result.current.startCooldown(3, 12));
    expect(result.current.cooldowns).toEqual({ 3: 12 });
  });
});
