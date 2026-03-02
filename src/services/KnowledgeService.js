/**
 * Knowledge Service
 * Handles knowledge base operations including auto-loading for context
 */

const db = require('../utils/database');
const logger = require('../utils/logger');

class KnowledgeService {
    constructor() {
        this.defaultLimit = 10;
        this.maxContextLength = 3000;
    }

    async createKnowledge(userId, data) {
        const { title, content, category = 'general', tags = [] } = data;
        
        const result = await db.query(
            `INSERT INTO knowledge (user_id, title, content, category, tags, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [userId, title, content, category, tags.join(',')]
        );
        
        const knowledgeId = result.insertId;
        
        logger.info(`Created knowledge ${knowledgeId} for user ${userId}`);
        return { id: knowledgeId, title, content, category, tags };
    }

    async getKnowledge(userId, options = {}) {
        const { page = 1, limit = 20, category, search } = options;
        const offset = (page - 1) * limit;
        
        let sql = `SELECT * FROM knowledge WHERE user_id = ?`;
        const params = [userId];
        
        if (category) {
            sql += ` AND category = ?`;
            params.push(category);
        }
        
        if (search) {
            sql += ` AND (title LIKE ? OR content LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        
        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const knowledge = await db.query(sql, params);
        
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM knowledge WHERE user_id = ?`,
            [userId]
        );
        
        return {
            knowledge: knowledge.map(k => ({
                ...k,
                tags: k.tags ? k.tags.split(',') : []
            })),
            pagination: {
                page,
                limit,
                total: countResult[0]?.total || 0,
                totalPages: Math.ceil((countResult[0]?.total || 0) / limit)
            }
        };
    }

    async searchKnowledge(userId, query, limit = 5) {
        try {
            const knowledge = await db.query(
                `SELECT id, title, content, category, tags,
                        MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
                 FROM knowledge 
                 WHERE user_id = ? 
                 AND MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
                 ORDER BY relevance DESC
                 LIMIT ?`,
                [query, userId, query, limit]
            );
            
            return knowledge.map(k => ({
                id: k.id,
                title: k.title,
                content: k.content,
                category: k.category,
                tags: k.tags ? k.tags.split(',') : [],
                relevance: k.relevance
            }));
        } catch (error) {
            logger.warn('Full-text search failed, falling back to LIKE search:', error.message);
            
            const knowledge = await db.query(
                `SELECT id, title, content, category, tags
                 FROM knowledge 
                 WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [userId, `%${query}%`, `%${query}%`, limit]
            );
            
            return knowledge.map(k => ({
                id: k.id,
                title: k.title,
                content: k.content,
                category: k.category,
                tags: k.tags ? k.tags.split(',') : [],
                relevance: 0.5
            }));
        }
    }

    async getRecentKnowledge(userId, limit = 10) {
        const knowledge = await db.query(
            `SELECT id, title, content, category, tags
             FROM knowledge 
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [userId, limit]
        );
        
        return knowledge.map(k => ({
            id: k.id,
            title: k.title,
            content: k.content,
            category: k.category,
            tags: k.tags ? k.tags.split(',') : []
        }));
    }

    buildKnowledgeContext(knowledge, maxLength = this.maxContextLength) {
        if (!knowledge || knowledge.length === 0) {
            return '';
        }
        
        let context = '[相关知识库内容]\n';
        let currentLength = context.length;
        
        for (const item of knowledge) {
            const itemText = `- [${item.category || 'general'}] ${item.title}: ${item.content?.substring(0, 300)}...\n`;
            
            if (currentLength + itemText.length > maxLength) {
                break;
            }
            
            context += itemText;
            currentLength += itemText.length;
        }
        
        context += '[/相关知识库内容]\n';
        return context;
    }

    async buildContextForQuery(userId, query, limit = 5) {
        const relevantKnowledge = await this.searchKnowledge(userId, query, limit);
        return this.buildKnowledgeContext(relevantKnowledge);
    }

    async deleteKnowledge(userId, knowledgeId) {
        const result = await db.query(
            `DELETE FROM knowledge WHERE id = ? AND user_id = ?`,
            [knowledgeId, userId]
        );
        return result.affectedRows > 0;
    }

    async getKnowledgeStats(userId) {
        const stats = await db.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT category) as categories
             FROM knowledge WHERE user_id = ?`,
            [userId]
        );
        
        return {
            total: stats[0]?.total || 0,
            categories: stats[0]?.categories || 0
        };
    }

    async autoConvert(userId, content, type = 'text') {
        const title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        
        const knowledge = await this.createKnowledge(userId, {
            title,
            content,
            category: 'auto-converted',
            tags: ['auto', type]
        });
        
        logger.info(`Auto-converted content to knowledge ${knowledge.id} for user ${userId}`);
        return knowledge;
    }
}

const knowledgeService = new KnowledgeService();
module.exports = knowledgeService;
