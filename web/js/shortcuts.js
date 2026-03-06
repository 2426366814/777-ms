
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
        return key.toLowerCase().replace(/\s+/g, '');
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
