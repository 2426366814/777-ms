/**
 * Memory Linker Service
 * Automatically links related memories based on content similarity
 */

const db = require('../utils/database');
const logger = require('../utils/logger');
const LLMService = require('./LLMService');

const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER || 'deepseek';

class MemoryLinker {
    constructor() {
        this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.3;
        this.autoLinkEnabled = process.env.AUTO_LINK_ENABLED !== 'false';
        this.maxLinksPerMemory = parseInt(process.env.MAX_LINKS_PER_MEMORY) || 5;
    }

    async findSimilarMemories(userId, content, excludeId = null, limit = 10) {
        try {
            let sql = `SELECT m.id, m.content, m.category, m.importance,
                              MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE) as similarity
                       FROM memories m
                       WHERE m.user_id = ?`;
            
            const params = [content, userId];
            
            if (excludeId) {
                sql += ` AND m.id != ?`;
                params.push(excludeId);
            }
            
            sql += ` AND MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE)
                     HAVING similarity >= ?
                     ORDER BY similarity DESC
                     LIMIT ?`;
            
            params.push(content, this.similarityThreshold, limit);
            
            const memories = await db.query(sql, params);
            return memories;
        } catch (error) {
            logger.warn('Similar memory search failed:', error.message);
            
            const fallbackSql = `SELECT m.id, m.content, m.category, m.importance, 0.3 as similarity
                                FROM memories m
                                WHERE m.user_id = ? AND m.content LIKE ?
                                ${excludeId ? 'AND m.id != ?' : ''}
                                LIMIT ?`;
            
            const fallbackParams = [userId, `%${content.substring(0, 50)}%`];
            if (excludeId) fallbackParams.push(excludeId);
            fallbackParams.push(limit);
            
            return await db.query(fallbackSql, fallbackParams);
        }
    }

    async createLink(memoryId, relatedId, similarity, linkType = 'similar') {
        try {
            await db.query(
                `INSERT INTO memory_links (memory_id, related_id, similarity, link_type, created_at)
                 VALUES (?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE similarity = VALUES(similarity), link_type = VALUES(link_type)`,
                [memoryId, relatedId, similarity, linkType]
            );
            return true;
        } catch (error) {
            logger.warn('Failed to create memory link:', error.message);
            return false;
        }
    }

    async autoLinkMemory(userId, memoryId, content) {
        if (!this.autoLinkEnabled) {
            return { linked: 0, links: [] };
        }

        const similarMemories = await this.findSimilarMemories(userId, content, memoryId, this.maxLinksPerMemory);
        const links = [];

        for (const similar of similarMemories) {
            const created = await this.createLink(memoryId, similar.id, similar.similarity, 'auto-similar');
            if (created) {
                await this.createLink(similar.id, memoryId, similar.similarity, 'auto-similar');
                links.push({
                    memoryId: similar.id,
                    similarity: similar.similarity,
                    preview: similar.content.substring(0, 50)
                });
            }
        }

        if (links.length > 0) {
            logger.info(`Auto-linked memory ${memoryId} with ${links.length} similar memories`);
        }

        return { linked: links.length, links };
    }

    async getLinkedMemories(memoryId, limit = 10) {
        const links = await db.query(
            `SELECT m.id, m.content, m.category, m.importance, ml.similarity, ml.link_type
             FROM memory_links ml
             JOIN memories m ON ml.related_id = m.id
             WHERE ml.memory_id = ?
             ORDER BY ml.similarity DESC
             LIMIT ?`,
            [memoryId, limit]
        );
        return links;
    }

    async getMemoryNetwork(userId, depth = 2) {
        const memories = await db.query(
            `SELECT m.id, m.content, m.category, m.importance
             FROM memories m
             WHERE m.user_id = ?
             ORDER BY m.importance DESC
             LIMIT 50`,
            [userId]
        );

        const network = { nodes: [], edges: [] };
        const nodeMap = new Map();

        for (const m of memories) {
            nodeMap.set(m.id, m);
            network.nodes.push({
                id: m.id,
                label: m.content.substring(0, 30),
                category: m.category,
                importance: m.importance
            });
        }

        for (const m of memories) {
            const links = await this.getLinkedMemories(m.id, 5);
            for (const link of links) {
                if (nodeMap.has(link.id)) {
                    network.edges.push({
                        source: m.id,
                        target: link.id,
                        similarity: link.similarity,
                        type: link.link_type
                    });
                }
            }
        }

        return network;
    }

    async removeLink(memoryId, relatedId) {
        await db.query(
            `DELETE FROM memory_links WHERE memory_id = ? AND related_id = ?`,
            [memoryId, relatedId]
        );
        await db.query(
            `DELETE FROM memory_links WHERE memory_id = ? AND related_id = ?`,
            [relatedId, memoryId]
        );
        return true;
    }

    async batchLinkMemories(userId, limit = 100) {
        const memories = await db.query(
            `SELECT id, content FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
            [userId, limit]
        );

        let totalLinked = 0;
        for (const m of memories) {
            const result = await this.autoLinkMemory(userId, m.id, m.content);
            totalLinked += result.linked;
        }

        return { processed: memories.length, totalLinked };
    }

    getStatus() {
        return {
            enabled: this.autoLinkEnabled,
            similarityThreshold: this.similarityThreshold,
            maxLinksPerMemory: this.maxLinksPerMemory
        };
    }
}

const memoryLinker = new MemoryLinker();
module.exports = memoryLinker;
