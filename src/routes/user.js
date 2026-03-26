/**
 * 用户路由
 * 处理用户认证和管理
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const logger = require('../utils/logger');
const { generateToken, generateRefreshToken, generateApiKey, authenticate, validateJwtSecret } = require('../middleware/auth');
const { CONFIG, DB_FIELDS } = require('../config/constants');
const User = require('../models/User');
const db = require('../utils/database');
const EncryptionService = require('../services/EncryptionService');

validateJwtSecret();

const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(100).required(),
    email: Joi.string().email().required()
});

const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

const checkUsernameLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMITS.WINDOW_MS.HOUR,
    max: 10,
    message: { success: false, message: '检查次数过多，请稍后再试' }
});

const loginLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMITS.WINDOW_MS.QUARTER_HOUR,
    max: CONFIG.RATE_LIMITS.LOGIN,
    message: { success: false, message: '登录尝试次数过多，请15分钟后再试' }
});

const registerLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMITS.WINDOW_MS.HOUR,
    max: CONFIG.RATE_LIMITS.REGISTER,
    message: { success: false, message: '注册次数过多，请1小时后再试' }
});

const apiKeyLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMITS.WINDOW_MS.HOUR,
    max: CONFIG.RATE_LIMITS.API_KEY_GENERATE,
    message: { success: false, message: 'API Key操作次数过多，请稍后再试' }
});

const passwordLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMITS.WINDOW_MS.HOUR,
    max: CONFIG.RATE_LIMITS.PASSWORD_RESET,
    message: { success: false, message: '密码修改次数过多，请1小时后再试' }
});

const refreshTokenLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMITS.WINDOW_MS.QUARTER_HOUR,
    max: 10,
    message: { success: false, message: '令牌刷新次数过多，请稍后再试' }
});

/**
 * @route   POST /api/v1/users/register
 * @desc    用户注册
 * @access  Public
 */
router.post('/register', registerLimiter, async (req, res, next) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const { username, password, email } = value;

        const user = await User.create({
            username,
            password,
            email,
            role: 'user'
        });

        logger.info(`新用户注册: ${username}`);

        res.status(201).json({
            success: true,
            message: '注册成功',
            data: {
                userId: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/users/login
 * @desc    用户登录
 * @access  Public
 */
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const { username, password } = value;

        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }

        const isValid = await User.verifyPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        const logId = require('uuid').v4();
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        
        await db.query(
            `INSERT INTO login_logs (id, user_id, ip_address, user_agent, status) 
             VALUES (?, ?, ?, ?, 'success')`,
            [logId, user.id, ipAddress, userAgent]
        );

        logger.info(`用户登录: ${username}`);

        res.json({
            success: true,
            message: '登录成功',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    createdAt: user.created_at
                },
                token,
                refreshToken,
                expiresIn: CONFIG.JWT.EXPIRES_IN
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/users/refresh
 * @desc    刷新访问令牌
 * @access  Public
 */
router.post('/refresh', refreshTokenLimiter, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: '未提供刷新令牌'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: '刷新令牌无效或已过期'
            });
        }
        
        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                message: '无效的刷新令牌类型'
            });
        }
        
        try {
            const { CacheService } = require('../services/cache');
            
            const tokenBlacklisted = await CacheService.get(`blacklist:${refreshToken}`);
            if (tokenBlacklisted) {
                return res.status(401).json({
                    success: false,
                    message: '刷新令牌已失效'
                });
            }
            
            const userBlacklisted = await CacheService.get(`user_blacklist:${decoded.userId}`);
            if (userBlacklisted) {
                return res.status(401).json({
                    success: false,
                    message: '用户已登出，请重新登录'
                });
            }
        } catch (cacheError) {
            logger.warn('Cache check failed for refresh token:', cacheError.message);
        }
        
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户不存在'
            });
        }

        const newToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        res.json({
            success: true,
            data: {
                token: newToken,
                refreshToken: newRefreshToken,
                expiresIn: CONFIG.JWT.EXPIRES_IN
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/users/profile
 * @desc    获取用户信息
 * @access  Private
 */
router.get('/profile', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    createdAt: user.created_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/users/profile
 * @desc    更新用户信息（用户名、邮箱）
 * @access  Private
 */
router.put('/profile', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { username, email } = req.body;
        
        if (!username && !email) {
            return res.status(400).json({ success: false, message: '请提供要更新的内容' });
        }
        
        if (username) {
            if (username.length < 3 || username.length > 50) {
                return res.status(400).json({ success: false, message: '用户名长度必须在3-50个字符之间' });
            }
            const existingUser = await User.findByUsername(username);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ success: false, message: '用户名已被使用' });
            }
        }
        
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: '邮箱格式无效' });
            }
        }
        
        await User.updateProfile(userId, { username, email });
        
        logger.info(`用户更新个人信息: ${userId}`);
        
        res.json({ success: true, message: '用户信息更新成功' });
    } catch (error) {
        logger.error('更新用户资料失败:', error.message);
        res.status(500).json({ success: false, message: error.message || '更新失败' });
    }
});

