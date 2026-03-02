/**
 * 主题服务
 * 支持浅色/深色主题切换
 */

class ThemeService {
    constructor() {
        this.currentTheme = 'dark';
        this.themes = ['light', 'dark', 'auto'];
        this.themeNames = {
            'light': '浅色',
            'dark': '深色',
            'auto': '跟随系统'
        };
    }

    init() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme && this.themes.includes(savedTheme)) {
            this.currentTheme = savedTheme;
        } else {
            this.currentTheme = 'dark';
        }
        
        this.applyTheme(this.currentTheme);
        this.watchSystemTheme();
    }

    applyTheme(theme) {
        let effectiveTheme = theme;
        
        if (theme === 'auto') {
            effectiveTheme = this.getSystemTheme();
        }
        
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${effectiveTheme}`);
        
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = effectiveTheme === 'dark' ? '#0a0a0f' : '#ffffff';
        }
        
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        
        document.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme, effectiveTheme } 
        }));
    }

    setTheme(theme) {
        if (!this.themes.includes(theme)) {
            return false;
        }
        this.applyTheme(theme);
        return true;
    }

    getTheme() {
        return this.currentTheme;
    }

    getEffectiveTheme() {
        if (this.currentTheme === 'auto') {
            return this.getSystemTheme();
        }
        return this.currentTheme;
    }

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.applyTheme('auto');
            }
        });
    }

    getThemes() {
        return this.themes.map(theme => ({
            code: theme,
            name: this.themeNames[theme]
        }));
    }

    toggle() {
        const currentEffective = this.getEffectiveTheme();
        const newTheme = currentEffective === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
}

const themeService = new ThemeService();

document.addEventListener('DOMContentLoaded', () => {
    themeService.init();
});

window.themeService = themeService;
