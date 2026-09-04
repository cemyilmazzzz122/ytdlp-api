export * from './types';
export * from './errors';
export * from './yt-dlp';

import { YtDlp } from './yt-dlp';

// Provide a default instance for quick usage
const ytdlp = new YtDlp();
export default ytdlp;