/**
 * @route   PUT /api/v1/users/password
 * @desc    修改用户密码
 * @access  Private
 */
router.put('/password', authenticate, passwordLimiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: '请提供当前密码和新密码' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: '新密码长度至少6个字符' });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        const isValid = await User.verifyPassword(currentPassword, user.password);
        if (!isValid) {
            return res.status(400).json({ success: false, message: '当前密码错误' });
        }
        
        await User.updatePassword(userId, newPassword);
        
        logger.info(`用户修改密码: ${userId}`, { category: 'security', action: 'password_change' });
        
        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        logger.error('修改密码失败:', error.message);
        res.status(500).json({ success: false, message: error.message || '修改密码失败' });
    }
});

/**
 * @route   POST /api/v1/users/apikey
 * @desc    创建新的 API Key（支持多个）
 * @access  Private
 */
router.post('/apikey', authenticate, apiKeyLimiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;
        const apiKey = generateApiKey();
        
        const result = await User.createApiKey(userId, apiKey, name);
        
        logger.info(`用户创建 API Key: ${userId}`, { category: 'security', action: 'apikey_create' });

        res.json({
            success: true,
            message: 'API Key 创建成功',
            data: {
                id: result.id,
                name: result.name,
                apiKey,
                createdAt: result.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/users/api-keys
 * @desc    获取用户的所有 API Keys
 * @access  Private
 */
router.get('/api-keys', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const keys = await User.getAllApiKeys(userId);
        
        const apiKeys = keys.map(k => ({
            id: k.id,
            name: k.name || '未命名',
            createdAt: k.created_at,
            expiresAt: k.expires_at,
            lastUsedAt: k.last_used_at,
            isActive: k.is_active === 1
        }));
        
        res.json({
            success: true,
            data: { apiKeys }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/users/api-key/:id
 * @desc    删除指定的 API Key
 * @access  Private
 */
router.delete('/api-key/:id', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const keyId = req.params.id;
        
        const result = await User.deleteApiKeyById(userId, keyId);
        
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                message: '未找到 API Key 或无权删除' 
            });
        }
        
        logger.info(`用户删除 API Key: ${userId}, Key ID: ${keyId}`, { category: 'security', action: 'apikey_delete' });
        
        res.json({ 
            success: true, 
            message: 'API Key 删除成功' 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/users/api-key/:id/permanent
 * @desc    彻底删除指定的 API Key（硬删除）
 * @access  Private
 */
router.delete('/api-key/:id/permanent', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const keyId = req.params.id;
        
        const result = await User.hardDeleteApiKey(userId, keyId);
        
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                message: '未找到 API Key 或无权删除' 
            });
        }
        
        logger.info(`用户彻底删除 API Key: ${userId}, Key ID: ${keyId}`, { category: 'security', action: 'apikey_hard_delete' });
        
        res.json({ 
            success: true, 
            message: 'API Key 已彻底删除' 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/users/check-username
 * @desc    检查用户名是否已存在
 * @access  Public
 */
router.get('/check-username', checkUsernameLimiter, async (req, res, next) => {
    try {
        const { username } = req.query;
        
        if (!username) {
            return res.status(400).json({ success: false, message: '请提供用户名' });
        }
        
        const user = await User.findByUsername(username);
        
        res.json({ success: true, exists: !!user });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/user/logout
 * @desc    用户登出（将Token加入黑名单）
 * @access  Private
 */
router.post('/logout', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const authHeader = req.headers.authorization;
        const token = authHeader.split(' ')[1];
        
        const { CacheService } = require('../services/cache');
        
        const decoded = jwt.decode(token);
        const tokenExp = decoded?.exp || Math.floor(Date.now() / 1000) + CONFIG.JWT.DEFAULT_TTL_SECONDS;
        const ttl = tokenExp - Math.floor(Date.now() / 1000);
        
        if (ttl > 0) {
            await CacheService.set(`blacklist:${token}`, { userId, logoutAt: new Date().toISOString() }, ttl);
        }
        
        logger.info(`用户登出: ${userId}`);
        
        res.json({ success: true, message: '登出成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/user/logout-all
 * @desc    登出所有设备（将用户所有Token加入黑名单）
 * @access  Private
 */
router.post('/logout-all', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const authHeader = req.headers.authorization;
        const token = authHeader.split(' ')[1];
        
        const { CacheService } = require('../services/cache');
        
        const decoded = jwt.decode(token);
        const tokenExp = decoded?.exp || Math.floor(Date.now() / 1000) + CONFIG.JWT.DEFAULT_TTL_SECONDS;
        const ttl = tokenExp - Math.floor(Date.now() / 1000);
        
        if (ttl > 0) {
            await CacheService.set(`user_blacklist:${userId}`, { logoutAt: new Date().toISOString() }, ttl);
        }
        
        logger.info(`用户登出所有设备: ${userId}`);
        
        res.json({ success: true, message: '已登出所有设备' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
