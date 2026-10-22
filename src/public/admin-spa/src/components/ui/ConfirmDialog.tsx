import { useEffect, useRef, useState } from 'react';

import { Button } from './Button.js';

// 브라우저 confirm() 대신 쓰는 확인 창. 호출부는 `if (!(await confirmAction(...))) return;` 한 줄로 바뀐다.
// 상태는 Toast와 같이 모듈 안에 두고, 화면에는 App이 올린 <ConfirmHost /> 하나만 그린다
interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

interface ConfirmOptions {
  /** 확인 버튼 글자 (기본 '확인') */
  confirmLabel?: string;
  /** 삭제처럼 되돌릴 수 없는 동작이면 확인 버튼을 위험 색으로 */
  danger?: boolean;
}

let listener: ((req: ConfirmRequest) => void) | null = null;

export function confirmAction(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    // 창을 그릴 곳이 없으면(테스트·마운트 전) 막지 않고 취소로 본다 — 실수로 삭제가 실행되지 않게
    if (!listener) {
      resolve(false);
      return;
    }
    listener({ message, confirmLabel: options.confirmLabel ?? '확인', danger: options.danger ?? false, resolve });
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listener = (next) =>
      setRequest((prev) => {
        prev?.resolve(false); // 앞의 창은 취소로 닫는다
        return next;
      });
    return () => {
      listener = null;
    };
  }, []);

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus(); // 기본 초점은 취소 — Enter 한 번으로 삭제되지 않게
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request]);

  if (!request) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-message"
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-message" className="whitespace-pre-line text-sm text-base-800">
          {request.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} tone="secondary" size="md" onClick={() => close(false)}>
            취소
          </Button>
          <Button tone={request.danger ? 'danger' : 'primary'} size="md" onClick={() => close(true)}>
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
