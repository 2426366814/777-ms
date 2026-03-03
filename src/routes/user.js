/**
 * 用户路由
 * 处理用户认证和管理
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');

const router = express.Router();
const logger = require('../utils/logger');
const { generateToken, generateRefreshToken, generateApiKey } = require('../middleware/auth');
const User = require('../models/User');

// 注册验证 schema
const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(100).required(),
    email: Joi.string().email().required()
});

// 登录验证 schema
const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

/**
 * @route   POST /api/v1/users/register
 * @desc    用户注册
 * @access  Public
 */
router.post('/register', async (req, res, next) => {
    try {
        // 验证输入
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const { username, password, email } = value;

        // 创建用户
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
router.post('/login', async (req, res, next) => {
    try {
        // 验证输入
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const { username, password } = value;

        // 从数据库查找用户
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }

        // 验证密码
        const isValid = await User.verifyPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }

        // 生成令牌
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        // 记录登录日志
        const db = require('../utils/database');
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
                expiresIn: '24h'
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
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: '未提供刷新令牌'
            });
        }

        const jwt = require('jsonwebtoken');
        
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'your-secret-key');
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
                expiresIn: '24h'
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
router.get('/profile', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未授权访问'
            });
        }
        
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: '令牌无效或已过期'
            });
        }
        
        const userId = decoded.userId || decoded.id;
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
 * @route   POST /api/v1/users/apikey
 * @desc    生成 API Key
 * @access  Private
 */
router.post('/apikey', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未授权访问'
            });
        }
        
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: '令牌无效或已过期'
            });
        }
        
        const userId = decoded.userId || decoded.id;
        const apiKey = generateApiKey();

        res.json({
            success: true,
            message: 'API Key 生成成功',
            data: {
                apiKey,
                createdAt: new Date().toISOString()
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
router.put('/profile', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: '未授权访问' });
        }
        
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (err) {
            return res.status(401).json({ success: false, message: '令牌无效或已过期' });
        }
        
        const userId = decoded.userId || decoded.id;
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
router.put('/password', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: '未授权访问' });
        }
        
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (err) {
            return res.status(401).json({ success: false, message: '令牌无效或已过期' });
        }
        
        const userId = decoded.userId || decoded.id;
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
        
        logger.info(`用户修改密码: ${userId}`);
        
        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        logger.error('修改密码失败:', error.message);
        res.status(500).json({ success: false, message: error.message || '修改密码失败' });
    }
});

/**
 * @route   GET /api/v1/users/apikeys
 * @desc    获取用户的 API Keys
 * @access  Private
 */
router.get('/apikeys', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未授权访问'
            });
        }
        
        res.json({
            success: true,
            data: {
                apiKeys: []
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/users/api-key
 * @desc    获取用户当前的 API Key
 * @access  Private
 */
router.get('/api-key', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: '未授权访问' });
        }
        
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (err) {
            return res.status(401).json({ success: false, message: '令牌无效或已过期' });
        }
        
        const userId = decoded.userId || decoded.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        res.json({ success: true, apiKey: user.api_key || null });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/users/api-key/regenerate
 * @desc    重新生成用户的 API Key
 * @access  Private
 */
router.post('/api-key/regenerate', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: '未授权访问' });
        }
        
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (err) {
            return res.status(401).json({ success: false, message: '令牌无效或已过期' });
        }
        
        const userId = decoded.userId || decoded.id;
        const apiKey = generateApiKey();
        
        await User.updateApiKey(userId, apiKey);
        
        logger.info(`用户重新生成 API Key: ${userId}`);
        
        res.json({ success: true, apiKey });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/users/check-username
 * @desc    检查用户名是否已存在
 * @access  Public
 */
router.get('/check-username', async (req, res, next) => {
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

module.exports = router;
