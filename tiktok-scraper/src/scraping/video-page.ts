import { Page } from 'playwright';
import {
  randomDelay,
  safeText,
  safeAttr,
  parseNumber,
  extractHashtags,
  extractMentions,
  parseVtt,
  extractVideoId,
} from './browser.js';
import { SerpResult } from './search-page.js';
import { TikTokVideo } from '../types.js';

interface EmbeddedVideoData {
  description?: string;
  author?: {
    id?: string;
    uniqueId?: string;
    nickname?: string;
    avatarUrl?: string;
    signature?: string;
    verified?: boolean;
    followerCount?: number;
    followingCount?: number;
    heartCount?: number;
    videoCount?: number;
  };
  stats?: {
    playCount?: number;
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
    collectCount?: number;
  };
  hashtags?: string[];
  createTime?: number;
}

export async function scrapeTikTokVideo(
  videoUrl: string,
  page: Page,
  serpData?: SerpResult,
  onError?: (msg: string) => void,
): Promise<TikTokVideo | null> {
  console.log(`  Scraping video: ${videoUrl.substring(0, 70)}...`);

  let capturedVtt = '';

  const handleResponse = async (response: import('playwright').Response) => {
    try {
      const url = response.url();
      if (!url.includes('tiktokcdn')) return;
      const headers = response.headers();
      const contentType = headers['content-type'] || '';
      const contentLength = parseInt(headers['content-length'] || '0', 10);
      const isVttCandidate =
        contentType.includes('text/vtt') ||
        contentType.includes('text/plain') ||
        // TikTok CDN serves VTT files with wrong content-type: video/mp4.
        // Identify them by small size (<2000 bytes) since real videos are much larger.
        (contentType.includes('video/mp4') && contentLength > 0 && contentLength < 2000);
      if (!isVttCandidate) return;
      const body = await response.text().catch(() => '');
      if (body.startsWith('WEBVTT')) {
        capturedVtt = body;
        console.log(`    ✓ Captured VTT captions (${body.length} bytes, content-type: ${contentType})`);
      }
    } catch (_) {}
  };

  page.on('response', handleResponse);

  try {
    const t0 = performance.now();
    await page.goto(videoUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const gotoMs = performance.now() - t0;
    await randomDelay(3000, 5000);
    const delayMs = performance.now() - t0 - gotoMs;

    const videoId = extractVideoId(videoUrl);
    const urlAuthorMatch = videoUrl.match(/@([\w.]+)/);
    const authorFromUrl = urlAuthorMatch ? urlAuthorMatch[1] : '';

    const t1 = performance.now();

    // __NEXT_DATA__ is skipped — TikTok blocks it for unauthenticated sessions.
    // There is no playCount/viewCount element in the DOM on individual video pages.
    // playCount comes from serpData (discover page or SERP <cite> element) instead.
    const embedded = null as EmbeddedVideoData | null;

    const [
      ogTitle, ogDescription, metaDescription, ogImage,
      videoDescText, likeText, commentText, shareText,
      collectText, bookmarkText, viewsText,
      posterAttr, poiText, poiHref, musicText,
    ] = await Promise.all([
      safeAttr(page, 'meta[property="og:title"]', 'content'),
      safeAttr(page, 'meta[property="og:description"]', 'content'),
      safeAttr(page, 'meta[name="description"]', 'content'),
      safeAttr(page, 'meta[property="og:image"]', 'content'),
      safeText(page, '[data-e2e="video-desc"]'),
      safeText(page, '[data-e2e="like-count"]'),
      safeText(page, '[data-e2e="comment-count"]'),
      safeText(page, '[data-e2e="share-count"]'),
      safeText(page, '[data-e2e="collect-count"]'),
      safeText(page, '[data-e2e="bookmark-count"]'),
      safeText(page, '[data-e2e="video-views"]'),
      safeAttr(page, '[data-e2e="feed-video"] video', 'poster'),
      safeText(page, '[data-e2e="poi-tag"]'),
      safeAttr(page, 'a[href*="/place/"]', 'href'),
      safeText(page, '[data-e2e="video-music"]'),
    ]);

    const description = embedded?.description || ogDescription || videoDescText || serpData?.title || '';

    let authorUniqueId = embedded?.author?.uniqueId || authorFromUrl;
    let authorNickname = embedded?.author?.nickname || '';

    if (!authorNickname) {
      const onTiktokMatch = ogTitle.match(/(.+?)\s+on TikTok/);
      if (onTiktokMatch) authorNickname = onTiktokMatch[1].trim();
    }
    if (!authorNickname) {
      const fromMatch = metaDescription.match(
        /from\s+(.+?)\s*\(@?[\w.]+\)/,
      );
      if (fromMatch) authorNickname = fromMatch[1].trim();
    }
    if (!authorNickname) authorNickname = serpData?.creator || authorFromUrl;

    let diggCount = embedded?.stats?.diggCount || 0;
    let commentCount = embedded?.stats?.commentCount || 0;
    let shareCount = embedded?.stats?.shareCount || 0;
    let collectCount = embedded?.stats?.collectCount || 0;
    let playCount = embedded?.stats?.playCount || serpData?.viewCount || 0;

    if (diggCount === 0) {
      const likesMatch = metaDescription.match(/([\d.]+[KkMmBb]?)\s*Likes?/i);
      if (likesMatch) diggCount = parseNumber(likesMatch[1]);
      if (likeText) diggCount = parseNumber(likeText);
    }

    if (commentCount === 0) {
      const commentsMatch = metaDescription.match(/([\d.]+[KkMmBb]?)\s*Comments?/i);
      if (commentsMatch) commentCount = parseNumber(commentsMatch[1]);
      if (commentText) commentCount = parseNumber(commentText);
    }

    if (shareCount === 0) {
      if (shareText) shareCount = parseNumber(shareText);
    }

    if (collectCount === 0) {
      if (collectText) collectCount = parseNumber(collectText);
      if (collectCount === 0 && bookmarkText) {
        collectCount = parseNumber(bookmarkText);
      }
    }

    if (playCount === 0) {
      const viewsMatch = metaDescription.match(/([\d.]+[KkMmBb]?)\s*[Vv]iews?/);
      if (viewsMatch) playCount = parseNumber(viewsMatch[1]);
      if (playCount === 0 && viewsText) playCount = parseNumber(viewsText);
    }

    const coverUrl = ogImage || posterAttr || '';

    const locationTag = poiText;

    let locationUrl = '';
    if (poiHref) {
      locationUrl = poiHref.startsWith('http')
        ? poiHref
        : `https://www.tiktok.com${poiHref}`;
    }

    let musicTitle = '';
    let musicAuthor = '';
    if (musicText) {
      const parts = musicText.split('-');
      if (parts.length >= 2) {
        musicTitle = parts[0].trim();
        musicAuthor = parts.slice(1).join('-').trim();
      }
    }

    const embeddedHashtags = embedded?.hashtags || [];
    const descHashtags = extractHashtags(description);
    const hashtags = [...new Set([...embeddedHashtags, ...descHashtags])];
    const mentions = extractMentions(description);
    const subtitles = capturedVtt ? parseVtt(capturedVtt) : '';
    const authorFollowers = embedded?.author?.followerCount || 0;

    const extractAndLocatorsMs = performance.now() - t1;
    const totalMs = performance.now() - t0;
    console.log(
      `    ✓ @${authorUniqueId} | ❤${diggCount} 💬${commentCount} 👁${playCount}${locationTag ? ` | 📍 ${locationTag}` : ''}${subtitles ? ' | 📝 captions' : ''} [${(totalMs / 1000).toFixed(1)}s: goto=${(gotoMs / 1000).toFixed(1)}s delay=${(delayMs / 1000).toFixed(1)}s extract+locators=${(extractAndLocatorsMs / 1000).toFixed(1)}s]`,
    );

    page.off('response', handleResponse);

    return {
      id: videoId,
      url: videoUrl,
      description: description.trim(),
      author: {
        id: embedded?.author?.id || '',
        uniqueId: authorUniqueId,
        nickname: authorNickname.trim(),
        avatarUrl: embedded?.author?.avatarUrl || '',
        signature: embedded?.author?.signature || '',
        verified: embedded?.author?.verified || false,
        followers: authorFollowers,
        following: embedded?.author?.followingCount || 0,
        hearts: embedded?.author?.heartCount || 0,
        videoCount: embedded?.author?.videoCount || 0,
      },
      createTime: embedded?.createTime || 0,
      playCount,
      shareCount,
      commentCount,
      diggCount,
      collectCount,
      videoUrl: '',
      coverUrl,
      dynamicCoverUrl: '',
      duration: 0,
      width: 0,
      height: 0,
      hashtags,
      mentions,
      isAd: false,
      isPinned: false,
      locationTag,
      locationUrl,
      musicTitle,
      musicAuthor,
      subtitles,
    };
  } catch (error) {
    page.off('response', handleResponse);
    const errorMsg = `Failed to scrape video: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`    ✗ ${errorMsg}`);
    onError?.(errorMsg);
    return null;
  }
}
