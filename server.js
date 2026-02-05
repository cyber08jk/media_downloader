const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const ytdl = require('@distube/ytdl-core');
const YTDlpWrap = require('yt-dlp-wrap').default;
const os = require('os');

const app = express();

// Optimize for downloads
app.set('trust proxy', 1);

// Increase payload limits for better handling
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Initialize yt-dlp and download binary if needed
let ytDlp = null;
let ytDlpReady = false;

const initYtDlp = async () => {
    try {
        // Check for local binary first
        const binaryPath = path.join(__dirname, 'yt-dlp.exe');
        if (fs.existsSync(binaryPath)) {
            ytDlp = new YTDlpWrap(binaryPath);
            console.log('Using local yt-dlp binary at:', binaryPath);
        } else {
            // Fallback to default lookup or download
            ytDlp = new YTDlpWrap();
            await ytDlp.getVersion();
            console.log('yt-dlp binary found in PATH');
        }
        ytDlpReady = true;
        console.log('✅ yt-dlp initialized successfully');
    } catch (error) {
        console.log('⚠️  yt-dlp binary not found, attempting download...');
        try {
            await YTDlpWrap.downloadFromGithub();
            ytDlp = new YTDlpWrap(path.join(__dirname, 'yt-dlp.exe'));
            ytDlpReady = true;
            console.log('✅ yt-dlp binary downloaded and initialized successfully');
        } catch (downloadError) {
            console.error('❌ Failed to initialize yt-dlp:', downloadError.message);
            ytDlpReady = false;
        }
    }
};

// Start initialization immediately
initYtDlp();

// Use system temp directory for downloads to avoid cluttering project folder
const downloadsDir = os.tmpdir();

// Middleware
app.use(express.static('public'));
app.use(express.static('assets'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'assets')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Authentication middleware
function requireAuth(req, res, next) {
    next();
}

// Middleware to ensure ytDlp is initialized
function requireYtDlp(req, res, next) {
    if (!ytDlpReady || !ytDlp) {
        return res.status(503).json({ 
            success: false, 
            message: 'Download service is initializing. Please try again in a moment.' 
        });
    }
    next();
}

// Users data file path
const usersFilePath = path.join(__dirname, 'users.json');

// Initialize users.json if it doesn't exist
if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify([]));
}

// Helper function to read users
function readUsers() {
    const data = fs.readFileSync(usersFilePath);
    return JSON.parse(data);
}

// Helper function to write users
function writeUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/services', 'main.html'));
});

app.get('/facebook', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/services', 'Facebook.html'));
});

app.get('/spotify', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/services', 'Spotify.html'));
});

app.get('/insta', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/services', 'instagram.html'));
});

// Login route
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();

    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        req.session.userId = user.id;
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
});

// Register route
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const users = readUsers();

    // Check if email already exists
    if (users.some(u => u.email === email)) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Create new user
    const newUser = {
        id: Date.now(),
        name,
        email,
        password,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    req.session.userId = newUser.id;
    res.json({ success: true, user: newUser });
});

// Logout route
// Helper function to handle online downloads via third-party services
function handleOnlineDownload(res, url, format, fileName, mediaType) {
    try {
        // Encode URL for services
        const encodedUrl = encodeURIComponent(url);
        
        // Different services for different needs
        let downloadUrl;
        
        if (mediaType === 'audio') {
            // Audio download services (MP3)
            downloadUrl = `https://y2mate.com/en/youtube-to-mp3?url=${encodedUrl}`;
        } else {
            // Video download services
            // Using y2mate as primary (most reliable)
            downloadUrl = `https://y2mate.com/en/youtube-to-mp4?url=${encodedUrl}`;
        }
        
        // Return the download service URL for the user
        // The browser will open this in a new tab/window
        res.json({
            success: true,
            message: 'Opening download service in new tab...',
            downloadUrl: downloadUrl,
            note: 'Using online download service. You may need to follow additional steps on the download site.'
        });
        
    } catch (error) {
        console.error('Online download error:', error);
        res.status(500).json({
            success: false,
            message: 'Could not generate download link. Please try: 1) Use local app (npm start) 2) Visit y2mate.com manually'
        });
    }
}

