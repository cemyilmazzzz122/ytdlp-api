const fs = require('fs');
const https = require('https');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '..', 'bin');
const platform = os.platform();

let binaryName = 'yt-dlp';
let downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

if (platform === 'win32') {
  binaryName = 'yt-dlp.exe';
  downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
} else if (platform === 'darwin') {
  downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
}

const binaryPath = path.join(binDir, binaryName);

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        if (platform !== 'win32') {
          // Make it executable
          execSync(`chmod +x "${dest}"`);
        }
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

console.log(`Downloading yt-dlp for ${platform}...`);
download(downloadUrl, binaryPath)
  .then(() => {
    console.log(`Successfully downloaded yt-dlp to ${binaryPath}`);
  })
  .catch((err) => {
    console.error('Error downloading yt-dlp:', err);
    process.exit(1);
  });
