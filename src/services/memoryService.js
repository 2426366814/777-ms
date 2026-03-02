/**
 * Memory Service
 * Handles memory operations including auto-loading relevant memories for context
 */

const db = require('../utils/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const LLMService = require('./LLMService');

const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER || 'deepseek';
const AUTO_TAG_ENABLED = process.env.AUTO_TAG_ENABLED !== 'false';

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

    async generateAutoTags(content) {
        if (!AUTO_TAG_ENABLED) {
            return [];
        }

        try {
            const prompt = `为以下记忆内容生成3-5个相关标签（只返回标签，用逗号分隔，不要其他内容）：

记忆内容: ${content.substring(0, 500)}

标签:`;

            const response = await LLMService.chat('system', DEFAULT_PROVIDER, [
                { role: 'user', content: prompt }
            ], { maxTokens: 50 });

            const tags = response.content
                .split(/[,，、\n]/)
                .map(t => t.trim().replace(/^#/, ''))
                .filter(t => t.length > 0 && t.length <= 20)
                .slice(0, 5);

            return tags;
        } catch (error) {
            logger.warn('Auto-tag generation failed:', error.message);
            return [];
        }
    }

    async createMemoryWithAutoTags(userId, data) {
        const { content, category = 'general', tags = [], importance = 5, metadata = {} } = data;
        
        let finalTags = tags;
        if (tags.length === 0 && AUTO_TAG_ENABLED) {
            finalTags = await this.generateAutoTags(content);
            logger.info(`Auto-generated tags for memory: ${finalTags.join(', ')}`);
        }
        
        let finalCategory = category;
        if (category === 'general' && AUTO_TAG_ENABLED) {
            finalCategory = await this.autoCategorize(content);
            logger.info(`Auto-categorized memory as: ${finalCategory}`);
        }
        
        let finalMetadata = metadata;
        if (content.length > 200 && AUTO_TAG_ENABLED) {
            const summary = await this.generateSummary(content);
            if (summary) {
                finalMetadata = { ...metadata, summary };
                logger.info(`Generated summary for memory`);
            }
        }
        
        const memory = await this.createMemory(userId, {
            content,
            category: finalCategory,
            tags: finalTags,
            importance,
            metadata: finalMetadata
        });
        
        if (memory && memory.id) {
            this.autoLinkRelated(userId, memory.id, content).catch(err => 
                logger.warn('Auto-link failed:', err.message)
            );
        }
        
        return memory;
    }

    async autoCategorize(content) {
        try {
            const prompt = `为以下记忆内容选择一个最合适的分类（只返回分类名称，不要其他内容）：

可选分类：工作、学习、生活、健康、财务、社交、娱乐、技术、其他

记忆内容: ${content.substring(0, 300)}

分类:`;

            const response = await LLMService.chat('system', DEFAULT_PROVIDER, [
                { role: 'user', content: prompt }
            ], { maxTokens: 10 });

            const category = response.content.trim();
            const validCategories = ['工作', '学习', '生活', '健康', '财务', '社交', '娱乐', '技术', '其他', 'work', 'study', 'life', 'health', 'finance', 'social', 'entertainment', 'tech', 'other'];
            
            return validCategories.includes(category.toLowerCase()) ? category : 'general';
        } catch (error) {
            logger.warn('Auto-categorization failed:', error.message);
            return 'general';
        }
    }

    async generateSummary(content) {
        try {
            const prompt = `为以下内容生成一个简短的摘要（不超过50字）：

${content.substring(0, 500)}

摘要:`;

            const response = await LLMService.chat('system', DEFAULT_PROVIDER, [
                { role: 'user', content: prompt }
            ], { maxTokens: 100 });

            return response.content.trim().substring(0, 100);
        } catch (error) {
            logger.warn('Summary generation failed:', error.message);
            return null;
        }
    }

    async autoLinkRelated(userId, memoryId, content) {
        try {
            const related = await this.searchRelevantMemories(userId, content, 5);
            
            for (const rel of related) {
                if (rel.id !== memoryId) {
                    await db.query(
                        `INSERT IGNORE INTO memory_links (memory_id, related_id, similarity, created_at)
                         VALUES (?, ?, ?, NOW())`,
                        [memoryId, rel.id, rel.relevance || 0.5]
                    );
                }
            }
            
            if (related.length > 0) {
                logger.info(`Auto-linked memory ${memoryId} with ${related.length} related memories`);
            }
        } catch (error) {
            logger.warn('Auto-link failed:', error.message);
        }
    }

    async getRelatedMemories(memoryId, limit = 5) {
        const links = await db.query(
            `SELECT m.id, m.content, m.category, ml.similarity 
             FROM memory_links ml 
             JOIN memories m ON ml.related_id = m.id 
             WHERE ml.memory_id = ? 
             ORDER BY ml.similarity DESC 
             LIMIT ?`,
            [memoryId, limit]
        );
        return links;
    }
}

const memoryService = new MemoryService();
module.exports = memoryService;
