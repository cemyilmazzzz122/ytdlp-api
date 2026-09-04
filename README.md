# ytdlp-api

A robust, fully-typed Node.js wrapper for `yt-dlp`.

This package automatically downloads and manages the correct `yt-dlp` executable for the host operating system during installation. It eliminates the need for global Python or yt-dlp dependencies.

## Installation

```bash
npm install ytdlp-api
```

## Usage Guide

The API is fully Promise-based and returns strictly typed objects.

### 1. Auto-Updating the Binary

The `yt-dlp` extractors require frequent updates to maintain compatibility with YouTube's backend changes. You can programmatically update the bundled executable.

```typescript
import ytdlp from 'ytdlp-api';

async function bootstrap() {
  await ytdlp.update();
}
```

### 2. Fetching Video Metadata

The `getVideoInfo` method retrieves all metadata associated with a video without initiating a download.

```typescript
import ytdlp from 'ytdlp-api';

async function fetchMetadata() {
  const video = await ytdlp.getVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  
  console.log(video.title); // Rick Astley - Never Gonna Give You Up (Official Music Video)
  console.log(video.duration); // 212
  console.log(video.view_count); // 1530000000
}
```

**JSON Output Structure Example:**
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
  "duration": 212,
  "view_count": 1532451239,
  "channel_id": "UCuAXFkgsw1L7zawYySPMVgw",
  "uploader": "Rick Astley",
  "thumbnails": [
    {
      "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "width": 480,
      "height": 360
    }
  ],
  "formats": [
    {
      "format_id": "137",
      "ext": "mp4",
      "resolution": "1920x1080",
      "vcodec": "avc1.640028",
      "url": "https://rr4---sn-..."
    }
  ]
}
```

### 3. Downloading Media with Progress Tracking

The `download` method allows downloading files directly to the filesystem while providing real-time progress callbacks.

```typescript
import ytdlp from 'ytdlp-api';

async function downloadMusic() {
  await ytdlp.download(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
    (progress) => {
      // Example progress: { percent: 45.5, totalSize: '5.00MiB', speed: '1.2MiB/s', eta: '00:03' }
      console.log(`${progress.percent}% of ${progress.totalSize} at ${progress.speed} (ETA: ${progress.eta})`);
    },
    { 
      args: ['-f', 'bestaudio', '-x', '--audio-format', 'mp3', '-o', '%(title)s.%(ext)s'] 
    }
  );
}
```

### 4. Querying Search Results

The `search` method retrieves search results as an array.

```typescript
import ytdlp from 'ytdlp-api';

async function searchYoutube() {
  const results = await ytdlp.search('Node.js tutorial', 5);
  
  results.forEach(video => {
    console.log(`- ${video.title} (${video.url})`);
  });
}
```

### 5. Global Options (cookies, proxy, rate limiting)

Pass a second argument to the `YtDlp` constructor to apply options to every call automatically — no need to repeat them via `args` each time.

```typescript
import { YtDlp } from 'ytdlp-api';

const ytdlp = new YtDlp(undefined, {
  cookies: './cookies.txt',        // or: cookiesFromBrowser: 'chrome'
  proxy: 'socks5://127.0.0.1:1080',
  rateLimit: '2M',                 // cap bandwidth at 2MB/s
  concurrentFragments: 4,          // parallel fragment downloads
  ffmpegLocation: '/usr/bin',
  impersonate: 'chrome',           // spoof a browser's TLS/HTTP fingerprint
  extractorArgs: ['youtube:player_client=web,ios'],
});
```

### 6. Extracting Audio

A convenience wrapper around `download` for the common "just give me an mp3" case.

```typescript
import ytdlp from 'ytdlp-api';

await ytdlp.extractAudio(
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  (progress) => console.log(`${progress.percent}% (${progress.status})`),
  { format: 'mp3', outputTemplate: '%(title)s.%(ext)s' }
);
```

### 7. Thumbnails and Subtitles

Fetch a thumbnail or subtitle files without downloading the video/audio itself.

```typescript
import ytdlp from 'ytdlp-api';

const thumbPath = await ytdlp.downloadThumbnail(url, './out');
const subtitlePaths = await ytdlp.downloadSubtitles(url, './out', ['en', 'tr']);
```

### 8. Listing Formats

```typescript
import ytdlp from 'ytdlp-api';

const formats = await ytdlp.getFormats(url);
const best1080p = formats.find(f => f.height === 1080);
```

### 9. Cancelling In-Flight Requests

Every method that spawns `yt-dlp` accepts an `AbortSignal` via `options.signal` (or as the second argument to `execJson`/`exec`).

```typescript
import ytdlp from 'ytdlp-api';

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

await ytdlp.download(url, onProgress, { args: ['-f', 'best'], signal: controller.signal });
```

### 10. Full Playlist Metadata

`getChannel` uses `--flat-playlist` by default for speed. Pass `{ flat: false }` to fetch full metadata (including `formats`) for every entry.

```typescript
import ytdlp from 'ytdlp-api';

const videos = await ytdlp.getChannel(playlistUrl, { flat: false });
```

### 11. Resolving Direct Stream URLs

Skip the download entirely and get the raw, playable media URL(s) — useful for proxying or handing off to a media player.

```typescript
import ytdlp from 'ytdlp-api';

const urls = await ytdlp.getDirectUrl(url, { args: ['-f', 'best'] });
console.log(urls[0]); // https://...
```

### 12. Fast, Field-Only Metadata

`getFields` skips the full `--dump-json` extraction and only prints the fields you ask for — much faster when scraping metadata for many URLs.

```typescript
import ytdlp from 'ytdlp-api';

