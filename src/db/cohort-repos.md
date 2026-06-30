# CohortRepo 입력용 표

`missionRepoId`는 `MissionRepo.id` autoincrement 값이라 실제 DB를 조회해야만 알 수 있다. 아래 표에서는 `repoName`/`repoUrl`로 `/admin/repos`에서 `MissionRepo`를 찾고, 확인한 id를 `missionRepoId`에 채운다.

실제 `CohortRepo` insert payload에 들어가는 필드는 다음 4개다.

```json
{
  "cohort": 7,
  "missionRepoId": "TBD",
  "order": 0,
  "level": 1
}
```

`track`은 `CohortRepo`에 직접 저장되지 않고 연결된 `MissionRepo.track`에 저장된다. 이 문서에서는 입력/검수 편의를 위해 frontend, backend, android를 섹션으로 분리한다.

주의: 아래 `order`는 같은 `track` + `cohort` 안의 표시 순서로 0부터 다시 시작한다. `CohortRepo.order`는 unique 제약이 없어서 저장은 가능하지만, 트랙/기수 필터 없이 전체를 같이 볼 때 안정적인 정렬이 필요하면 모든 행을 합쳐 전역 order로 다시 번호를 매겨야 한다.

## Frontend

원본:

- 7기: <https://raw.githubusercontent.com/sanghee01/woowacourse-archive/refs/heads/main/README.md>
- 6기: <https://raw.githubusercontent.com/Yoonkyoungme/woowacourse-archive/refs/heads/main/README.md>
- 5기: <https://raw.githubusercontent.com/dladncks1217/woowacourse-archive/refs/heads/main/README.md>
- 4기: <https://raw.githubusercontent.com/rladpwl0512/2022-woowacourse-frontend/refs/heads/main/README.md>
- 3기: <https://raw.githubusercontent.com/yujo11/woowacourse-projects/refs/heads/main/README.md>

