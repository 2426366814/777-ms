/**
 * 快捷键服务
 * 支持全局快捷键和自定义快捷键
 */

class HotkeysService {
    constructor() {
        this.enabled = true;
        this.hotkeys = new Map();
        this.defaultHotkeys = {
            'ctrl+n': { action: 'newMemory', description: '新建记忆' },
            'ctrl+s': { action: 'save', description: '保存' },
            'ctrl+f': { action: 'search', description: '搜索' },
            'ctrl+/': { action: 'toggleSidebar', description: '切换侧边栏' },
            'ctrl+enter': { action: 'sendMessage', description: '发送消息' },
            'escape': { action: 'closeModal', description: '关闭弹窗' },
            'ctrl+1': { action: 'goDashboard', description: '跳转概览' },
            'ctrl+2': { action: 'goChat', description: '跳转对话' },
            'ctrl+3': { action: 'goReview', description: '跳转复习' },
            'ctrl+4': { action: 'goSettings', description: '跳转设置' },
            'ctrl+shift+e': { action: 'export', description: '导出' },
            'ctrl+shift+i': { action: 'import', description: '导入' },
            '?': { action: 'showHelp', description: '显示帮助' }
        };
        this.customHotkeys = {};
    }

    init() {
        const savedEnabled = localStorage.getItem('hotkeysEnabled');
        this.enabled = savedEnabled !== 'false';
        
        const savedCustom = localStorage.getItem('customHotkeys');
        if (savedCustom) {
            try {
                this.customHotkeys = JSON.parse(savedCustom);
            } catch (e) {
                this.customHotkeys = {};
            }
        }
        
        this.registerDefaultHotkeys();
        this.bindEvents();
    }

    registerDefaultHotkeys() {
        Object.entries(this.defaultHotkeys).forEach(([key, config]) => {
            this.hotkeys.set(key.toLowerCase(), config);
        });
        
        Object.entries(this.customHotkeys).forEach(([key, config]) => {
            this.hotkeys.set(key.toLowerCase(), config);
        });
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            if (this.isInputFocused()) return;
            
            const key = this.getKeyCombo(e);
            const config = this.hotkeys.get(key);
            
            if (config) {
                e.preventDefault();
                this.executeAction(config.action, e);
            }
        });
    }

    getKeyCombo(e) {
        const parts = [];
        
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        
        let key = e.key.toLowerCase();
        if (key === ' ') key = 'space';
        if (key === 'escape') key = 'escape';
        if (key === 'enter') key = 'enter';
        if (key === '/') key = '/';
        
        if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
            parts.push(key);
        }
        
        return parts.join('+');
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        const inputTypes = ['input', 'textarea', 'select'];
        return inputTypes.includes(activeElement.tagName.toLowerCase()) ||
               activeElement.isContentEditable;
    }

    executeAction(action, event) {
        document.dispatchEvent(new CustomEvent('hotkey', { 
            detail: { action, event } 
        }));
        
        switch (action) {
            case 'newMemory':
                this.emit('newMemory');
                break;
            case 'save':
                this.emit('save');
                break;
            case 'search':
                this.emit('search');
                break;
            case 'toggleSidebar':
                this.emit('toggleSidebar');
                break;
            case 'sendMessage':
                this.emit('sendMessage');
                break;
            case 'closeModal':
                this.emit('closeModal');
                break;
            case 'goDashboard':
                window.location.href = '/dashboard';
                break;
            case 'goChat':
                window.location.href = '/chat';
                break;
            case 'goReview':
                window.location.href = '/review';
                break;
            case 'goSettings':
                window.location.href = '/settings';
                break;
            case 'export':
                this.emit('export');
                break;
            case 'import':
                this.emit('import');
                break;
            case 'showHelp':
                this.showHelp();
                break;
        }
    }

    emit(event, data = null) {
        document.dispatchEvent(new CustomEvent(`hotkey:${event}`, { detail: data }));
    }

    on(event, callback) {
        document.addEventListener(`hotkey:${event}`, (e) => callback(e.detail));
    }

    off(event, callback) {
        document.removeEventListener(`hotkey:${event}`, callback);
    }

    showHelp() {
        const modal = document.createElement('div');
        modal.className = 'hotkeys-help-modal';
        modal.innerHTML = `
            <div class="hotkeys-help-content">
                <h3>快捷键帮助</h3>
                <table class="hotkeys-table">
                    ${Array.from(this.hotkeys.entries()).map(([key, config]) => `
                        <tr>
                            <td class="hotkey-key"><kbd>${this.formatKey(key)}</kbd></td>
                            <td class="hotkey-desc">${config.description}</td>
                        </tr>
                    `).join('')}
                </table>
                <p class="hotkeys-note">按 ESC 关闭</p>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeHandler = (e) => {
            if (e.key === 'Escape' || e.target === modal) {
                modal.remove();
                document.removeEventListener('keydown', closeHandler);
            }
        };
        
        document.addEventListener('keydown', closeHandler);
        modal.addEventListener('click', closeHandler);
    }

    formatKey(key) {
        return key
            .replace('ctrl', '⌃ Ctrl')
            .replace('shift', '⇧ Shift')
            .replace('alt', '⌥ Alt')
            .replace('+', ' + ')
            .replace('enter', '↵ Enter')
            .replace('escape', '⎋ Esc')
            .replace('space', '␣ Space');
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        localStorage.setItem('hotkeysEnabled', enabled);
    }

    isEnabled() {
        return this.enabled;
    }

    register(key, action, description) {
        this.hotkeys.set(key.toLowerCase(), { action, description });
    }

    unregister(key) {
        this.hotkeys.delete(key.toLowerCase());
    }

    getHotkeys() {
        return Array.from(this.hotkeys.entries()).map(([key, config]) => ({
            key,
            ...config
        }));
    }
}

const hotkeysService = new HotkeysService();

document.addEventListener('DOMContentLoaded', () => {
    hotkeysService.init();
});

window.hotkeysService = hotkeysService;
