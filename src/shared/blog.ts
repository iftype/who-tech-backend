const DEFAULT_IGNORED_DOMAINS = [
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
];

// 도메인 자신이거나 그 하위 도메인일 때만 일치 (x.com 이 netflix.com 까지 걸러내지 않게 점 경계로 비교)
export function matchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const d = domain.trim().toLowerCase().replace(/^\.+/, '');
  if (!d) return false;
  return host === d || host.endsWith(`.${d}`);
}

function parseIPv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return null;
  return nums;
}

function isPrivateIPv4([a, b]: number[]): boolean {
  if (a === undefined || b === undefined) return true;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 (CGNAT)
    (a === 169 && b === 254) || // link-local, 클라우드 메타데이터
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    a >= 224 // 멀티캐스트·예약
  );
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === '::' || h === '::1') return true;
  // IPv4-mapped (::ffff:a.b.c.d) — URL은 ::ffff:7f00:1 처럼 16진으로 바꿔 준다
  const mapped = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1] ?? '0', 16);
    const lo = parseInt(mapped[2] ?? '0', 16);
    return isPrivateIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }
  const dotted = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = parseIPv4(dotted[1] ?? '');
    return v4 ? isPrivateIPv4(v4) : true;
  }
  return /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h); // fc00::/7, fe80::/10
}

// 서버가 대신 요청해도 되는 공개 호스트인지. 사설망·루프백·메타데이터 주소와 내부 이름을 막는다 (SSRF 방지)
export function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return false;

  if (host.startsWith('[') && host.endsWith(']')) return !isPrivateIPv6(host.slice(1, -1));
  if (host.includes(':')) return !isPrivateIPv6(host);

  const v4 = parseIPv4(host);
  if (v4) return !isPrivateIPv4(v4);
  // 숫자로만 된 다른 표기(2130706433, 0x7f.1 등)는 IP로 해석될 수 있어 거부
  if (/^[\d.]+$/.test(host) || /^0x/i.test(host)) return false;

  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (!host.includes('.')) return false; // 단일 라벨 (intranet 이름)
  return true;
}

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

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (!isPublicHostname(url.hostname)) {
      return null;
    }

    const allIgnored = [...DEFAULT_IGNORED_DOMAINS, ...ignoredDomains];
    if (allIgnored.some((d) => matchesDomain(url.hostname, d))) {
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
