import { MutationCache, QueryClient } from '@tanstack/react-query';

// 뮤테이션의 성공·실패 토스트를 한곳에서 띄운다. 화면은 meta에 문구만 적는다:
//   useMutation({ mutationFn, meta: { errorMessage: '저장 실패', successMessage: '저장 완료' } })
// 실패 문구는 서버가 준 메시지가 있으면 그것을, 없으면 errorMessage를 쓴다.
// lib는 화면 부품을 모르므로 토스트 함수는 진입점(main.tsx)이 넘긴다
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { errorMessage?: string; successMessage?: string };
  }
}

export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export type Notify = (message: string, type?: 'success' | 'error') => void;

export function createAdminQueryClient(options: { notify: Notify; retry?: number | false }) {
  const { notify } = options;
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: options.retry ?? 1 } },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        const fallback = mutation.meta?.errorMessage;
        if (fallback) notify(toErrorMessage(error, fallback), 'error');
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = mutation.meta?.successMessage;
        if (message) notify(message);
      },
    }),
  });
}