// Check login status route
app.get('/api/check-login', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ isLoggedIn: true });
    } else {
        res.json({ isLoggedIn: false });
    }
});

// Media download routes
// Video Info route - works online and locally
app.post('/api/video-info', requireAuth, async (req, res) => {
    const { url } = req.body;
    try {
        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        console.log('Fetching video info for:', url);
        
        // Try local yt-dlp first
        if (ytDlpReady && ytDlp) {
            try {
                const jsonOutput = await ytDlp.execPromise([
                    url,
                    '--dump-json',
                    '--no-playlist',
                    '--no-warnings',
                    '--skip-download',
                    '--socket-timeout', '30',
                    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    '--referer', 'https://www.youtube.com',
                    '--extractor-args', 'youtube:skip=dash,hls'
                ]);

                const info = JSON.parse(jsonOutput);

                // Simplified format selection
                const formats = [
                    {
                        type: 'video',
                        label: 'Video (Best Quality)',
                        format: 'bestvideo+bestaudio/best',
                        description: 'Highest quality video with audio'
                    },
                    {
                        type: 'audio',
                        label: 'Audio Only (Best Quality)',
                        format: 'bestaudio/best',
                        description: 'Highest quality audio only'
                    }
                ];

                return res.json({
                    title: info.title,
                    thumbnail: info.thumbnail,
                    duration: info.duration,
                    formats: formats,
                    url: url
                });
            } catch (error) {
                console.log('yt-dlp failed, falling back to API:', error.message);
                // Fall through to API fallback
            }
        }
        
        // Fallback: Use public API for metadata
        console.log('Using fallback API for video info...');
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ success: false, message: 'Invalid YouTube URL' });
        }

        // Try noembed API (no key required)
        try {
            const apiUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
            const response = await fetch(apiUrl);
            
            if (response.ok) {
                const data = await response.json();
                
                const formats = [
                    {
                        type: 'video',
                        label: 'Video (Best Quality)',
                        format: 'bestvideo+bestaudio/best',
                        description: 'Highest quality video with audio'
                    },
                    {
                        type: 'audio',
                        label: 'Audio Only (Best Quality)',
                        format: 'bestaudio/best',
                        description: 'Highest quality audio only'
                    }
                ];

                return res.json({
                    title: data.title || 'Video',
                    thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    duration: data.duration || 0,
                    formats: formats,
                    url: url
                });
            }
        } catch (apiError) {
            console.log('Noembed API failed:', apiError.message);
        }

        // Final fallback: basic YouTube thumbnail
        const formats = [
            {
                type: 'video',
                label: 'Video (Best Quality)',
                format: 'bestvideo+bestaudio/best',
                description: 'Highest quality video with audio'
            },
            {
                type: 'audio',
                label: 'Audio Only (Best Quality)',
                format: 'bestaudio/best',
                description: 'Highest quality audio only'
            }
        ];

        return res.json({
            title: 'Video',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: 0,
            formats: formats,
            url: url
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        let errorMsg = 'Failed to fetch video info - video may be unavailable or restricted';
        
        if (error.message.includes('Video unavailable') || error.message.includes('is not available')) {
            errorMsg = 'Video is unavailable or private';
        } else if (error.message.includes('Sign in') || error.message.includes('age-restricted')) {
            errorMsg = 'Video requires sign-in (age-restricted or members-only)';
        }
        
        res.status(500).json({ success: false, message: errorMsg });
    }
});

