# Media Downloader (YouTube, Facebook, Instagram, Spotify)

A full-stack media downloader application built with Express.js and yt-dlp.

## ⚠️ Important: Local vs Deployed

### For Development/Testing (Recommended)
```bash
npm start
# Open http://localhost:3000
```
The local version supports **full downloads** of videos and audio files.

### Deployed Version (Vercel)
The deployed version at `mstudio-olive.vercel.app` only supports:
- ✅ Preview/metadata fetching
- ❌ **NOT** file downloads (Vercel serverless doesn't support this)

**For downloads to work, you MUST run the application locally.**

---

## Features

- 🎥 **YouTube** - Download videos and audio
- 📱 **Instagram** - Download photos and videos  
- 👥 **Facebook** - Download videos
- 🎵 **Spotify** - Download audio tracks
- 🚀 **High Performance** - Streaming downloads with concurrent fragments
- 📊 **Best Quality** - Auto-selects best available quality
- 🔐 **Secure** - Session-based authentication

---

## Installation

### Requirements
- Node.js 16+
- yt-dlp (automatically downloaded on first run)
- FFmpeg (for audio extraction)

### Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd media_downloader

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in browser
# Visit http://localhost:3000
```

---

## Usage

### Local Usage (Recommended)

1. **Start Server**
   ```bash
   npm start
   ```

2. **Open Browser**
   ```
   http://localhost:3000
   ```

3. **Download Videos**
   - Paste YouTube/Instagram/Facebook/Spotify URL
   - Click Download
   - Choose quality and format
   - Files download automatically

### Testing Video Info Fetching

```bash
# Test with a YouTube video
node test-ytdlp.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## API Endpoints

### POST `/api/video-info`
Fetch metadata about a video
```json
{
  "url": "https://youtube.com/watch?v=..."
}
```

### GET `/api/download-video`
Download video file
```
/api/download-video?url=...&format=video&fileName=myfile
```

### GET `/api/download-audio`  
Download audio file
```
/api/download-audio?url=...&fileName=myfile
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed help with:
- "Failed to fetch video info" errors
- Age-restricted videos
- Geo-blocked content
- Network issues
- And more...

### Quick Diagnosis
```bash
node test-ytdlp.js "YOUR_VIDEO_URL"
```

---

## Performance

The application includes optimizations for:
- ⚡ Streaming downloads (no memory buildup)
- 🔄 Concurrent fragment downloading (4 parallel connections)
- 📈 Optimized buffer sizes (16KB minimum)
- 🧹 Automatic cleanup of temp files
- 🔌 Connection pooling

Expected speeds: **2-4x faster** than browser downloads

---

## Development

### File Structure
```
├── server.js              # Main Express server
├── public/                # Frontend files
│   ├── login.html
│   ├── services/          # YouTube, Instagram, etc.
│   ├── scripts/           # Frontend JS
│   └── style.css
├── assets/                # Images, fonts, CSS
├── test-ytdlp.js          # Diagnostic script
├── vercel.json            # Vercel deployment config
└── package.json
```

### Running Locally
```bash
npm start        # Production mode
npm run dev      # Development mode with hot reload
```

### Deploying to Vercel

⚠️ **Note**: Downloads won't work on Vercel (serverless limitation)

```bash
vercel --prod
```

---

## Known Limitations

### Vercel Deployment
- ❌ Cannot download files (serverless environment)
- ✅ Can fetch metadata only
- ✅ UI still works for preview

### Video Support
- Age-restricted videos require authentication
- Geo-blocked videos need VPN
- Copyright-protected content may not download
- Some platforms block automated downloads

---

## Security Notes

- 🔐 Authentication is session-based
- 🔒 No credentials stored permanently  
- ⚠️ Downloaded files are temporary (auto-deleted)
- 🔑 Keep API endpoints secure in production

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues:
1. Run diagnostic: `node test-ytdlp.js "YOUR_URL"`
2. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. Review server logs in terminal
4. Ensure yt-dlp is up to date: `pip install --upgrade yt-dlp`

---

**Last Updated:** February 5, 2026
