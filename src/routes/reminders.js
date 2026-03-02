/**
 * Reminders路由
 * 处理记忆提醒
 */

const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const db = require('../utils/database');
const logger = require('../utils/logger');

const reminderSchema = Joi.object({
    memoryId: Joi.string().required(),
    remindAt: Joi.date().iso().greater('now').required(),
    type: Joi.string().valid('once', 'daily', 'weekly', 'monthly').default('once'),
    message: Joi.string().max(500).optional()
});

/**
 * @route   GET /api/v1/reminders
 * @desc    获取用户的提醒列表
 * @access  Private
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { status = 'pending' } = req.query;
        
        let sql = 'SELECT r.*, m.content as memory_content FROM reminders r LEFT JOIN memories m ON r.memory_id = m.id WHERE r.user_id = ?';
        const params = [userId];
        
        if (status === 'pending') {
            sql += ' AND r.remind_at > NOW() AND r.is_completed = 0';
        } else if (status === 'completed') {
            sql += ' AND r.is_completed = 1';
        }
        
        sql += ' ORDER BY r.remind_at ASC';
        
        const reminders = await db.query(sql, params);
        
        res.json({ success: true, data: { reminders: reminders || [] } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/reminders
 * @desc    创建提醒
 * @access  Private
 */
router.post('/', async (req, res, next) => {
    try {
        const { error, value } = reminderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const userId = req.user?.id || 'default-user';
        const { memoryId, remindAt, type, message } = value;
        
        const id = uuidv4();
        await db.query(
            'INSERT INTO reminders (id, user_id, memory_id, remind_at, type, message, is_completed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, NOW())',
            [id, userId, memoryId, remindAt, type, message || '']
        );
        
        logger.info(`用户 ${userId} 创建提醒: ${id}`);
        
        res.status(201).json({
            success: true,
            message: '提醒创建成功',
            data: { id, memoryId, remindAt, type }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/reminders/:id
 * @desc    更新提醒
 * @access  Private
 */
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        const { remindAt, message, isCompleted } = req.body;
        
        const existing = await db.query('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: '提醒不存在' });
        }
        
        const updates = [];
        const params = [];
        
        if (remindAt) {
            updates.push('remind_at = ?');
            params.push(remindAt);
        }
        if (message !== undefined) {
            updates.push('message = ?');
            params.push(message);
        }
        if (isCompleted !== undefined) {
            updates.push('is_completed = ?');
            params.push(isCompleted ? 1 : 0);
        }
        
        if (updates.length > 0) {
            params.push(id);
            await db.query(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        
        res.json({ success: true, message: '提醒更新成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/reminders/:id
 * @desc    删除提醒
 * @access  Private
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        
        await db.query('DELETE FROM reminders WHERE id = ? AND user_id = ?', [id, userId]);
        
        logger.info(`用户 ${userId} 删除提醒: ${id}`);
        
        res.json({ success: true, message: '提醒删除成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/reminders/:id/complete
 * @desc    标记提醒完成
 * @access  Private
 */
router.post('/:id/complete', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        
        await db.query(
            'UPDATE reminders SET is_completed = 1, completed_at = NOW() WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        res.json({ success: true, message: '提醒已标记完成' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