| track    | cohort | level | order | missionRepoId | repoName                       | repoUrl                                                       |
| -------- | -----: | ----: | ----: | ------------- | ------------------------------ | ------------------------------------------------------------- |
| frontend |      7 |     1 |     0 | TBD           | `javascript-racingcar`         | `https://github.com/woowacourse/javascript-racingcar`         |
| frontend |      7 |     1 |     1 | TBD           | `javascript-lotto`             | `https://github.com/woowacourse/javascript-lotto`             |
| frontend |      7 |     1 |     2 | TBD           | `javascript-lunch`             | `https://github.com/woowacourse/javascript-lunch`             |
| frontend |      7 |     1 |     3 | TBD           | `javascript-movie-review`      | `https://github.com/woowacourse/javascript-movie-review`      |
| frontend |      7 |     2 |     4 | TBD           | `react-payments`               | `https://github.com/woowacourse/react-payments`               |
| frontend |      7 |     2 |     5 | TBD           | `react-modules`                | `https://github.com/woowacourse/react-modules`                |
| frontend |      7 |     2 |     6 | TBD           | `react-shopping-products`      | `https://github.com/woowacourse/react-shopping-products`      |
| frontend |      7 |     2 |     7 | TBD           | `react-shopping-cart`          | `https://github.com/woowacourse/react-shopping-cart`          |
| frontend |      7 |     4 |     8 | TBD           | `perf-basecamp`                | `https://github.com/woowacourse/perf-basecamp`                |
| frontend |      7 |     4 |     9 | TBD           | `a11y-airline`                 | `https://github.com/woowacourse/a11y-airline`                 |
| frontend |      7 |     4 |    10 | TBD           | `rendering-basecamp`           | `https://github.com/woowacourse/rendering-basecamp`           |
| frontend |      6 |     1 |     0 | TBD           | `javascript-racingcar`         | `https://github.com/woowacourse/javascript-racingcar`         |
| frontend |      6 |     1 |     1 | TBD           | `javascript-lotto`             | `https://github.com/woowacourse/javascript-lotto`             |
| frontend |      6 |     1 |     2 | TBD           | `javascript-lunch`             | `https://github.com/woowacourse/javascript-lunch`             |
| frontend |      6 |     1 |     3 | TBD           | `javascript-movie-review`      | `https://github.com/woowacourse/javascript-movie-review`      |
| frontend |      6 |     2 |     4 | TBD           | `react-payments`               | `https://github.com/woowacourse/react-payments`               |
| frontend |      6 |     2 |     5 | TBD           | `react-modules`                | `https://github.com/woowacourse/react-modules`                |
| frontend |      6 |     2 |     6 | TBD           | `react-shopping-cart`          | `https://github.com/woowacourse/react-shopping-cart`          |
| frontend |      6 |     2 |     7 | TBD           | `react-shopping-products`      | `https://github.com/woowacourse/react-shopping-products`      |
| frontend |      6 |     4 |     8 | TBD           | `perf-basecamp`                | `https://github.com/woowacourse/perf-basecamp`                |
| frontend |      6 |     4 |     9 | TBD           | `a11y-airline`                 | `https://github.com/woowacourse/a11y-airline`                 |
| frontend |      6 |     4 |    10 | TBD           | `react-ssr`                    | `https://github.com/woowacourse/react-ssr`                    |
| frontend |      5 |     1 |     0 | TBD           | `javascript-racingcar`         | `https://github.com/woowacourse/javascript-racingcar`         |
| frontend |      5 |     1 |     1 | TBD           | `javascript-lotto`             | `https://github.com/woowacourse/javascript-lotto`             |
| frontend |      5 |     1 |     2 | TBD           | `javascript-lunch`             | `https://github.com/woowacourse/javascript-lunch`             |
| frontend |      5 |     1 |     3 | TBD           | `javascript-movie-review`      | `https://github.com/woowacourse/javascript-movie-review`      |
| frontend |      5 |     2 |     4 | TBD           | `react-lunch`                  | `https://github.com/woowacourse/react-lunch`                  |
| frontend |      5 |     2 |     5 | TBD           | `react-payments`               | `https://github.com/woowacourse/react-payments`               |
| frontend |      5 |     2 |     6 | TBD           | `react-shopping-cart`          | `https://github.com/woowacourse/react-shopping-cart`          |
| frontend |      5 |     2 |     7 | TBD           | `react-shopping-cart-prod`     | `https://github.com/woowacourse/react-shopping-cart-prod`     |
| frontend |      5 |     4 |     8 | TBD           | `perf-basecamp`                | `https://github.com/woowacourse/perf-basecamp`                |
| frontend |      5 |     4 |     9 | TBD           | `layout-component`             | `https://github.com/woowacourse/layout-component`             |
| frontend |      5 |     4 |    10 | TBD           | `frontend-rendering`           | `https://github.com/woowacourse/frontend-rendering`           |
| frontend |      4 |     1 |     0 | TBD           | `javascript-calculator`        | `https://github.com/woowacourse/javascript-calculator`        |
| frontend |      4 |     1 |     1 | TBD           | `javascript-racingcar`         | `https://github.com/woowacourse/javascript-racingcar`         |
| frontend |      4 |     1 |     2 | TBD           | `javascript-lotto`             | `https://github.com/woowacourse/javascript-lotto`             |
| frontend |      4 |     1 |     3 | TBD           | `javascript-youtube-classroom` | `https://github.com/woowacourse/javascript-youtube-classroom` |
| frontend |      4 |     1 |     4 | TBD           | `javascript-vendingmachine`    | `https://github.com/woowacourse/javascript-vendingmachine`    |
| frontend |      4 |     2 |     5 | TBD           | `react-calculator`             | `https://github.com/woowacourse/react-calculator`             |
| frontend |      4 |     2 |     6 | TBD           | `react-payments`               | `https://github.com/woowacourse/react-payments`               |
| frontend |      4 |     2 |     7 | TBD           | `react-shopping-cart`          | `https://github.com/woowacourse/react-shopping-cart`          |
| frontend |      4 |     2 |     8 | TBD           | `react-shopping-cart-prod`     | `https://github.com/woowacourse/react-shopping-cart-prod`     |
| frontend |      4 |     4 |     9 | TBD           | `perf-basecamp`                | `https://github.com/woowacourse/perf-basecamp`                |
| frontend |      4 |     4 |    10 | TBD           | `ts-module`                    | `https://github.com/woowacourse/ts-module`                    |
| frontend |      4 |     4 |    11 | TBD           | `a11y-airline`                 | `https://github.com/woowacourse/a11y-airline`                 |
| frontend |      3 |     1 |     0 | TBD           | `javascript-calculator`        | `https://github.com/woowacourse/javascript-calculator`        |
| frontend |      3 |     1 |     1 | TBD           | `javascript-racingcar`         | `https://github.com/woowacourse/javascript-racingcar`         |
| frontend |      3 |     1 |     2 | TBD           | `javascript-lotto`             | `https://github.com/woowacourse/javascript-lotto`             |
| frontend |      3 |     1 |     3 | TBD           | `javascript-youtube-classroom` | `https://github.com/woowacourse/javascript-youtube-classroom` |
| frontend |      3 |     1 |     4 | TBD           | `javascript-subway`            | `https://github.com/woowacourse/javascript-subway`            |
| frontend |      3 |     2 |     5 | TBD           | `react-lotto`                  | `https://github.com/woowacourse/react-lotto`                  |
| frontend |      3 |     2 |     6 | TBD           | `react-payments`               | `https://github.com/woowacourse/react-payments`               |
| frontend |      3 |     2 |     7 | TBD           | `react-shopping-cart`          | `https://github.com/woowacourse/react-shopping-cart`          |
| frontend |      3 |     2 |     8 | TBD           | `react-subway-map`             | `https://github.com/woowacourse/react-subway-map`             |

