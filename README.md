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

## API Reference

- `ytdlp.update(): Promise<string>`
  Updates the bundled `yt-dlp` binary to its latest release from the official repository.

- `ytdlp.getVideoInfo(url: string, options?: YtDlpOptions): Promise<VideoInfo>`
  Fetches detailed metadata for a single video entity.

- `ytdlp.download(url: string, onProgress?: (progress: DownloadProgress) => void, options?: YtDlpOptions): Promise<void>`
  Downloads the video or audio payload and emits continuous progress events.

- `ytdlp.search(query: string, limit?: number, options?: YtDlpOptions): Promise<VideoInfo[]>`
  Searches YouTube and returns a list of matching entries.

- `ytdlp.getChannel(url: string, options?: YtDlpOptions): Promise<VideoInfo[]>`
  Fetches a list of video entries from a specific channel or playlist URL.

- `ytdlp.execJson<T>(args: string[]): Promise<T[]>`
  Executes `yt-dlp` with arbitrary arguments and parses the standard output as JSON objects.

## License

MIT
