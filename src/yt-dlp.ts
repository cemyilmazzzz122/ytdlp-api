import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import os from 'os';
import {
  VideoInfo,
  YtDlpOptions,
  ChannelOptions,
  ExtractAudioOptions,
  GlobalOptions,
  DownloadProgress,
  Format,
  SearchOptions,
  Comment,
  WatchChannelOptions,
  BatchOptions,
  BatchResult,
} from './types';
import { classifyError } from './errors';

const binaryName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const defaultBinaryPath = path.join(__dirname, '..', 'bin', binaryName);

export class YtDlp {
  private binaryPath: string;
  private globalOptions: GlobalOptions;

  constructor(customBinaryPath?: string, globalOptions?: GlobalOptions) {
    this.binaryPath = customBinaryPath || defaultBinaryPath;
    this.globalOptions = globalOptions || {};
  }

  /**
   * Translates `GlobalOptions` into yt-dlp CLI flags. Applied to every
   * invocation made through `exec`/`download` so options like `cookies` or
   * `proxy` don't need to be repeated on every call.
   */
  private buildGlobalArgs(): string[] {
    const g = this.globalOptions;
    const args: string[] = [];

    if (g.cookies) args.push('--cookies', g.cookies);
    if (g.cookiesFromBrowser) args.push('--cookies-from-browser', g.cookiesFromBrowser);
    if (g.proxy) args.push('--proxy', g.proxy);
    if (g.userAgent) args.push('--user-agent', g.userAgent);
    if (g.rateLimit) args.push('-r', g.rateLimit);
    if (g.concurrentFragments) args.push('-N', String(g.concurrentFragments));
    if (g.ffmpegLocation) args.push('--ffmpeg-location', g.ffmpegLocation);
    if (g.noPlaylist) args.push('--no-playlist');
    if (g.impersonate) args.push('--impersonate', g.impersonate);
    if (g.extractorArgs) {
      for (const ea of g.extractorArgs) args.push('--extractor-args', ea);
    }

    return args;
  }

  /**
   * Kills `child` when `signal` aborts. Attaches nothing if no signal is given.
   */
  private linkAbortSignal(child: ChildProcessWithoutNullStreams, signal?: AbortSignal): void {
    if (!signal) return;
    if (signal.aborted) {
      child.kill();
      return;
    }
    const onAbort = () => child.kill();
    signal.addEventListener('abort', onAbort, { once: true });
    child.on('close', () => signal.removeEventListener('abort', onAbort));
  }

