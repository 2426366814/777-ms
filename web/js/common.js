
var API_BASE = '/api/v1';
var token = localStorage.getItem('token');

function api(endpoint, options = {}) {
    return fetch(API_BASE + endpoint, {
        ...options,
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            ...options.headers
        }
    }).then(r => r.json()).catch(err => ({ success: false, error: err.message }));
}

function formatDate(date) {
    return new Date(date).toLocaleString('zh-CN');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
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
    if (!token) {
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
