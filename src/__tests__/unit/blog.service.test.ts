import { describe, expect, it } from '@jest/globals';
import { resolveRSSUrlsForBlog } from '../../features/blog/blog.service.js';

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
      'https://lns13301.github.io/github-blog/feed.xml',
      'https://lns13301.github.io/github-blog/rss.xml',
      'https://lns13301.github.io/github-blog/atom.xml',
      'https://lns13301.github.io/github-blog/feed',
      'https://lns13301.github.io/github-blog/rss',
      'https://lns13301.github.io/github-blog/index.xml',
    ]);
  });
});
