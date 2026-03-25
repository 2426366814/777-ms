/**
 * 全局错误处理中间件
 * 统一处理应用中的错误
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    logger.error('错误处理:', {
        message: err.message,
        stack: isProduction ? undefined : err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'JSON 格式错误'
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: '数据验证失败',
            errors: err.errors
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            message: '未授权'
        });
    }

    if (err.name === 'ForbiddenError') {
        return res.status(403).json({
            success: false,
            message: '禁止访问'
        });
    }

    if (err.name === 'NotFoundError') {
        return res.status(404).json({
            success: false,
            message: '资源未找到'
        });
    }

    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            message: '数据已存在'
        });
    }

    if (err.code && err.code.startsWith('ER_')) {
        return res.status(500).json({
            success: false,
            message: isProduction ? '数据库操作失败' : err.message
        });
    }

    const statusCode = err.statusCode || err.status || 500;
    const safeMessages = [
        '服务器内部错误',
        '请求超时',
        '服务暂时不可用',
        '请求过于频繁'
    ];
    
    const message = isProduction && !safeMessages.includes(err.message)
        ? '服务器内部错误'
        : err.message;

    res.status(statusCode).json({
        success: false,
        message: message,
        ...(isProduction ? {} : { stack: err.stack })
    });
};

// 自定义错误类
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, errors) {
        super(message, 400);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

class UnauthorizedError extends AppError {
    constructor(message) {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}

class ForbiddenError extends AppError {
    constructor(message) {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}

module.exports = errorHandler;
module.exports.AppError = AppError;
module.exports.ValidationError = ValidationError;
module.exports.NotFoundError = NotFoundError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
