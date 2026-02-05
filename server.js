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
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
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
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check login status route
app.get('/api/check-login', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ isLoggedIn: true });
    } else {
        res.json({ isLoggedIn: false });
    }
});

// Media download routes
// Video Info route
app.post('/api/video-info', requireAuth, requireYtDlp, async (req, res) => {
    const { url } = req.body;
    try {
        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        console.log('Fetching video info for:', url);
        
        // Check if running on Vercel (serverless)
        if (process.env.VERCEL) {
            return res.status(503).json({
                success: false,
                message: 'Video downloads are only available when running locally. Start the server with: npm start'
            });
        }
        
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

        // Simplified format selection - only audio or video with auto-best quality
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

        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            formats: formats,
            url: url
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            stderr: error.stderr,
            stdout: error.stdout
        });
        
        // Better error detection
        let errorMsg = 'Failed to fetch video info - video may be unavailable or restricted';
        
        if (error.message.includes('Video unavailable') || error.message.includes('is not available')) {
            errorMsg = 'Video is unavailable or private';
        } else if (error.message.includes('Sign in') || error.message.includes('age-restricted')) {
            errorMsg = 'Video requires sign-in (age-restricted or members-only)';
        } else if (error.message.includes('not available') || error.message.includes('region')) {
            errorMsg = 'Video is not available in your region';
        } else if (error.message.includes('Invalid URL') || error.message.includes('No such file')) {
            errorMsg = 'Invalid URL format';
        } else if (error.message.includes('No space') || error.message.includes('disk')) {
            errorMsg = 'Not enough disk space available';
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
            errorMsg = 'Network connection error - check your internet';
        }
        
        res.status(500).json({ success: false, message: errorMsg });
    }
});

// Streaming Video Download route with improved performance
app.get('/api/download-video', requireAuth, requireYtDlp, async (req, res) => {
    const { url, format, fileName } = req.query;
    
    // Check if running on Vercel (serverless)
    if (process.env.VERCEL) {
        return res.status(503).send('Video downloads are only available when running locally. Start the server with: npm start');
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
app.get('/api/download-audio', requireAuth, requireYtDlp, async (req, res) => {
    const { url, fileName } = req.query;
    
    // Check if running on Vercel (serverless)
    if (process.env.VERCEL) {
        return res.status(503).send('Audio downloads are only available when running locally. Start the server with: npm start');
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
app.get('/api/download/facebook', requireAuth, requireYtDlp, async (req, res) => {
    const { url } = req.query;
    let outputPath = null;

    try {
        if (!url) {
            return res.status(400).send('Invalid Facebook URL');
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
app.get('/api/download/instagram', requireAuth, requireYtDlp, async (req, res) => {
    const { url } = req.query;
    let outputPath = null;

    try {
        if (!url) {
            return res.status(400).send('Invalid Instagram URL');
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
app.get('/api/download/spotify', requireAuth, requireYtDlp, async (req, res) => {
    const { url } = req.query;
    let outputPath = null;

    try {
        if (!url) {
            return res.status(400).send('Invalid Spotify URL');
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

// Start server
const PORT = process.env.PORT || 3000;

// Export app for Vercel serverless
if (process.env.VERCEL) {
    module.exports = app;
} else {
    // Local development
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Optimizations enabled:');
        console.log('- File streaming for faster downloads');
        console.log('- Concurrent connection handling');
        console.log('- Automatic cleanup of temporary files');
        console.log('- Enhanced error handling');
    });
}