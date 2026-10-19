import { describe, expect, it } from '@jest/globals';
import { isPublicHostname, matchesDomain, normalizeBlogUrl } from '../../shared/blog.js';

describe('normalizeBlogUrl', () => {
  it('프로토콜이 없으면 https를 붙인다', () => {
    expect(normalizeBlogUrl('iftype.github.io')).toBe('https://iftype.github.io');
  });

  it('끝 슬래시는 제거한다', () => {
    expect(normalizeBlogUrl('https://iftype.tistory.com/')).toBe('https://iftype.tistory.com');
  });

  it('유효하지 않으면 null을 반환한다', () => {
    expect(normalizeBlogUrl('not a url')).toBeNull();
  });

  it('should keep a blog whose host only ends with an ignored domain string', () => {
    expect(normalizeBlogUrl('https://netflix.com/techblog')).toBe('https://netflix.com/techblog');
    expect(normalizeBlogUrl('https://dropbox.com')).toBe('https://dropbox.com');
    expect(normalizeBlogUrl('https://mynotion.so')).toBe('https://mynotion.so');
  });

  it('should drop ignored domains and their subdomains', () => {
    expect(normalizeBlogUrl('https://x.com/iftype')).toBeNull();
    expect(normalizeBlogUrl('https://www.x.com/iftype')).toBeNull();
    expect(normalizeBlogUrl('https://iftype.notion.site/blog')).toBeNull();
    expect(normalizeBlogUrl('https://custom.example.com', ['example.com'])).toBeNull();
  });

  it('should drop private, loopback and metadata addresses', () => {
    expect(normalizeBlogUrl('http://localhost:3000')).toBeNull();
    expect(normalizeBlogUrl('127.0.0.1:3000')).toBeNull();
    expect(normalizeBlogUrl('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(normalizeBlogUrl('http://10.0.0.1')).toBeNull();
    expect(normalizeBlogUrl('http://192.168.0.10')).toBeNull();
    expect(normalizeBlogUrl('http://172.20.1.1')).toBeNull();
    expect(normalizeBlogUrl('http://[::1]:3000')).toBeNull();
    expect(normalizeBlogUrl('http://2130706433')).toBeNull();
  });

  it('should drop non-http protocols', () => {
    expect(normalizeBlogUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeBlogUrl('ftp://example.com')).toBeNull();
  });
});

describe('matchesDomain', () => {
  it('should match only on a dot boundary', () => {
    expect(matchesDomain('x.com', 'x.com')).toBe(true);
    expect(matchesDomain('www.x.com', 'x.com')).toBe(true);
    expect(matchesDomain('netflix.com', 'x.com')).toBe(false);
    expect(matchesDomain('WWW.X.COM', 'x.com')).toBe(true);
    expect(matchesDomain('a.com', '')).toBe(false);
  });
});

describe('isPublicHostname', () => {
  it.each([
    'localhost',
    'api.localhost',
    'printer.local',
    'intranet',
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '224.0.0.1',
    '[::1]',
    '[::ffff:7f00:1]',
    '[fc00::1]',
    '[fd12::1]',
    '[fe80::1]',
    '0x7f.0.0.1',
  ])('should reject %s', (host) => {
    expect(isPublicHostname(host)).toBe(false);
  });

  it.each(['velog.io', 'iftype.tistory.com', '8.8.8.8', '172.32.0.1', '[2606:4700::1111]'])(
    'should accept %s',
    (host) => {
      expect(isPublicHostname(host)).toBe(true);
    },
  );
});