  /**
   * Executes yt-dlp with the given arguments and returns the raw stdout.
   */
  public async exec(args: string[], signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binaryPath, [...this.buildGlobalArgs(), ...args]);
      this.linkAbortSignal(child, signal);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (signal?.aborted) {
          reject(new Error('yt-dlp process aborted'));
        } else if (code !== 0) {
          reject(classifyError(stderr, code));
        } else {
          resolve(stdout);
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });
    });
  }

  /**
   * Executes yt-dlp and parses the output as JSON.
   * yt-dlp outputs one JSON object per line. This always returns an array of objects.
   */
  public async execJson<T = any>(args: string[], signal?: AbortSignal): Promise<T[]> {
    const output = await this.exec([...args, '--dump-json'], signal);
    const lines = output.trim().split('\n').filter(line => line.length > 0);
    return lines.map(line => JSON.parse(line));
  }

  /**
   * Updates the yt-dlp binary to the latest version.
   * This is equivalent to running `yt-dlp -U`.
   */
  public async update(): Promise<string> {
    return this.exec(['-U']);
  }

  /**
   * Returns the version string of the underlying yt-dlp binary.
   */
  public async version(): Promise<string> {
    const out = await this.exec(['--version']);
    return out.trim();
  }

  /**
   * Fetches information about a specific video.
   * Does NOT download the video file.
   */
  public async getVideoInfo(url: string, options?: YtDlpOptions): Promise<VideoInfo> {
    const args = [url];
    if (options?.args) {
      args.push(...options.args);
    }
    const results = await this.execJson<VideoInfo>(args, options?.signal);
    return results[0];
  }

  /**
   * Fetches the list of available formats for a video, as reported by
   * `yt-dlp -F`. Equivalent to `(await getVideoInfo(url)).formats`.
   */
  public async getFormats(url: string, options?: YtDlpOptions): Promise<Format[]> {
    const info = await this.getVideoInfo(url, options);
    return info.formats || [];
  }

  /**
   * Fetches videos from a channel or playlist.
   * By default this uses `--flat-playlist` for a fast listing with partial
   * metadata. Pass `{ flat: false }` to fetch full metadata (including
   * `formats`) for every entry — slower, one request per video.
   */
  public async getChannel(url: string, options?: ChannelOptions): Promise<VideoInfo[]> {
    const args = [url];
    if (options?.flat !== false) {
      args.push('--flat-playlist');
    }
    if (options?.args) {
      args.push(...options.args);
    }
    return this.execJson<VideoInfo>(args, options?.signal);
  }

  /**
   * Searches a site's search extractor and returns a list of results.
   * Defaults to YouTube (`ytsearch`); pass `{ engine: 'soundcloudsearch' }`
   * (or any other yt-dlp search-extractor prefix) to search elsewhere.
   */
  public async search(query: string, limit: number = 10, options?: SearchOptions): Promise<VideoInfo[]> {
    const engine = options?.engine || 'ytsearch';
    const args = [`${engine}${limit}:${query}`, '--flat-playlist'];
    if (options?.args) {
      args.push(...options.args);
    }
    return this.execJson<VideoInfo>(args, options?.signal);
  }

  /**
   * Resolves the direct, playable media URL(s) for a video without
   * downloading it (`yt-dlp -g`). Returns one URL per requested stream —
   * usually one, or two when video and audio are served separately.
   */
  public async getDirectUrl(url: string, options?: YtDlpOptions): Promise<string[]> {
    const args = [url, '-g'];
    if (options?.args) {
      args.push(...options.args);
    }
    const output = await this.exec(args, options?.signal);
    return output.trim().split('\n').filter(line => line.length > 0);
  }

  /**
   * Fetches a small set of metadata fields via `--print`, avoiding the cost
   * of a full `--dump-json` extraction. `fields` are `VideoInfo` keys, e.g.
   * `['title', 'duration', 'view_count']`.
   */
  public async getFields(
    url: string,
    fields: string[],
    options?: YtDlpOptions
  ): Promise<Record<string, string>> {
    const args = [url, '--skip-download'];
    for (const field of fields) {
      args.push('--print', `%(${field})s`);
    }
    if (options?.args) {
      args.push(...options.args);
    }
    const output = await this.exec(args, options?.signal);
    const lines = output.trim().split('\n');
    const result: Record<string, string> = {};
    fields.forEach((field, i) => {
      result[field] = lines[i] ?? '';
    });
    return result;
  }

  /**
   * Fetches comments for a video (`--write-comments`). Requires the site's
   * extractor to support comment extraction.
   */
  public async getComments(url: string, options?: YtDlpOptions): Promise<Comment[]> {
    const args = [url, '--write-comments', '--skip-download'];
    if (options?.args) {
      args.push(...options.args);
    }
    const results = await this.execJson<VideoInfo>(args, options?.signal);
    return results[0]?.comments ?? [];
  }

  /**
   * Runs `getVideoInfo` over many URLs with bounded concurrency, so a large
   * scrape doesn't spawn hundreds of processes at once or hammer the target
   * site. Failures for individual URLs don't abort the batch — each result
   * reports its own fulfilled/rejected outcome.
   */
  public async batchGetVideoInfo(urls: string[], options?: BatchOptions): Promise<BatchResult<VideoInfo>[]> {
    return this.runBatch(urls, (url, signal) => this.getVideoInfo(url, { signal }), options);
  }

  private async runBatch<T>(
    urls: string[],
    task: (url: string, signal?: AbortSignal) => Promise<T>,
    options?: BatchOptions
  ): Promise<BatchResult<T>[]> {
    const concurrency = Math.max(1, options?.concurrency ?? 3);
    const delayMs = options?.delayMs ?? 0;
    const results: BatchResult<T>[] = new Array(urls.length);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < urls.length) {
        if (options?.signal?.aborted) return;
        const i = nextIndex++;
        const url = urls[i];
        try {
          const value = await task(url, options?.signal);
          results[i] = { url, status: 'fulfilled', value };
        } catch (err) {
          results[i] = { url, status: 'rejected', reason: err as Error };
        }
        if (delayMs > 0 && nextIndex < urls.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    };

    const workerCount = Math.min(concurrency, urls.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
  }

  /**
   * Polls a channel or playlist for newly published videos and invokes
   * `onNewVideo` for each one. The first poll only establishes the known
   * baseline (no callbacks fire for pre-existing videos). Returns a `stop`
   * function; polling also stops if `options.signal` aborts.
   */
  public watchChannel(
    url: string,
    onNewVideo: (video: VideoInfo) => void,
    options?: WatchChannelOptions
  ): () => void {
    const intervalMs = options?.intervalMs ?? 5 * 60_000;
    const seen = new Set<string>();
    let initialized = false;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);
    };

    const poll = async () => {
      if (stopped) return;
      try {
        const entries = await this.getChannel(url, {
          flat: true,
          args: options?.args,
          signal: options?.signal,
        });
        if (!initialized) {
          for (const entry of entries) seen.add(entry.id);
          initialized = true;
        } else {
          for (const entry of entries) {
            if (!seen.has(entry.id)) {
              seen.add(entry.id);
              onNewVideo(entry);
            }
          }
        }
      } catch (err) {
        options?.onError?.(err as Error);
      }
      if (!stopped) {
        timer = setTimeout(poll, intervalMs);
      }
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        stop();
        return stop;
      }
      options.signal.addEventListener('abort', stop, { once: true });
    }

    void poll();
    return stop;
  }

  /**
   * Downloads only the thumbnail image for a video (no video/audio payload).
   * Returns the path yt-dlp wrote the thumbnail to.
   */
  public async downloadThumbnail(url: string, outputDir: string, options?: YtDlpOptions): Promise<string> {
    const args = [
      url,
      '--skip-download',
      '--write-thumbnail',
      '-o', path.join(outputDir, '%(id)s.%(ext)s'),
    ];
    if (options?.args) {
      args.push(...options.args);
    }
    const output = await this.exec(args, options?.signal);
    const match = output.match(/Writing (?:video )?thumbnail[^:]*to:\s*(.+)/i);
    if (!match) {
      throw new Error('yt-dlp did not report a thumbnail path. Output:\n' + output);
    }
    return match[1].trim();
  }

  /**
   * Downloads subtitle files (including auto-generated ones) without
   * downloading the video/audio payload. Returns the paths yt-dlp wrote.
   */
  public async downloadSubtitles(
    url: string,
    outputDir: string,
    langs: string[] = ['en'],
    options?: YtDlpOptions
  ): Promise<string[]> {
    const args = [
      url,
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', langs.join(','),
      '-o', path.join(outputDir, '%(id)s.%(ext)s'),
    ];
    if (options?.args) {
      args.push(...options.args);
    }
    const output = await this.exec(args, options?.signal);
    const matches = [...output.matchAll(/Writing (?:video )?subtitles? to:\s*(.+)/gi)];
    return matches.map(m => m[1].trim());
  }

  /**
   * Downloads a video or audio file and provides real-time progress.
   * @param url The URL of the video
   * @param onProgress Callback function for download progress
   * @param options Additional arguments like format selection (e.g. ['-f', 'bestaudio'])
   */
  public async download(
    url: string,
    onProgress?: (progress: DownloadProgress) => void,
    options?: YtDlpOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [url];
      if (options?.args) {
        args.push(...options.args);
      }

      const child = spawn(this.binaryPath, [...this.buildGlobalArgs(), ...args]);
      this.linkAbortSignal(child, options?.signal);
      let stderr = '';

      // Progress lines look like:
      //   [download]  10.0% of ~5.00MiB at 1.50MiB/s ETA 00:03
      //   [download] 100% of 5.00MiB in 00:03
      //   [download] Destination: video.mp4
      //   [download] video.mp4 has already been downloaded
      //   [download] Downloading item 1 of 5
      const progressRegex = /\[download\]\s+([\d.]+)%\s+of\s+[~]?\s*([^ ]+)\s+at\s+([^ ]+)\s+ETA\s+([^ ]+)/;
      const finishedRegex = /\[download\]\s+100%\s+of\s+[~]?\s*([^ ]+)\s+in\s+([^ ]+)/;
      const destinationRegex = /\[download\] Destination:\s*(.+)/;
      const alreadyDownloadedRegex = /\[download\]\s+(.+)\s+has already been downloaded/;
      const playlistRegex = /\[download\] Downloading (?:item|video) (\d+) of (\d+)/;

      let filename: string | undefined;
      let playlistIndex: number | undefined;
      let playlistCount: number | undefined;

      child.stdout.on('data', (data) => {
        const text = data.toString();
        if (!onProgress) return;

        const lines = text.split('\n');
        for (const line of lines) {
          const playlistMatch = line.match(playlistRegex);
          if (playlistMatch) {
            playlistIndex = parseInt(playlistMatch[1], 10);
            playlistCount = parseInt(playlistMatch[2], 10);
            continue;
          }

          const destinationMatch = line.match(destinationRegex);
          if (destinationMatch) {
            filename = destinationMatch[1].trim();
            continue;
          }

          const progressMatch = line.match(progressRegex);
          if (progressMatch) {
            onProgress({
              percent: parseFloat(progressMatch[1]),
              totalSize: progressMatch[2],
              speed: progressMatch[3],
              eta: progressMatch[4],
              status: 'downloading',
              filename,
              playlistIndex,
              playlistCount,
            });
            continue;
          }

          const finishedMatch = line.match(finishedRegex);
          if (finishedMatch) {
            onProgress({
              percent: 100,
              totalSize: finishedMatch[1],
              speed: '',
              eta: '00:00',
              status: 'finished',
              filename,
              playlistIndex,
              playlistCount,
            });
            continue;
          }

          const alreadyMatch = line.match(alreadyDownloadedRegex);
          if (alreadyMatch) {
            onProgress({
              percent: 100,
              totalSize: '',
              speed: '',
              eta: '00:00',
              status: 'already-downloaded',
              filename: alreadyMatch[1].trim(),
              playlistIndex,
              playlistCount,
            });
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (options?.signal?.aborted) {
          reject(new Error('Download aborted'));
        } else if (code !== 0) {
          reject(classifyError(stderr, code));
        } else {
          resolve();
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });
    });
  }

  /**
   * Convenience wrapper around `download` that extracts audio only,
   * transcoding it with ffmpeg (`-x --audio-format <format>`).
   */
  public async extractAudio(
    url: string,
    onProgress?: (progress: DownloadProgress) => void,
    options?: ExtractAudioOptions
  ): Promise<void> {
    const args = ['-x', '--audio-format', options?.format || 'mp3'];
    if (options?.outputTemplate) {
      args.push('-o', options.outputTemplate);
    }
    if (options?.args) {
      args.push(...options.args);
    }
    return this.download(url, onProgress, { args, signal: options?.signal });
  }
}
