// 백엔드 의존 규칙 (ARCHITECTURE_PLAN): 기능 간 순환 금지, 다른 기능은 공개 진입점(index.ts)으로만 참조,
// shared·db·infra는 features를 모른다. 위반하면 CI가 실패한다 (기능 단위 순환은 scripts/check-feature-cycles.mjs --strict)
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: '순환 의존 금지',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'feature-internal-access',
      severity: 'error',
      comment: '다른 기능은 그 기능의 index.ts(공개 타입·포트)로만 참조한다',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'] },
    },
    {
      name: 'lower-layer-no-features',
      severity: 'error',
      comment: 'shared·db·infra는 features에 의존하지 않는다',
      from: { path: '^src/(shared|db|infra)/' },
      to: { path: '^src/features/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/(__tests__|public)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