// Helper function to extract YouTube video ID
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Streaming Video Download route with improved performance
app.get('/api/download-video', requireAuth, async (req, res) => {
    const { url, format, fileName } = req.query;
    
    // Check if yt-dlp is available (only local)
    if (!ytDlpReady || !ytDlp) {
        // Fallback: Use online download services for Vercel
        return handleOnlineDownload(res, url, format, fileName, 'video');
    }
    
    let outputPath = null;
    
    try {
        if (!url) return res.status(400).send('URL is required');

        const safeFileName = (fileName || 'video').replace(/[^a-z0-9._-]/gi, '_').substring(0, 50);
        const timestamp = Date.now();
        outputPath = path.join(downloadsDir, `${safeFileName}_${timestamp}.%(ext)s`);
        const expectedPath = path.join(downloadsDir, `${safeFileName}_${timestamp}.mp4`);

        // Auto-select best quality based on format type - force video WITH audio
        const formatArg = format === 'audio' ? 'bestaudio/best' : 'bestvideo+bestaudio/best';
        
        console.log(`Downloading: ${url}`);
        console.log(`Format requested: ${format || 'video'}`);
        console.log(`yt-dlp format: ${formatArg}`);
        console.log(`Expected output: ${expectedPath}`);

        // Set headers before starting download
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.mp4"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Use streaming for faster downloads
        const ytDlpArgs = [
            url,
            '-f', formatArg,
            '--merge-output-format', 'mp4',
            '--no-playlist',
            '--no-warnings',
            '--no-mtime',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '--referer', url,
            '--newline',
            '-o', outputPath
        ];
        
        // Add audio-specific flags for video downloads
        if (format !== 'audio') {
            ytDlpArgs.push('--audio-format', 'best');
            ytDlpArgs.push('--postprocessor-args', 'ffmpeg:-c:a aac -c:v copy');
        }
        
        const ytDlpProcess = ytDlp.exec(ytDlpArgs);
        
        if (!ytDlpProcess) {
            console.error('Failed to start yt-dlp process');
            return res.status(500).send('Failed to start download process');
        }
        
        // Capture stdout/stderr for debugging
        let downloadLog = '';
        let errorLog = '';
        if (ytDlpProcess.stdout) {
            ytDlpProcess.stdout.on('data', (data) => {
                downloadLog += data.toString();
            });
        }
        if (ytDlpProcess.stderr) {
            ytDlpProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                errorLog += msg;
                console.log('yt-dlp:', msg);
            });
        }
        
        outputPath = expectedPath;

        ytDlpProcess.on('error', (error) => {
            console.error('yt-dlp process error:', error);
            if (!res.headersSent) {
                res.status(500).send('Download failed: ' + error.message);
            }
        });

        await new Promise((resolve, reject) => {
            ytDlpProcess.on('close', (code) => {
                console.log(`yt-dlp process exited with code: ${code}`);
                console.log(`Download stderr: ${errorLog}`);
                if (code === 0) {
                    resolve();
                } else {
                    let errorMsg = 'Download failed - video may be unavailable or restricted';
                    if (errorLog.includes('Video unavailable') || errorLog.includes('is not available')) {
                        errorMsg = 'Video is unavailable or private';
                    } else if (errorLog.includes('Sign in') || errorLog.includes('age-restricted')) {
                        errorMsg = 'Video requires authentication (age-restricted or members-only)';
                    } else if (errorLog.includes('403')) {
                        errorMsg = 'Access forbidden - video may be blocked';
                    } else if (errorLog.includes('No space')) {
                        errorMsg = 'Not enough disk space';
                    }
                    reject(new Error(errorMsg));
                }
            });
        });

        console.log('Download completed, checking file...');
        console.log('Looking for file at:', outputPath);
        
        // Check if file exists before streaming
        if (!fs.existsSync(outputPath)) {
            // Try to find the file with similar name (yt-dlp might have modified it)
            const dir = path.dirname(outputPath);
            const baseName = path.basename(outputPath, '.mp4');
            console.log('File not found, searching in:', dir);
            console.log('Looking for basename:', baseName.substring(0, 50));
            
            const allFiles = fs.readdirSync(dir);
            // Look for merged file first, then any video file with our base name
            const matchingFiles = allFiles
                .filter(f => f.includes(baseName.substring(0, 50)) && (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm')))
                .sort((a, b) => {
                    // Prefer files without format IDs (merged files)
                    const aHasFormat = /\.f\d+/.test(a);
                    const bHasFormat = /\.f\d+/.test(b);
                    if (aHasFormat && !bHasFormat) return 1;
                    if (!aHasFormat && bHasFormat) return -1;
                    return 0;
                });
            console.log('Matching files:', matchingFiles);
            
            if (matchingFiles.length > 0) {
                outputPath = path.join(dir, matchingFiles[0]);
                console.log('Found file:', outputPath);
            } else {
                console.error('Downloaded file not found at:', outputPath);
                console.error('Recent files in temp dir:', allFiles.slice(-10));
                return res.status(500).send('Download completed but file not found');
            }
        } else {
            console.log('File found at expected location');
        }

        // Get file size for Content-Length header
        const stat = fs.statSync(outputPath);
        res.setHeader('Content-Length', stat.size);

        // Stream the file to response
        const fileStream = fs.createReadStream(outputPath);
        fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) res.status(500).send('Stream failed');
        });

        fileStream.pipe(res);

        res.on('finish', () => {
            // Cleanup after successful send
            setTimeout(() => {
                if (outputPath && fs.existsSync(outputPath)) {
                    fs.unlink(outputPath, (e) => {
                        if (e) console.log('Cleanup error:', e);
                    });
                }
            }, 1000);
        });

    } catch (error) {
        console.error('Video download error:', error);
        if (!res.headersSent) res.status(500).send('Download failed: ' + error.message);
        // Cleanup on error
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlink(outputPath, () => {});
        }
    }
});