## Backend

원본:

- 7기: <https://raw.githubusercontent.com/dye0p/woowacourse-archive/refs/heads/main/README.md>
- 6기: <https://raw.githubusercontent.com/hangillee/woowacourse-archive/refs/heads/main/README.md>
- 5기: <https://raw.githubusercontent.com/yoondgu/woowacourse-archive/refs/heads/main/README.md>
- 4기: <https://raw.githubusercontent.com/yeon-06/woowacourse-archive/refs/heads/main/README.md>
- 3기: <https://raw.githubusercontent.com/Hyeon9mak/woowacourse-projects/refs/heads/main/README.md>
- 2기: <https://raw.githubusercontent.com/chws/woowa-techcourse-2020-history/refs/heads/main/README.md>
- 1기: <https://raw.githubusercontent.com/hyogenie-v/woowa-techcourse-history/refs/heads/master/README.md>

| track   | cohort | level | order | missionRepoId | repoName                    | repoUrl                                                    |
| ------- | -----: | ----: | ----: | ------------- | --------------------------- | ---------------------------------------------------------- |
| backend |      7 |     1 |     0 | TBD           | `java-lotto`                | `https://github.com/woowacourse/java-lotto`                |
| backend |      7 |     1 |     1 | TBD           | `java-attendance`           | `https://github.com/woowacourse/java-attendance`           |
| backend |      7 |     1 |     2 | TBD           | `java-blackjack`            | `https://github.com/woowacourse/java-blackjack`            |
| backend |      7 |     1 |     3 | TBD           | `java-janggi`               | `https://github.com/woowacourse/java-janggi`               |
| backend |      7 |     2 |     4 | TBD           | `spring-roomescape-admin`   | `https://github.com/woowacourse/spring-roomescape-admin`   |
| backend |      7 |     2 |     5 | TBD           | `spring-roomescape-member`  | `https://github.com/woowacourse/spring-roomescape-member`  |
| backend |      7 |     2 |     6 | TBD           | `spring-roomescape-waiting` | `https://github.com/woowacourse/spring-roomescape-waiting` |
| backend |      7 |     2 |     7 | TBD           | `spring-roomescape-payment` | `https://github.com/woowacourse/spring-roomescape-payment` |
| backend |      7 |     2 |     8 | TBD           | `lv2-final-mission`         | `https://github.com/woowacourse/lv2-final-mission`         |
| backend |      7 |     4 |     9 | TBD           | `java-http`                 | `https://github.com/woowacourse/java-http`                 |
| backend |      7 |     4 |    10 | TBD           | `java-mvc`                  | `https://github.com/woowacourse/java-mvc`                  |
| backend |      7 |     4 |    11 | TBD           | `java-jdbc`                 | `https://github.com/woowacourse/java-jdbc`                 |
| backend |      6 |     1 |     0 | TBD           | `java-racingcar`            | `https://github.com/woowacourse/java-racingcar`            |
| backend |      6 |     1 |     1 | TBD           | `java-ladder`               | `https://github.com/woowacourse/java-ladder`               |
| backend |      6 |     1 |     2 | TBD           | `java-blackjack`            | `https://github.com/woowacourse/java-blackjack`            |
| backend |      6 |     1 |     3 | TBD           | `java-chess`                | `https://github.com/woowacourse/java-chess`                |
| backend |      6 |     2 |     4 | TBD           | `spring-roomescape-admin`   | `https://github.com/woowacourse/spring-roomescape-admin`   |
| backend |      6 |     2 |     5 | TBD           | `spring-roomescape-member`  | `https://github.com/woowacourse/spring-roomescape-member`  |
| backend |      6 |     2 |     6 | TBD           | `spring-roomescape-waiting` | `https://github.com/woowacourse/spring-roomescape-waiting` |
| backend |      6 |     2 |     7 | TBD           | `spring-roomescape-payment` | `https://github.com/woowacourse/spring-roomescape-payment` |
| backend |      6 |     4 |     8 | TBD           | `java-http`                 | `https://github.com/woowacourse/java-http`                 |
| backend |      6 |     4 |     9 | TBD           | `java-mvc`                  | `https://github.com/woowacourse/java-mvc`                  |
| backend |      6 |     4 |    10 | TBD           | `java-jdbc`                 | `https://github.com/woowacourse/java-jdbc`                 |
| backend |      6 |     4 |    11 | TBD           | `java-coupon`               | `https://github.com/woowacourse/java-coupon`               |
| backend |      5 |     1 |     0 | TBD           | `java-racingcar`            | `https://github.com/woowacourse/java-racingcar`            |
| backend |      5 |     1 |     1 | TBD           | `java-ladder`               | `https://github.com/woowacourse/java-ladder`               |
| backend |      5 |     1 |     2 | TBD           | `java-blackjack`            | `https://github.com/woowacourse/java-blackjack`            |
| backend |      5 |     1 |     3 | TBD           | `java-chess`                | `https://github.com/woowacourse/java-chess`                |
| backend |      5 |     2 |     4 | TBD           | `jwp-racingcar`             | `https://github.com/woowacourse/jwp-racingcar`             |
| backend |      5 |     2 |     5 | TBD           | `jwp-shopping-cart`         | `https://github.com/woowacourse/jwp-shopping-cart`         |
| backend |      5 |     2 |     6 | TBD           | `jwp-subway-path`           | `https://github.com/woowacourse/jwp-subway-path`           |
| backend |      5 |     2 |     7 | TBD           | `jwp-shopping-order`        | `https://github.com/woowacourse/jwp-shopping-order`        |
| backend |      5 |     4 |     8 | TBD           | `jwp-dashboard-http`        | `https://github.com/woowacourse/jwp-dashboard-http`        |
| backend |      5 |     4 |     9 | TBD           | `jwp-dashboard-mvc`         | `https://github.com/woowacourse/jwp-dashboard-mvc`         |
| backend |      5 |     4 |    10 | TBD           | `jwp-dashboard-jdbc`        | `https://github.com/woowacourse/jwp-dashboard-jdbc`        |
| backend |      4 |     1 |     0 | TBD           | `java-racingcar`            | `https://github.com/woowacourse/java-racingcar`            |
| backend |      4 |     1 |     1 | TBD           | `java-lotto`                | `https://github.com/woowacourse/java-lotto`                |
| backend |      4 |     1 |     2 | TBD           | `java-blackjack`            | `https://github.com/woowacourse/java-blackjack`            |
| backend |      4 |     1 |     3 | TBD           | `java-chess`                | `https://github.com/woowacourse/java-chess`                |
| backend |      4 |     2 |     4 | TBD           | `jwp-chess`                 | `https://github.com/woowacourse/jwp-chess`                 |
| backend |      4 |     2 |     5 | TBD           | `atdd-subway-map`           | `https://github.com/woowacourse/atdd-subway-map`           |
| backend |      4 |     2 |     6 | TBD           | `atdd-subway-path`          | `https://github.com/woowacourse/atdd-subway-path`          |
| backend |      4 |     2 |     7 | TBD           | `jwp-shopping-cart`         | `https://github.com/woowacourse/jwp-shopping-cart`         |
| backend |      4 |     4 |     8 | TBD           | `jwp-dashboard-http`        | `https://github.com/woowacourse/jwp-dashboard-http`        |
| backend |      4 |     4 |     9 | TBD           | `jwp-dashboard-mvc`         | `https://github.com/woowacourse/jwp-dashboard-mvc`         |
| backend |      4 |     4 |    10 | TBD           | `jwp-dashboard-jdbc`        | `https://github.com/woowacourse/jwp-dashboard-jdbc`        |
| backend |      3 |     1 |     0 | TBD           | `java-racingcar`            | `https://github.com/woowacourse/java-racingcar`            |
| backend |      3 |     1 |     1 | TBD           | `java-lotto`                | `https://github.com/woowacourse/java-lotto`                |
| backend |      3 |     1 |     2 | TBD           | `java-blackjack`            | `https://github.com/woowacourse/java-blackjack`            |
| backend |      3 |     1 |     3 | TBD           | `java-chess`                | `https://github.com/woowacourse/java-chess`                |
| backend |      3 |     1 |     4 | TBD           | `js-todo-list-step1`        | `https://github.com/woowacourse/js-todo-list-step1`        |
| backend |      3 |     1 |     5 | TBD           | `js-todo-list-step2`        | `https://github.com/woowacourse/js-todo-list-step2`        |
| backend |      3 |     2 |     6 | TBD           | `jwp-chess`                 | `https://github.com/woowacourse/jwp-chess`                 |
| backend |      3 |     2 |     7 | TBD           | `atdd-subway-map`           | `https://github.com/woowacourse/atdd-subway-map`           |
| backend |      3 |     2 |     8 | TBD           | `atdd-subway-path`          | `https://github.com/woowacourse/atdd-subway-path`          |
| backend |      3 |     2 |     9 | TBD           | `atdd-subway-fare`          | `https://github.com/woowacourse/atdd-subway-fare`          |
| backend |      3 |     4 |    10 | TBD           | `jwp-dashboard-http`        | `https://github.com/woowacourse/jwp-dashboard-http`        |
| backend |      3 |     4 |    11 | TBD           | `jwp-dashboard-mvc`         | `https://github.com/woowacourse/jwp-dashboard-mvc`         |
| backend |      3 |     4 |    12 | TBD           | `jwp-dashboard-jdbc`        | `https://github.com/woowacourse/jwp-dashboard-jdbc`        |
| backend |      3 |     4 |    13 | TBD           | `sql-tuning`                | `https://github.com/woowacourse/sql-tuning`                |
| backend |      3 |     4 |    14 | TBD           | `jwp-refactoring`           | `https://github.com/woowacourse/jwp-refactoring`           |
| backend |      2 |     1 |     0 | TBD           | `java-calculator`           | `https://github.com/woowacourse/java-calculator`           |
| backend |      2 |     1 |     1 | TBD           | `java-racingcar`            | `https://github.com/woowacourse/java-racingcar`            |
| backend |      2 |     1 |     2 | TBD           | `java-lotto`                | `https://github.com/woowacourse/java-lotto`                |
| backend |      2 |     1 |     3 | TBD           | `java-blackjack`            | `https://github.com/woowacourse/java-blackjack`            |
| backend |      2 |     1 |     4 | TBD           | `java-chess`                | `https://github.com/woowacourse/java-chess`                |
| backend |      2 |     2 |     5 | TBD           | `jwp-chess`                 | `https://github.com/woowacourse/jwp-chess`                 |
| backend |      2 |     2 |     6 | TBD           | `atdd-subway-admin`         | `https://github.com/woowacourse/atdd-subway-admin`         |
| backend |      2 |     2 |     7 | TBD           | `atdd-subway-path`          | `https://github.com/woowacourse/atdd-subway-path`          |
| backend |      2 |     2 |     8 | TBD           | `atdd-subway-favorite`      | `https://github.com/woowacourse/atdd-subway-favorite`      |
| backend |      2 |     4 |     9 | TBD           | `jwp-was`                   | `https://github.com/woowacourse/jwp-was`                   |
| backend |      1 |     1 |     0 | TBD           | `java-racingcar`            | `https://github.com/woowacourse/java-racingcar`            |
| backend |      1 |     1 |     1 | TBD           | `java-ladder`               | `https://github.com/woowacourse/java-ladder`               |
| backend |      1 |     1 |     2 | TBD           | `java-coordinate`           | `https://github.com/woowacourse/java-coordinate`           |
| backend |      1 |     1 |     3 | TBD           | `java-lotto`                | `https://github.com/woowacourse/java-lotto`                |
| backend |      1 |     1 |     4 | TBD           | `java-chess`                | `https://github.com/woowacourse/java-chess`                |
| backend |      1 |     2 |     5 | TBD           | `jwp-blog`                  | `https://github.com/woowacourse/jwp-blog`                  |
| backend |      1 |     2 |     6 | TBD           | `miniprojects-2019`         | `https://github.com/woowacourse/miniprojects-2019`         |
| backend |      1 |     3 |     7 | TBD           | `jwp-was`                   | `https://github.com/woowacourse/jwp-was`                   |
| backend |      1 |     3 |     8 | TBD           | `jwp-mvc`                   | `https://github.com/woowacourse/jwp-mvc`                   |
| backend |      1 |     3 |     9 | TBD           | `jwp-jdbc`                  | `https://github.com/woowacourse/jwp-jdbc`                  |
| backend |      1 |     3 |    10 | TBD           | `jwp-di`                    | `https://github.com/woowacourse/jwp-di`                    |

