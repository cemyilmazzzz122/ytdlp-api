export interface YtDlpOptions {
  /**
   * Additional arguments to pass to yt-dlp.
   */
  args?: string[];
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
}
