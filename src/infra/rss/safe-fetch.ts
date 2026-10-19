import { isPublicHostname } from '../../shared/blog.js';

const MAX_REDIRECTS = 5;

export class UnsafeUrlError extends Error {
  constructor(url: string) {
    super(`blocked non-public url: ${url}`);
    this.name = 'UnsafeUrlError';
  }
}

function assertPublic(url: URL): void {
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !isPublicHostname(url.hostname)) {
    throw new UnsafeUrlError(url.toString());
  }
}

// 리다이렉트를 직접 따라가며 hop마다 공개 호스트인지 검사한다.
// redirect: 'follow' 는 공개 주소가 사설 주소로 보내도 그대로 따라가서 서버 내부망에 요청하게 된다
export async function fetchPublic(input: string, init: RequestInit = {}): Promise<Response> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublic(url);
    const response = await fetch(url, { ...init, redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    url = new URL(location, url);
  }
  throw new Error(`too many redirects: ${input}`);
}
