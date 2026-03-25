const API_BASE = '/api/v1';

const getToken = () => localStorage.getItem('token');

function api(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    return fetch(API_BASE + endpoint, {
        ...options,
        signal: controller.signal,
        headers: {
            'Authorization': 'Bearer ' + getToken(),
            'Content-Type': 'application/json',
            ...options.headers
        }
    }).then(r => {
        clearTimeout(timeoutId);
        if (r.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.resolve({ success: false, error: 'Token expired' });
        }
        return r.json().catch(() => ({ success: false, error: 'Response parse error' }));
    }).catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            return { success: false, error: 'Request timeout' };
        }
        console.error('API Error:', err);
        return { success: false, error: 'Network error' };
    });
}

function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN');
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 24px;border-radius:8px;z-index:9999;animation:slideIn 0.3s ease;';
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.style.color = '#fff';
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function checkAuth() {
    if (!getToken()) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(style);
});

window.api = api;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;
window.showToast = showToast;
window.debounce = debounce;
window.throttle = throttle;
window.checkAuth = checkAuth;
window.logout = logout;
