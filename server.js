const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = 3000;

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
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Authentication required' });
    }
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

//app.get('/insta', requireAuth, (req, res) => {
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

// Media download routes
app.post('/api/download/youtube', requireAuth, async (req, res) => {
    const { url } = req.body;
    // Implement YouTube download logic here
    res.json({ success: true, downloadUrl: '/downloads/youtube-video.mp4' });
});

app.post('/api/download/facebook', requireAuth, async (req, res) => {
    const { url } = req.body;
    // Implement Facebook download logic here
    res.json({ success: true, downloadUrl: '/downloads/facebook-video.mp4' });
});

app.post('/api/download/instagram', requireAuth, async (req, res) => {
    const { url } = req.body;
    // Implement Instagram download logic here
    res.json({ success: true, downloadUrl: '/downloads/instagram-video.mp4' });
});

app.post('/api/download/spotify', requireAuth, async (req, res) => {
    const { url } = req.body;
    // Implement Spotify download logic here
    res.json({ success: true, downloadUrl: '/downloads/spotify-audio.mp3' });
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