import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../test/fake-event-source';

const sources: FakeEventSource[] = [];
vi.mock('../lib/sse.js', () => ({
  createEventSource: (url: string) => {
    const es = new FakeEventSource(url);
    sources.push(es);
    return es;
  },
}));
vi.stubGlobal('EventSource', FakeEventSource);

const { useEventStreamLog } = await import('./useEventStreamLog');

describe('useEventStreamLog', () => {
  beforeEach(() => {
    sources.length = 0;
  });

  it('should close the stream when the component unmounts', () => {
    const { result, unmount } = renderHook(() => useEventStreamLog());
    act(() => result.current.follow('/admin/sync/stream', '시작'));
    expect(sources[0]?.closed).toBe(false);

    unmount();

    expect(sources[0]?.closed).toBe(true);
  });

  it('should close the previous stream when a new one is followed', () => {
    const { result } = renderHook(() => useEventStreamLog());
    act(() => result.current.follow('/a', '첫 번째'));
    act(() => result.current.follow('/b', '두 번째'));

    expect(sources[0]?.closed).toBe(true);
    expect(sources[1]?.closed).toBe(false);
    expect(result.current.logs.map((l) => l.message)).toEqual(['두 번째']);
  });

  it('should ignore events from a stream that was replaced', () => {
    const { result } = renderHook(() => useEventStreamLog());
    act(() => result.current.follow('/a', '첫 번째'));
    act(() => result.current.follow('/b', '두 번째'));

    act(() => sources[0]?.emit('progress', 'stale'));

    expect(result.current.logs.map((l) => l.message)).toEqual(['두 번째']);
  });
});
