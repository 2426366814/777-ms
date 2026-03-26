/**
 * 用户模型
 * 处理用户相关的数据库操作
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../utils/database');
const logger = require('../utils/logger');
const { DB_FIELDS, CONFIG } = require('../config/constants');

const hashApiKey = (apiKey) => {
    return crypto.createHash(CONFIG.HASH.ALGORITHM).update(apiKey).digest('hex');
};

const USER_SAFE_FIELDS = DB_FIELDS.USERS.SAFE;
const USER_AUTH_FIELDS = DB_FIELDS.USERS.AUTH;

class User {
    static async findByUsername(username) {
        try {
            const sql = `SELECT ${USER_AUTH_FIELDS} FROM users WHERE username = ?`;
            const results = await db.query(sql, [username]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            logger.error('查找用户失败:', error.message);
            throw error;
        }
    }

    /**
     * 根据ID查找用户
     * @param {string} id - 用户ID
     * @returns {Promise<Object|null>} 用户信息或null
     */
    static async findById(id) {
        try {
            const sql = `SELECT ${USER_AUTH_FIELDS} FROM users WHERE id = ?`;
            const results = await db.query(sql, [id]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            logger.error('查找用户失败:', error.message);
            throw error;
        }
    }

    /**
     * 创建新用户
     * @param {Object} userData - 用户数据
     * @returns {Promise<Object>} 创建的用户信息
     */
    static async create(userData) {
        try {
            const { username, password, email, role = 'user' } = userData;
            
            // 检查用户名是否已存在
            const existingUser = await this.findByUsername(username);
            if (existingUser) {
                throw new Error('用户名已存在');
            }

            // 加密密码
            const hashedPassword = await bcrypt.hash(password, CONFIG.BCRYPT.SALT_ROUNDS);
            
            // 生成用户ID
            const id = uuidv4();
            
            const sql = `
                INSERT INTO users (id, username, password, email, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())
            `;
            
            await db.query(sql, [id, username, hashedPassword, email, role]);
            
            logger.info(`用户创建成功: ${username}`);
            
            // 返回用户信息（不包含密码）
            return {
                id,
                username,
                email,
                role,
                status: 'active'
            };
        } catch (error) {
            logger.error('创建用户失败:', error.message);
            throw error;
        }
    }

    /**
     * 验证用户密码
     * @param {string} password - 明文密码
     * @param {string} hashedPassword - 加密后的密码
     * @returns {Promise<boolean>} 验证结果
     */
    static async verifyPassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }

    /**
     * 更新用户信息
     * @param {string} id - 用户ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise<boolean>} 更新结果
     */
    static async update(id, updateData) {
        try {
            const allowedFields = ['email', 'role', 'status'];
            const updates = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (updates.length === 0) {
                return false;
            }

            values.push(id);
            const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
            
            const result = await db.query(sql, values);
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('更新用户失败:', error.message);
            throw error;
        }
    }

    /**
     * 更新用户密码
     * @param {string} id - 用户ID
     * @param {string} newPassword - 新密码
     * @returns {Promise<boolean>} 更新结果
     */
    static async updatePassword(id, newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, CONFIG.BCRYPT.SALT_ROUNDS);
            const sql = 'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?';
            const result = await db.query(sql, [hashedPassword, id]);
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('更新密码失败:', error.message);
            throw error;
        }
    }

    /**
     * 保存API Key
     * @param {string} userId - 用户ID
     * @param {string} apiKey - API Key
     * @returns {Promise<boolean>} 保存结果
     */
    static async saveApiKey(userId, apiKey) {
        try {
            const hashedKey = hashApiKey(apiKey);
            const sql = `
                INSERT INTO user_api_keys (id, user_id, api_key_hash, is_active, created_at, expires_at)
                VALUES (?, ?, ?, 1, NOW(), DATE_ADD(NOW(), INTERVAL ${CONFIG.API_KEY.EXPIRES_INTERVAL}))
            `;
            const id = uuidv4();
            await db.query(sql, [id, userId, hashedKey]);
            return true;
        } catch (error) {
            logger.error('保存API Key失败:', error.message);
            throw error;
        }
    }

    /**
     * 根据API Key查找用户
     * @param {string} apiKey - API Key
     * @returns {Promise<Object|null>} 用户信息或null
     */
    static async findByApiKey(apiKey) {
        try {
            const hashedKey = hashApiKey(apiKey);
            const sql = `
                SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, u.updated_at
                FROM users u
                JOIN user_api_keys k ON u.id = k.user_id
                WHERE k.api_key_hash = ? AND k.is_active = 1 AND (k.expires_at IS NULL OR k.expires_at > NOW())
            `;
            const results = await db.query(sql, [hashedKey]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            logger.error('查找API Key失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取用户的 API Key 信息（包含活跃和非活跃状态）
     * @param {string} userId - 用户ID
     * @returns {Promise<Object|null>} API Key 信息或null
     */
    static async getApiKeyInfo(userId) {
        try {
            const sql = `
                SELECT ${DB_FIELDS.USER_API_KEYS.AUTH}
                FROM user_api_keys 
                WHERE user_id = ?
                ORDER BY is_active DESC, created_at DESC 
                LIMIT 1
            `;
            const results = await db.query(sql, [userId]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            logger.error('获取API Key信息失败:', error.message);
            throw error;
        }
    }

    /**
     * 创建新的 API Key（支持多个）
     * @param {string} userId - 用户ID
     * @param {string} apiKey - API Key
     * @param {string} name - API Key 名称（可选）
     * @returns {Promise<Object>} 创建结果
     */
    static async createApiKey(userId, apiKey, name = null) {
        try {
            const hashedKey = hashApiKey(apiKey);
            const id = uuidv4();
            const keyName = name || `API Key ${new Date().toLocaleDateString('zh-CN')}`;
            const keyPrefix = apiKey.substring(0, 8);
            
            const sql = `
                INSERT INTO user_api_keys (id, user_id, api_key, api_key_hash, name, is_active, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, 1, NOW(), DATE_ADD(NOW(), INTERVAL ${CONFIG.API_KEY.EXPIRES_INTERVAL}))
            `;
            await db.query(sql, [id, userId, keyPrefix, hashedKey, keyName]);
            
            logger.info(`用户创建新 API Key: ${userId}, 名称: ${keyName}`);
            
            return {
                id,
                name: keyName,
                apiKey,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('创建API Key失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取用户的所有 API Keys
     * @param {string} userId - 用户ID
     * @returns {Promise<Array>} API Key 列表
     */
    static async getAllApiKeys(userId) {
        try {
            const sql = `
                SELECT ${DB_FIELDS.USER_API_KEYS.LIST}
                FROM user_api_keys 
                WHERE user_id = ?
                ORDER BY is_active DESC, created_at DESC
            `;
            return await db.query(sql, [userId]);
        } catch (error) {
            logger.error('获取所有API Keys失败:', error.message);
            throw error;
        }
    }

    /**
     * 删除指定的 API Key
     * @param {string} userId - 用户ID
     * @param {string} keyId - API Key ID
     * @returns {Promise<boolean>} 删除结果
     */
    static async deleteApiKeyById(userId, keyId) {
        try {
            const sql = 'UPDATE user_api_keys SET is_active = 0, updated_at = NOW() WHERE id = ? AND user_id = ?';
            const result = await db.query(sql, [keyId, userId]);
            logger.info(`API Key 删除操作，用户: ${userId}, Key ID: ${keyId}, 影响行数: ${result.affectedRows}`);
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('删除API Key失败:', error.message);
            throw error;
        }
    }

    /**
     * 彻底删除指定的 API Key（硬删除）
     * @param {string} userId - 用户ID
     * @param {string} keyId - API Key ID
     * @returns {Promise<boolean>} 删除结果
     */
    static async hardDeleteApiKey(userId, keyId) {
        try {
            const sql = 'DELETE FROM user_api_keys WHERE id = ? AND user_id = ?';
            const result = await db.query(sql, [keyId, userId]);
            logger.info(`API Key 硬删除操作，用户: ${userId}, Key ID: ${keyId}, 影响行数: ${result.affectedRows}`);
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('硬删除API Key失败:', error.message);
            throw error;
        }
    }

    /**
     * 更新用户资料
     * @param {string} id - 用户ID
     * @param {Object} profileData - 资料数据
     * @returns {Promise<boolean>} 更新结果
     */
    static async updateProfile(id, profileData) {
        try {
            const { username, email } = profileData;
            const updates = [];
            const values = [];

            if (username) {
                const existingUser = await this.findByUsername(username);
                if (existingUser && existingUser.id !== id) {
                    throw new Error('用户名已被使用');
                }
                updates.push('username = ?');
                values.push(username);
            }

            if (email) {
                updates.push('email = ?');
                values.push(email);
            }

            if (updates.length === 0) {
                return false;
            }

            values.push(id);
            const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
            const result = await db.query(sql, values);
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('更新用户资料失败:', error.message);
            throw error;
        }
    }

    /**
     * 更新用户的 API Key
     * @param {string} userId - 用户ID
     * @param {string} apiKey - 新的 API Key
     * @returns {Promise<boolean>} 更新结果
     */
    static async updateApiKey(userId, apiKey) {
        try {
            const hashedKey = hashApiKey(apiKey);
            
            const checkSql = 'SELECT id FROM user_api_keys WHERE user_id = ?';
            const existing = await db.query(checkSql, [userId]);
            
            if (existing.length > 0) {
                const updateSql = `UPDATE user_api_keys SET api_key_hash = ?, is_active = 1, created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL ${CONFIG.API_KEY.EXPIRES_INTERVAL}) WHERE user_id = ?`;
                await db.query(updateSql, [hashedKey, userId]);
            } else {
                const insertSql = `
                    INSERT INTO user_api_keys (id, user_id, api_key_hash, is_active, created_at, expires_at)
                    VALUES (?, ?, ?, 1, NOW(), DATE_ADD(NOW(), INTERVAL ${CONFIG.API_KEY.EXPIRES_INTERVAL}))
                `;
                const id = uuidv4();
                await db.query(insertSql, [id, userId, hashedKey]);
            }
            
            return true;
        } catch (error) {
            logger.error('更新API Key失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取所有用户列表
     * @param {Object} options - 查询选项
     * @returns {Promise<Array>} 用户列表
     */
    static async findAll(options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const sql = `
                SELECT id, username, email, role, status, created_at, updated_at 
                FROM users 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `;
            return await db.query(sql, [limit, offset]);
        } catch (error) {
            logger.error('获取用户列表失败:', error.message);
            throw error;
        }
    }

    /**
     * 统计用户总数
     * @returns {Promise<number>} 用户总数
     */
    static async count() {
        try {
            const sql = 'SELECT COUNT(*) as count FROM users';
            const result = await db.query(sql);
            return result[0].count;
        } catch (error) {
            logger.error('统计用户失败:', error.message);
            throw error;
        }
    }
}

module.exports = User;
