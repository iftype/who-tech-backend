# 0004 어드민 색은 역할별 계열로 옮긴다

- 상태: 적용 (2026-10-19, #192)

## 배경

어드민 화면에 Tailwind 원시 팔레트 색(`text-gray-500`, `bg-blue-600` 등)이 713곳 있었다. 색의 의미(기본 글자, 주요 동작, 위험, 성공)가 클래스에 드러나지 않아, 예를 들어 "주요 동작 색을 바꾸자"면 파란색이 쓰인 곳을 하나하나 보고 의미가 같은 곳만 골라야 했다.

## 결정

색의 **계열 이름만 역할로 바꾸고 단계(50~900)는 그대로 둔다.**

```css
/* src/public/admin-spa/src/index.css */
--color-base-500: var(--color-gray-500);
--color-primary-600: var(--color-blue-600);
--color-danger-50: var(--color-red-50);
```

- 계열: `base`(회색) · `primary`(파랑) · `danger`(빨강) · `success`(초록) · `accent`(보라) · `warning`(호박) · `caution`(주황) · `highlight`(노랑) · `positive`(에메랄드) · `console`(슬레이트) · `brand`(그라데이션)
- `text-gray-500` → `text-base-500`처럼 기계적으로 바꿀 수 있어 화면이 1px도 바뀌지 않는다
- 원시 팔레트를 다시 쓰면 `lint:tokens`가 CI에서 실패한다

## 버린 대안

- **단어 하나짜리 의미 토큰(`text-muted`, `border-default`)**: 웹은 이 방식이다. 하지만 어드민은 회색만 400·500·600·700 여러 단계를 섞어 쓴다. 한 이름으로 합치면 비슷한 회색이 하나로 뭉쳐 화면이 바뀐다. "운영 기능 불변"에서 화면 변화는 디자인 결정이라 구조 PR에서 하지 않았다
- 역할 계열로 옮겨 둔 덕분에, 나중에 단계를 줄이는 디자인 작업은 `index.css`와 몇 군데 클래스만 보면 된다
