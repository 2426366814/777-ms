const llmService = require('./LLMService');
const db = require('../utils/database');

class KnowledgeGraphService {
    constructor() {
        this.relationTypes = [
            'related_to',
            'causes',
            'precedes',
            'follows',
            'contradicts',
            'supports',
            'is_part_of',
            'is_type_of',
            'located_at',
            'occurred_at',
            'involves',
            'similar_to'
        ];
    }

    async extractEntities(userId, content, providerId = 'openai') {
        const messages = [
            {
                role: 'system',
                content: `你是一个实体提取专家。从文本中提取关键实体（人物、地点、事件、概念、时间等）。
输出JSON格式：
{
  "entities": [
    {"name": "实体名", "type": "person|place|event|concept|time|other", "importance": 0.0-1.0}
  ]
}`
            },
            { role: 'user', content: `提取以下文本中的实体：\n\n${content}` }
        ];

        try {
            const response = await llmService.chat(userId, providerId, messages, {
                temperature: 0.1,
                maxTokens: 500
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { entities: [] };
        } catch (error) {
            console.error('Entity extraction failed:', error);
            return { entities: [] };
        }
    }

    async findRelations(userId, memory1, memory2, providerId = 'openai') {
        const messages = [
            {
                role: 'system',
                content: `你是一个关系分析专家。分析两段记忆之间的关系。
输出JSON格式：
{
  "hasRelation": true/false,
  "relationType": "关系类型",
  "confidence": 0.0-1.0,
  "description": "关系描述"
}

关系类型包括：${this.relationTypes.join(', ')}`
            },
            {
                role: 'user',
                content: `分析以下两段记忆的关系：
记忆1：${memory1.content}
记忆2：${memory2.content}`
            }
        ];

        try {
            const response = await llmService.chat(userId, providerId, messages, {
                temperature: 0.1,
                maxTokens: 200
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { hasRelation: false };
        } catch (error) {
            return { hasRelation: false };
        }
    }

    async buildGraph(userId, limit = 100) {
        const memories = await db.query(
            'SELECT id, content FROM memories WHERE user_id = ? ORDER BY importance_score DESC LIMIT ?',
            [userId, limit]
        );

        const nodes = [];
        const edges = [];

        for (const memory of (memories || [])) {
            const entities = await this.extractEntities(userId, memory.content);
            
            for (const entity of (entities.entities || [])) {
                const existingNode = nodes.find(n => n.name === entity.name && n.type === entity.type);
                if (existingNode) {
                    existingNode.memories.push(memory.id);
                    existingNode.weight += entity.importance;
                } else {
                    nodes.push({
                        id: `entity_${nodes.length}`,
                        name: entity.name,
                        type: entity.type,
                        weight: entity.importance,
                        memories: [memory.id]
                    });
                }
            }
        }

        for (let i = 0; i < (memories || []).length; i++) {
            for (let j = i + 1; j < (memories || []).length; j++) {
                if (memories[i].content.length < 20 || memories[j].content.length < 20) continue;
                
                const relation = await this.findRelations(userId, memories[i], memories[j]);
                
                if (relation.hasRelation && relation.confidence > 0.5) {
                    edges.push({
                        source: memories[i].id,
                        target: memories[j].id,
                        type: relation.relationType,
                        weight: relation.confidence,
                        description: relation.description
                    });
                }
            }
        }

        return { nodes, edges, stats: { nodeCount: nodes.length, edgeCount: edges.length } };
    }

    async getRelatedMemories(userId, memoryId, depth = 2) {
        const relations = await db.query(`
            SELECT * FROM memory_relations 
            WHERE (source_id = ? OR target_id = ?) AND user_id = ?
        `, [memoryId, memoryId, userId]);

        const visited = new Set([memoryId]);
        const result = [];

        const traverse = async (id, currentDepth) => {
            if (currentDepth > depth) return;

            const related = await db.query(`
                SELECT r.*, 
                       CASE WHEN r.source_id = ? THEN r.target_id ELSE r.source_id END as related_id
                FROM memory_relations r
                WHERE (r.source_id = ? OR r.target_id = ?) AND r.user_id = ?
            `, [id, id, id, userId]);

            for (const rel of (related || [])) {
                if (!visited.has(rel.related_id)) {
                    visited.add(rel.related_id);
                    result.push({
                        memoryId: rel.related_id,
                        relationType: rel.relation_type,
                        distance: currentDepth
                    });
                    await traverse(rel.related_id, currentDepth + 1);
                }
            }
        };

        await traverse(memoryId, 1);
        return result;
    }

    async saveRelation(userId, sourceId, targetId, relationType, confidence = 1.0, description = '') {
        await db.query(`
            INSERT INTO memory_relations (user_id, source_id, target_id, relation_type, confidence, description)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE confidence = ?, description = ?
        `, [userId, sourceId, targetId, relationType, confidence, description, confidence, description]);
    }

    async getGraphStats(userId) {
        const nodeCount = await db.query(
            'SELECT COUNT(DISTINCT id) as count FROM memories WHERE user_id = ?',
            [userId]
        );

        const edgeCount = await db.query(
            'SELECT COUNT(*) as count FROM memory_relations WHERE user_id = ?',
            [userId]
        );

        const topEntities = await db.query(`
            SELECT entity_name, entity_type, COUNT(*) as frequency
            FROM memory_entities
            WHERE user_id = ?
            GROUP BY entity_name, entity_type
            ORDER BY frequency DESC
            LIMIT 10
        `, [userId]);

        const relationTypes = await db.query(`
            SELECT relation_type, COUNT(*) as count
            FROM memory_relations
            WHERE user_id = ?
            GROUP BY relation_type
            ORDER BY count DESC
        `, [userId]);

        return {
            nodeCount: nodeCount && nodeCount.length > 0 ? nodeCount[0].count : 0,
            edgeCount: edgeCount && edgeCount.length > 0 ? edgeCount[0].count : 0,
            topEntities: topEntities || [],
            relationTypes: relationTypes || []
        };
    }
}

const knowledgeGraphService = new KnowledgeGraphService();
module.exports = knowledgeGraphService;
