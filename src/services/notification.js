/**
 * 通知服务
 * 通过WebSocket发送实时通知
 */

let io = null;
let userSockets = null;

const init = (socketIo, sockets) => {
    io = socketIo;
    userSockets = sockets;
};

class NotificationService {
    static sendToUser(userId, event, data) {
        if (io) {
            io.to(`user:${userId}`).emit(event, data);
        }
    }
    
    static sendReviewReminder(userId, memories) {
        this.sendToUser(userId, 'review:reminder', {
            type: 'review',
            title: '复习提醒',
            message: `您有 ${memories.length} 条记忆需要复习`,
            data: memories,
            timestamp: new Date().toISOString()
        });
    }
    
    static sendSystemNotification(userId, notification) {
        this.sendToUser(userId, 'system:notification', {
            type: 'system',
            ...notification,
            timestamp: new Date().toISOString()
        });
    }
    
    static sendMemoryUpdate(userId, action, memory) {
        this.sendToUser(userId, 'memory:update', {
            type: 'memory',
            action,
            memory,
            timestamp: new Date().toISOString()
        });
    }
    
    static broadcast(event, data) {
        if (io) {
            io.emit(event, data);
        }
    }
    
    static isUserOnline(userId) {
        return userSockets && userSockets.has(userId);
    }
}

module.exports = { NotificationService, init };
