Fix a bug through the bug workflow in AGENTS.md ("버그 처리 워크플로"). `$ARGUMENTS` is the issue number.

1. **기록 확인**: `gh issue view $ARGUMENTS` — 증상·재현·영향·심각도가 다 있는지. 심각도가 비었으면 멈추고 사람에게 묻는다
2. **재현**: 고치기 전에 실패하는 테스트를 먼저 쓴다 (단위·계약·통합 중 증상에 가장 가까운 층). 테스트로 못 잡는 운영 문제(주기·성능)는 **수정 전 측정값**을 Issue 코멘트로 남긴다
3. **수정**: 원인만 고치는 최소 변경. 브랜치 `fix/<topic>`, 커밋·PR 제목 `fix: … (#$ARGUMENTS)`, PR 본문 `closes #$ARGUMENTS`
4. **검증**: 재현 테스트가 통과하는지, `npx tsc --noEmit` · `npm test` 전부 통과. PR 본문에 전/후 값(테스트 이름 또는 측정값)
5. **머지는 사람이 결정**한다 (또는 메모리의 머지 위임 범위 안에서). 배포 후 `/health` commit 확인 → 운영에서 같은 재현 방법으로 다시 확인하고 Issue에 코멘트
6. **마감**: Issue 닫기 코멘트에 원인 한 줄, 재발 방지(추가한 테스트·린트·문서), 발견→배포 시간. `node scripts/bug-metrics.mjs`로 전체 지표 갱신
