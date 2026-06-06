// YouTube Data API v3 클라이언트 — 재생목록의 영상 메타데이터(제목/업로드일/썸네일/조회수)를 수집한다.
// 재생목록 689개 기준: playlistItems.list(50개/페이지) + videos.list(50개/배치) ≈ 28 쿼터.

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const PAGE_SIZE = 50;

export type YouTubeVideo = {
  videoId: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  uploadedAt: Date;
  viewCount: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`YouTube API ${response.status}: ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

type PlaylistItemsResponse = {
  nextPageToken?: string;
  items: { contentDetails?: { videoId?: string } }[];
};

type VideosResponse = {
  items: {
    id: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    statistics?: { viewCount?: string };
  }[];
};

function pickThumbnail(thumbnails?: Record<string, { url?: string }>): string | null {
  if (!thumbnails) return null;
  return (
    thumbnails['maxres']?.url ??
    thumbnails['standard']?.url ??
    thumbnails['high']?.url ??
    thumbnails['medium']?.url ??
    thumbnails['default']?.url ??
    null
  );
}

/**
 * 재생목록의 영상 id를 수집한다.
 * maxVideos 지정 시 해당 개수만큼만(증분 모드: 재생목록 앞=최신 업로드) 가져오고 페이지네이션을 멈춘다.
 */
async function fetchPlaylistVideoIds(playlistId: string, apiKey: string, maxVideos?: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'contentDetails',
      maxResults: String(PAGE_SIZE),
      playlistId,
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await fetchJson<PlaylistItemsResponse>(`${API_BASE}/playlistItems?${params.toString()}`);
    for (const item of data.items) {
      const videoId = item.contentDetails?.videoId;
      if (videoId) ids.push(videoId);
    }
    pageToken = data.nextPageToken;
  } while (pageToken && (maxVideos === undefined || ids.length < maxVideos));

  return maxVideos === undefined ? ids : ids.slice(0, maxVideos);
}

/** videoId 배치(최대 50개)로 영상 상세(제목/업로드일/썸네일/조회수)를 가져온다. */
async function fetchVideoDetails(videoIds: string[], apiKey: string): Promise<YouTubeVideo[]> {
  const result: YouTubeVideo[] = [];

  for (let i = 0; i < videoIds.length; i += PAGE_SIZE) {
    const batch = videoIds.slice(i, i + PAGE_SIZE);
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: batch.join(','),
      maxResults: String(PAGE_SIZE),
      key: apiKey,
    });

    const data = await fetchJson<VideosResponse>(`${API_BASE}/videos?${params.toString()}`);
    for (const item of data.items) {
      const publishedAt = item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null;
      if (!item.snippet?.title || !publishedAt || isNaN(publishedAt.getTime())) continue;

      const viewCountRaw = item.statistics?.viewCount;
      const viewCount = viewCountRaw ? Number.parseInt(viewCountRaw, 10) : 0;

      result.push({
        videoId: item.id,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
        uploadedAt: publishedAt,
        viewCount: Number.isFinite(viewCount) ? viewCount : 0,
      });
    }
  }

  return result;
}

/**
 * 재생목록의 영상을 수집한다.
 * - 전체(초기 백필): opts 생략
 * - 증분(주간): { maxVideos } 로 최신 N개만 — 재생목록 앞쪽이 최신 업로드
 */
export async function fetchPlaylistVideos(
  playlistId: string,
  apiKey: string,
  opts?: { maxVideos?: number },
): Promise<YouTubeVideo[]> {
  try {
    const videoIds = await fetchPlaylistVideoIds(playlistId, apiKey, opts?.maxVideos);
    return await fetchVideoDetails(videoIds, apiKey);
  } catch (error) {
    throw new Error(`failed to fetch playlist ${playlistId}: ${errorMessage(error)}`);
  }
}
