import { describe, it, expect } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { YtDlp } from '../src/yt-dlp';
import {
  classifyError,
  PrivateVideoError,
  AgeRestrictedError,
  GeoRestrictedError,
  VideoUnavailableError,
  NetworkError,
  YtDlpError,
} from '../src/errors';

// Rick Astley - Never Gonna Give You Up: stable, evergreen public video used
// as a fixture across the yt-dlp ecosystem. These are integration tests that
// hit the real network and the real yt-dlp binary.
const TEST_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const NETWORK_TIMEOUT = 30_000;

const ytdlp = new YtDlp();

describe('YtDlp', () => {
  it('version() returns a non-empty version string', async () => {
    const version = await ytdlp.version();
    expect(version).toMatch(/^\d{4}\.\d{2}\.\d{2}/);
  }, NETWORK_TIMEOUT);

  it('getVideoInfo() returns metadata for a known video', async () => {
    const info = await ytdlp.getVideoInfo(TEST_URL);
    expect(info.id).toBe('dQw4w9WgXcQ');
    expect(info.title).toBeTruthy();
    expect(info.duration).toBeGreaterThan(0);
  }, NETWORK_TIMEOUT);

  it('getFormats() returns a non-empty list of formats', async () => {
    const formats = await ytdlp.getFormats(TEST_URL);
    expect(formats.length).toBeGreaterThan(0);
    expect(formats[0]).toHaveProperty('format_id');
  }, NETWORK_TIMEOUT);

  it('download() emits a finished progress event and writes the file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ytdlp-api-test-'));
    try {
      const events: { percent: number; status?: string }[] = [];
      await ytdlp.download(TEST_URL, (p) => events.push(p), {
        args: ['-f', 'worst[ext=mp4]', '-o', path.join(dir, 'video.%(ext)s')],
      });

      expect(events.some((e) => e.status === 'finished' && e.percent === 100)).toBe(true);
      expect(readdirSync(dir).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, NETWORK_TIMEOUT);

  it('download() rejects when aborted via signal', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ytdlp-api-test-'));
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 300);

      await expect(
        ytdlp.download(TEST_URL, undefined, {
          args: ['-f', 'best', '-o', path.join(dir, 'video.%(ext)s')],
          signal: controller.signal,
        })
      ).rejects.toThrow(/aborted/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, NETWORK_TIMEOUT);

  it('downloadThumbnail() writes a thumbnail and returns its path', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ytdlp-api-test-'));
    try {
      const thumbPath = await ytdlp.downloadThumbnail(TEST_URL, dir);
      expect(readdirSync(dir)).toContain(path.basename(thumbPath));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, NETWORK_TIMEOUT);

  it('downloadSubtitles() writes subtitle files and returns their paths', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ytdlp-api-test-'));
    try {
      const paths = await ytdlp.downloadSubtitles(TEST_URL, dir, ['en']);
      expect(paths.length).toBeGreaterThan(0);
      expect(readdirSync(dir).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, NETWORK_TIMEOUT);

  it('getDirectUrl() resolves one or more playable stream URLs', async () => {
    const urls = await ytdlp.getDirectUrl(TEST_URL, { args: ['-f', 'best'] });
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toMatch(/^https?:\/\//);
  }, NETWORK_TIMEOUT);

  it('getFields() returns only the requested metadata fields', async () => {
    const fields = await ytdlp.getFields(TEST_URL, ['id', 'title']);
    expect(fields.id).toBe('dQw4w9WgXcQ');
    expect(fields.title).toBeTruthy();
  }, NETWORK_TIMEOUT);

  it('getComments() returns a non-empty list of comments', async () => {
    const comments = await ytdlp.getComments(TEST_URL, { args: ['--extractor-args', 'youtube:max_comments=5'] });
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0]).toHaveProperty('text');
  }, NETWORK_TIMEOUT);

  it('search() supports a custom search engine prefix', async () => {
    const results = await ytdlp.search('lofi', 1, { engine: 'ytsearch' });
    expect(results.length).toBe(1);
  }, NETWORK_TIMEOUT);

  it('batchGetVideoInfo() resolves each url independently, mixing success and failure', async () => {
    const results = await ytdlp.batchGetVideoInfo(
      [TEST_URL, 'https://www.youtube.com/watch?v=00000000000'],
      { concurrency: 2 }
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ url: TEST_URL, status: 'fulfilled' });
    expect(results[1].status).toBe('rejected');
  }, NETWORK_TIMEOUT * 2);

  it('watchChannel() only reports videos discovered after the baseline poll', async () => {
    const seenOnBaseline: unknown[] = [];
    const stop = ytdlp.watchChannel(
      'https://www.youtube.com/@RickAstleyYT/videos',
      (video) => seenOnBaseline.push(video),
      { intervalMs: NETWORK_TIMEOUT, args: ['--playlist-end', '3'] }
    );
    await new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT));
    stop();
    expect(seenOnBaseline).toHaveLength(0);
  }, NETWORK_TIMEOUT * 2);
});

describe('classifyError', () => {
  it('classifies a private video message', () => {
    const err = classifyError('ERROR: [youtube] abc123: Private video. Sign in if you\'ve been granted access', 1);
    expect(err).toBeInstanceOf(PrivateVideoError);
  });

  it('classifies an age-restricted message', () => {
    const err = classifyError('ERROR: [youtube] abc123: Sign in to confirm your age', 1);
    expect(err).toBeInstanceOf(AgeRestrictedError);
  });

  it('classifies a geo-restricted message', () => {
    const err = classifyError('ERROR: [youtube] abc123: The uploader has not made this video available in your country', 1);
    expect(err).toBeInstanceOf(GeoRestrictedError);
  });

  it('classifies an unavailable video message', () => {
    const err = classifyError('ERROR: [youtube] abc123: Video unavailable', 1);
    expect(err).toBeInstanceOf(VideoUnavailableError);
  });

  it('classifies a network failure message', () => {
    const err = classifyError('ERROR: Unable to download webpage: <urlopen error [Errno -2] Name or service not known>', 1);
    expect(err).toBeInstanceOf(NetworkError);
  });

  it('falls back to the generic YtDlpError for unrecognized messages', () => {
    const err = classifyError('ERROR: something completely unexpected happened', 1);
    expect(err.constructor).toBe(YtDlpError);
  });
});
