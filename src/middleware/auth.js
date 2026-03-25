/**
 * 认证中间件
 * 处理 JWT 认证和 API Key 认证
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const logger = require('../utils/logger');
const { CacheService } = require('../services/cache');
const EncryptionService = require('../services/EncryptionService');
const { CONFIG } = require('../config/constants');

const hashApiKey = (apiKey) => {
    return crypto.createHash(CONFIG.HASH.ALGORITHM).update(apiKey).digest('hex');
};

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

const authenticateApiKey = async (req, res, next) => {
    try {
        let apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                apiKey = authHeader.substring(7);
            }
        }

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: '未提供 API Key'
            });
        }

        if (!apiKey.startsWith(CONFIG.API_KEY.PREFIX)) {
            return res.status(401).json({
                success: false,
                message: '无效的 API Key 格式'
            });
        }

        const db = require('../utils/database');
        const hashedKey = hashApiKey(apiKey);
        
        const users = await db.query(
            `SELECT u.id, u.username, u.role
             FROM users u 
             JOIN user_api_keys k ON u.id = k.user_id 
             WHERE k.api_key_hash = ? AND k.is_active = 1 AND (k.expires_at IS NULL OR k.expires_at > NOW())`,
            [hashedKey]
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

const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: CONFIG.JWT.EXPIRES_IN,
            issuer: CONFIG.JWT.ISSUER,
            audience: CONFIG.JWT.AUDIENCE
        }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            type: 'refresh'
        },
        process.env.JWT_SECRET,
        {
            expiresIn: CONFIG.JWT.REFRESH_EXPIRES_IN,
            issuer: CONFIG.JWT.ISSUER
        }
    );
};

const generateApiKey = () => {
    const key = uuidv4().replace(/-/g, '');
    return CONFIG.API_KEY.PREFIX + key;
};

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
        next();
    }
};

const authenticateWithApiKey = async (req, res, next) => {
    try {
        let apiKey = req.headers['x-api-key'];
        const authHeader = req.headers.authorization;
        let token = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            if (token.startsWith(CONFIG.API_KEY.PREFIX)) {
                apiKey = token;
            }
        }
        
        if (apiKey) {
            req.headers['x-api-key'] = apiKey;
            return authenticateApiKey(req, res, next);
        }
        
        if (token) {
            try {
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
                
                req.user = {
                    id: decoded.userId,
                    username: decoded.username,
                    role: decoded.role
                };
                
                return next();
            } catch (jwtError) {
                logger.error('JWT 验证失败:', jwtError.message);
                
                if (jwtError.name === 'TokenExpiredError') {
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
        }
        
        return res.status(401).json({
            success: false,
            message: '未提供认证令牌'
        });
    } catch (error) {
        logger.error('认证失败:', error.message);
        return res.status(401).json({
            success: false,
            message: '认证失败'
        });
    }
};

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

const requireAuth = (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            message: '未授权访问'
        });
    }
    next();
};

const validateJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET 环境变量未设置');
    }
    if (secret.length < 32) {
        logger.warn('JWT_SECRET 长度不足32位，建议使用更长的密钥');
    }
    const weakSecrets = ['secret', 'password', '123456', 'jwt-secret', 'your-secret-key'];
    if (weakSecrets.includes(secret.toLowerCase())) {
        throw new Error('JWT_SECRET 使用了弱密钥，请更换为强密钥');
    }
    return true;
};

module.exports = {
    authenticate,
    isAdmin,
    authenticateApiKey,
    authenticateWithApiKey,
    optionalAuth,
    requireRole,
    requireAuth,
    validateJwtSecret,
    generateToken,
    generateRefreshToken,
    generateApiKey,
    hashApiKey
};
