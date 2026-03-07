/**
 * 777-MS Memory System - 主服务器入口
 * AI驱动的智能记忆管理系统
 * 
 * @version 0.5.5
 * @description 完整的Express服务器，包含自动功能管理
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const logger = require('./src/utils/logger');
const db = require('./src/utils/database');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 1777;
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', true);
app.set('io', io);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://static.cloudflareinsights.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://memory.91wz.org", "wss://memory.91wz.org", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

const allowedOrigins = [
    'https://memory.91wz.org',
    'http://localhost:3000',
    'http://localhost:1777',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:1777'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'web')));

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

const routes = {
    '/api/v1/memories': require('./src/routes/memory'),
    '/api/v1/user': require('./src/routes/user'),
    '/api/v1/admin': require('./src/routes/admin'),
    '/api/v1/chat': require('./src/routes/chat'),
    '/api/v1/llm': require('./src/routes/llm'),
    '/api/v1/knowledge': require('./src/routes/knowledge'),
    '/api/v1/review': require('./src/routes/review'),
    '/api/v1/tags': require('./src/routes/tags'),
    '/api/v1/categories': require('./src/routes/categories'),
    '/api/v1/backup': require('./src/routes/backup'),
    '/api/v1/settings': require('./src/routes/settings'),
    '/api/v1/system': require('./src/routes/system'),
    '/api/v1/usage': require('./src/routes/usage'),
    '/api/v1/providers': require('./src/routes/providers'),
    '/api/v1/recommendations': require('./src/routes/recommendations'),
    '/api/v1/reminders': require('./src/routes/reminders'),
    '/api/v1/templates': require('./src/routes/templates'),
    '/api/v1/versions': require('./src/routes/versions'),
    '/api/v1/share': require('./src/routes/share'),
    '/api/v1/visualization': require('./src/routes/visualization'),
    '/api/v1/intelligence': require('./src/routes/intelligence'),
    '/api/v1/advanced': require('./src/routes/advanced'),
    '/api/v1/batch': require('./src/routes/batch'),
    '/api/v1/logs': require('./src/routes/logs'),
    '/api/v1/sessions': require('./src/routes/session'),
    '/api/v1/ide': require('./src/routes/ide')
};

for (const [path, router] of Object.entries(routes)) {
    try {
        app.use(path, router);
        logger.info(`Route mounted: ${path}`);
    } catch (err) {
        logger.warn(`Failed to mount route ${path}: ${err.message}`);
    }
}

app.get('/health', async (req, res) => {
    try {
        const dbStatus = await db.testConnection();
        const autoManager = require('./src/services/AutoManager');
        const autoStatus = autoManager.getStatus();
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbStatus ? 'connected' : 'disconnected',
            autoManager: autoStatus.isRunning ? 'running' : 'stopped',
            features: autoStatus.features,
            version: '0.5.5'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/api/v1/status', async (req, res) => {
    try {
        const autoManager = require('./src/services/AutoManager');
        res.json({
            success: true,
            data: {
                server: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: '0.5.5'
                },
                autoManager: autoManager.getStatus()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

const spaRoutes = ['/login', '/dashboard', '/admin', '/profile', '/settings', '/chat', '/knowledge', '/review', '/providers', '/visualization', '/intelligence', '/share', '/security', '/api-docs'];
spaRoutes.forEach(route => {
    app.get(route, (req, res) => {
        const pageMap = {
            '/login': 'login.html',
            '/dashboard': 'dashboard.html',
            '/admin': 'admin.html',
            '/profile': 'profile.html',
            '/settings': 'settings.html',
            '/chat': 'chat.html',
            '/knowledge': 'knowledge.html',
            '/review': 'review.html',
            '/providers': 'providers.html',
            '/visualization': 'visualization.html',
            '/intelligence': 'intelligence.html',
            '/share': 'share.html',
            '/security': 'security.html',
            '/api-docs': 'api.html'
        };
        const page = pageMap[route] || 'index.html';
        res.sendFile(path.join(__dirname, 'web', page));
    });
});

app.use((req, res) => {
    if (req.accepts('html')) {
        return res.status(404).sendFile(path.join(__dirname, 'web', 'index.html'));
    }
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.path
    });
});

app.use(errorHandler);

io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
    
    socket.on('error', (err) => {
        logger.error(`WebSocket error: ${err.message}`);
    });
});

async function startAutoManager() {
    try {
        const autoManager = require('./src/services/AutoManager');
        autoManager.start();
        logger.info('AutoManager started successfully with all auto features enabled');
        return true;
    } catch (error) {
        logger.error('Failed to start AutoManager:', error.message);
        return false;
    }
}

async function startBackupService() {
    try {
        const backupService = require('./src/services/BackupService');
        await backupService.init();
        logger.info('BackupService started successfully');
        return true;
    } catch (error) {
        logger.error('Failed to start BackupService:', error.message);
        return false;
    }
}

async function initializeDatabase() {
    try {
        const connected = await db.testConnection();
        if (connected) {
            logger.info('Database connection established');
            return true;
        } else {
            logger.warn('Database connection failed, will retry...');
            return false;
        }
    } catch (error) {
        logger.error('Database initialization error:', error.message);
        return false;
    }
}

async function startServer() {
    logger.info('========================================');
    logger.info('777-MS Memory System v0.5.5');
    logger.info('========================================');
    
    await initializeDatabase();
    
    await startAutoManager();
    await startBackupService();
    
    server.listen(PORT, HOST, () => {
        logger.info(`Server running on http://${HOST}:${PORT}`);
        logger.info(`Health check: http://${HOST}:${PORT}/health`);
        logger.info(`WebSocket enabled`);
        logger.info('========================================');
    });
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
}

async function gracefulShutdown() {
    logger.info('Received shutdown signal, closing server gracefully...');
    
    try {
        const autoManager = require('./src/services/AutoManager');
        autoManager.stop();
        logger.info('AutoManager stopped');
    } catch (err) {
        logger.warn('Error stopping AutoManager:', err.message);
    }
    
    try {
        const backupService = require('./src/services/BackupService');
        backupService.stopAllJobs();
        logger.info('BackupService stopped');
    } catch (err) {
        logger.warn('Error stopping BackupService:', err.message);
    }
    
    server.close(() => {
        logger.info('HTTP server closed');
        
        db.closePool().then(() => {
            logger.info('Database pool closed');
            process.exit(0);
        }).catch((err) => {
            logger.error('Error closing database pool:', err.message);
            process.exit(1);
        });
    });
    
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

startServer().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = { app, server, io };
