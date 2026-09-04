import { describe, it, expect } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { YtDlp } from '../src/yt-dlp';

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
});
