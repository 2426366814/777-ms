/**
 * Share路由
 * 处理分享链接
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const db = require('../utils/database');
const logger = require('../utils/logger');

/**
 * @route   POST /api/v1/share
 * @desc    创建分享链接
 * @access  Private
 */
router.post('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { type, id, expiresIn = 7 * 24 * 60 * 60 * 1000 } = req.body;
        
        if (!type || !id) {
            return res.status(400).json({ success: false, message: '请提供分享类型和ID' });
        }
        
        const shareCode = uuidv4().substring(0, 8);
        const expiresAt = new Date(Date.now() + expiresIn);
        
        await db.query(
            'INSERT INTO share_links (id, code, user_id, resource_type, resource_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [uuidv4(), shareCode, userId, type, id, expiresAt]
        );
        
        logger.info(`用户 ${userId} 创建分享链接: ${shareCode}`);
        
        res.json({
            success: true,
            data: {
                code: shareCode,
                url: `/share/${shareCode}`,
                expiresAt
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/share/:code
 * @desc    获取分享内容
 * @access  Public
 */
router.get('/:code', async (req, res, next) => {
    try {
        const { code } = req.params;
        
        const shares = await db.query(
            'SELECT * FROM share_links WHERE code = ? AND expires_at > NOW()',
            [code]
        );
        
        if (!shares || shares.length === 0) {
            return res.status(404).json({ success: false, message: '分享链接不存在或已过期' });
        }
        
        const share = shares[0];
        
        let content = null;
        if (share.resource_type === 'memory') {
            const memories = await db.query('SELECT * FROM memories WHERE id = ?', [share.resource_id]);
            content = memories && memories.length > 0 ? memories[0] : null;
        } else if (share.resource_type === 'knowledge') {
            const knowledge = await db.query('SELECT * FROM knowledge WHERE id = ?', [share.resource_id]);
            content = knowledge && knowledge.length > 0 ? knowledge[0] : null;
        }
        
        if (!content) {
            return res.status(404).json({ success: false, message: '分享内容不存在' });
        }
        
        res.json({
            success: true,
            data: {
                type: share.resource_type,
                content
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/share
 * @desc    获取用户的分享列表
 * @access  Private
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const shares = await db.query(
            'SELECT * FROM share_links WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        
        res.json({ success: true, data: { shares: shares || [] } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/share/:code
 * @desc    删除分享链接
 * @access  Private
 */
router.delete('/:code', async (req, res, next) => {
    try {
        const { code } = req.params;
        const userId = req.user?.id || 'default-user';
        
        await db.query('DELETE FROM share_links WHERE code = ? AND user_id = ?', [code, userId]);
        
        res.json({ success: true, message: '分享链接已删除' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
