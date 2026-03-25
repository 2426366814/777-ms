/**
 * 管理员路由
 * 处理管理员相关的用户管理、系统配置等操作
 */

const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const EncryptionService = require('../services/EncryptionService');
const { validateJwtSecret } = require('../middleware/auth');
const { CONFIG } = require('../config/constants');

validateJwtSecret();

const ADMIN_USER_FIELDS = 'id, username, email, role, status, created_at, last_login_at';

const updateUserSchema = Joi.object({
    username: Joi.string().min(3).max(50).optional(),
    email: Joi.string().email().optional(),
    role: Joi.string().valid('user', 'admin').optional(),
    status: Joi.string().valid('active', 'inactive', 'banned').optional()
});

const changePasswordSchema = Joi.object({
    newPassword: Joi.string().min(6).max(100).required()
});

const createUserSchema = Joi.object({
    username: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
    role: Joi.string().valid('user', 'admin').default('user')
});

const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: '未授权访问' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const users = await db.query(
            `SELECT ${ADMIN_USER_FIELDS} FROM users WHERE id = ?`,
            [decoded.userId || decoded.id]
        );
        if (!users || users.length === 0) {
            return res.status(401).json({ success: false, message: '用户不存在' });
        }
        
        const user = users[0];
        if (user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '需要管理员权限' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: '令牌无效或已过期' });
    }
};

router.get('/users', adminAuth, async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;
        
        let sql = 'SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE 1=1';
        const params = [];
        
        if (search) {
            const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
            sql += ' AND (username LIKE ? OR email LIKE ?) ESCAPE "\\\\"';
            params.push(`%${escapedSearch}%`, `%${escapedSearch}%`);
        }
        
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const users = await db.query(sql, params);
        
        const countSql = 'SELECT COUNT(*) as total FROM users';
        const countResult = await db.query(countSql);
        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
        
        res.json({
            success: true,
            data: {
                users: users || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/users/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const users = await db.query(
            'SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE id = ?',
            [id]
        );
        
        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        res.json({ success: true, data: { user: users[0] } });
    } catch (error) {
        next(error);
    }
});

router.post('/users', adminAuth, async (req, res, next) => {
    try {
        const { error, value } = createUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const { username, email, password, role } = value;
        
        const existing = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: '用户名或邮箱已存在' });
        }
        
        const hashedPassword = await bcrypt.hash(password, CONFIG.BCRYPT.SALT_ROUNDS);
        const userId = uuidv4();
        
        await db.query(
            'INSERT INTO users (id, username, email, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, "active", NOW())',
            [userId, username, email, hashedPassword, role]
        );
        
        logger.info(`管理员 ${req.user.username} 创建用户: ${username}`);
        
        res.status(201).json({
            success: true,
            message: '用户创建成功',
            data: { id: userId, username, email, role }
        });
    } catch (error) {
        next(error);
    }
});

router.put('/users/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { error, value } = updateUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const existing = await db.query(`SELECT ${ADMIN_USER_FIELDS} FROM users WHERE id = ?`, [id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        if (value.username) {
            const duplicateUser = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [value.username, id]);
            if (duplicateUser && duplicateUser.length > 0) {
                return res.status(400).json({ success: false, message: '用户名已被使用' });
            }
        }
        
        if (value.email) {
            const duplicateEmail = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [value.email, id]);
            if (duplicateEmail && duplicateEmail.length > 0) {
                return res.status(400).json({ success: false, message: '邮箱已被使用' });
            }
        }
        
        const updates = [];
        const params = [];
        
        if (value.username) {
            updates.push('username = ?');
            params.push(value.username);
        }
        if (value.email) {
            updates.push('email = ?');
            params.push(value.email);
        }
        if (value.role) {
            updates.push('role = ?');
            params.push(value.role);
        }
        if (value.status) {
            updates.push('status = ?');
            params.push(value.status);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: '没有要更新的内容' });
        }
        
        params.push(id);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        
        logger.info(`管理员 ${req.user.username} 更新用户: ${id}`);
        
        res.json({ success: true, message: '用户更新成功' });
    } catch (error) {
        next(error);
    }
});

router.put('/users/:id/password', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { error, value } = changePasswordSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const existing = await db.query(`SELECT ${ADMIN_USER_FIELDS} FROM users WHERE id = ?`, [id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        const hashedPassword = await bcrypt.hash(value.newPassword, CONFIG.BCRYPT.SALT_ROUNDS);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
        
        logger.info(`管理员 ${req.user.username} 重置用户密码: ${id}`);
        
        res.json({ success: true, message: '密码重置成功' });
    } catch (error) {
        next(error);
    }
});

