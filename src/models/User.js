/**
 * 用户模型
 * 处理用户相关的数据库操作
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../utils/database');
const logger = require('../utils/logger');

class User {
    /**
     * 根据用户名查找用户
     * @param {string} username - 用户名
     * @returns {Promise<Object|null>} 用户信息或null
     */
    static async findByUsername(username) {
        try {
            const sql = 'SELECT * FROM users WHERE username = ?';
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
            const sql = 'SELECT id, username, email, password, role, status, created_at, updated_at FROM users WHERE id = ?';
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
            const hashedPassword = await bcrypt.hash(password, 10);
            
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
            const hashedPassword = await bcrypt.hash(newPassword, 10);
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
            const sql = `
                INSERT INTO user_api_keys (id, user_id, api_key, created_at, expires_at)
                VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))
            `;
            const id = uuidv4();
            await db.query(sql, [id, userId, apiKey]);
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
            const sql = `
                SELECT u.* FROM users u
                JOIN user_api_keys k ON u.id = k.user_id
                WHERE k.api_key = ? AND k.expires_at > NOW()
            `;
            const results = await db.query(sql, [apiKey]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            logger.error('查找API Key失败:', error.message);
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
            const checkSql = 'SELECT id FROM user_api_keys WHERE user_id = ?';
            const existing = await db.query(checkSql, [userId]);
            
            if (existing.length > 0) {
                const updateSql = 'UPDATE user_api_keys SET api_key = ?, created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 1 YEAR) WHERE user_id = ?';
                await db.query(updateSql, [apiKey, userId]);
            } else {
                const insertSql = `
                    INSERT INTO user_api_keys (id, user_id, api_key, created_at, expires_at)
                    VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))
                `;
                const id = uuidv4();
                await db.query(insertSql, [id, userId, apiKey]);
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
