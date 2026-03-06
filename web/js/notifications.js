
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