router.delete('/users/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        if (id === req.user.id) {
            return res.status(400).json({ success: false, message: '不能删除自己的账号' });
        }
        
        const existing = await db.query(`SELECT ${ADMIN_USER_FIELDS} FROM users WHERE id = ?`, [id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        
        logger.info(`管理员 ${req.user.username} 删除用户: ${id}`);
        
        res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/stats', adminAuth, async (req, res, next) => {
    try {
        const userCount = await db.query('SELECT COUNT(*) as count FROM users');
        const memoryCount = await db.query('SELECT COUNT(*) as count FROM memories');
        const knowledgeCount = await db.query('SELECT COUNT(*) as count FROM knowledge');
        const sessionCount = await db.query('SELECT COUNT(*) as count FROM sessions');
        const providerCount = await db.query('SELECT COUNT(*) as count FROM llm_providers WHERE is_active = 1');
        
        res.json({
            success: true,
            data: {
                users: userCount && userCount.length > 0 ? userCount[0].count : 0,
                memories: memoryCount && memoryCount.length > 0 ? memoryCount[0].count : 0,
                knowledge: knowledgeCount && knowledgeCount.length > 0 ? knowledgeCount[0].count : 0,
                sessions: sessionCount && sessionCount.length > 0 ? sessionCount[0].count : 0,
                providers: providerCount && providerCount.length > 0 ? providerCount[0].count : 0
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/logs', adminAuth, async (req, res, next) => {
    try {
        const { page = 1, limit = 50, type, userId } = req.query;
        const offset = (page - 1) * limit;
        
        let sql = 'SELECT * FROM login_logs WHERE 1=1';
        const params = [];
        
        if (userId) {
            sql += ' AND user_id = ?';
            params.push(userId);
        }
        
        sql += ' ORDER BY login_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const logs = await db.query(sql, params);
        
        const countSql = 'SELECT COUNT(*) as total FROM login_logs';
        const countResult = await db.query(countSql);
        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
        
        res.json({
            success: true,
            data: {
                logs: logs || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/providers', adminAuth, async (req, res, next) => {
    try {
        const providers = await db.query('SELECT * FROM llm_providers ORDER BY sort_order');
        res.json({ success: true, data: { providers: providers || [] } });
    } catch (error) {
        next(error);
    }
});

router.put('/providers/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { api_key, is_active, priority, sort_order } = req.body;
        
        const updates = [];
        const params = [];
        
        if (api_key !== undefined) {
            updates.push('api_key_encrypted = ?');
            params.push(EncryptionService.encrypt(api_key));
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (priority !== undefined) {
            updates.push('priority = ?');
            params.push(priority);
        }
        if (sort_order !== undefined) {
            updates.push('sort_order = ?');
            params.push(sort_order);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: '没有要更新的内容' });
        }
        
        params.push(id);
        await db.query(`UPDATE llm_providers SET ${updates.join(', ')} WHERE id = ?`, params);
        
        logger.info(`管理员 ${req.user.username} 更新提供商配置: ${id}`);
        
        res.json({ success: true, message: '提供商配置更新成功' });
    } catch (error) {
        next(error);
    }
});

router.post('/init-admin', async (req, res, next) => {
    try {
        const forwardedFor = req.headers['x-forwarded-for'];
        const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.ip || req.connection.remoteAddress || 'unknown');
        
        const allowedIPs = (process.env.ADMIN_INIT_IPS || '127.0.0.1,::1').split(',').map(ip => ip.trim());
        
        if (!allowedIPs.includes(clientIP)) {
            logger.warn(`未授权IP尝试初始化管理员: ${clientIP}`, { 
                category: 'security', 
                action: 'init_admin_unauthorized',
                ip: clientIP 
            });
            return res.status(403).json({ success: false, message: '禁止访问' });
        }
        
        const existingAdmins = await db.query("SELECT id FROM users WHERE role = 'admin'");
        if (existingAdmins && existingAdmins.length > 0) {
            return res.status(400).json({ success: false, message: '管理员已存在，无法初始化' });
        }
        
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: '请提供用户名、邮箱和密码' });
        }
        
        if (password.length < 12) {
            return res.status(400).json({ success: false, message: '管理员密码至少需要12个字符' });
        }
        
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecial)) {
            return res.status(400).json({ 
                success: false, 
                message: '密码必须包含大写字母、小写字母、数字和特殊字符' 
            });
        }
        
        if (username.length < 3 || username.length > 30) {
            return res.status(400).json({ success: false, message: '用户名长度必须在3-30个字符之间' });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: '邮箱格式无效' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = uuidv4();
        
        await db.query(
            'INSERT INTO users (id, username, email, password, role, status, created_at) VALUES (?, ?, ?, ?, "admin", "active", NOW())',
            [userId, username, email, hashedPassword]
        );
        
        logger.info(`初始化管理员账号: ${username}`, { 
            category: 'security', 
            action: 'admin_initialized',
            actor_ip: clientIP 
        });
        
        res.status(201).json({
            success: true,
            message: '管理员账号创建成功',
            data: { id: userId, username, email, role: 'admin' }
        });
    } catch (error) {
        next(error);
    }
});