## Android

원본:

- 7기: <https://raw.githubusercontent.com/yrsel/woowacourse-archive/refs/heads/main/README.md>
- 6기: <https://raw.githubusercontent.com/kimhm0728/woowacourse-archive/refs/heads/main/README.md>
- 5기: <https://raw.githubusercontent.com/hyemdooly/woowacourse-android-5-dooly/refs/heads/main/README.md>

| track   | cohort | level | order | missionRepoId | repoName                 | repoUrl                                                 |
| ------- | -----: | ----: | ----: | ------------- | ------------------------ | ------------------------------------------------------- |
| android |      7 |     1 |     0 | TBD           | `kotlin-racingcar`       | `https://github.com/woowacourse/kotlin-racingcar`       |
| android |      7 |     1 |     1 | TBD           | `kotlin-lotto`           | `https://github.com/woowacourse/kotlin-lotto`           |
| android |      7 |     1 |     2 | TBD           | `kotlin-blackjack`       | `https://github.com/woowacourse/kotlin-blackjack`       |
| android |      7 |     1 |     3 | TBD           | `kotlin-omok`            | `https://github.com/woowacourse/kotlin-omok`            |
| android |      7 |     2 |     4 | TBD           | `android-movie-ticket`   | `https://github.com/woowacourse/android-movie-ticket`   |
| android |      7 |     2 |     5 | TBD           | `android-movie-theater`  | `https://github.com/woowacourse/android-movie-theater`  |
| android |      7 |     2 |     6 | TBD           | `android-shopping-cart`  | `https://github.com/woowacourse/android-shopping-cart`  |
| android |      7 |     2 |     7 | TBD           | `android-shopping-order` | `https://github.com/woowacourse/android-shopping-order` |
| android |      7 |     4 |     8 | TBD           | `android-payments`       | `https://github.com/woowacourse/android-payments`       |
| android |      7 |     4 |     9 | TBD           | `android-di`             | `https://github.com/woowacourse/android-di`             |
| android |      6 |     1 |     0 | TBD           | `kotlin-racingcar`       | `https://github.com/woowacourse/kotlin-racingcar`       |
| android |      6 |     1 |     1 | TBD           | `kotlin-lotto`           | `https://github.com/woowacourse/kotlin-lotto`           |
| android |      6 |     1 |     2 | TBD           | `kotlin-blackjack`       | `https://github.com/woowacourse/kotlin-blackjack`       |
| android |      6 |     1 |     3 | TBD           | `kotlin-omok`            | `https://github.com/woowacourse/kotlin-omok`            |
| android |      6 |     2 |     4 | TBD           | `android-movie-ticket`   | `https://github.com/woowacourse/android-movie-ticket`   |
| android |      6 |     2 |     5 | TBD           | `android-movie-theater`  | `https://github.com/woowacourse/android-movie-theater`  |
| android |      6 |     2 |     6 | TBD           | `android-shopping-cart`  | `https://github.com/woowacourse/android-shopping-cart`  |
| android |      6 |     2 |     7 | TBD           | `android-shopping-order` | `https://github.com/woowacourse/android-shopping-order` |
| android |      6 |     4 |     8 | TBD           | `android-di`             | `https://github.com/woowacourse/android-di`             |
| android |      6 |     4 |     9 | TBD           | `android-paint`          | `https://github.com/woowacourse/android-paint`          |
| android |      6 |     4 |    10 | TBD           | `android-signup`         | `https://github.com/woowacourse/android-signup`         |
| android |      5 |     1 |     0 | TBD           | `kotlin-racingcar`       | `https://github.com/woowacourse/kotlin-racingcar`       |
| android |      5 |     1 |     1 | TBD           | `kotlin-lotto`           | `https://github.com/woowacourse/kotlin-lotto`           |
| android |      5 |     1 |     2 | TBD           | `kotlin-blackjack`       | `https://github.com/woowacourse/kotlin-blackjack`       |
| android |      5 |     1 |     3 | TBD           | `kotlin-omok`            | `https://github.com/woowacourse/kotlin-omok`            |
| android |      5 |     2 |     4 | TBD           | `android-movie-ticket`   | `https://github.com/woowacourse/android-movie-ticket`   |
| android |      5 |     2 |     5 | TBD           | `android-movie-theater`  | `https://github.com/woowacourse/android-movie-theater`  |
| android |      5 |     2 |     6 | TBD           | `android-shopping-cart`  | `https://github.com/woowacourse/android-shopping-cart`  |
| android |      5 |     2 |     7 | TBD           | `android-shopping-order` | `https://github.com/woowacourse/android-shopping-order` |
| android |      5 |     4 |     8 | TBD           | `android-di`             | `https://github.com/woowacourse/android-di`             |
| android |      5 |     4 |     9 | TBD           | `android-paint`          | `https://github.com/woowacourse/android-paint`          |

