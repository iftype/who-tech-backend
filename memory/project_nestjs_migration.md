---
name: NestJS + Bun 마이그레이션 계획
description: 백엔드를 NestJS + Bun 기반으로 마이그레이션할 계획 (시간날 때 진행)
type: project
---

백엔드를 NestJS + Bun 기반으로 마이그레이션할 계획이다.

**Why:** 현재 Express + Node.js 기반에서 NestJS + Bun으로 현대화 예정.

**How to apply:**

- 마이그레이션은 "시간날 때마다" 진행 — 단기 계획 아님
- 현재 코드베이스 유지보수 및 리팩토링은 여전히 가치 있음
- 리팩토링 시 비즈니스 로직(sync, blog, member)은 포팅 가능한 형태로 유지
- 새 기능 추가 시 현재 Express 패턴을 따르되 NestJS 이식 가능성 고려
