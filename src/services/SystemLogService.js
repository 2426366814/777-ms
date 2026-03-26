const db = require('../utils/database');
const logger = require('../utils/logger');
const { DB_FIELDS } = require('../config/constants');

/**
 * System Log Service - 系统日志服务
 * @class SystemLogService
 * @description 提供系统日志的写入、查询和清理功能
 */
class SystemLogService {
    /**
     * 写入系统日志
     * @async
     * @param {'info'|'warn'|'error'} level - 日志级别
     * @param {string} category - 日志分类（如 'auth', 'api', 'database'）
     * @param {string} message - 日志消息
     * @param {Object} [details={}] - 详细信息对象
     * @returns {Promise<void>}
     */
    async log(level, category, message, details = {}) {
        try {
            await db.query(
                `INSERT INTO system_logs (level, category, message, details, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [level, category, message, JSON.stringify(details)]
            );
        } catch (error) {
            logger.error('Failed to write system log:', error.message);
        }
    }

    /**
     * 记录信息级别日志
     * @async
     * @param {string} category - 日志分类
     * @param {string} message - 日志消息
     * @param {Object} [details={}] - 详细信息
     * @returns {Promise<void>}
     */
    async info(category, message, details = {}) {
        return this.log('info', category, message, details);
    }

    /**
     * 记录警告级别日志
     * @async
     * @param {string} category - 日志分类
     * @param {string} message - 日志消息
     * @param {Object} [details={}] - 详细信息
     * @returns {Promise<void>}
     */
    async warn(category, message, details = {}) {
        return this.log('warn', category, message, details);
    }

    /**
     * 记录错误级别日志
     * @async
     * @param {string} category - 日志分类
     * @param {string} message - 日志消息
     * @param {Object} [details={}] - 详细信息
     * @returns {Promise<void>}
     */
    async error(category, message, details = {}) {
        return this.log('error', category, message, details);
    }

    /**
     * 获取日志列表
     * @async
     * @param {Object} [options={}] - 查询选项
     * @param {'info'|'warn'|'error'} [options.level] - 按级别筛选
     * @param {string} [options.category] - 按分类筛选
     * @param {number} [options.limit=100] - 返回数量限制
     * @param {number} [options.offset=0] - 偏移量
     * @returns {Promise<Array<Object>>} 日志记录数组
     */
    async getLogs(options = {}) {
        const { level, category, limit = 100, offset = 0 } = options;
        
        const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 100));
        const safeOffset = Math.max(0, parseInt(offset) || 0);
        
        let sql = `SELECT ${DB_FIELDS.SYSTEM_LOGS.FULL} FROM system_logs WHERE 1=1`;
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
        params.push(safeLimit, safeOffset);

        return await db.query(sql, params);
    }

    /**
     * 清理旧日志
     * @async
     * @param {number} [daysToKeep=30] - 保留天数
     * @returns {Promise<number>} 删除的记录数
     */
    async cleanOldLogs(daysToKeep = 30) {
        const safeDays = Math.max(1, Math.min(365, parseInt(daysToKeep) || 30));
        const result = await db.query(
            'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [safeDays]
        );
        return result.affectedRows || 0;
    }
}

module.exports = new SystemLogService();
