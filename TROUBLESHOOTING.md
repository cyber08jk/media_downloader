# Troubleshooting: "Failed to fetch video info"

This error typically means yt-dlp couldn't retrieve information about the video. Here are the common causes and solutions:

## Quick Diagnosis

First, test if the issue is with your URL or with the entire system:

```bash
node test-ytdlp.js "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

This diagnostic script will:
- ✅ Check if yt-dlp is installed and working
- ✅ Try to fetch video information
- ✅ Provide specific error details
- ✅ Suggest solutions based on the error

## Common Error Causes & Solutions

### 1. **Video Unavailable or Deleted**
**Error Message:** `Video unavailable` or `This video is not available`

**Causes:**
- Video has been deleted
- Video is private or unlisted
- Video is restricted

**Solutions:**
- Verify the video URL is correct and the video still exists
- Try accessing the video directly in your browser
- If it's a private video, make sure you have access to it

---

### 2. **Age-Restricted Videos**
**Error Message:** `Sign in`, `age-restricted`, `requires authentication`

**Causes:**
- Video is marked as 18+
- YouTube requires sign-in to view
- Video contains mature content

**Solutions:**
- **Option A:** Add your YouTube credentials to yt-dlp
  ```bash
  yt-dlp --username YOUR_EMAIL --password YOUR_PASSWORD VIDEO_URL
  ```
- **Option B:** Use a browser cookie file
  - Install browser extension to export cookies (e.g., "Get cookies.txt")
  - Save cookies to `cookies.txt`
  - Update server.js to use: `'--cookies', 'cookies.txt'`

---

### 3. **Geo-Blocked Videos**
**Error Message:** `not available in your country` or `not available in your region`

**Causes:**
- Video is restricted to certain countries
- Your IP location is blocked
- Content licensing restrictions

**Solutions:**
- Use a VPN to change your location
- Contact the video uploader to request access
- Some videos cannot be accessed outside their region

---

### 4. **Network/Connection Issues**
**Error Message:** `ECONNREFUSED`, `ETIMEDOUT`, `No connection`

**Causes:**
- Internet connection is down
- Firewall blocking yt-dlp
- YouTube temporarily unavailable
- Rate limiting from YouTube

**Solutions:**
```bash
# Test your connection
ping google.com

# Try increasing timeout in the app
# Add '--socket-timeout 60' in server.js yt-dlp calls

# Check if YouTube is accessible
ping youtube.com

# Try after a few minutes (rate limit issue)
```

---

### 5. **Invalid URL Format**
**Error Message:** `Invalid URL`, `No such file`

**Causes:**
- URL is malformed
- Not a valid YouTube/media URL
- Missing video ID

**Solutions:**
Valid YouTube URL formats:
```
✅ https://www.youtube.com/watch?v=dQw4w9WgXcQ
✅ https://youtu.be/dQw4w9WgXcQ
✅ https://m.youtube.com/watch?v=dQw4w9WgXcQ
❌ https://youtube.com/search?q=hello
❌ https://youtube.com/
```

---

### 6. **yt-dlp Binary Issues**
**Error Message:** `No such file or directory`, version mismatch

**Causes:**
- yt-dlp not installed
- Binary is outdated
- Binary is corrupted

**Solutions:**
```bash
# Check if yt-dlp is installed
yt-dlp --version

# Update to latest version
pip install --upgrade yt-dlp

# Or on Windows, if using the bundled version:
# Delete yt-dlp.exe and restart the app (it will auto-download)

# Verify installation
npm install
npm install yt-dlp-wrap
```

---

### 7. **Disk Space Issue**
**Error Message:** `No space left on device`, `Disk quota exceeded`

**Causes:**
- Temporary drive is full
- Not enough space for video file

**Solutions:**
```bash
# Check disk space on your temp directory
# On Windows, check C: drive (or wherever TEMP is set)
# Free up space by deleting old files

# Alternatively, change the temp directory in server.js:
# Change: const downloadsDir = os.tmpdir();
# To: const downloadsDir = 'D:\\Downloads'; // or your preferred drive
```

---

### 8. **YouTube Algorithm/Copyright Issues**
**Error Message:** `Video unavailable`, Access forbidden (403)

**Causes:**
- Video contains copyright-protected content
- Video blocked by platform
- Age verification required

**Solutions:**
- Some videos cannot be downloaded due to copyright
- Check if you own the rights to download the video
- Contact the content creator for permission

---

## Advanced Troubleshooting

### Enable Debug Logging
Update [server.js](server.js) to see detailed error logs:

Look for these lines and they should already have enhanced logging:
```javascript
console.error('Error details:', {
    message: error.message,
    code: error.code,
    stderr: error.stderr,
    stdout: error.stdout
});
```

### Check Server Logs
Run the server and watch the console output:
```bash
npm start
# Watch the terminal for detailed error messages
```

### Test Directly with yt-dlp
Test the URL directly without the web interface:
```bash
# Just get info
yt-dlp --dump-json --skip-download "YOUR_URL"

# Get list of formats
yt-dlp --list-formats "YOUR_URL"

# Try download
yt-dlp -f "bestvideo+bestaudio/best" -o "test.mp4" "YOUR_URL"
```

---

## Still Having Issues?

1. **Run the diagnostic:** `node test-ytdlp.js "YOUR_URL"`
2. **Check server.js console** for the actual error message
3. **Share the full error output** for more specific help
4. **Update yt-dlp:** `pip install --upgrade yt-dlp`
5. **Restart the application** to ensure everything is reinitialized

---

## Performance Tips

Even if downloads work, here are tips to improve reliability:

1. **Use stable internet** - Avoid WiFi fluctuations
2. **Download during off-peak hours** - Less rate limiting
3. **Keep yt-dlp updated** - `pip install --upgrade yt-dlp`
4. **Use cookies for authentication** - More reliable than passwords
5. **Avoid concurrent downloads** - Download one at a time initially

---

**Last Updated:** February 5, 2026
