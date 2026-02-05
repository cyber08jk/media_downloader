# Installing FFmpeg

FFmpeg is required for audio extraction from videos. Here's how to install it:

## Windows

### Option 1: Manual Download (Easiest)
1. Visit: https://ffmpeg.org/download.html
2. Click on Windows builds
3. Download the full build (includes ffmpeg, ffprobe, ffplay)
4. Extract to a folder, e.g., `C:\ffmpeg`
5. Add to PATH:
   - Right-click "This PC" → Properties
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Click "New" under System variables
   - Variable name: `PATH`
   - Variable value: `C:\ffmpeg\bin` (or wherever you extracted it)
   - Click OK three times
6. **Restart your terminal** and verify:
   ```bash
   ffmpeg -version
   ```

### Option 2: Using a Package Manager
If you have **Chocolatey** installed:
```bash
choco install ffmpeg
```

If you have **Windows Package Manager** (winget):
```bash
winget install GyanD.FFmpeg
```

## macOS

Using Homebrew:
```bash
brew install ffmpeg
```

## Linux

### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

### Fedora/RHEL:
```bash
sudo yum install ffmpeg
```

### Arch:
```bash
sudo pacman -S ffmpeg
```

## Verify Installation

After installation, verify it works:
```bash
ffmpeg -version
ffprobe -version
```

You should see version information for both commands.

## Troubleshooting

If you still get "ffmpeg not found":
1. **Close and reopen your terminal** (important!)
2. Check the installation path
3. Ensure it's in your PATH environment variable
4. Restart your computer if needed

Once FFmpeg is installed, restart the media downloader:
```bash
npm start
```

---

For more info: https://ffmpeg.org
