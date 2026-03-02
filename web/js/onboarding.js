/**
 * 新用户引导服务
 * 分步骤引导新用户了解系统功能
 */

class OnboardingService {
    constructor() {
        this.currentStep = 0;
        this.completed = false;
        this.steps = [
            {
                id: 'welcome',
                title: '欢迎使用 777-MS',
                content: '777-MS 是一个AI智能记忆管理系统，帮助您高效管理和复习记忆。',
                target: null,
                position: 'center'
            },
            {
                id: 'sidebar',
                title: '导航菜单',
                content: '通过左侧导航菜单，您可以访问概览、对话、复习等功能。',
                target: '.sidebar',
                position: 'right'
            },
            {
                id: 'new-memory',
                title: '创建记忆',
                content: '点击"新建记忆"按钮或使用快捷键 Ctrl+N 创建新的记忆。',
                target: '.btn-new-memory',
                position: 'bottom'
            },
            {
                id: 'chat',
                title: 'AI对话',
                content: '在对话页面，您可以与AI助手交流，它会根据您的记忆提供智能回答。',
                target: 'a[href="/chat"]',
                position: 'right'
            },
            {
                id: 'review',
                title: '记忆复习',
                content: '系统会根据遗忘曲线自动安排复习计划，帮助您巩固记忆。',
                target: 'a[href="/review"]',
                position: 'right'
            },
            {
                id: 'settings',
                title: '个性化设置',
                content: '在设置页面，您可以自定义主题、语言、通知等偏好。',
                target: 'a[href="/settings"]',
                position: 'right'
            },
            {
                id: 'complete',
                title: '开始使用',
                content: '您已了解基本功能，现在开始探索吧！如有疑问，可随时按 ? 键查看帮助。',
                target: null,
                position: 'center'
            }
        ];
    }

    async init() {
        const savedCompleted = localStorage.getItem('onboardingCompleted');
        this.completed = savedCompleted === 'true';
        
        const savedStep = localStorage.getItem('onboardingStep');
        this.currentStep = savedStep ? parseInt(savedStep) : 0;
        
        if (!this.completed) {
            this.checkFirstVisit();
        }
    }

    checkFirstVisit() {
        const lastVisit = localStorage.getItem('lastVisit');
        if (!lastVisit) {
            setTimeout(() => this.start(), 1000);
        }
        localStorage.setItem('lastVisit', new Date().toISOString());
    }

    start() {
        this.currentStep = 0;
        this.showStep(this.currentStep);
    }

    showStep(index) {
        if (index < 0 || index >= this.steps.length) {
            this.complete();
            return;
        }
        
        this.currentStep = index;
        localStorage.setItem('onboardingStep', index.toString());
        
        const step = this.steps[index];
        this.highlight(step);
    }

    highlight(step) {
        this.removeHighlight();
        
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.innerHTML = `
            <div class="onboarding-highlight" data-step="${step.id}">
                <div class="onboarding-tooltip ${step.position}">
                    <div class="onboarding-header">
                        <span class="onboarding-step">${this.currentStep + 1}/${this.steps.length}</span>
                        <h4 class="onboarding-title">${step.title}</h4>
                    </div>
                    <p class="onboarding-content">${step.content}</p>
                    <div class="onboarding-actions">
                        ${this.currentStep > 0 ? '<button class="btn-back">上一步</button>' : ''}
                        <button class="btn-skip">跳过</button>
                        <button class="btn-next">${this.currentStep === this.steps.length - 1 ? '完成' : '下一步'}</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        if (step.target) {
            const targetElement = document.querySelector(step.target);
            if (targetElement) {
                targetElement.classList.add('onboarding-target');
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        overlay.querySelector('.btn-back')?.addEventListener('click', () => this.previous());
        overlay.querySelector('.btn-skip')?.addEventListener('click', () => this.skip());
        overlay.querySelector('.btn-next')?.addEventListener('click', () => this.next());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.next();
        });
    }

    removeHighlight() {
        document.querySelectorAll('.onboarding-overlay').forEach(el => el.remove());
        document.querySelectorAll('.onboarding-target').forEach(el => {
            el.classList.remove('onboarding-target');
        });
    }

    next() {
        this.removeHighlight();
        this.showStep(this.currentStep + 1);
    }

    previous() {
        this.removeHighlight();
        this.showStep(this.currentStep - 1);
    }

    skip() {
        this.removeHighlight();
        this.complete();
    }

    complete() {
        this.completed = true;
        this.currentStep = 0;
        localStorage.setItem('onboardingCompleted', 'true');
        localStorage.removeItem('onboardingStep');
        
        document.dispatchEvent(new CustomEvent('onboardingComplete'));
    }

    reset() {
        this.completed = false;
        this.currentStep = 0;
        localStorage.removeItem('onboardingCompleted');
        localStorage.removeItem('onboardingStep');
    }

    isCompleted() {
        return this.completed;
    }

    getProgress() {
        return {
            current: this.currentStep,
            total: this.steps.length,
            completed: this.completed
        };
    }
}

const onboardingService = new OnboardingService();

document.addEventListener('DOMContentLoaded', () => {
    onboardingService.init();
});

window.onboardingService = onboardingService;
