// SSE(EventSource) 대역. createEventSource를 이걸로 바꿔 끼우고 emit으로 서버 이벤트를 흉내 낸다
type Listener = (e: MessageEvent) => void;

export class FakeEventSource {
  static CLOSED = 2;
  readyState = 1;
  closed = false;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Listener>();

  constructor(public url: string) {}

  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, fn);
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({ data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent);
  }

  close() {
    this.closed = true;
  }
}
