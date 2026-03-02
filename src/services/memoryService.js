/**
 * Memory Service
 * Handles memory operations including auto-loading relevant memories for context
 */

const db = require('../utils/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class MemoryService {
    constructor() {
        this.defaultLimit = 10;
        this.maxContextLength = 4000;
    }

    async createMemory(userId, data) {
        const { content, category = 'general', tags = [], importance = 5, metadata = {} } = data;
        const memoryId = uuidv4();
        
        const result = await db.query(
            `INSERT INTO memories (id, user_id, content, category, importance, metadata, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [memoryId, userId, content, category, importance, JSON.stringify(metadata)]
        );
        
        if (tags.length > 0) {
            await this.addTags(memoryId, tags);
        }
        
        logger.info(`Created memory ${memoryId} for user ${userId}`);
        return { id: memoryId, content, category, importance, tags };
    }

    async addTags(memoryId, tags) {
        for (const tag of tags) {
            await db.query(
                `INSERT IGNORE INTO memory_tags (memory_id, tag_name) VALUES (?, ?)`,
                [memoryId, tag]
            );
        }
    }

    async getMemories(userId, options = {}) {
        const { page = 1, limit = 20, category, tag, search, sortBy = 'created_at', sortOrder = 'DESC' } = options;
        const offset = (page - 1) * limit;
        
        let sql = `SELECT m.*, GROUP_CONCAT(DISTINCT mt.tag_name) as tags 
                   FROM memories m 
                   LEFT JOIN memory_tags mt ON m.id = mt.memory_id 
                   WHERE m.user_id = ?`;
        const params = [userId];
        
        if (category) {
            sql += ` AND m.category = ?`;
            params.push(category);
        }
        
        if (tag) {
            sql += ` AND EXISTS (SELECT 1 FROM memory_tags WHERE memory_id = m.id AND tag_name = ?)`;
            params.push(tag);
        }
        
        if (search) {
            sql += ` AND MATCH(m.content) AGAINST(? IN BOOLEAN MODE)`;
            params.push(search);
        }
        
        sql += ` GROUP BY m.id`;
        
        const validSortFields = ['created_at', 'updated_at', 'importance', 'access_count'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        sql += ` ORDER BY m.${sortField} ${order}`;
        
        sql += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const memories = await db.query(sql, params);
        
        const countResult = await db.query(
            `SELECT COUNT(DISTINCT m.id) as total FROM memories m WHERE m.user_id = ?`,
            [userId]
        );
        
        return {
            memories: memories.map(m => ({
                ...m,
                tags: m.tags ? m.tags.split(',') : [],
                metadata: m.metadata ? JSON.parse(m.metadata) : {}
            })),
            pagination: {
                page,
                limit,
                total: countResult[0]?.total || 0,
                totalPages: Math.ceil((countResult[0]?.total || 0) / limit)
            }
        };
    }

    async searchRelevantMemories(userId, query, limit = 5) {
        try {
            const memories = await db.query(
                `SELECT m.id, m.content, m.category, m.importance, 
                        GROUP_CONCAT(DISTINCT mt.tag_name) as tags,
                        MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
                 FROM memories m 
                 LEFT JOIN memory_tags mt ON m.id = mt.memory_id 
                 WHERE m.user_id = ? 
                 AND MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE)
                 GROUP BY m.id
                 ORDER BY relevance DESC, m.importance DESC
                 LIMIT ?`,
                [query, userId, query, limit]
            );
            
            return memories.map(m => ({
                id: m.id,
                content: m.content,
                category: m.category,
                importance: m.importance,
                tags: m.tags ? m.tags.split(',') : [],
                relevance: m.relevance
            }));
        } catch (error) {
            logger.warn('Full-text search failed, falling back to LIKE search:', error.message);
            
            const memories = await db.query(
                `SELECT m.id, m.content, m.category, m.importance,
                        GROUP_CONCAT(DISTINCT mt.tag_name) as tags
                 FROM memories m 
                 LEFT JOIN memory_tags mt ON m.id = mt.memory_id 
                 WHERE m.user_id = ? AND m.content LIKE ?
                 GROUP BY m.id
                 ORDER BY m.importance DESC
                 LIMIT ?`,
                [userId, `%${query}%`, limit]
            );
            
            return memories.map(m => ({
                id: m.id,
                content: m.content,
                category: m.category,
                importance: m.importance,
                tags: m.tags ? m.tags.split(',') : [],
                relevance: 0.5
            }));
        }
    }

    async getRecentMemories(userId, limit = 10) {
        const memories = await db.query(
            `SELECT m.id, m.content, m.category, m.importance,
                    GROUP_CONCAT(DISTINCT mt.tag_name) as tags
             FROM memories m 
             LEFT JOIN memory_tags mt ON m.id = mt.memory_id 
             WHERE m.user_id = ?
             GROUP BY m.id
             ORDER BY m.created_at DESC
             LIMIT ?`,
            [userId, limit]
        );
        
        return memories.map(m => ({
            id: m.id,
            content: m.content,
            category: m.category,
            importance: m.importance,
            tags: m.tags ? m.tags.split(',') : []
        }));
    }

    async getImportantMemories(userId, limit = 10) {
        const memories = await db.query(
            `SELECT m.id, m.content, m.category, m.importance,
                    GROUP_CONCAT(DISTINCT mt.tag_name) as tags
             FROM memories m 
             LEFT JOIN memory_tags mt ON m.id = mt.memory_id 
             WHERE m.user_id = ?
             GROUP BY m.id
             ORDER BY m.importance DESC, m.created_at DESC
             LIMIT ?`,
            [userId, limit]
        );
        
        return memories.map(m => ({
            id: m.id,
            content: m.content,
            category: m.category,
            importance: m.importance,
            tags: m.tags ? m.tags.split(',') : []
        }));
    }

    buildMemoryContext(memories, maxLength = this.maxContextLength) {
        if (!memories || memories.length === 0) {
            return '';
        }
        
        let context = '[相关记忆上下文]\n';
        let currentLength = context.length;
        
        for (const memory of memories) {
            const memoryText = `- [${memory.category || 'general'}] ${memory.content}\n`;
            
            if (currentLength + memoryText.length > maxLength) {
                break;
            }
            
            context += memoryText;
            currentLength += memoryText.length;
        }
        
        context += '[/相关记忆上下文]\n\n';
        return context;
    }

    async buildContextForQuery(userId, query, options = {}) {
        const { 
            includeRecent = true, 
            includeImportant = true, 
            includeRelevant = true,
            recentLimit = 3,
            importantLimit = 3,
            relevantLimit = 5
        } = options;
        
        const allMemories = [];
        const seenIds = new Set();
        
        if (includeRelevant && query) {
            const relevantMemories = await this.searchRelevantMemories(userId, query, relevantLimit);
            for (const m of relevantMemories) {
                if (!seenIds.has(m.id)) {
                    seenIds.add(m.id);
                    allMemories.push({ ...m, source: 'relevant' });
                }
            }
        }
        
        if (includeImportant) {
            const importantMemories = await this.getImportantMemories(userId, importantLimit);
            for (const m of importantMemories) {
                if (!seenIds.has(m.id)) {
                    seenIds.add(m.id);
                    allMemories.push({ ...m, source: 'important' });
                }
            }
        }
        
        if (includeRecent) {
            const recentMemories = await this.getRecentMemories(userId, recentLimit);
            for (const m of recentMemories) {
                if (!seenIds.has(m.id)) {
                    seenIds.add(m.id);
                    allMemories.push({ ...m, source: 'recent' });
                }
            }
        }
        
        return this.buildMemoryContext(allMemories);
    }

    async updateAccessCount(memoryId) {
        await db.query(
            `UPDATE memories SET access_count = access_count + 1, last_accessed_at = NOW() WHERE id = ?`,
            [memoryId]
        );
    }

    async getMemoryById(userId, memoryId) {
        const memories = await db.query(
            `SELECT * FROM memories WHERE id = ? AND user_id = ?`,
            [memoryId, userId]
        );
        return memories[0] || null;
    }

    async updateMemory(userId, memoryId, data) {
        const { content, category, importance, tags, metadata } = data;
        
        const existingMemory = await this.getMemoryById(userId, memoryId);
        if (!existingMemory) {
            return null;
        }
        
        const updates = [];
        const values = [];
        
        if (content !== undefined) {
            updates.push('content = ?');
            values.push(content);
        }
        if (category !== undefined) {
            updates.push('category = ?');
            values.push(category);
        }
        if (importance !== undefined) {
            updates.push('importance = ?');
            values.push(importance);
        }
        if (metadata !== undefined) {
            updates.push('metadata = ?');
            values.push(JSON.stringify(metadata));
        }
        
        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            values.push(memoryId, userId);
            
            await db.query(
                `UPDATE memories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                values
            );
        }
        
        if (tags !== undefined) {
            await db.query(`DELETE FROM memory_tags WHERE memory_id = ?`, [memoryId]);
            if (tags.length > 0) {
                await this.addTags(memoryId, tags);
            }
        }
        
        return this.getMemoryById(userId, memoryId);
    }

    async deleteMemory(userId, memoryId) {
        await db.query(`DELETE FROM memory_tags WHERE memory_id = ?`, [memoryId]);
        const result = await db.query(
            `DELETE FROM memories WHERE id = ? AND user_id = ?`,
            [memoryId, userId]
        );
        return result.affectedRows > 0;
    }

    async getMemoryStats(userId) {
        const stats = await db.query(
            `SELECT 
                COUNT(*) as total,
                AVG(importance) as avg_importance,
                SUM(access_count) as total_access,
                COUNT(DISTINCT category) as categories
             FROM memories WHERE user_id = ?`,
            [userId]
        );
        
        const tags = await db.query(
            `SELECT tag_name, COUNT(*) as count 
             FROM memory_tags mt 
             JOIN memories m ON mt.memory_id = m.id 
             WHERE m.user_id = ? 
             GROUP BY tag_name 
             ORDER BY count DESC 
             LIMIT 20`,
            [userId]
        );
        
        return {
            total: stats[0]?.total || 0,
            avgImportance: stats[0]?.avg_importance || 0,
            totalAccess: stats[0]?.total_access || 0,
            categories: stats[0]?.categories || 0,
            topTags: tags
        };
    }
}

const memoryService = new MemoryService();
module.exports = memoryService;
