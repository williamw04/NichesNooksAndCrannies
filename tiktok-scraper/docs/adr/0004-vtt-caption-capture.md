# ADR-0004: VTT Caption Capture via Response Interception

## Context

TikTok videos sometimes have auto-generated captions/subtitles in VTT format. These captions can contain location names not mentioned in the video description.

## Decision

Listen for HTTP responses from `tiktokcdn` domains during page load. Identify VTT files by checking: content-type is `text/vtt` or `text/plain`, OR content-type is `video/mp4` with content-length < 2000 bytes. Verify by checking the body starts with `WEBVTT`.

## Why

[NEEDS HUMAN INPUT]

Observable facts:
- TikTok CDN serves VTT files with incorrect `content-type: video/mp4` headers
- VTT files are small (< 2000 bytes) while actual video files are much larger
- The combination of wrong content-type + small size + `WEBVTT` prefix is a reliable identifier
- No DOM element or API exposes subtitle text directly
