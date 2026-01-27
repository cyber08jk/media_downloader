window.authManager = {
    async login(email, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.saveUser(data.user);
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error occurred' };
        }
    },

    async register(name, email, password) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.saveUser(data.user);
            }

            return data;
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Network error occurred' };
        }
    },

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.clearUser();
            window.location.href = '/login.html'; // Redirect to login page
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    saveUser(user) {
        // Store in localStorage
        localStorage.setItem('user', JSON.stringify(user));

        // Store in cookie as requested
        // Using encodeURIComponent to ensure safe cookie value
        document.cookie = `user_info=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=86400`;
    },

    clearUser() {
        localStorage.removeItem('user');
        document.cookie = 'user_info=; path=/; max-age=0';
    },

    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    isAuthenticated() {
        return !!this.getUser();
    }
};
