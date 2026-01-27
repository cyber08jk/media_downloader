import { Utils } from '../scripts/utils.js';

class MainService {
    constructor() {
        this.downloadForm = document.getElementById('downloadForm');
        this.urlInput = document.getElementById('mediaUrl');
        this.downloadError = document.getElementById('downloadError');
        this.downloadOptions = document.getElementById('downloadOptions');
        this.preview = document.getElementById('preview');
        this.loading = document.getElementById('loading');
        this.fileName = document.getElementById('fileName');
        this.logoutBtn = document.getElementById('logoutBtn');
        
        this.init();
    }

    init() {
        // Check authentication
        Utils.redirectIfNotLoggedIn();

        // Initialize event listeners
        if (this.downloadForm) {
            this.downloadForm.addEventListener('submit', (e) => this.handleDownload(e));
        }

        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => window.authManager.logout());
        }
    }

    async handleDownload(e) {
        e.preventDefault();
        const url = this.urlInput.value.trim();

        if (!url) {
            Utils.showError(this.downloadError, 'Please enter a valid URL');
            return;
        }

        const mediaType = Utils.getMediaType(url);
        if (mediaType === 'unknown') {
            Utils.showError(this.downloadError, 'Unsupported media type');
            return;
        }

        try {
            this.setLoadingState(true);
            Utils.hideError(this.downloadError);

            const response = await fetch(`/api/download/${mediaType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (data.success) {
                // Show preview if available
                if (data.previewUrl) {
                    this.showPreview(data.previewUrl);
                }
                
                // Show download options
                this.showDownloadOptions(data);
                
                // Set filename if provided
                if (data.fileName) {
                    this.fileName.textContent = data.fileName;
                    this.fileName.style.display = 'block';
                }

                // Trigger download
                window.location.href = data.downloadUrl;
            } else {
                Utils.showError(this.downloadError, data.message || 'Download failed');
            }
        } catch (error) {
            console.error('Download error:', error);
            Utils.showError(this.downloadError, 'An error occurred during download');
        } finally {
            this.setLoadingState(false);
        }
    }

    setLoadingState(isLoading) {
        const submitBtn = this.downloadForm.querySelector('button[type="submit"]');
        submitBtn.disabled = isLoading;
        submitBtn.textContent = isLoading ? 'Processing...' : 'Download';
        this.loading.style.display = isLoading ? 'block' : 'none';
    }

    showPreview(previewUrl) {
        this.preview.style.display = 'block';
        // Implement preview display logic based on media type
        // For example, setting video/image source
    }

    showDownloadOptions(data) {
        if (data.formats && data.formats.length > 0) {
            this.downloadOptions.innerHTML = data.formats.map(format => `
                <button class="btn btn-download" data-url="${format.url}">
                    Download ${format.quality} ${format.extension}
                </button>
            `).join('');
            this.downloadOptions.style.display = 'block';

            // Add click handlers for format selection
            this.downloadOptions.querySelectorAll('.btn-download').forEach(btn => {
                btn.addEventListener('click', () => {
                    window.location.href = btn.dataset.url;
                });
            });
        }
    }
}

// Initialize the service when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MainService();
}); 