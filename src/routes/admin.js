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

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not set');
    process.exit(1);
}

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
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const users = await db.query('SELECT * FROM users WHERE id = ?', [decoded.userId || decoded.id]);
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
            sql += ' AND (username LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
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
        
        const hashedPassword = await bcrypt.hash(password, 10);
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
        
        const existing = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
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
        
        const existing = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        const hashedPassword = await bcrypt.hash(value.newPassword, 10);
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
        
        const existing = await db.query('SELECT * FROM users WHERE id = ?', [id]);
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
            params.push(api_key);
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
        const existingAdmins = await db.query("SELECT id FROM users WHERE role = 'admin'");
        if (existingAdmins && existingAdmins.length > 0) {
            return res.status(400).json({ success: false, message: '管理员已存在，无法初始化' });
        }
        
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: '请提供用户名、邮箱和密码' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        
        await db.query(
            'INSERT INTO users (id, username, email, password, role, status, created_at) VALUES (?, ?, ?, ?, "admin", "active", NOW())',
            [userId, username, email, hashedPassword]
        );
        
        logger.info(`初始化管理员账号: ${username}`);
        
        res.status(201).json({
            success: true,
            message: '管理员账号创建成功',
            data: { id: userId, username, email, role: 'admin' }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/providers', adminAuth, async (req, res, next) => {
    try {
        const { name, display_name, api_endpoint, api_key, models } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: '提供商名称不能为空' });
        }
        
        const existing = await db.query('SELECT id FROM llm_providers WHERE name = ?', [name]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: '提供商已存在' });
        }
        
        const providerId = uuidv4();
        await db.query(
            'INSERT INTO llm_providers (id, name, display_name, base_url, api_key_encrypted, models, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
            [providerId, name, display_name || name, api_endpoint, api_key, JSON.stringify(models || [])]
        );
        
        logger.info(`管理员 ${req.user.username} 添加提供商: ${name}`);
        
        res.status(201).json({ success: true, message: '提供商添加成功', data: { id: providerId } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