// Streaming Audio Download route with improved performance
app.get('/api/download-audio', requireAuth, async (req, res) => {
    const { url, fileName } = req.query;
    
    // Check if yt-dlp is available (only local)
    if (!ytDlpReady || !ytDlp) {
        // Fallback: Use online download services for Vercel
        return handleOnlineDownload(res, url, 'audio', fileName, 'audio');
    }
    
    let outputPath = null;
    
    try {
        if (!url) return res.status(400).send('URL is required');

        const safeFileName = (fileName || 'audio').replace(/[^a-z0-9._-]/gi, '_').substring(0, 50);
        outputPath = path.join(downloadsDir, `${safeFileName}_${Date.now()}.mp3`);

        console.log(`Downloading audio (best quality): ${url}`);

        // Set headers before starting download
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.mp3"`);
        res.setHeader('Cache-Control', 'no-cache');

        const args = [
            url,
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',  // Best quality
            '--no-playlist',
            '--no-warnings',
            '--concurrent-fragments', '4',
            '--buffer-size', '16K',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '-o', outputPath
        ];

        const ytDlpProcess = ytDlp.exec(args);
        
        let errorLog = '';
        if (ytDlpProcess.stderr) {
            ytDlpProcess.stderr.on('data', (data) => {
                errorLog += data.toString();
                console.log('yt-dlp:', data.toString());
            });
        }

        ytDlpProcess.on('error', (error) => {
            console.error('yt-dlp process error:', error);
            if (!res.headersSent) {
                res.status(500).send('Download failed');
            }
        });

        await new Promise((resolve, reject) => {
            ytDlpProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    let errorMsg = 'Audio download failed';
                    if (errorLog.includes('ffmpeg not found') || errorLog.includes('ffprobe not found')) {
                        errorMsg = 'FFmpeg is not installed. Please install it and try again.';
                    }
                    reject(new Error(errorMsg));
                }
            });
        });

        // Check if file exists before streaming
        if (!fs.existsSync(outputPath)) {
            const dir = path.dirname(outputPath);
            const baseName = path.basename(outputPath, '.mp3');
            const files = fs.readdirSync(dir).filter(f => f.includes(baseName.substring(0, 50)));
            
            if (files.length > 0) {
                outputPath = path.join(dir, files[0]);
                console.log('Found file:', outputPath);
            } else {
                console.error('Downloaded file not found at:', outputPath);
                return res.status(500).send('Download completed but file not found');
            }
        }

        // Get file size for Content-Length header
        const stat = fs.statSync(outputPath);
        res.setHeader('Content-Length', stat.size);

        // Stream the file to response
        const fileStream = fs.createReadStream(outputPath);
        fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) res.status(500).send('Stream failed');
        });

        fileStream.pipe(res);

        res.on('finish', () => {
            // Cleanup after successful send
            setTimeout(() => {
                if (outputPath && fs.existsSync(outputPath)) {
                    fs.unlink(outputPath, (e) => {
                        if (e) console.log('Cleanup error:', e);
                    });
                }
            }, 1000);
        });

    } catch (error) {
        console.error('Audio download error:', error);
        let errorMsg = 'Download failed: ' + error.message;
        
        if (error.message.includes('FFmpeg is not installed')) {
            errorMsg = 'FFmpeg is required for audio downloads. Visit https://ffmpeg.org/download.html to install it.';
        }
        
        if (!res.headersSent) res.status(500).send(errorMsg);
        // Cleanup on error
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlink(outputPath, () => {});
        }
    }
});