const { title, duration, view_count } = await ytdlp.getFields(url, ['title', 'duration', 'view_count']);
```

### 13. Typed Errors

Failures are classified into specific error subclasses so callers can branch on *why* yt-dlp failed instead of parsing stderr themselves.

```typescript
import ytdlp, { PrivateVideoError, GeoRestrictedError, AgeRestrictedError, VideoUnavailableError, NetworkError } from 'ytdlp-api';

try {
  await ytdlp.getVideoInfo(url);
} catch (err) {
  if (err instanceof PrivateVideoError) {
    // skip and move on
  } else if (err instanceof NetworkError) {
    // retry later
  }
  throw err;
}
```

### 14. Watching a Channel for New Uploads

Polls a channel or playlist and calls `onNewVideo` only for videos published after the watch started.

```typescript
import ytdlp from 'ytdlp-api';

const stop = ytdlp.watchChannel(
  'https://www.youtube.com/@SomeChannel/videos',
  (video) => console.log('New upload:', video.title),
  { intervalMs: 5 * 60_000 }
);

// later, to stop polling:
stop();
```

### 15. Batch Scraping with Bounded Concurrency

Fetches metadata for many URLs at once without spawning unlimited processes or hammering the target site. Each URL resolves independently — one failure doesn't sink the batch.

```typescript
import ytdlp from 'ytdlp-api';

const results = await ytdlp.batchGetVideoInfo(urls, { concurrency: 3, delayMs: 250 });

for (const r of results) {
  if (r.status === 'fulfilled') console.log(r.url, r.value.title);
  else console.warn(r.url, r.reason.message);
}
```

### 16. Fetching Comments

```typescript
import ytdlp from 'ytdlp-api';

const comments = await ytdlp.getComments(url, { args: ['--extractor-args', 'youtube:max_comments=50'] });
```

### 17. Searching Other Sites

`search` defaults to YouTube (`ytsearch`) but accepts any search-extractor prefix yt-dlp supports.

```typescript
import ytdlp from 'ytdlp-api';

const results = await ytdlp.search('lofi beats', 5, { engine: 'ytsearch' });
```

### 18. Anti-Bot Fingerprinting and Extractor Args

For sites that need browser impersonation or extractor-specific tuning (e.g. YouTube PO tokens), set these on `GlobalOptions`.

```typescript
import { YtDlp } from 'ytdlp-api';

const ytdlp = new YtDlp(undefined, {
  impersonate: 'chrome',
  extractorArgs: ['youtube:player_client=web,ios'],
});
```

## API Reference

- `new YtDlp(binaryPath?: string, globalOptions?: GlobalOptions)`
  Creates a wrapper instance. `globalOptions` (cookies, proxy, rate limiting, etc.) apply to every call made through it.

- `ytdlp.update(): Promise<string>`
  Updates the bundled `yt-dlp` binary to its latest release from the official repository.

- `ytdlp.version(): Promise<string>`
  Returns the version string of the underlying `yt-dlp` binary.

- `ytdlp.getVideoInfo(url: string, options?: YtDlpOptions): Promise<VideoInfo>`
  Fetches detailed metadata for a single video entity.

- `ytdlp.getFormats(url: string, options?: YtDlpOptions): Promise<Format[]>`
  Fetches the list of available formats for a video.

- `ytdlp.download(url: string, onProgress?: (progress: DownloadProgress) => void, options?: YtDlpOptions): Promise<void>`
  Downloads the video or audio payload and emits continuous progress events, including playlist index/count when downloading a playlist.

- `ytdlp.extractAudio(url: string, onProgress?: (progress: DownloadProgress) => void, options?: ExtractAudioOptions): Promise<void>`
  Downloads and transcodes audio only.

- `ytdlp.downloadThumbnail(url: string, outputDir: string, options?: YtDlpOptions): Promise<string>`
  Downloads just the thumbnail image and returns its path.

- `ytdlp.downloadSubtitles(url: string, outputDir: string, langs?: string[], options?: YtDlpOptions): Promise<string[]>`
  Downloads subtitle/auto-caption files and returns their paths.

- `ytdlp.search(query: string, limit?: number, options?: SearchOptions): Promise<VideoInfo[]>`
  Searches a site's search extractor (YouTube by default) and returns a list of matching entries.

- `ytdlp.getChannel(url: string, options?: ChannelOptions): Promise<VideoInfo[]>`
  Fetches a list of video entries from a specific channel or playlist URL.

- `ytdlp.getDirectUrl(url: string, options?: YtDlpOptions): Promise<string[]>`
  Resolves the direct, playable stream URL(s) for a video without downloading it.

- `ytdlp.getFields(url: string, fields: string[], options?: YtDlpOptions): Promise<Record<string, string>>`
  Fetches only the requested metadata fields — faster than a full `getVideoInfo` call.

- `ytdlp.getComments(url: string, options?: YtDlpOptions): Promise<Comment[]>`
  Fetches comments for a video, when the site's extractor supports it.

- `ytdlp.batchGetVideoInfo(urls: string[], options?: BatchOptions): Promise<BatchResult<VideoInfo>[]>`
  Fetches metadata for many URLs with bounded concurrency; each URL resolves independently as fulfilled or rejected.

- `ytdlp.watchChannel(url: string, onNewVideo: (video: VideoInfo) => void, options?: WatchChannelOptions): () => void`
  Polls a channel/playlist and invokes `onNewVideo` for videos published after the watch started. Returns a `stop` function.

- `ytdlp.execJson<T>(args: string[], signal?: AbortSignal): Promise<T[]>`
  Executes `yt-dlp` with arbitrary arguments and parses the standard output as JSON objects.

- `ytdlp.exec(args: string[], signal?: AbortSignal): Promise<string>`
  Executes `yt-dlp` with arbitrary arguments and returns raw stdout.

## License

MIT
