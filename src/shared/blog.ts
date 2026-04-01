export function normalizeBlogUrl(blogUrl: string | null | undefined, ignoredDomains: string[] = []): string | null {
  if (!blogUrl) {
    return null;
  }

  const trimmed = blogUrl.trim();
  if (!trimmed) {
    return null;
  }

  // Ignore pure emails
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    const allIgnored = [
      'notion.site',
      'notion.so',
      'oopy.io',
      'instagram.com',
      'linkedin.com',
      'acmicpc.net',
      'solved.ac',
      'youtube.com',
      'x.com',
      'twitter.com',
      'facebook.com',
      'gmail.com',
      'snu.ac.kr',
      ...ignoredDomains,
    ];

    if (allIgnored.some((d) => url.hostname.endsWith(d))) {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
