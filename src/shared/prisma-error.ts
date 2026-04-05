export function isUniqueConstraintError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002'
  );
}
