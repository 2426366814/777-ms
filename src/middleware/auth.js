/**
 * 认证中间件
 * 处理 JWT 认证和 API Key 认证
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const logger = require('../utils/logger');
const { CacheService } = require('../services/cache');

// JWT 认证
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }

        const token = authHeader.substring(7);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const userId = decoded.userId;
        
        const tokenBlacklisted = await CacheService.get(`blacklist:${token}`);
        if (tokenBlacklisted) {
            return res.status(401).json({
                success: false,
                message: '令牌已失效，请重新登录',
                code: 'TOKEN_REVOKED'
            });
        }
        
        const userBlacklisted = await CacheService.get(`user_blacklist:${userId}`);
        if (userBlacklisted) {
            const logoutAt = new Date(userBlacklisted.logoutAt).getTime() / 1000;
            if (decoded.iat < logoutAt) {
                return res.status(401).json({
                    success: false,
                    message: '该账号已在其他设备登出，请重新登录',
                    code: 'USER_LOGGED_OUT'
                });
            }
        }
        
        // 将用户信息附加到请求对象
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            role: decoded.role
        };
        
        next();
    } catch (error) {
        logger.error('认证失败:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '令牌已过期',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: '无效的认证令牌'
        });
    }
};
// 管理员权限检查中间件
const isAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "未认证"
            });
        }

        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "需要管理员权限"
            });
        }

        next();
    } catch (error) {
        logger.error("管理员权限检查失败:", error.message);
        return res.status(500).json({
            success: false,
            message: "权限检查失败"
        });
    }
};
// API Key 认证（用于 IDE 对接）
const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: '未提供 API Key'
            });
        }

        const db = require('../utils/database');
        
        const users = await db.query(
            'SELECT id, username, role, api_key FROM users WHERE api_key = ?',
            [apiKey]
        );
        
        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: '无效的 API Key'
            });
        }
        
        const user = users[0];
        
        req.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        
        next();
    } catch (error) {
        logger.error('API Key 认证失败:', error.message);
        return res.status(401).json({
            success: false,
            message: '无效的 API Key'
        });
    }
};

// 生成 JWT 令牌
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            issuer: '777-ms',
            audience: '777-ms-users'
        }
    );
};

// 生成刷新令牌
const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            type: 'refresh'
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
            issuer: '777-ms'
        }
    );
};

// 生成 API Key
const generateApiKey = () => {
    const prefix = '777_';
    const key = uuidv4().replace(/-/g, '');
    return prefix + key;
};

// 可选认证（不强制要求登录）
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = {
                id: decoded.userId,
                username: decoded.username,
                role: decoded.role
            };
        }
        
        next();
    } catch (error) {
        // 可选认证失败不阻止请求
        next();
    }
};

// 角色检查
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        next();
    };
};

module.exports = {
    authenticate,
    isAdmin,
    authenticateApiKey,
    optionalAuth,
    requireRole,
    generateToken,
    generateRefreshToken,
    generateApiKey
};
