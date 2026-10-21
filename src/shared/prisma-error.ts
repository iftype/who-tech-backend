/** Prisma: 갱신·삭제 대상 행이 없다 (P2025). 라우트가 존재 확인을 빠뜨려도 404로 나가게 errorHandler가 읽는다 */
export function isRecordNotFoundError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2025';
}

export function isUniqueConstraintError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002'
  );
}
