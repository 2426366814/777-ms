/**
 * 通知服务
 * 支持浏览器通知和站内通知
 */

class NotificationService {
    constructor() {
        this.enabled = true;
        this.soundEnabled = true;
        this.desktopEnabled = false;
        this.notifications = [];
        this.maxNotifications = 50;
        this.soundFile = '/sounds/notification.mp3';
    }

    async init() {
        const savedEnabled = localStorage.getItem('notificationsEnabled');
        this.enabled = savedEnabled !== 'false';
        
        const savedSound = localStorage.getItem('soundEnabled');
        this.soundEnabled = savedSound !== 'false';
        
        const savedDesktop = localStorage.getItem('desktopNotifications');
        this.desktopEnabled = savedDesktop === 'true';
        
        await this.requestPermission();
        this.loadNotifications();
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    }

    async show(title, options = {}) {
        if (!this.enabled) return null;
        
        const notification = {
            id: Date.now().toString(),
            title,
            message: options.body || '',
            type: options.type || 'info',
            icon: options.icon || '/icons/icon-192.png',
            url: options.url || null,
            read: false,
            createdAt: new Date().toISOString()
        };
        
        this.notifications.unshift(notification);
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }
        this.saveNotifications();
        
        this.showInApp(notification);
        
        if (this.desktopEnabled && Notification.permission === 'granted') {
            this.showDesktop(title, options);
        }
        
        if (this.soundEnabled) {
            this.playSound();
        }
        
        document.dispatchEvent(new CustomEvent('notification', { 
            detail: notification 
        }));
        
        return notification;
    }

    showInApp(notification) {
        const container = this.getContainer();
        
        const element = document.createElement('div');
        element.className = `notification-toast notification-${notification.type}`;
        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                ${notification.message ? `<div class="notification-message">${notification.message}</div>` : ''}
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        element.querySelector('.notification-close').addEventListener('click', () => {
            element.remove();
        });
        
        if (notification.url) {
            element.style.cursor = 'pointer';
            element.addEventListener('click', (e) => {
                if (!e.target.classList.contains('notification-close')) {
                    window.location.href = notification.url;
                }
            });
        }
        
        container.appendChild(element);
        
        setTimeout(() => {
            element.classList.add('fade-out');
            setTimeout(() => element.remove(), 300);
        }, 5000);
    }

    showDesktop(title, options) {
        const notification = new Notification(title, {
            body: options.body || '',
            icon: options.icon || '/icons/icon-192.png',
            tag: options.tag || Date.now().toString(),
            data: { url: options.url }
        });
        
        notification.onclick = () => {
            if (options.url) {
                window.location.href = options.url;
            }
            notification.close();
        };
        
        return notification;
    }

    playSound() {
        try {
            const audio = new Audio(this.soundFile);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {
            // Ignore audio errors
        }
    }

    getContainer() {
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
            }
        } catch (e) {
            this.notifications = [];
        }
    }

    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }

    getAll() {
        return this.notifications;
    }

    getUnread() {
        return this.notifications.filter(n => !n.read);
    }

    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.saveNotifications();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
    }

    delete(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.saveNotifications();
    }

    clearAll() {
        this.notifications = [];
        this.saveNotifications();
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        localStorage.setItem('notificationsEnabled', enabled);
    }

    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        localStorage.setItem('soundEnabled', enabled);
    }

    setDesktopEnabled(enabled) {
        this.desktopEnabled = enabled;
        localStorage.setItem('desktopNotifications', enabled);
        if (enabled) {
            this.requestPermission();
        }
    }

    // Convenience methods
    success(title, message = '') {
        return this.show(title, { body: message, type: 'success' });
    }

    error(title, message = '') {
        return this.show(title, { body: message, type: 'error' });
    }

    warning(title, message = '') {
        return this.show(title, { body: message, type: 'warning' });
    }

    info(title, message = '') {
        return this.show(title, { body: message, type: 'info' });
    }
}

const notificationService = new NotificationService();

document.addEventListener('DOMContentLoaded', () => {
    notificationService.init();
});

window.notificationService = notificationService;
