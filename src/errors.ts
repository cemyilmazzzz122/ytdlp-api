/**
 * Base class for errors raised when a yt-dlp process exits non-zero.
 * Carries the raw stderr and exit code for callers that need the detail
 * beyond the classified subtype.
 */
export class YtDlpError extends Error {
  public readonly stderr: string;
  public readonly exitCode: number | null;

  constructor(message: string, stderr: string, exitCode: number | null) {
    super(message);
    this.name = 'YtDlpError';
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class VideoUnavailableError extends YtDlpError {
  constructor(stderr: string, exitCode: number | null) {
    super('Video is unavailable or has been removed', stderr, exitCode);
    this.name = 'VideoUnavailableError';
  }
}

export class PrivateVideoError extends YtDlpError {
  constructor(stderr: string, exitCode: number | null) {
    super('Video is private', stderr, exitCode);
    this.name = 'PrivateVideoError';
  }
}

export class GeoRestrictedError extends YtDlpError {
  constructor(stderr: string, exitCode: number | null) {
    super('Video is not available in this region', stderr, exitCode);
    this.name = 'GeoRestrictedError';
  }
}

export class AgeRestrictedError extends YtDlpError {
  constructor(stderr: string, exitCode: number | null) {
    super('Video is age-restricted and requires authentication', stderr, exitCode);
    this.name = 'AgeRestrictedError';
  }
}

export class NetworkError extends YtDlpError {
  constructor(stderr: string, exitCode: number | null) {
    super('Network error while communicating with the target site', stderr, exitCode);
    this.name = 'NetworkError';
  }
}

/**
 * Classifies a yt-dlp stderr blob into a specific `YtDlpError` subtype by
 * matching known message patterns from yt-dlp's extractors. Falls back to
 * the generic `YtDlpError` when nothing matches.
 */
export function classifyError(stderr: string, exitCode: number | null): YtDlpError {
  if (/private video/i.test(stderr)) {
    return new PrivateVideoError(stderr, exitCode);
  }
  if (/sign in to confirm your age|age[- ]restricted/i.test(stderr)) {
    return new AgeRestrictedError(stderr, exitCode);
  }
  if (/available in your country|geo.?restricted|blocked it in your country/i.test(stderr)) {
    return new GeoRestrictedError(stderr, exitCode);
  }
  if (/video (is )?unavailable|this video is unavailable|has been removed/i.test(stderr)) {
    return new VideoUnavailableError(stderr, exitCode);
  }
  if (/unable to download webpage|urlopen error|getaddrinfo failed|econnrefused|etimedout|network is unreachable|temporary failure in name resolution/i.test(stderr)) {
    return new NetworkError(stderr, exitCode);
  }
  return new YtDlpError(`yt-dlp exited with code ${exitCode}\nStderr: ${stderr}`, stderr, exitCode);
}
