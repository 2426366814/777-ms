const express = require('express');
const router = express.Router();
const knowledgeGraphService = require('../services/KnowledgeGraphService');
const memoryExtractor = require('../services/MemoryExtractor');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/status', async (req, res) => {
    try {
        const db = require('../utils/database');
        const [memories] = await db.query('SELECT COUNT(*) as count FROM memories WHERE user_id = ?', [req.user.id]);
        const [entities] = await db.query('SELECT COUNT(*) as count FROM memory_entities WHERE user_id = ?', [req.user.id]).catch(() => [[{ count: 0 }]]);
        const [relations] = await db.query('SELECT COUNT(*) as count FROM memory_relations WHERE user_id = ?', [req.user.id]).catch(() => [[{ count: 0 }]]);
        
        res.json({
            success: true,
            data: {
                memories: memories?.[0]?.count || 0,
                entities: entities?.[0]?.count || 0,
                relations: relations?.[0]?.count || 0,
                features: ['graph', 'extract', 'summarize', 'tags', 'importance']
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/graph', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const data = await knowledgeGraphService.buildGraph(req.user.id, limit);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/graph/stats', async (req, res) => {
    try {
        const stats = await knowledgeGraphService.getGraphStats(req.user.id);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/related/:memoryId', async (req, res) => {
    try {
        const depth = parseInt(req.query.depth) || 2;
        const related = await knowledgeGraphService.getRelatedMemories(
            req.user.id, 
            parseInt(req.params.memoryId), 
            depth
        );
        res.json({ success: true, related });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/extract', async (req, res) => {
    try {
        const { message, provider } = req.body;
        const result = await memoryExtractor.extractFromMessage(
            req.user.id, 
            message, 
            provider || 'openai'
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/extract/conversation', async (req, res) => {
    try {
        const { messages, provider } = req.body;
        const result = await memoryExtractor.extractFromConversation(
            req.user.id, 
            messages, 
            provider || 'openai'
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/save', async (req, res) => {
    try {
        const { memories, sessionId } = req.body;
        const saved = await memoryExtractor.saveMemories(req.user.id, memories, sessionId);
        res.json({ success: true, saved });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/tags/generate', async (req, res) => {
    try {
        const { content, provider } = req.body;
        const result = await memoryExtractor.generateTags(req.user.id, content, provider || 'openai');
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/importance/assess', async (req, res) => {
    try {
        const { content, provider } = req.body;
        const result = await memoryExtractor.assessImportance(req.user.id, content, provider || 'openai');
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/summarize', async (req, res) => {
    try {
        const { memoryIds, provider } = req.body;
        const result = await memoryExtractor.summarizeMemories(
            req.user.id, 
            memoryIds, 
            provider || 'openai'
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/entities', async (req, res) => {
    try {
        const db = require('../utils/database');
        const [entities] = await db.query(`
            SELECT entity_name, entity_type, COUNT(*) as frequency, AVG(importance) as avg_importance
            FROM memory_entities
            WHERE user_id = ?
            GROUP BY entity_name, entity_type
            ORDER BY frequency DESC
            LIMIT 50
        `, [req.user.id]);
        res.json({ success: true, entities });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/relations', async (req, res) => {
    try {
        const db = require('../utils/database');
        const [relations] = await db.query(`
            SELECT r.*, 
                   m1.content as source_content,
                   m2.content as target_content
            FROM memory_relations r
            JOIN memories m1 ON r.source_id = m1.id
            JOIN memories m2 ON r.target_id = m2.id
            WHERE r.user_id = ?
            ORDER BY r.confidence DESC
            LIMIT 100
        `, [req.user.id]);
        res.json({ success: true, relations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