## 제외한 항목

아래 항목은 `CohortRepo` 입력 대상에서 제외했다.

| 원본                                  | 제외 이유                                                                |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Precourse / 최종 코딩테스트           | 정규 레벨 미션 repo가 아니며 `woowacourse-precourse` 또는 개인 repo 중심 |
| Level 3 팀 프로젝트                   | `woowacourse-teams` org의 팀 프로젝트 repo                               |
| 글쓰기 미션                           | `CohortRepo`가 아니라 글/블로그 도메인                                   |
| 테코톡                                | `TecoTalk` 도메인                                                        |
| Study                                 | 우테코 내부 스터디 기록이며 미션 repo가 아님                             |
| 공식 `woowacourse` repo/PR 확인 불가  | 개인 repo만 있거나 PR 링크가 없어 `MissionRepo` 매칭 신뢰도가 낮음       |
| 3기 Frontend Level 1 Cypress 맛보기   | 공식 `woowacourse` PR 링크가 없음                                        |
| 2기 Backend Level 1 웹 Basic / `html` | 공식 `woowacourse` PR 링크가 없음                                        |

## 실제 CohortRepo insert payload 형태

`track`, `repoName`, `repoUrl`은 DB에 직접 들어가지 않고, `MissionRepo`를 찾고 검수하기 위한 보조 컬럼이다. 실제 insert에는 위 표의 각 행에서 `cohort`, `level`, `order`, `missionRepoId`만 사용한다.
