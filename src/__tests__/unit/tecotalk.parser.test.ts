import { describe, expect, it } from '@jest/globals';
import { extractSpeakerZone, nicknameInZone, parseCohortHint } from '../../features/tecotalk/tecotalk.parser.js';

describe('extractSpeakerZone', () => {
  it.each([
    ['[10분 테코톡] 클라우디의 세션과 JWT', '클라우디'],
    ['[10분 테코톡] 프리, 말론의 B-Tree 인덱스와 클러스터링 인덱스', '프리, 말론'],
    ['[10분 테코톡] 히스타, 미소의 마인크래프트로 배우는 네트워크 기초', '히스타, 미소'],
    ['[우아한테크코스 9기 테코톡] 후니 : 우아한 객체지향', '후니'],
    ['[10분 테코톡] 마이찬의 BDD는 방향을, TDD는 실행을 만든다(feat. Cucumber)', '마이찬'],
  ])('"%s" → 발표자 구역 "%s"', (title, expected) => {
    expect(extractSpeakerZone(title)).toBe(expected);
  });

  it('빈 문자열은 빈 구역', () => {
    expect(extractSpeakerZone('')).toBe('');
  });
});

describe('nicknameInZone', () => {
  it('소유격 의가 붙은 닉네임을 매칭한다', () => {
    expect(nicknameInZone('클라우디', '클라우디')).toBe(true);
  });

  it('쉼표로 나열된 공동 발표자를 각각 매칭한다', () => {
    const zone = extractSpeakerZone('[10분 테코톡] 프리, 말론의 B-Tree 인덱스');
    expect(nicknameInZone(zone, '프리')).toBe(true);
    expect(nicknameInZone(zone, '말론')).toBe(true);
  });

  it('부분 문자열 오탐을 막는다 (코 ⊄ 코로구)', () => {
    expect(nicknameInZone('코로구', '코')).toBe(false);
  });

  it('1글자 닉네임은 매칭하지 않는다', () => {
    expect(nicknameInZone('이 발표', '이')).toBe(false);
  });

  it('구역에 없는 닉네임은 매칭 실패', () => {
    expect(nicknameInZone('클라우디', '피트')).toBe(false);
  });
});

describe('parseCohortHint', () => {
  it.each([
    ['[우아한테크코스 9기 테코톡] 후니 : DI', 9],
    ['[10분 테코톡] 클라우디의 세션과 JWT', null], // "10분"은 기수가 아님
  ])('"%s" → %s', (title, expected) => {
    expect(parseCohortHint(title)).toBe(expected);
  });
});