const createProviderSchema = Joi.object({
    name: Joi.string().min(2).max(50).pattern(/^[a-z0-9_-]+$/).required(),
    display_name: Joi.string().max(100).optional(),
    api_endpoint: Joi.string().uri().required(),
    api_key: Joi.string().min(10).max(500).optional(),
    models: Joi.array().items(Joi.string()).max(100).optional()
});

router.post('/providers', adminAuth, async (req, res, next) => {
    try {
        const { error, value } = createProviderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const { name, display_name, api_endpoint, api_key, models } = value;
        
        const existing = await db.query('SELECT id FROM llm_providers WHERE name = ?', [name]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: '提供商已存在' });
        }
        
        const providerId = uuidv4();
        const encryptedApiKey = api_key ? EncryptionService.encrypt(api_key) : null;
        await db.query(
            'INSERT INTO llm_providers (id, name, display_name, base_url, api_key_encrypted, models, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
            [providerId, name, display_name || name, api_endpoint, encryptedApiKey, JSON.stringify(models || [])]
        );
        
        logger.info(`管理员 ${req.user.username} 添加提供商: ${name}`);
        
        res.status(201).json({ success: true, message: '提供商添加成功', data: { id: providerId } });
    } catch (error) {
        next(error);
    }
});

router.get('/apikeys', adminAuth, async (req, res, next) => {
    try {
        const keys = await db.query(`
            SELECT ak.*, u.username as created_by_name 
            FROM api_key_pool ak 
            LEFT JOIN users u ON ak.created_by = u.id 
            ORDER BY ak.created_at DESC
        `);
        res.json({ success: true, data: { keys: keys || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/apikeys', adminAuth, async (req, res, next) => {
    try {
        const { provider_name, api_key, description, priority, daily_limit } = req.body;
        
        if (!provider_name || !api_key) {
            return res.status(400).json({ success: false, message: '提供商名称和 API Key 不能为空' });
        }
        
        const keyId = uuidv4();
        const encryptedApiKey = EncryptionService.encrypt(api_key);
        await db.query(
            'INSERT INTO api_key_pool (id, provider_name, api_key_encrypted, description, priority, daily_limit, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [keyId, provider_name, encryptedApiKey, description || '', priority || 0, daily_limit || 0, req.user.id]
        );
        
        logger.info(`管理员 ${req.user.username} 添加 API Key: ${provider_name}`);
        
        res.status(201).json({ success: true, message: 'API Key 添加成功', data: { id: keyId } });
    } catch (error) {
        next(error);
    }
});

router.put('/apikeys/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { api_key, description, is_active, priority, daily_limit } = req.body;
        
        const updates = [];
        const params = [];
        
        if (api_key !== undefined) {
            updates.push('api_key_encrypted = ?');
            params.push(EncryptionService.encrypt(api_key));
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (priority !== undefined) {
            updates.push('priority = ?');
            params.push(priority);
        }
        if (daily_limit !== undefined) {
            updates.push('daily_limit = ?');
            params.push(daily_limit);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: '没有要更新的内容' });
        }
        
        params.push(id);
        await db.query(`UPDATE api_key_pool SET ${updates.join(', ')} WHERE id = ?`, params);
        
        logger.info(`管理员 ${req.user.username} 更新 API Key: ${id}`);
        
        res.json({ success: true, message: 'API Key 更新成功' });
    } catch (error) {
        next(error);
    }
});

router.delete('/apikeys/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM api_key_pool WHERE id = ?', [id]);
        
        logger.info(`管理员 ${req.user.username} 删除 API Key: ${id}`);
        
        res.json({ success: true, message: 'API Key 删除成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/announcements', adminAuth, async (req, res, next) => {
    try {
        const announcements = await db.query(`
            SELECT a.*, u.username as created_by_name 
            FROM announcements a 
            LEFT JOIN users u ON a.created_by = u.id 
            ORDER BY a.is_pinned DESC, a.created_at DESC
        `);
        res.json({ success: true, data: { announcements: announcements || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/announcements', adminAuth, async (req, res, next) => {
    try {
        const { title, content, type, is_pinned, start_time, end_time } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ success: false, message: '标题和内容不能为空' });
        }
        
        const announcementId = uuidv4();
        await db.query(
            'INSERT INTO announcements (id, title, content, type, is_pinned, start_time, end_time, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [announcementId, title, content, type || 'info', is_pinned ? 1 : 0, start_time || null, end_time || null, req.user.id]
        );
        
        logger.info(`管理员 ${req.user.username} 发布公告: ${title}`);
        
        res.status(201).json({ success: true, message: '公告发布成功', data: { id: announcementId } });
    } catch (error) {
        next(error);
    }
});

router.put('/announcements/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, content, type, is_pinned, is_active, start_time, end_time } = req.body;
        
        const updates = [];
        const params = [];
        
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }
        if (type !== undefined) {
            updates.push('type = ?');
            params.push(type);
        }
        if (is_pinned !== undefined) {
            updates.push('is_pinned = ?');
            params.push(is_pinned ? 1 : 0);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (start_time !== undefined) {
            updates.push('start_time = ?');
            params.push(start_time);
        }
        if (end_time !== undefined) {
            updates.push('end_time = ?');
            params.push(end_time);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: '没有要更新的内容' });
        }
        
        params.push(id);
        await db.query(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`, params);
        
        logger.info(`管理员 ${req.user.username} 更新公告: ${id}`);
        
        res.json({ success: true, message: '公告更新成功' });
    } catch (error) {
        next(error);
    }
});

router.delete('/announcements/:id', adminAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM announcements WHERE id = ?', [id]);
        
        logger.info(`管理员 ${req.user.username} 删除公告: ${id}`);
        
        res.json({ success: true, message: '公告删除成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/permissions', adminAuth, async (req, res, next) => {
    try {
        const permissions = await db.query(`
            SELECT up.*, u.username, u.email 
            FROM user_permissions up 
            JOIN users u ON up.user_id = u.id 
            ORDER BY u.username, up.permission_key
        `);
        
        const users = await db.query('SELECT id, username, email, role FROM users WHERE role = "user" ORDER BY username');
        
        res.json({ success: true, data: { permissions: permissions || [], users: users || [] } });
    } catch (error) {
        next(error);
    }
});

router.put('/permissions/:userId', adminAuth, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { allowed_providers } = req.body;
        
        if (!allowed_providers || !Array.isArray(allowed_providers)) {
            return res.status(400).json({ success: false, message: '无效的提供商列表' });
        }
        
        await db.query(
            'INSERT INTO user_permissions (id, user_id, permission_key, permission_value, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE permission_value = VALUES(permission_value), updated_at = NOW()',
            [uuidv4(), userId, 'allowed_providers', JSON.stringify(allowed_providers)]
        );
        
        logger.info(`管理员 ${req.user.username} 更新用户权限: ${userId}`);
        
        res.json({ success: true, message: '权限更新成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/system-logs', adminAuth, async (req, res, next) => {
    try {
        const { page = 1, limit = 50, level, category } = req.query;
        const offset = (page - 1) * limit;
        
        let sql = 'SELECT * FROM system_logs WHERE 1=1';
        const params = [];
        
        if (level) {
            sql += ' AND level = ?';
            params.push(level);
        }
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const logs = await db.query(sql, params);
        
        const countSql = 'SELECT COUNT(*) as total FROM system_logs WHERE 1=1' + 
            (level ? ' AND level = ?' : '') + 
            (category ? ' AND category = ?' : '');
        const countParams = [];
        if (level) countParams.push(level);
        if (category) countParams.push(category);
        const countResult = await db.query(countSql, countParams);
        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
        
        res.json({
            success: true,
            data: {
                logs: logs || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/health', adminAuth, async (req, res, next) => {
    try {
        const health = {
            database: { status: 'unknown', message: '' },
            redis: { status: 'unknown', message: '' },
            api: { status: 'ok', message: 'API 服务正常运行' },
            memory: { status: 'unknown', usage: {} },
            cpu: { status: 'unknown', usage: 0 }
        };
        
        try {
            await db.query('SELECT 1');
            health.database = { status: 'ok', message: '数据库连接正常' };
        } catch (dbError) {
            health.database = { status: 'error', message: dbError.message };
        }
        
        try {
            const redis = require('redis');
            const redisClient = redis.createClient({ url: process.env.REDIS_URL });
            await redisClient.connect();
            await redisClient.ping();
            await redisClient.disconnect();
            health.redis = { status: 'ok', message: 'Redis 连接正常' };
        } catch (redisError) {
            health.redis = { status: 'error', message: redisError.message };
        }
        
        const os = require('os');
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
        
        health.memory = {
            status: memoryUsagePercent > 90 ? 'warning' : 'ok',
            usage: {
                total: Math.round(totalMemory / 1024 / 1024),
                used: Math.round(usedMemory / 1024 / 1024),
                free: Math.round(freeMemory / 1024 / 1024),
                percent: memoryUsagePercent
            }
        };
        
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total);
        }, 0) / cpus.length * 100;
        
        health.cpu = {
            status: cpuUsage > 90 ? 'warning' : 'ok',
            usage: Math.round(cpuUsage),
            cores: cpus.length
        };
        
        res.json({ success: true, data: health });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
