// admin-spa 의존 규칙 (ARCHITECTURE_PLAN): pages → components·hooks → lib 방향만 허용, 순환 금지.
// 지금은 보고 모드(warn)이고 D-3에서 error로 바꿔 CI에서 막는다
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
    {
      name: 'lib-no-upward',
      severity: 'warn',
      comment: 'lib(API·유틸)은 화면 코드를 모른다',
      from: { path: '^src/lib/' },
      to: { path: '^src/(components|hooks|pages|context)/' },
    },
    {
      name: 'components-no-pages',
      severity: 'warn',
      comment: '공용 컴포넌트·훅은 페이지를 모른다',
      from: { path: '^src/(components|hooks|context)/' },
      to: { path: '^src/pages/' },
    },
    {
      name: 'pages-no-cross',
      severity: 'warn',
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
