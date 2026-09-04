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

- `ytdlp.search(query: string, limit?: number, options?: YtDlpOptions): Promise<VideoInfo[]>`
  Searches YouTube and returns a list of matching entries.

- `ytdlp.getChannel(url: string, options?: ChannelOptions): Promise<VideoInfo[]>`
  Fetches a list of video entries from a specific channel or playlist URL.

- `ytdlp.execJson<T>(args: string[], signal?: AbortSignal): Promise<T[]>`
  Executes `yt-dlp` with arbitrary arguments and parses the standard output as JSON objects.

- `ytdlp.exec(args: string[], signal?: AbortSignal): Promise<string>`
  Executes `yt-dlp` with arbitrary arguments and returns raw stdout.

## License

MIT
