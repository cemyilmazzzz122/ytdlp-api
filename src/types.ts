export interface YtDlpOptions {
  /**
   * Additional arguments to pass to yt-dlp.
   */
  args?: string[];
  /**
   * Abort the underlying yt-dlp process when this signal fires.
   */
  signal?: AbortSignal;
}

export interface ChannelOptions extends YtDlpOptions {
  /**
   * When true (default), uses `--flat-playlist` for a fast listing with
   * partial metadata. Set to false to fetch full metadata (including
   * `formats`) for every entry, at the cost of one extra request per video.
   */
  flat?: boolean;
}

export type AudioFormat = 'mp3' | 'm4a' | 'opus' | 'wav' | 'flac' | 'aac' | 'vorbis' | 'alac' | 'best';

export interface ExtractAudioOptions extends YtDlpOptions {
  /**
   * Target audio codec/container. Defaults to 'mp3'.
   */
  format?: AudioFormat;
  /**
   * Output filename template, e.g. '%(title)s.%(ext)s'. Passed via `-o`.
   */
  outputTemplate?: string;
}

/**
 * Options applied to every yt-dlp invocation made by a `YtDlp` instance.
 * Useful for authentication, network, and performance tuning that would
 * otherwise need to be repeated via `args` on every call.
 */
export interface GlobalOptions {
  /** Path to a Netscape-format cookies file (`--cookies`). */
  cookies?: string;
  /** Load cookies from a local browser, e.g. 'chrome', 'firefox' (`--cookies-from-browser`). */
  cookiesFromBrowser?: string;
  /** Proxy URL, e.g. 'socks5://127.0.0.1:1080' (`--proxy`). */
  proxy?: string;
  /** Custom User-Agent header (`--user-agent`). */
  userAgent?: string;
  /** Maximum download rate, e.g. '5M', '500K' (`-r`/`--limit-rate`). */
  rateLimit?: string;
  /** Number of fragments to download concurrently (`-N`/`--concurrent-fragments`). */
  concurrentFragments?: number;
  /** Path to the ffmpeg/ffprobe binaries directory (`--ffmpeg-location`). */
  ffmpegLocation?: string;
  /** Never download playlists, only the given video (`--no-playlist`). */
  noPlaylist?: boolean;
}

export interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
  resolution?: string;
  id?: string;
}

export interface Format {
  format_id: string;
  format_note: string;
  ext: string;
  protocol: string;
  acodec: string;
  vcodec: string;
  url: string;
  width: number;
  height: number;
  fps: number;
  rows: number;
  columns: number;
  filesize: number;
  tbr: number;
  vbr: number;
  abr: number;
  asr: number;
  audio_ext?: string;
  video_ext?: string;
  format: string;
  resolution: string;
  http_headers?: Record<string, string>;
  [key: string]: any;
}

export interface VideoInfo {
  id: string;
  title: string;
  fulltitle?: string;
  ext?: string;
  url: string; // The URL of the video stream (if requested)
  thumbnail: string;
  thumbnails?: Thumbnail[];
  description: string;
  uploader: string;
  uploader_id: string;
  uploader_url: string;
  channel_id: string;
  channel_url: string;
  channel_follower_count?: number;
  duration: number; // in seconds
  duration_string?: string;
  view_count: number;
  like_count?: number;
  repost_count?: number;
  comment_count?: number;
  age_limit?: number;
  webpage_url: string;
  categories?: string[];
  tags?: string[];
  is_live?: boolean;
  was_live?: boolean;
  live_status?: string;
  playable_in_embed?: boolean;
  formats?: Format[];
  subtitles?: Record<string, any[]>;
  automatic_captions?: Record<string, any[]>;
  chapters?: any[];
  [key: string]: any; // Catch-all for other properties returned by yt-dlp
}

export interface ChannelInfo {
  id: string;
  title: string;
  description: string;
  url: string;
  entries?: VideoInfo[];
  [key: string]: any;
}

export interface DownloadProgress {
  percent: number;
  totalSize: string;
  downloadedSize?: string;
  speed: string;
  eta: string;
  /** Current lifecycle stage of this download event. */
  status?: 'downloading' | 'finished' | 'already-downloaded';
  /** Destination path yt-dlp reported for the file currently being written. */
  filename?: string;
  /** 1-based index of the current entry, when downloading a playlist. */
  playlistIndex?: number;
  /** Total number of entries in the playlist being downloaded. */
  playlistCount?: number;
}
