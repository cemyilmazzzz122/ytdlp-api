import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { VideoInfo, ChannelInfo, YtDlpOptions, DownloadProgress } from './types';

const binaryName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const defaultBinaryPath = path.join(__dirname, '..', 'bin', binaryName);

export class YtDlp {
  private binaryPath: string;

  constructor(customBinaryPath?: string) {
    this.binaryPath = customBinaryPath || defaultBinaryPath;
  }

  /**
   * Executes yt-dlp with the given arguments and returns the raw stdout.
   */
  public async exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binaryPath, args);
      
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}\nStderr: ${stderr}`));
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
  public async execJson<T = any>(args: string[]): Promise<T[]> {
    const output = await this.exec([...args, '--dump-json']);
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
   * Fetches information about a specific video.
   * Does NOT download the video file.
   */
  public async getVideoInfo(url: string, options?: YtDlpOptions): Promise<VideoInfo> {
    const args = [url];
    if (options?.args) {
      args.push(...options.args);
    }
    const results = await this.execJson<VideoInfo>(args);
    return results[0];
  }

  /**
   * Fetches videos from a channel or playlist. 
   */
  public async getChannel(url: string, options?: YtDlpOptions): Promise<VideoInfo[]> {
    const args = [url, '--flat-playlist'];
    if (options?.args) {
      args.push(...options.args);
    }
    return this.execJson<VideoInfo>(args);
  }

  /**
   * Searches YouTube and returns a list of results.
   */
  public async search(query: string, limit: number = 10, options?: YtDlpOptions): Promise<VideoInfo[]> {
    const args = [`ytsearch${limit}:${query}`, '--flat-playlist'];
    if (options?.args) {
      args.push(...options.args);
    }
    return this.execJson<VideoInfo>(args);
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
      
      const child = spawn(this.binaryPath, args);
      let stderr = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        // Regex to parse: [download]  10.0% of ~5.00MiB at 1.50MiB/s ETA 00:03
        // Or: [download]  10.0% of 5.00MiB at 1.50MiB/s ETA 00:03
        const progressRegex = /\[download\]\s+([\d.]+)%\s+of\s+[~]?\s*([^ ]+)\s+at\s+([^ ]+)\s+ETA\s+([^ ]+)/;
        
        if (onProgress) {
          const lines = text.split('\n');
          for (const line of lines) {
            const match = line.match(progressRegex);
            if (match) {
              onProgress({
                percent: parseFloat(match[1]),
                totalSize: match[2],
                speed: match[3],
                eta: match[4]
              });
            }
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}\nStderr: ${stderr}`));
        } else {
          resolve();
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });
    });
  }
}

