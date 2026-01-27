const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const ytdl = require('@distube/ytdl-core');
const YTDlpWrap = require('yt-dlp-wrap').default;
const os = require('os');

const app = express();
const PORT = 3000;

// Initialize yt-dlp and download binary if needed
let ytDlp;
(async () => {
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
    } catch (error) {
        console.log('yt-dlp binary not found, downloading...');
        try {
            await YTDlpWrap.downloadFromGithub();
            ytDlp = new YTDlpWrap(path.join(__dirname, 'yt-dlp.exe')); // Use the downloaded binary path
            console.log('yt-dlp binary downloaded successfully');
        } catch (downloadError) {
            console.error('Failed to download yt-dlp:', downloadError);
        }
    }
})();

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
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.post('/api/video-info', requireAuth, async (req, res) => {
    const { url } = req.body;
    try {
        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        console.log('Fetching video info for:', url);
        const jsonOutput = await ytDlp.execPromise([
            url,
            '--dump-json',
            '--no-playlist'
        ]);

        const info = JSON.parse(jsonOutput);

        // Filter and map formats
        const formats = info.formats
            .map(f => ({
                itag: f.format_id,
                quality: f.resolution || (f.height ? `${f.height}p` : null) || (f.abr ? `${Math.round(f.abr)}kbps` : 'Unknown'),
                mimeType: f.ext,
                hasAudio: f.acodec !== 'none',
                hasVideo: f.vcodec !== 'none',
                container: f.container || f.ext,
                filesize: f.filesize
            }))
            .filter(f => f.hasVideo || f.hasAudio);

        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            formats: formats,
            url: url
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch video info' });
    }
});

// Specific Video Download route
app.get('/api/download-video', requireAuth, async (req, res) => {
    const { url, quality, fileName } = req.query;
    try {
        if (!url) return res.status(400).send('URL is required');

        const safeFileName = (fileName || 'video').replace(/[^a-z0-9]/gi, '_');
        const outputPath = path.join(downloadsDir, `${safeFileName}_${Date.now()}.mp4`);

        console.log(`Downloading video: ${url} quality: ${quality}`);
        const formatArg = quality ? `${quality}+bestaudio/best` : 'best[ext=mp4]/best';

        await ytDlp.execPromise([
            url,
            '-f', formatArg,
            '--merge-output-format', 'mp4',
            '-o', outputPath
        ]);

        res.download(outputPath, `${safeFileName}.mp4`, (err) => {
            if (err) console.error('Download sending error:', err);
            fs.unlink(outputPath, (e) => {
                if (e) console.log('Cleanup error:', e);
            });
        });

    } catch (error) {
        console.error('Video download error:', error);
        if (!res.headersSent) res.status(500).send('Download failed: ' + error.message);
    }
});

// Specific Audio Download route
app.get('/api/download-audio', requireAuth, async (req, res) => {
    const { url, quality, fileName } = req.query;
    try {
        if (!url) return res.status(400).send('URL is required');

        const safeFileName = (fileName || 'audio').replace(/[^a-z0-9]/gi, '_');
        const outputPath = path.join(downloadsDir, `${safeFileName}_${Date.now()}.mp3`);

        console.log(`Downloading audio: ${url}`);

        const args = [
            url,
            '-x',
            '--audio-format', 'mp3',
            '-o', outputPath
        ];

        await ytDlp.execPromise(args);

        res.download(outputPath, `${safeFileName}.mp3`, (err) => {
            if (err) console.error('Download sending error:', err);
            fs.unlink(outputPath, (e) => {
                if (e) console.log('Cleanup error:', e);
            });
        });

    } catch (error) {
        console.error('Audio download error:', error);
        if (!res.headersSent) res.status(500).send('Download failed: ' + error.message);
    }
});

// Facebook Download Route
app.get('/api/download/facebook', requireAuth, async (req, res) => {
    const { url } = req.query;

    try {
        if (!url) {
            return res.status(400).send('Invalid Facebook URL');
        }

        const outputPath = path.join(downloadsDir, `facebook_${Date.now()}.mp4`);

        await ytDlp.execPromise([
            url,
            '-f', 'best',
            '-o', outputPath
        ]);

        const filename = 'facebook_video.mp4';
        res.download(outputPath, filename, (err) => {
            if (err) console.error('Download sending error:', err);
            fs.unlink(outputPath, (e) => {
                if (e) console.log('Cleanup error:', e);
            });
        });
    } catch (error) {
        console.error('Facebook download error:', error);
        if (!res.headersSent) {
            res.status(500).send('Download failed: ' + error.message);
        }
    }
});

// Instagram Download Route
app.get('/api/download/instagram', requireAuth, async (req, res) => {
    const { url } = req.query;

    try {
        if (!url) {
            return res.status(400).send('Invalid Instagram URL');
        }

        const outputPath = path.join(downloadsDir, `instagram_${Date.now()}.mp4`);

        await ytDlp.execPromise([
            url,
            '-f', 'best',
            '-o', outputPath
        ]);

        const filename = 'instagram_media.mp4';
        res.download(outputPath, filename, (err) => {
            if (err) console.error('Download sending error:', err);
            fs.unlink(outputPath, (e) => {
                if (e) console.log('Cleanup error:', e);
            });
        });
    } catch (error) {
        console.error('Instagram download error:', error);
        if (!res.headersSent) {
            res.status(500).send('Download failed: ' + error.message);
        }
    }
});

// Spotify Download Route
app.get('/api/download/spotify', requireAuth, async (req, res) => {
    const { url } = req.query;

    try {
        if (!url) {
            return res.status(400).send('Invalid Spotify URL');
        }

        const outputPath = path.join(downloadsDir, `spotify_${Date.now()}.mp3`);

        await ytDlp.execPromise([
            url,
            '-x',
            '--audio-format', 'mp3',
            '-o', outputPath
        ]);

        const filename = 'spotify_audio.mp3';
        res.download(outputPath, filename, (err) => {
            if (err) console.error('Download sending error:', err);
            fs.unlink(outputPath, (e) => {
                if (e) console.log('Cleanup error:', e);
            });
        });
    } catch (error) {
        console.error('Spotify download error:', error);
        if (!res.headersSent) {
            res.status(500).send('Download failed: ' + error.message);
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});