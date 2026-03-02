#!/usr/bin/env python3
"""
创建前端JS文件
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

COMMON_JS = '''
const API_BASE = '/api/v1';
let token = localStorage.getItem('token');

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
'''

THEME_JS = '''
const ThemeManager = {
    STORAGE_KEY: '777-ms-theme',
    
    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'dark');
        this.setTheme(theme);
        this.watchSystemTheme();
    },
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.updateMetaTheme(theme);
    },
    
    getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    },
    
    toggle() {
        const current = this.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        return next;
    },
    
    updateMetaTheme(theme) {
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.name = 'theme-color';
            document.head.appendChild(metaTheme);
        }
        metaTheme.content = theme === 'dark' ? '#0a0a0f' : '#ffffff';
    },
    
    watchSystemTheme() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.STORAGE_KEY)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
window.ThemeManager = ThemeManager;
'''

SHORTCUTS_JS = '''
const ShortcutsManager = {
    shortcuts: new Map(),
    enabled: true,
    
    init() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.registerDefault();
    },
    
    register(key, callback, options = {}) {
        const normalizedKey = this.normalizeKey(key);
        this.shortcuts.set(normalizedKey, { callback, ...options });
    },
    
    unregister(key) {
        this.shortcuts.delete(this.normalizeKey(key));
    },
    
    normalizeKey(key) {
        return key.toLowerCase().replace(/\\s+/g, '');
    },
    
    handleKeydown(e) {
        if (!this.enabled) return;
        if (this.isInputFocused() && !e.ctrlKey && !e.metaKey) return;
        
        const combo = this.getCombo(e);
        const shortcut = this.shortcuts.get(combo);
        
        if (shortcut) {
            e.preventDefault();
            shortcut.callback(e);
        }
    },
    
    getCombo(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    },
    
    isInputFocused() {
        const active = document.activeElement;
        return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    },
    
    registerDefault() {
        this.register('ctrl+k', () => this.openSearch());
        this.register('ctrl+n', () => this.openNewMemory());
        this.register('ctrl+/', () => this.showHelp());
        this.register('escape', () => this.closeModal());
        this.register('?', () => this.showShortcuts());
    },
    
    openSearch() {
        const searchModal = document.getElementById('searchModal');
        if (searchModal) {
            searchModal.classList.add('active');
            const input = searchModal.querySelector('input');
            if (input) input.focus();
        } else {
            showToast('搜索功能即将上线', 'info');
        }
    },
    
    openNewMemory() {
        if (typeof openNewMemoryModal === 'function') {
            openNewMemoryModal();
        } else {
            window.location.href = '/dashboard?action=new';
        }
    },
    
    showHelp() {
        showToast('按 ? 查看所有快捷键', 'info');
    },
    
    closeModal() {
        const modals = document.querySelectorAll('.modal.active, .modal.show');
        modals.forEach(modal => modal.classList.remove('active', 'show'));
    },
    
    showShortcuts() {
        if (this.isInputFocused()) return;
        
        const shortcuts = [
            { key: 'Ctrl + K', desc: '快速搜索' },
            { key: 'Ctrl + N', desc: '新建记忆' },
            { key: 'Ctrl + /', desc: '帮助' },
            { key: 'Esc', desc: '关闭弹窗' },
            { key: '?', desc: '显示快捷键' }
        ];
        
        let html = '<div class="shortcuts-help" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a24;padding:24px;border-radius:12px;z-index:10000;min-width:300px;">';
        html += '<h3 style="margin:0 0 16px 0;color:#fff;">快捷键</h3>';
        shortcuts.forEach(s => {
            html += '<div style="display:flex;justify-content:space-between;margin:8px 0;color:#ccc;">';
            html += '<kbd style="background:#333;padding:4px 8px;border-radius:4px;font-family:monospace;">' + s.key + '</kbd>';
            html += '<span>' + s.desc + '</span></div>';
        });
        html += '<p style="margin:16px 0 0;color:#666;font-size:12px;">按 Esc 关闭</p></div>';
        
        const overlay = document.createElement('div');
        overlay.id = 'shortcuts-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;';
        overlay.innerHTML = html;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }
};

document.addEventListener('DOMContentLoaded', () => ShortcutsManager.init());
window.ShortcutsManager = ShortcutsManager;
'''

I18N_JS = '''
const I18n = {
    currentLang: 'zh-CN',
    
    translations: {
        'zh-CN': {
            'nav.dashboard': '概览',
            'nav.chat': '对话',
            'nav.knowledge': '知识库',
            'nav.review': '复习',
            'nav.visualization': '可视化',
            'nav.security': '安全',
            'nav.providers': '提供商',
            'btn.save': '保存',
            'btn.cancel': '取消',
            'btn.delete': '删除',
            'btn.edit': '编辑',
            'btn.search': '搜索',
            'btn.new': '新建',
            'placeholder.search': '搜索记忆...',
            'placeholder.content': '输入内容...',
            'msg.saved': '保存成功',
            'msg.deleted': '删除成功',
            'msg.error': '操作失败',
            'label.title': '标题',
            'label.content': '内容',
            'label.tags': '标签',
            'label.importance': '重要性',
            'label.created': '创建时间',
            'label.updated': '更新时间'
        },
        'en-US': {
            'nav.dashboard': 'Dashboard',
            'nav.chat': 'Chat',
            'nav.knowledge': 'Knowledge',
            'nav.review': 'Review',
            'nav.visualization': 'Visualization',
            'nav.security': 'Security',
            'nav.providers': 'Providers',
            'btn.save': 'Save',
            'btn.cancel': 'Cancel',
            'btn.delete': 'Delete',
            'btn.edit': 'Edit',
            'btn.search': 'Search',
            'btn.new': 'New',
            'placeholder.search': 'Search memories...',
            'placeholder.content': 'Enter content...',
            'msg.saved': 'Saved successfully',
            'msg.deleted': 'Deleted successfully',
            'msg.error': 'Operation failed',
            'label.title': 'Title',
            'label.content': 'Content',
            'label.tags': 'Tags',
            'label.importance': 'Importance',
            'label.created': 'Created',
            'label.updated': 'Updated'
        }
    },
    
    init() {
        const saved = localStorage.getItem('777-ms-lang');
        this.currentLang = saved || 'zh-CN';
    },
    
    t(key) {
        return this.translations[this.currentLang]?.[key] || key;
    },
    
    setLang(lang) {
        if (this.translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('777-ms-lang', lang);
            document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
        }
    },
    
    getLang() {
        return this.currentLang;
    }
};

document.addEventListener('DOMContentLoaded', () => I18n.init());
window.I18n = I18n;
window.t = (key) => I18n.t(key);
'''

NOTIFICATIONS_JS = '''
const NotificationManager = {
    permission: Notification.permission,
    
    async init() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                this.permission = await Notification.requestPermission();
            }
        }
    },
    
    async requestPermission() {
        if ('Notification' in window) {
            this.permission = await Notification.requestPermission();
            return this.permission === 'granted';
        }
        return false;
    },
    
    send(title, options = {}) {
        if (this.permission !== 'granted') {
            console.log('Notification permission not granted');
            return null;
        }
        
        const notification = new Notification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            ...options
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
            if (options.onClick) options.onClick();
        };
        
        return notification;
    },
    
    sendReviewReminder(count) {
        return this.send('复习提醒', {
            body: `您有 ${count} 条记忆需要复习`,
            tag: 'review-reminder'
        });
    },
    
    sendMemoryExtracted(title) {
        return this.send('记忆提取完成', {
            body: `已自动提取: ${title}`,
            tag: 'memory-extracted'
        });
    }
};

document.addEventListener('DOMContentLoaded', () => NotificationManager.init());
window.NotificationManager = NotificationManager;
'''

ONBOARDING_JS = '''
const OnboardingManager = {
    STORAGE_KEY: '777-ms-onboarding',
    currentStep: 0,
    
    steps: [
        { target: '#nav-dashboard', content: '这是您的控制台，可以查看所有记忆统计', position: 'right' },
        { target: '#nav-chat', content: '在这里与AI对话，系统会自动提取重要信息', position: 'right' },
        { target: '#nav-review', content: '复习系统会帮您巩固记忆', position: 'right' },
        { target: '#nav-visualization', content: '数据可视化帮您了解记忆分布', position: 'right' }
    ],
    
    init() {
        if (this.isCompleted()) return;
        
        setTimeout(() => {
            if (this.shouldShow()) {
                this.start();
            }
        }, 1000);
    },
    
    isCompleted() {
        return localStorage.getItem(this.STORAGE_KEY) === 'completed';
    },
    
    shouldShow() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.isNew || !localStorage.getItem(this.STORAGE_KEY);
    },
    
    start() {
        this.currentStep = 0;
        this.showStep();
    },
    
    showStep() {
        this.removeHighlight();
        
        if (this.currentStep >= this.steps.length) {
            this.complete();
            return;
        }
        
        const step = this.steps[this.currentStep];
        const target = document.querySelector(step.target);
        
        if (!target) {
            this.currentStep++;
            this.showStep();
            return;
        }
        
        this.highlight(target);
        this.showTooltip(target, step);
    },
    
    highlight(element) {
        element.style.outline = '2px solid #3b82f6';
        element.style.outlineOffset = '4px';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    
    removeHighlight() {
        document.querySelectorAll('[style*="outline"]').forEach(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
        });
        document.querySelectorAll('.onboarding-tooltip').forEach(el => el.remove());
    },
    
    showTooltip(target, step) {
        const rect = target.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: #1a1a24;
            color: #fff;
            padding: 16px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        tooltip.innerHTML = `
            <p style="margin:0 0 12px;">${step.content}</p>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button onclick="OnboardingManager.skip()" style="background:transparent;border:none;color:#888;cursor:pointer;">跳过</button>
                <button onclick="OnboardingManager.next()" style="background:#3b82f6;border:none;color:#fff;padding:6px 16px;border-radius:4px;cursor:pointer;">下一步</button>
            </div>
            <span style="position:absolute;top:-8px;left:20px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:8px solid #1a1a24;"></span>
        `;
        
        tooltip.style.top = (rect.bottom + 16) + 'px';
        tooltip.style.left = rect.left + 'px';
        
        document.body.appendChild(tooltip);
    },
    
    next() {
        this.currentStep++;
        this.showStep();
    },
    
    skip() {
        this.complete();
    },
    
    complete() {
        this.removeHighlight();
        localStorage.setItem(this.STORAGE_KEY, 'completed');
        showToast('引导完成，开始使用吧！', 'success');
    }
};

document.addEventListener('DOMContentLoaded', () => OnboardingManager.init());
window.OnboardingManager = OnboardingManager;
'''

def create_files():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(
            hostname=CONFIG['host'],
            port=CONFIG['port'],
            username=CONFIG['username'],
            password=CONFIG['password'],
            timeout=30
        )
        
        sftp = client.open_sftp()
        
        files = {
            'common.js': COMMON_JS,
            'theme.js': THEME_JS,
            'shortcuts.js': SHORTCUTS_JS,
            'i18n.js': I18N_JS,
            'notifications.js': NOTIFICATIONS_JS,
            'onboarding.js': ONBOARDING_JS
        }
        
        for filename, content in files.items():
            path = f"{CONFIG['remote_dir']}/web/js/{filename}"
            with sftp.file(path, 'w') as f:
                f.write(content)
            print(f"Created: {path}")
        
        sftp.close()
        print("All JS files created successfully!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_files()
