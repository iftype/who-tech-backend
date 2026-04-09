import { describe, expect, it } from '@jest/globals';
import { resolveRSSUrlsForBlog, sanitizeXml } from '../../features/blog/blog.service.js';

describe('resolveRSSUrlsForBlog', () => {
  it('velog posts 경로는 사용자 RSS로 변환한다', () => {
    expect(resolveRSSUrlsForBlog('https://velog.io/@ulim130/posts')).toEqual(['https://v2.velog.io/rss/@ulim130']);
  });

  it('medium 프로필은 feed 경로로 변환한다', () => {
    expect(resolveRSSUrlsForBlog('https://medium.com/@jeyongsong')).toEqual(['https://medium.com/feed/@jeyongsong']);
  });

  it('이미 feed 경로면 그대로 사용한다', () => {
    expect(resolveRSSUrlsForBlog('https://myblog.com/feed')).toEqual(['https://myblog.com/feed']);
  });

  it('github pages 블로그는 여러 common candidate를 생성한다', () => {
    expect(resolveRSSUrlsForBlog('https://lns13301.github.io/github-blog')).toEqual([
      'https://lns13301.github.io/github-blog/rss',
      'https://lns13301.github.io/github-blog/feed',
      'https://lns13301.github.io/github-blog/feed.xml',
      'https://lns13301.github.io/github-blog/rss.xml',
      'https://lns13301.github.io/github-blog/atom.xml',
      'https://lns13301.github.io/github-blog/index.xml',
    ]);
  });
});

describe('sanitizeXml', () => {
  it('제어 문자(0x00-0x08)를 제거한다', () => {
    expect(sanitizeXml('hello\x00\x01\x08world')).toBe('helloworld');
  });

  it('0x0B, 0x0C 제어 문자를 제거한다', () => {
    expect(sanitizeXml('a\x0Bb\x0Cc')).toBe('abc');
  });

  it('0x0E-0x1F 제어 문자를 제거한다', () => {
    expect(sanitizeXml('a\x0Eb\x1Fc')).toBe('abc');
  });

  it('0x7F(DEL) 제거', () => {
    expect(sanitizeXml('a\x7Fb')).toBe('ab');
  });

  it('줄바꿈(0x0A)과 탭(0x09)은 보존한다', () => {
    const input = 'line1\nline2\ttab';
    expect(sanitizeXml(input)).toBe(input);
  });

  it('이스케이프되지 않은 & 를 &amp;로 변환한다', () => {
    expect(sanitizeXml('<title>A & B</title>')).toBe('<title>A &amp; B</title>');
  });

  it('올바른 XML 엔티티(&amp; &lt; &gt; &quot; &apos;)는 변환하지 않는다', () => {
    const input = '&amp; &lt; &gt; &quot; &apos;';
    expect(sanitizeXml(input)).toBe(input);
  });

  it('&#숫자; 엔티티는 변환하지 않는다', () => {
    expect(sanitizeXml('&#123; &#x1F;')).toBe('&#123; &#x1F;');
  });

  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(sanitizeXml('')).toBe('');
  });

  it('정상 XML은 변경 없이 반환한다', () => {
    const xml = '<item><title>테스트 글</title><link>https://example.com</link></item>';
    expect(sanitizeXml(xml)).toBe(xml);
  });
});
