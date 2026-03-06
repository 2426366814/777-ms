/**
 * Security Utilities
 * XSS防护、输入验证、安全工具函数
 */

const XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:\s*text\/html/gi,
    /vbscript:/gi,
    /expression\s*\(/gi
];

const SQL_INJECTION_PATTERNS = [
    /('\s*(OR|AND)\s*['"]?\d*['"]?\s*[=<>])/gi,
    /("\s*(OR|AND)\s*['"]?\d*['"]?\s*[=<>])/gi,
    /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s+\d+\s*=\s*\d+)/gi,
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/gi,
    /(--\s*$)/gm,
    /(\/\*[\s\S]*?\*\/)/g,
    /(\bUNION\b\s+\bALL\b|\bUNION\b\s+\bSELECT\b)/gi,
    /(\bWAITFOR\b\s+\bDELAY\b)/gi,
    /(\bBENCHMARK\b\s*\()/gi,
    /(\bSLEEP\b\s*\()/gi,
    /(;\s*--)/gi,
    /(\bXP_\w+)/gi,
    /(\bSP_\w+)/gi,
    /('\s*;)/gi,
    /('\s*--)/gi
];

const HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

function escapeHtml(text) {
    if (typeof text !== 'string') {
        return text;
    }
    return text.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char]);
}

function escapeHtmlAttribute(text) {
    if (typeof text !== 'string') {
        return text;
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function stripHtmlTags(text) {
    if (typeof text !== 'string') {
        return text;
    }
    return text.replace(/<[^>]*>/g, '');
}

function sanitizeHtml(text, options = {}) {
    if (typeof text !== 'string') {
        return text;
    }
    
    const {
        allowBasicFormatting = false,
        maxLength = 100000
    } = options;
    
    if (text.length > maxLength) {
        text = text.substring(0, maxLength);
    }
    
    if (allowBasicFormatting) {
        const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'span'];
        let result = text;
        
        XSS_PATTERNS.forEach(pattern => {
            result = result.replace(pattern, '');
        });
        
        result = result.replace(/<(?!(\/?(?:b|i|u|strong|em|br|p|span)\s*>))/gi, '&lt;');
        
        return result;
    }
    
    return escapeHtml(text);
}

function detectXSS(text) {
    if (typeof text !== 'string') {
        return { isXSS: false, patterns: [] };
    }
    
    const detectedPatterns = [];
    
    XSS_PATTERNS.forEach(pattern => {
        if (pattern.test(text)) {
            detectedPatterns.push(pattern.toString());
        }
    });
    
    return {
        isXSS: detectedPatterns.length > 0,
        patterns: detectedPatterns
    };
}

function detectSQLInjection(text) {
    if (typeof text !== 'string') {
        return { isSQLInjection: false, patterns: [] };
    }
    
    const detectedPatterns = [];
    
    for (const pattern of SQL_INJECTION_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        regex.lastIndex = 0;
        if (regex.test(text)) {
            detectedPatterns.push(pattern.toString());
        }
    }
    
    return {
        isSQLInjection: detectedPatterns.length > 0,
        patterns: detectedPatterns
    };
}

function sanitizeSearchQuery(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    const sqlCheck = detectSQLInjection(text);
    if (sqlCheck.isSQLInjection) {
        return '';
    }
    
    return text
        .replace(/[<>\"\'\\]/g, '')
        .replace(/[\x00-\x1f\x7f]/g, '')
        .substring(0, 500);
}

function sanitizeObject(obj, options = {}) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'string') {
        return sanitizeHtml(obj, options);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, options));
    }
    
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = escapeHtml(key);
            sanitized[sanitizedKey] = sanitizeObject(value, options);
        }
        return sanitized;
    }
    
    return obj;
}

function sanitizeInput(req, res, next) {
    try {
        if (req.body) {
            req.body = sanitizeObject(req.body);
        }
        if (req.query) {
            req.query = sanitizeObject(req.query);
        }
        if (req.params) {
            req.params = sanitizeObject(req.params);
        }
        next();
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Invalid input detected'
        });
    }
}

function validateInput(rules) {
    return (req, res, next) => {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = req.body[field] || req.query[field] || req.params[field];
            
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(`Field '${field}' is required`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rule.type && typeof value !== rule.type) {
                    errors.push(`Field '${field}' must be of type ${rule.type}`);
                }
                
                if (rule.minLength && value.length < rule.minLength) {
                    errors.push(`Field '${field}' must be at least ${rule.minLength} characters`);
                }
                
                if (rule.maxLength && value.length > rule.maxLength) {
                    errors.push(`Field '${field}' must be at most ${rule.maxLength} characters`);
                }
                
                if (rule.pattern && !rule.pattern.test(value)) {
                    errors.push(`Field '${field}' has invalid format`);
                }
                
                if (rule.enum && !rule.enum.includes(value)) {
                    errors.push(`Field '${field}' must be one of: ${rule.enum.join(', ')}`);
                }
                
                if (rule.custom) {
                    const customError = rule.custom(value);
                    if (customError) {
                        errors.push(customError);
                    }
                }
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }
        
        next();
    };
}

function generateSecureToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    
    for (let i = 0; i < length; i++) {
        const randomIndex = randomValues[i] % chars.length;
        result += chars[randomIndex];
    }
    
    return result;
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

module.exports = {
    escapeHtml,
    escapeHtmlAttribute,
    stripHtmlTags,
    sanitizeHtml,
    detectXSS,
    detectSQLInjection,
    sanitizeSearchQuery,
    sanitizeObject,
    sanitizeInput,
    validateInput,
    generateSecureToken,
    hashString,
    XSS_PATTERNS,
    SQL_INJECTION_PATTERNS,
    HTML_ENTITIES
};