// Facebook Download Route with streaming
app.get('/api/download/facebook', requireAuth, async (req, res) => {
    const { url } = req.query;
    
    // Check if yt-dlp is available (only local)
    if (!ytDlpReady || !ytDlp) {
        return res.status(503).json({ 
            success: false, 
            message: 'Downloads require local installation. Download/clone this project and run: npm start' 
        });
    }
    
    let outputPath = null;

    try {
        if (!url) {
            return res.status(400).json({ success: false, message: 'Invalid Facebook URL' });
        }

        outputPath = path.join(downloadsDir, `facebook_${Date.now()}.mp4`);

        // Set headers
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="facebook_video.mp4"');
        res.setHeader('Cache-Control', 'no-cache');

        const ytDlpProcess = ytDlp.exec([
            url,
            '-f', 'bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--no-warnings',
            '--audio-format', 'best',
            '-o', outputPath
        ]);

        await new Promise((resolve, reject) => {
            ytDlpProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Process exited with code ${code}`));
            });
            ytDlpProcess.on('error', reject);
        });

        // Check if file exists
        if (!fs.existsSync(outputPath)) {
            const dir = path.dirname(outputPath);
            const files = fs.readdirSync(dir).filter(f => f.startsWith('facebook_'));
            if (files.length > 0) {
                outputPath = path.join(dir, files[files.length - 1]);
                console.log('Found file:', outputPath);
            } else {
                return res.status(500).send('Download completed but file not found');
            }
        }

        const stat = fs.statSync(outputPath);
        res.setHeader('Content-Length', stat.size);

        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);

        res.on('finish', () => {
            setTimeout(() => {
                if (outputPath && fs.existsSync(outputPath)) {
                    fs.unlink(outputPath, (e) => {
                        if (e) console.log('Cleanup error:', e);
                    });
                }
            }, 1000);
        });
    } catch (error) {
        console.error('Facebook download error:', error);
        if (!res.headersSent) {
            res.status(500).send('Download failed: ' + error.message);
        }
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlink(outputPath, () => {});
        }
    }
});

// Instagram Download Route with streaming
app.get('/api/download/instagram', requireAuth, async (req, res) => {
    const { url } = req.query;
    
    // Check if yt-dlp is available (only local)
    if (!ytDlpReady || !ytDlp) {
        return res.status(503).json({ 
            success: false, 
            message: 'Downloads require local installation. Download/clone this project and run: npm start' 
        });
    }
    
    let outputPath = null;

    try {
        if (!url) {
            return res.status(400).json({ success: false, message: 'Invalid Instagram URL' });
        }

        outputPath = path.join(downloadsDir, `instagram_${Date.now()}.mp4`);

        // Set headers
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="instagram_media.mp4"');
        res.setHeader('Cache-Control', 'no-cache');

        const ytDlpProcess = ytDlp.exec([
            url,
            '-f', 'bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--no-warnings',
            '--audio-format', 'best',
            '-o', outputPath
        ]);

        await new Promise((resolve, reject) => {
            ytDlpProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Process exited with code ${code}`));
            });
            ytDlpProcess.on('error', reject);
        });

        // Check if file exists
        if (!fs.existsSync(outputPath)) {
            const dir = path.dirname(outputPath);
            const files = fs.readdirSync(dir).filter(f => f.startsWith('instagram_'));
            if (files.length > 0) {
                outputPath = path.join(dir, files[files.length - 1]);
                console.log('Found file:', outputPath);
            } else {
                return res.status(500).send('Download completed but file not found');
            }
        }

        const stat = fs.statSync(outputPath);
        res.setHeader('Content-Length', stat.size);

        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);

        res.on('finish', () => {
            setTimeout(() => {
                if (outputPath && fs.existsSync(outputPath)) {
                    fs.unlink(outputPath, (e) => {
                        if (e) console.log('Cleanup error:', e);
                    });
                }
            }, 1000);
        });
    } catch (error) {
        console.error('Instagram download error:', error);
        if (!res.headersSent) {
            res.status(500).send('Download failed: ' + error.message);
        }
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlink(outputPath, () => {});
        }
    }
});

