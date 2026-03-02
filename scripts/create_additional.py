#!/usr/bin/env python3
"""
创建图片懒加载和WebSocket支持
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

LAZY_LOAD_JS = '''
const LazyLoader = {
    init() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        if (el.dataset.src) {
                            el.src = el.dataset.src;
                            el.removeAttribute('data-src');
                            el.classList.remove('lazy');
                            el.classList.add('lazy-loaded');
                        }
                        if (el.dataset.bg) {
                            el.style.backgroundImage = 'url(' + el.dataset.bg + ')';
                            el.removeAttribute('data-bg');
                        }
                        observer.unobserve(el);
                    }
                });
            }, { rootMargin: '50px' });
            
            document.querySelectorAll('.lazy, [data-src], [data-bg]').forEach(el => {
                observer.observe(el);
            });
        } else {
            document.querySelectorAll('[data-src]').forEach(el => {
                el.src = el.dataset.src;
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => LazyLoader.init());
window.LazyLoader = LazyLoader;
'''

WEBSOCKET_ROUTE = '''
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

let wsClients = new Map();

router.initWebSocket = function(server) {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server, path: '/ws' });
    
    wss.on('connection', (ws, req) => {
        const userId = req.headers['x-user-id'] || 'anonymous';
        ws.userId = userId;
        
        if (!wsClients.has(userId)) {
            wsClients.set(userId, new Set());
        }
        wsClients.get(userId).add(ws);
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                handleMessage(ws, data);
            } catch (e) {
                logger.error('WS message error:', e);
            }
        });
        
        ws.on('close', () => {
            if (wsClients.has(userId)) {
                wsClients.get(userId).delete(ws);
            }
        });
        
        ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
    });
    
    return wss;
};

function handleMessage(ws, data) {
    switch (data.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        case 'subscribe':
            ws.subscriptions = ws.subscriptions || [];
            ws.subscriptions.push(data.channel);
            break;
    }
}

router.broadcast = function(userId, message) {
    const clients = wsClients.get(userId);
    if (clients) {
        const msg = JSON.stringify(message);
        clients.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(msg);
            }
        });
    }
};

router.broadcastAll = function(message) {
    const msg = JSON.stringify(message);
    wsClients.forEach(clients => {
        clients.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(msg);
            }
        });
    });
};

module.exports = router;
'''

RECOMMENDATION_SERVICE = '''
const logger = require('../utils/logger');

let pool = null;
function getPool() {
    if (!pool) {
        const mysql = require('mysql2/promise');
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'memory',
            password: process.env.DB_PASSWORD || 'ck123456@',
            database: process.env.DB_NAME || 'memory',
            waitForConnections: true,
            connectionLimit: 10
        });
    }
    return pool;
}

class RecommendationService {
    async getRelatedMemories(memoryId, userId, limit = 5) {
        try {
            const [memory] = await getPool().query(
                'SELECT tags, content FROM memories WHERE id = ? AND user_id = ?',
                [memoryId, userId]
            );
            
            if (!memory.length) return [];
            
            const tags = JSON.parse(memory[0].tags || '[]');
            
            if (tags.length > 0) {
                const [related] = await getPool().query(
                    'SELECT id, content, tags, importance_score, created_at FROM memories WHERE user_id = ? AND id != ? AND (tags LIKE ?) ORDER BY importance_score DESC, created_at DESC LIMIT ?',
                    [userId, memoryId, '%' + tags[0] + '%', limit]
                );
                return related;
            }
            
            const [recent] = await getPool().query(
                'SELECT id, content, tags, importance_score, created_at FROM memories WHERE user_id = ? AND id != ? ORDER BY created_at DESC LIMIT ?',
                [userId, memoryId, limit]
            );
            return recent;
        } catch (error) {
            logger.error('Get related memories error:', error);
            return [];
        }
    }
    
    async getRecommendations(userId, limit = 10) {
        try {
            const [recommendations] = await getPool().query(
                'SELECT id, content, tags, importance_score, created_at FROM memories WHERE user_id = ? ORDER BY importance_score DESC, last_accessed_at ASC LIMIT ?',
                [userId, limit]
            );
            return recommendations;
        } catch (error) {
            logger.error('Get recommendations error:', error);
            return [];
        }
    }
}

module.exports = new RecommendationService();
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
        
        with sftp.file(f"{CONFIG['remote_dir']}/web/js/lazy-load.js", 'w') as f:
            f.write(LAZY_LOAD_JS)
        print("Created: lazy-load.js")
        
        with sftp.file(f"{CONFIG['remote_dir']}/src/routes/websocket.js", 'w') as f:
            f.write(WEBSOCKET_ROUTE)
        print("Created: websocket.js")
        
        with sftp.file(f"{CONFIG['remote_dir']}/src/services/RecommendationService.js", 'w') as f:
            f.write(RECOMMENDATION_SERVICE)
        print("Created: RecommendationService.js")
        
        sftp.close()
        print("All additional files created!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_files()
