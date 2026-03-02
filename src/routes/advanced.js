/**
 * Advanced路由
 * 处理去重、导出、导入等高级功能
 */

const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');

/**
 * @route   POST /api/v1/advanced/deduplicate
 * @desc    检测并去重记忆
 * @access  Private
 */
router.post('/deduplicate', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { threshold = 0.8 } = req.body;
        
        const memories = await db.query(
            'SELECT id, content FROM memories WHERE user_id = ?',
            [userId]
        );
        
        const duplicates = [];
        const processed = new Set();
        
        for (let i = 0; i < memories.length; i++) {
            if (processed.has(memories[i].id)) continue;
            
            for (let j = i + 1; j < memories.length; j++) {
                if (processed.has(memories[j].id)) continue;
                
                const similarity = calculateSimilarity(memories[i].content, memories[j].content);
                if (similarity >= threshold) {
                    duplicates.push({
                        memory1: memories[i].id,
                        memory2: memories[j].id,
                        similarity
                    });
                    processed.add(memories[j].id);
                }
            }
        }
        
        res.json({
            success: true,
            data: {
                totalMemories: memories.length,
                duplicatesFound: duplicates.length,
                duplicates
            }
        });
    } catch (error) {
        next(error);
    }
});

function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}

/**
 * @route   GET /api/v1/advanced/export
 * @desc    导出用户数据
 * @access  Private
 */
router.get('/export', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { format = 'json', type = 'all' } = req.query;
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            user: userId,
            memories: [],
            knowledge: [],
            sessions: []
        };
        
        if (type === 'all' || type === 'memories') {
            exportData.memories = await db.query('SELECT * FROM memories WHERE user_id = ?', [userId]);
        }
        
        if (type === 'all' || type === 'knowledge') {
            exportData.knowledge = await db.query('SELECT * FROM knowledge WHERE user_id = ?', [userId]);
        }
        
        if (type === 'all' || type === 'sessions') {
            exportData.sessions = await db.query('SELECT * FROM sessions WHERE user_id = ?', [userId]);
        }
        
        logger.info(`用户 ${userId} 导出数据`);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="memory-export-${Date.now()}.json"`);
        res.json(exportData);
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/advanced/import
 * @desc    导入用户数据
 * @access  Private
 */
router.post('/import', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { memories, knowledge, sessions } = req.body;
        
        let imported = { memories: 0, knowledge: 0, sessions: 0 };
        
        if (memories && Array.isArray(memories)) {
            for (const memory of memories) {
                const id = uuidv4();
                await db.query(
                    'INSERT INTO memories (id, user_id, content, importance_score, created_at) VALUES (?, ?, ?, ?, NOW())',
                    [id, userId, memory.content, memory.importance_score || 5]
                );
                imported.memories++;
            }
        }
        
        if (knowledge && Array.isArray(knowledge)) {
            for (const item of knowledge) {
                const id = uuidv4();
                await db.query(
                    'INSERT INTO knowledge (id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, NOW())',
                    [id, userId, item.title, item.content]
                );
                imported.knowledge++;
            }
        }
        
        if (sessions && Array.isArray(sessions)) {
            for (const session of sessions) {
                const id = uuidv4();
                await db.query(
                    'INSERT INTO sessions (id, user_id, title, messages, created_at) VALUES (?, ?, ?, ?, NOW())',
                    [id, userId, session.title, JSON.stringify(session.messages || [])]
                );
                imported.sessions++;
            }
        }
        
        logger.info(`用户 ${userId} 导入数据: ${JSON.stringify(imported)}`);
        
        res.json({ success: true, message: '数据导入成功', data: { imported } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/advanced/bulk-delete
 * @desc    批量删除记忆
 * @access  Private
 */
router.post('/bulk-delete', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { ids, type = 'memories' } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: '请提供要删除的ID列表' });
        }
        
        const table = type === 'knowledge' ? 'knowledge' : 'memories';
        const placeholders = ids.map(() => '?').join(',');
        
        const result = await db.query(
            `DELETE FROM ${table} WHERE id IN (${placeholders}) AND user_id = ?`,
            [...ids, userId]
        );
        
        logger.info(`用户 ${userId} 批量删除 ${type}: ${ids.length} 条`);
        
        res.json({ success: true, message: `成功删除 ${ids.length} 条记录` });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
