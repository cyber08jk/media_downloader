#!/usr/bin/env node

/**
 * yt-dlp Diagnostic Test Script
 * 
 * This script helps diagnose issues with yt-dlp and video fetching
 * Usage: node test-ytdlp.js <URL>
 */

const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

const ytUrl = process.argv[2];

if (!ytUrl) {
    console.error('❌ Usage: node test-ytdlp.js <URL>');
    console.error('   Example: node test-ytdlp.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    process.exit(1);
}

console.log('🔍 yt-dlp Diagnostic Test');
console.log('==========================\n');
console.log(`Testing URL: ${ytUrl}\n`);

(async () => {
    try {
        // Initialize yt-dlp
        console.log('📦 Initializing yt-dlp...');
        const binaryPath = path.join(__dirname, 'yt-dlp.exe');
        let ytDlp;
        
        if (fs.existsSync(binaryPath)) {
            console.log(`✅ Found local binary at: ${binaryPath}`);
            ytDlp = new YTDlpWrap(binaryPath);
        } else {
            console.log('⚠️  No local binary found, using PATH...');
            ytDlp = new YTDlpWrap();
        }

        // Check yt-dlp version
        console.log('\n🔍 Checking yt-dlp version...');
        try {
            const version = await ytDlp.getVersion();
            console.log(`✅ yt-dlp version: ${version}`);
        } catch (e) {
            console.error('❌ Failed to get yt-dlp version:', e.message);
        }

        // Try to fetch video info
        console.log('\n🔍 Fetching video info...');
        try {
            console.log('Running: yt-dlp --dump-json --no-playlist --no-warnings --skip-download ...');
            const jsonOutput = await ytDlp.execPromise([
                ytUrl,
                '--dump-json',
                '--no-playlist',
                '--no-warnings',
                '--skip-download',
                '--socket-timeout', '30',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                '--referer', 'https://www.youtube.com'
            ]);

            const info = JSON.parse(jsonOutput);
            console.log('\n✅ SUCCESS! Video info fetched:');
            console.log(`   Title: ${info.title}`);
            console.log(`   Duration: ${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}`);
            console.log(`   Uploader: ${info.uploader || 'Unknown'}`);
            console.log(`   Available formats: ${info.formats.length}`);
            
            // Show available quality options
            console.log('\n📊 Available Qualities:');
            const uniqueFormats = {};
            info.formats.forEach(f => {
                if (f.height) {
                    const key = `${f.height}p`;
                    if (!uniqueFormats[key]) {
                        uniqueFormats[key] = f.format_id;
                    }
                }
            });
            Object.keys(uniqueFormats).sort().forEach(q => {
                console.log(`   • ${q}`);
            });

        } catch (error) {
            console.error('\n❌ FAILED to fetch video info');
            console.error('Error message:', error.message);
            console.error('\nTroubleshooting suggestions:');
            
            if (error.message.includes('Video unavailable')) {
                console.error('   • Video is unavailable or has been deleted');
                console.error('   • Try with a different URL');
            } else if (error.message.includes('Sign in') || error.message.includes('age')) {
                console.error('   • Video is age-restricted or requires sign-in');
                console.error('   • Try adding authentication or cookies');
            } else if (error.message.includes('not available in your country')) {
                console.error('   • Video is geo-blocked to your region');
                console.error('   • Try using a VPN or proxy');
            } else if (error.message.includes('Invalid URL')) {
                console.error('   • Invalid YouTube URL format');
                console.error('   • Example valid URLs:');
                console.error('     - https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                console.error('     - https://youtu.be/dQw4w9WgXcQ');
            } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
                console.error('   • Network connection error');
                console.error('   • Check your internet connection');
                console.error('   • Try again later or use a different network');
            } else if (error.message.includes('No such file')) {
                console.error('   • yt-dlp binary not found');
                console.error('   • Try: npm install');
                console.error('   • Or manually download from: https://github.com/yt-dlp/yt-dlp/releases');
            } else {
                console.error('   • Check your internet connection');
                console.error('   • Update yt-dlp: pip install --upgrade yt-dlp');
                console.error('   • Check if the URL is correct and the video is public');
            }
            
            console.error('\nFull error details:');
            console.error(error);
        }

        // Test if we can list available formats
        console.log('\n\n📋 Testing format listing (this may take longer)...');
        try {
            console.log('Running: yt-dlp --list-formats --no-warnings ...');
            const formatOutput = await ytDlp.execPromise([
                ytUrl,
                '--list-formats',
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ]);
            console.log('\n✅ Formats retrieved successfully!');
            console.log('First 20 lines of format output:');
            console.log(formatOutput.split('\n').slice(0, 20).join('\n'));
        } catch (error) {
            console.log('ℹ️  Format listing failed (non-critical):', error.message.split('\n')[0]);
        }

        console.log('\n\n✅ Diagnostic complete!');
        
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();
