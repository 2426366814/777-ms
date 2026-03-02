/**
 * 国际化服务
 * 支持中文、英文、日文
 */

class I18nService {
    constructor() {
        this.currentLanguage = 'zh-CN';
        this.translations = {};
        this.supportedLanguages = ['zh-CN', 'en-US', 'ja-JP'];
        this.languageNames = {
            'zh-CN': '简体中文',
            'en-US': 'English',
            'ja-JP': '日本語'
        };
    }

    async init() {
        const savedLang = localStorage.getItem('language');
        if (savedLang && this.supportedLanguages.includes(savedLang)) {
            this.currentLanguage = savedLang;
        } else {
            const browserLang = navigator.language || navigator.userLanguage;
            if (browserLang.startsWith('zh')) {
                this.currentLanguage = 'zh-CN';
            } else if (browserLang.startsWith('ja')) {
                this.currentLanguage = 'ja-JP';
            } else {
                this.currentLanguage = 'en-US';
            }
        }
        
        await this.loadLanguage(this.currentLanguage);
        this.applyTranslations();
    }

    async loadLanguage(lang) {
        try {
            const response = await fetch(`/js/i18n/${lang}.json`);
            if (response.ok) {
                this.translations = await response.json();
                this.currentLanguage = lang;
                localStorage.setItem('language', lang);
                return true;
            }
        } catch (error) {
            console.error('Failed to load language:', error);
        }
        return false;
    }

    async setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            return false;
        }
        
        const success = await this.loadLanguage(lang);
        if (success) {
            this.applyTranslations();
            document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
        }
        return success;
    }

    getLanguage() {
        return this.currentLanguage;
    }

    getSupportedLanguages() {
        return this.supportedLanguages.map(lang => ({
            code: lang,
            name: this.languageNames[lang]
        }));
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key;
            }
        }
        
        if (typeof value !== 'string') {
            return key;
        }
        
        return this.interpolate(value, params);
    }

    interpolate(str, params) {
        return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params.hasOwnProperty(key) ? params[key] : match;
        });
    }

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation !== key) {
                element.textContent = translation;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation !== key) {
                element.placeholder = translation;
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation !== key) {
                element.title = translation;
            }
        });
    }
}

const i18n = new I18nService();

document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
});

window.i18n = i18n;
