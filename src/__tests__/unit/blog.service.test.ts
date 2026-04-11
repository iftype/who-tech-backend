import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { Mock } from '@jest/globals';
import { resolveRSSUrlsForBlog, sanitizeXml, createBlogService } from '../../features/blog/blog.service.js';
import type { MemberWithRelations } from '../../db/repositories/member.repository.js';

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

describe('createBlogService - syncBlogs', () => {
  const mockMember = {
    id: 1,
    githubId: 'testuser',
    blog: 'https://testblog.com',
  } as unknown as MemberWithRelations;

  function makeMockDeps(
    overrides: {
      findWithFilters?: Mock<() => Promise<MemberWithRelations[]>>;
      patch?: Mock<() => Promise<void>>;
      deleteByMemberNotInUrls?: Mock<() => Promise<{ count: number }>>;
      deleteBefore?: Mock<() => Promise<{ count: number }>>;
      upsert?: Mock<() => Promise<void>>;
    } = {},
  ) {
    return {
      memberRepo: {
        findWithFilters:
          overrides.findWithFilters ?? (jest.fn() as Mock<() => Promise<MemberWithRelations[]>>).mockResolvedValue([]),
        patch: overrides.patch ?? (jest.fn() as Mock<() => Promise<void>>).mockResolvedValue(undefined),
      },
      blogPostRepo: {
        deleteByMemberNotInUrls:
          overrides.deleteByMemberNotInUrls ??
          (jest.fn() as Mock<() => Promise<{ count: number }>>).mockResolvedValue({ count: 0 }),
        deleteBefore:
          overrides.deleteBefore ??
          (jest.fn() as Mock<() => Promise<{ count: number }>>).mockResolvedValue({ count: 0 }),
        upsert: overrides.upsert ?? (jest.fn() as Mock<() => Promise<void>>).mockResolvedValue(undefined),
      },
    } as Parameters<typeof createBlogService>[0];
  }

  const validRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <item>
      <title>글 제목</title>
      <link>https://testblog.com/post/1</link>
      <pubDate>${new Date(Date.now() - 1000 * 60 * 60 * 24).toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('피드에서 사라진 글의 삭제 건수가 deleted에 포함된다', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => validRssXml,
    } as Response);

    const deleteByMemberNotInUrls = (jest.fn() as Mock<() => Promise<{ count: number }>>).mockResolvedValue({
      count: 2,
    });
    const deleteBefore = (jest.fn() as Mock<() => Promise<{ count: number }>>).mockResolvedValue({ count: 1 });

    const deps = makeMockDeps({ deleteByMemberNotInUrls, deleteBefore });
    (deps.memberRepo.findWithFilters as Mock<() => Promise<MemberWithRelations[]>>).mockResolvedValue([mockMember]);

    const service = createBlogService(deps);
    const result = await service.syncBlogs(1);

    expect(result.deleted).toBe(3);
    fetchSpy.mockRestore();
  });

  it('피드에서 사라진 글이 없으면 deleteByMemberNotInUrls count 0이 누적되지 않는다', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => validRssXml,
    } as Response);

    const deleteByMemberNotInUrls = (jest.fn() as Mock<() => Promise<{ count: number }>>).mockResolvedValue({
      count: 0,
    });
    const deleteBefore = (jest.fn() as Mock<() => Promise<{ count: number }>>).mockResolvedValue({ count: 5 });

    const deps = makeMockDeps({ deleteByMemberNotInUrls, deleteBefore });
    (deps.memberRepo.findWithFilters as Mock<() => Promise<MemberWithRelations[]>>).mockResolvedValue([mockMember]);

    const service = createBlogService(deps);
    const result = await service.syncBlogs(1);

    expect(result.deleted).toBe(5);
    fetchSpy.mockRestore();
  });

  it('RSS 수집 실패 시 deleteByMemberNotInUrls가 호출되지 않는다', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    } as Response);

    const deleteByMemberNotInUrls = jest.fn() as Mock<() => Promise<{ count: number }>>;
    const deps = makeMockDeps({ deleteByMemberNotInUrls });
    (deps.memberRepo.findWithFilters as Mock<() => Promise<MemberWithRelations[]>>).mockResolvedValue([mockMember]);

    const service = createBlogService(deps);
    await service.syncBlogs(1);

    expect(deleteByMemberNotInUrls).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
