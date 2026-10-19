// admin-spa 의존 규칙 (ARCHITECTURE_PLAN D-3). 위반은 CI(npm run deps:check)에서 실패한다.
//   pages(탭 화면, pages/<탭>/에 탭 전용 훅·컴포넌트) → components·hooks·context → lib
//   components/ui는 어디에도 기대지 않는 기본 부품 (lib/cn만 사용)
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: '어디서도 쓰지 않는 모듈은 지운다 (진입점·타입 선언·테스트 도우미 제외)',
      from: { orphan: true, pathNot: ['^src/main\\.tsx$', '\\.d\\.ts$', '^src/test/'] },
      to: {},
    },
    {
      name: 'lib-no-upward',
      severity: 'error',
      comment: 'lib(API·유틸)은 화면 코드를 모른다',
      from: { path: '^src/lib/' },
      to: { path: '^src/(components|hooks|pages|context)/' },
    },
    {
      name: 'ui-is-leaf',
      severity: 'error',
      comment: 'components/ui는 다른 화면 코드에 기대지 않는다',
      from: { path: '^src/components/ui/' },
      to: { path: '^src/(components/(?!ui/)|hooks|pages|context)' },
    },
    {
      name: 'components-no-pages',
      severity: 'error',
      comment: '공용 컴포넌트·훅은 페이지를 모른다',
      from: { path: '^src/(components|hooks|context)/' },
      to: { path: '^src/pages/' },
    },
    {
      name: 'pages-no-cross',
      severity: 'error',
      comment: '페이지 폴더끼리 직접 참조 금지 (공통은 components·hooks·lib로). XTab.tsx → pages/x/ 하위 파일은 허용',
      from: { path: '^src/pages/([^/]+)/' },
      to: { path: '^src/pages/', pathNot: ['^src/pages/$1/'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.tsx?$|^src/test/' },
    tsConfig: { fileName: 'tsconfig.app.json' },
    tsPreCompilationDeps: true,
  },
};
