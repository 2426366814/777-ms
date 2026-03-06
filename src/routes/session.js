/**
 * 会话路由
 * 处理对话会话管理
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
        const sessions = await db.query(
            'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );
        res.json({ success: true, data: { sessions: sessions || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { title } = req.body;
        const id = require('uuid').v4();
        await db.query(
            'INSERT INTO sessions (id, user_id, title, messages, created_at) VALUES (?, ?, ?, ?, NOW())',
            [id, userId, title || '新会话', JSON.stringify([])]
        );
        res.status(201).json({ 
            success: true, 
            data: { session: { id, title: title || '新会话' } } 
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            const id = require('uuid').v4();
            await db.query(
                'INSERT INTO sessions (id, user_id, title, messages, created_at) VALUES (?, ?, ?, ?, NOW())',
                [id, userId, title || '新会话', JSON.stringify([])]
            );
            return res.status(201).json({ 
                success: true, 
                data: { session: { id, title: title || '新会话' } } 
            });
        }
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        const sessions = await db.query(
            'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        if (!sessions || sessions.length === 0) {
            return res.status(404).json({ success: false, message: '会话不存在' });
        }
        res.json({ success: true, data: { session: sessions[0] } });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, messages } = req.body;
        const userId = req.user?.id || 'default-user';
        await db.query(
            'UPDATE sessions SET title = ?, messages = ? WHERE id = ? AND user_id = ?',
            [title, JSON.stringify(messages || []), id, userId]
        );
        res.json({ success: true, message: '会话更新成功' });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        await db.query('DELETE FROM sessions WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ success: true, message: '会话删除成功' });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/messages', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role, content } = req.body;
        const userId = req.user?.id || 'default-user';
        
        const sessions = await db.query(
            'SELECT messages FROM sessions WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        if (!sessions || sessions.length === 0) {
            return res.status(404).json({ success: false, message: '会话不存在' });
        }
        
        const messages = JSON.parse(sessions[0].messages || '[]');
        messages.push({ role, content, timestamp: new Date().toISOString() });
        
        await db.query(
            'UPDATE sessions SET messages = ? WHERE id = ?',
            [JSON.stringify(messages), id]
        );
        
        res.json({ success: true, message: '消息添加成功' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
