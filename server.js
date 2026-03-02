/**
 * 777-MS Memory System - 主服务器入口
 * 版本: v0.4.3
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const auth = require('./src/middleware/auth');
const db = require('./src/utils/database');

const userRoutes = require('./src/routes/user');
const memoryRoutes = require('./src/routes/memory');
const knowledgeRoutes = require('./src/routes/knowledge');
const sessionRoutes = require('./src/routes/session');
const tagsRoutes = require('./src/routes/tags');
const categoriesRoutes = require('./src/routes/categories');
const logsRoutes = require('./src/routes/logs');
const backupRoutes = require('./src/routes/backup');
const ideRoutes = require('./src/routes/ide');
const intelligenceRoutes = require('./src/routes/intelligence');
const reviewRoutes = require('./src/routes/review');
const visualizationRoutes = require('./src/routes/visualization');
const providersRoutes = require('./src/routes/providers');
const chatRoutes = require('./src/routes/chat');
const llmRoutes = require('./src/routes/llm');
const advancedRoutes = require('./src/routes/advanced');
const usageRoutes = require('./src/routes/usage');
const remindersRoutes = require('./src/routes/reminders');
const shareRoutes = require('./src/routes/share');
const adminRoutes = require('./src/routes/admin');
const recommendationsRoutes = require('./src/routes/recommendations');
const versionsRoutes = require('./src/routes/versions');

const BackupService = require('./src/services/BackupService');
const autoManager = require('./src/services/AutoManager');

const app = express();
const PORT = process.env.PORT || 1777;
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://static.cloudflareinsights.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https:", "wss:"],
            workerSrc: ["'self'", "blob:"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: null
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://memory.91wz.org'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        message: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'web')));

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/memories', auth.authenticate, memoryRoutes);
app.use('/api/v1/knowledge', auth.authenticate, knowledgeRoutes);
app.use('/api/v1/sessions', auth.authenticate, sessionRoutes);
app.use('/api/v1/tags', auth.authenticate, tagsRoutes);
app.use('/api/v1/categories', auth.authenticate, categoriesRoutes);
app.use('/api/v1/logs', auth.authenticate, logsRoutes);
app.use('/api/v1/backup', auth.authenticate, backupRoutes);
app.use('/api/v1/ide', auth.authenticateApiKey, ideRoutes);
app.use('/api/v1/intelligence', auth.authenticate, intelligenceRoutes);
app.use('/api/v1/review', auth.authenticate, reviewRoutes);
app.use('/api/v1/visualization', auth.authenticate, visualizationRoutes);
app.use('/api/v1/providers', providersRoutes);
app.use('/api/v1/chat', auth.authenticate, chatRoutes);
app.use('/api/v1/llm', auth.authenticate, llmRoutes);
app.use('/api/v1/advanced', auth.authenticate, advancedRoutes);
app.use('/api/v1/usage', auth.authenticate, usageRoutes);
app.use('/api/v1/reminders', auth.authenticate, remindersRoutes);
app.use('/api/v1/share', auth.authenticate, shareRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/recommendations', auth.authenticate, recommendationsRoutes);
app.use('/api/v1/versions', auth.authenticate, versionsRoutes);
const settingsRoutes = require('./src/routes/settings');
app.use('/api/v1/settings', settingsRoutes);
const templatesRoutes = require('./src/routes/templates');
app.use('/api/v1/templates', templatesRoutes);
const batchRoutes = require('./src/routes/batch');
app.use('/api/v1/memories/batch', batchRoutes);

app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        version: '0.4.3',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v1/version', (req, res) => {
    res.json({
        success: true,
        data: {
            version: '0.4.3',
            name: '777-MS Memory System',
            description: 'AI智能记忆管理系统',
            buildDate: new Date().toISOString(),
            features: [
                'memory-management',
                'knowledge-base',
                'ebbinghaus-review',
                'llm-routing',
                'multi-provider-support'
            ]
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'dashboard.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'chat.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'admin.html'));
});

app.get('/intelligence', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'intelligence.html'));
});

app.get('/review', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'review.html'));
});

app.get('/visualization', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'visualization.html'));
});

app.get('/security', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'security.html'));
});

app.get('/providers', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'providers.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'profile.html'));
});

app.get('/api-docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'api.html'));
});

app.get('/knowledge', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'knowledge.html'));
});

app.get('/share/:code', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'share.html'));
});

app.get('/docs', (req, res) => {
    res.redirect('/');
});

app.get('/landing', (req, res) => {
    res.redirect('/');
});

app.get('/pricing', (req, res) => {
    res.redirect('/#pricing');
});

app.get('/api', (req, res) => {
    res.redirect('/api-docs');
});

app.use(errorHandler);

const startServer = async () => {
    try {
        const dbConnected = await db.testConnection();
        if (dbConnected) {
            logger.info(`✅ 数据库连接正常`);
        } else {
            logger.warn(`⚠️ 数据库连接失败，部分功能可能不可用`);
        }
        
        await BackupService.init();
        logger.info(`✅ 备份服务已启动`);
        
        autoManager.start();
        logger.info(`✅ LLM自动管理服务已启动`);
        
        app.listen(PORT, HOST, () => {
            logger.info(`🚀 777-MS Memory System v0.4.3 启动成功`);
            logger.info(`📡 服务器地址: http://${HOST}:${PORT}`);
            logger.info(`🌐 环境: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        logger.error('服务器启动失败:', error.message);
        process.exit(1);
    }
};

startServer();

module.exports = app;
