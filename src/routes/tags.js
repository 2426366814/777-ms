/**
 * 标签路由
 * 处理标签管理
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const tags = await db.query(
            `SELECT tag_name, COUNT(*) as count 
             FROM memory_tags mt 
             JOIN memories m ON mt.memory_id = m.id 
             WHERE m.user_id = ? 
             GROUP BY tag_name 
             ORDER BY count DESC`,
            [userId]
        );
        res.json({ success: true, data: { tags: tags || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const { memoryId, tagName } = req.body;
        const userId = req.user?.id || 'default-user';
        
        const memories = await db.query(
            'SELECT id FROM memories WHERE id = ? AND user_id = ?',
            [memoryId, userId]
        );
        
        if (!memories || memories.length === 0) {
            return res.status(404).json({ success: false, message: '记忆不存在' });
        }
        
        await db.query(
            'INSERT IGNORE INTO memory_tags (memory_id, tag_name) VALUES (?, ?)',
            [memoryId, tagName]
        );
        
        res.status(201).json({ 
            success: true, 
            message: '标签添加成功',
            data: {
                memoryId,
                tagName
            }
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/', async (req, res, next) => {
    try {
        const { memoryId, tagName } = req.body;
        const userId = req.user?.id || 'default-user';
        
        await db.query(
            `DELETE mt FROM memory_tags mt 
             JOIN memories m ON mt.memory_id = m.id 
             WHERE mt.memory_id = ? AND mt.tag_name = ? AND m.user_id = ?`,
            [memoryId, tagName, userId]
        );
        
        res.json({ success: true, message: '标签删除成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/popular', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const limit = parseInt(req.query.limit) || 20;
        
        const tags = await db.query(
            `SELECT tag_name, COUNT(*) as count 
             FROM memory_tags mt 
             JOIN memories m ON mt.memory_id = m.id 
             WHERE m.user_id = ? 
             GROUP BY tag_name 
             ORDER BY count DESC 
             LIMIT ?`,
            [userId, limit]
        );
        
        res.json({ success: true, data: { tags: tags || [] } });
    } catch (error) {
        next(error);
    }
});

router.get('/search', async (req, res, next) => {
    try {
        const { q } = req.query;
        const userId = req.user?.id || 'default-user';
        
        const tags = await db.query(
            `SELECT DISTINCT tag_name 
             FROM memory_tags mt 
             JOIN memories m ON mt.memory_id = m.id 
             WHERE m.user_id = ? AND tag_name LIKE ?
             LIMIT 10`,
            [userId, `%${q}%`]
        );
        
        res.json({ success: true, data: { tags: tags || [] } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
