// 우아한테크코스 테코톡 제목 관례:
//   단독:     "[10분 테코톡] 클라우디의 세션과 JWT"
//   2인 발표: "[10분 테코톡] 프리, 말론의 B-Tree 인덱스와 클러스터링 인덱스"
//   구버전:   "[N기 테코톡] 후니 : 우아한 객체지향"
//
// 매칭 전략(사용자 정책): 제목에서 닉네임을 "추출"하지 않고, **우리가 보유한 (해당 기수) 닉네임이
// 발표자 구역에 포함되는지**로 매칭한다. 발표자 구역 = 첫 '의 '(소유격+공백) 또는 콜론 앞부분.
// 주제 영역을 검색에서 제외해 오탐을 막고, 2인 발표(쉼표 나열)도 모두 매칭한다.

const BRACKET_SEGMENT = /\[[^\]]*\]/g;
// 발표자 구역 종료 지점: 소유격 '의'+공백  또는  콜론(반각/전각)
const ZONE_TERMINATOR = /의\s|[:：]/;

/** 제목에서 대괄호 라벨을 제거하고 발표자 구역(닉네임 나열 부분)만 반환한다. */
export function extractSpeakerZone(title: string): string {
  if (!title) return '';
  const normalizedTitle = title.normalize('NFC');
  const withoutBrackets = normalizedTitle.replace(BRACKET_SEGMENT, ' ');
  const zone = withoutBrackets.split(ZONE_TERMINATOR)[0] ?? '';
  return zone.trim();
}

/**
 * 발표자 구역에 닉네임이 (경계 포함) 등장하는지 검사한다.
 * - 앞 경계: 구역 시작 또는 한글/영문/숫자가 아닌 문자(공백, 쉼표, & 등)
 * - 뒤 경계: 구역 끝 또는 소유격/접속 조사(의/와/과/랑) 또는 비단어 문자
 * 1글자 닉네임은 오탐이 커 매칭 대상에서 제외한다.
 */
export function nicknameInZone(zone: string, nickname: string): boolean {
  const normalizedZone = zone.normalize('NFC');
  const normalizedNickname = nickname.normalize('NFC');
  if (!normalizedZone || normalizedNickname.length < 2) return false;

  let from = 0;
  for (;;) {
    const idx = normalizedZone.indexOf(normalizedNickname, from);
    if (idx === -1) return false;

    const beforeOk = idx === 0 || /[^가-힣A-Za-z0-9]/.test(normalizedZone[idx - 1] ?? '');
    const rest = normalizedZone.slice(idx + normalizedNickname.length);
    const afterOk = rest === '' || /^(의|와|과|랑)/.test(rest) || /^[^가-힣A-Za-z0-9]/.test(rest);

    if (beforeOk && afterOk) return true;
    from = idx + 1;
  }
}

/** 제목 대괄호 라벨에서 기수 힌트를 추출한다. "[9기 테코톡]" → 9. "10분"은 매칭되지 않음. (매칭 본체는 업로드 연도 사용) */
export function parseCohortHint(title: string): number | null {
  const match = title.match(/(\d+)\s*기/);
  if (!match || !match[1]) return null;
  const cohort = Number.parseInt(match[1], 10);
  return Number.isFinite(cohort) ? cohort : null;
}