// Spotify Download Route with streaming
app.get('/api/download/spotify', requireAuth, async (req, res) => {
    const { url } = req.query;
    
    // Check if yt-dlp is available (only local)
    if (!ytDlpReady || !ytDlp) {
        return res.status(503).json({ 
            success: false, 
            message: 'Downloads require local installation. Download/clone this project and run: npm start' 
        });
    }
    
    let outputPath = null;

    try {
        if (!url) {
            return res.status(400).json({ success: false, message: 'Invalid Spotify URL' });
        }

        outputPath = path.join(downloadsDir, `spotify_${Date.now()}.mp3`);

        // Set headers
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="spotify_audio.mp3"');
        res.setHeader('Cache-Control', 'no-cache');

        const ytDlpProcess = ytDlp.exec([
            url,
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '--no-warnings',
            '--concurrent-fragments', '4',
            '--buffer-size', '16K',
            '-o', outputPath
        ]);

        await new Promise((resolve, reject) => {
            ytDlpProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Process exited with code ${code}`));
            });
            ytDlpProcess.on('error', reject);
        });

        // Check if file exists
        if (!fs.existsSync(outputPath)) {
            const dir = path.dirname(outputPath);
            const files = fs.readdirSync(dir).filter(f => f.startsWith('spotify_'));
            if (files.length > 0) {
                outputPath = path.join(dir, files[files.length - 1]);
                console.log('Found file:', outputPath);
            } else {
                return res.status(500).send('Download completed but file not found');
            }
        }

        const stat = fs.statSync(outputPath);
        res.setHeader('Content-Length', stat.size);

        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);

        res.on('finish', () => {
            setTimeout(() => {
                if (outputPath && fs.existsSync(outputPath)) {
                    fs.unlink(outputPath, (e) => {
                        if (e) console.log('Cleanup error:', e);
                    });
                }
            }, 1000);
        });
    } catch (error) {
        console.error('Spotify download error:', error);
        if (!res.headersSent) {
            res.status(500).send('Download failed: ' + error.message);
        }
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlink(outputPath, () => {});
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!' });
});

// 404 handler - serve index.html for SPA-like behavior
app.use((req, res) => {
    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    // For all other requests, serve index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;

// Export app for Vercel serverless
module.exports = app;

// Only listen locally (not on Vercel)
if (!process.env.VERCEL && require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Optimizations enabled:');
        console.log('- File streaming for faster downloads');
        console.log('- Concurrent connection handling');
        console.log('- Automatic cleanup of temporary files');
        console.log('- Enhanced error handling');
    });
}