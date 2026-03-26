/**
 * 公共知识库服务
 * 管理全局共享知识
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/database');
const logger = require('../utils/logger');
const { DB_FIELDS, safeParseInt } = require('../config/constants');
const { safeJsonParse } = require('../utils/safeJson');

class PublicKnowledgeService {
    static async create(data, adminId) {
        const id = uuidv4();
        const { title, content, category, tags, source, metadata, priority = 0 } = data;
        
        const sql = `
            INSERT INTO public_knowledge 
            (id, title, content, category, tags, source, metadata, priority, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        await db.query(sql, [
            id, title, content, category,
            JSON.stringify(tags || []),
            source || null,
            JSON.stringify(metadata || {}),
            priority,
            adminId
        ]);
        
        logger.info(`创建公共知识: ${id}`, { adminId, category });
        
        return { id, title, content, category, tags, priority };
    }
    
    static async update(id, data, adminId) {
        const fields = [];
        const values = [];
        
        const allowedFields = ['title', 'content', 'category', 'tags', 'source', 'metadata', 'priority', 'is_active'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                if (key === 'tags' || key === 'metadata') {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        }
        
        if (fields.length === 0) {
            return false;
        }
        
        fields.push('updated_at = NOW()');
        values.push(id);
        
        const sql = `UPDATE public_knowledge SET ${fields.join(', ')} WHERE id = ?`;
        await db.query(sql, values);
        
        logger.info(`更新公共知识: ${id}`, { adminId, fields: Object.keys(data) });
        
        return true;
    }
    
    static async delete(id, adminId) {
        await db.query('DELETE FROM public_knowledge WHERE id = ?', [id]);
        logger.info(`删除公共知识: ${id}`, { adminId });
        return true;
    }
    
    static async getById(id, incrementView = false) {
        const sql = `SELECT ${DB_FIELDS.PUBLIC_KNOWLEDGE.FULL} FROM public_knowledge WHERE id = ? AND is_active = TRUE`;
        const results = await db.query(sql, [id]);
        
        if (results.length === 0) {
            return null;
        }
        
        if (incrementView) {
            await db.query('UPDATE public_knowledge SET view_count = view_count + 1 WHERE id = ?', [id]);
        }
        
        const knowledge = results[0];
        return {
            ...knowledge,
            tags: safeJsonParse(knowledge.tags, [], 'PublicKnowledgeService.js:getById'),
            metadata: safeJsonParse(knowledge.metadata, {}, 'PublicKnowledgeService.js:getById')
        };
    }
    
    static async list(options = {}) {
        const { page = 1, limit = 20, category, search, sortBy = 'priority', sortOrder = 'DESC' } = options;
        const safeLimit = safeParseInt(limit, 20, 1, 100);
        const safePage = safeParseInt(page, 1, 1, 10000);
        const offset = (safePage - 1) * safeLimit;
        
        let sql = `SELECT ${DB_FIELDS.PUBLIC_KNOWLEDGE.LIST} FROM public_knowledge WHERE is_active = TRUE`;
        const params = [];
        
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        
        if (search) {
            sql += ' AND (title LIKE ? OR content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        const allowedSort = ['priority', 'created_at', 'view_count', 'title'];
        const safeSort = allowedSort.includes(sortBy) ? sortBy : 'priority';
        const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
        sql += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
        params.push(safeLimit, offset);
        
        const results = await db.query(sql, params);
        
        const countSql = 'SELECT COUNT(*) as total FROM public_knowledge WHERE is_active = TRUE' +
            (category ? ' AND category = ?' : '') +
            (search ? ' AND (title LIKE ? OR content LIKE ?)' : '');
        
        const countParams = [];
        if (category) countParams.push(category);
        if (search) countParams.push(`%${search}%`, `%${search}%`);
        
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0]?.total || 0;
        
        return {
            items: results.map(item => ({
                ...item,
                tags: safeJsonParse(item.tags, [], 'PublicKnowledgeService.js:list')
            })),
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit)
            }
        };
    }
    
    static async getCategories() {
        const sql = `
            SELECT category, COUNT(*) as count 
            FROM public_knowledge 
            WHERE is_active = TRUE 
            GROUP BY category 
            ORDER BY count DESC
        `;
        return db.query(sql);
    }
    
    static async searchForContext(query, limit = 5) {
        const safeLimit = safeParseInt(limit, 5, 1, 20);
        const sql = `
            SELECT ${DB_FIELDS.PUBLIC_KNOWLEDGE.SEARCH}
            FROM public_knowledge 
            WHERE is_active = TRUE 
            AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
            ORDER BY priority DESC, view_count DESC
            LIMIT ?
        `;
        
        const searchPattern = `%${query}%`;
        const results = await db.query(sql, [searchPattern, searchPattern, searchPattern, safeLimit]);
        
        return results.map(item => ({
            ...item,
            tags: safeJsonParse(item.tags, [], 'PublicKnowledgeService.js:searchForContext'),
            source: 'public_knowledge'
        }));
    }
    
    static async batchImport(items, adminId) {
        const results = { success: 0, failed: 0, errors: [] };
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();
            
            for (const item of items) {
                try {
                    const id = uuidv4();
                    const { title, content, category, tags, source, metadata, priority = 0 } = item;
                    
                    await connection.execute(
                        `INSERT INTO public_knowledge 
                        (id, title, content, category, tags, source, metadata, priority, created_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                        [id, title, content, category, JSON.stringify(tags || []), source || null, JSON.stringify(metadata || {}), priority, adminId]
                    );
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({ title: item.title, error: error.message });
                }
            }
            
            await connection.commit();
            logger.info(`批量导入公共知识: 成功 ${results.success}, 失败 ${results.failed}`, { adminId });
        } catch (error) {
            await connection.rollback();
            logger.error('批量导入公共知识失败，已回滚:', error);
            throw error;
        } finally {
            connection.release();
        }
        
        return results;
    }
    
    static async getStats() {
        const sql = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active,
                SUM(view_count) as total_views,
                COUNT(DISTINCT category) as categories
            FROM public_knowledge
        `;
        
        const result = await db.query(sql);
        return result[0];
    }
    
    static async listAll(options = {}) {
        const { page = 1, limit = 20, category, search, sortBy = 'created_at', sortOrder = 'DESC' } = options;
        const safeLimit = safeParseInt(limit, 20, 1, 100);
        const safePage = safeParseInt(page, 1, 1, 10000);
        const offset = (safePage - 1) * safeLimit;
        
        let sql = `SELECT ${DB_FIELDS.PUBLIC_KNOWLEDGE.FULL} FROM public_knowledge WHERE 1=1`;
        const params = [];
        
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        
        if (search) {
            sql += ' AND (title LIKE ? OR content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        const allowedSort = ['priority', 'created_at', 'view_count', 'title'];
        const safeSort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
        const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
        sql += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
        params.push(safeLimit, offset);
        
        const results = await db.query(sql, params);
        
        const countSql = 'SELECT COUNT(*) as total FROM public_knowledge WHERE 1=1' +
            (category ? ' AND category = ?' : '') +
            (search ? ' AND (title LIKE ? OR content LIKE ?)' : '');
        
        const countParams = [];
        if (category) countParams.push(category);
        if (search) countParams.push(`%${search}%`, `%${search}%`);
        
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0]?.total || 0;
        
        return {
            items: results.map(item => ({
                ...item,
                tags: safeJsonParse(item.tags, [], 'PublicKnowledgeService.js:adminList'),
                metadata: safeJsonParse(item.metadata, {}, 'PublicKnowledgeService.js:adminList')
            })),
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit)
            }
        };
    }
}

module.exports = PublicKnowledgeService;
