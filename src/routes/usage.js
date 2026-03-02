/**
 * Usage路由
 * 处理使用统计
 */

const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const logger = require('../utils/logger');

/**
 * @route   GET /api/v1/usage/stats
 * @desc    获取用户使用统计
 * @access  Private
 */
router.get('/stats', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { period = 'month' } = req.query;
        
        let dateFilter = '';
        if (period === 'week') {
            dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        } else if (period === 'month') {
            dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        } else if (period === 'year') {
            dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        }
        
        const memoryCount = await db.query(
            `SELECT COUNT(*) as count FROM memories WHERE user_id = ? ${dateFilter}`,
            [userId]
        );
        
        const knowledgeCount = await db.query(
            `SELECT COUNT(*) as count FROM knowledge WHERE user_id = ? ${dateFilter}`,
            [userId]
        );
        
        const sessionCount = await db.query(
            `SELECT COUNT(*) as count FROM sessions WHERE user_id = ? ${dateFilter}`,
            [userId]
        );
        
        const apiCalls = await db.query(
            `SELECT COUNT(*) as count FROM api_logs WHERE user_id = ? ${dateFilter}`,
            [userId]
        );
        
        res.json({
            success: true,
            data: {
                period,
                memories: memoryCount && memoryCount.length > 0 ? memoryCount[0].count : 0,
                knowledge: knowledgeCount && knowledgeCount.length > 0 ? knowledgeCount[0].count : 0,
                sessions: sessionCount && sessionCount.length > 0 ? sessionCount[0].count : 0,
                apiCalls: apiCalls && apiCalls.length > 0 ? apiCalls[0].count : 0
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/usage/history
 * @desc    获取使用历史
 * @access  Private
 */
router.get('/history', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { days = 30 } = req.query;
        
        const history = await db.query(
            `SELECT DATE(created_at) as date, 
                    COUNT(CASE WHEN type = 'memory' THEN 1 END) as memories,
                    COUNT(CASE WHEN type = 'knowledge' THEN 1 END) as knowledge,
                    COUNT(CASE WHEN type = 'chat' THEN 1 END) as chats
             FROM usage_stats 
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY DATE(created_at)
             ORDER BY date DESC`,
            [userId, parseInt(days)]
        );
        
        res.json({ success: true, data: { history: history || [] } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/usage/tokens
 * @desc    获取Token使用量
 * @access  Private
 */
router.get('/tokens', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const tokens = await db.query(
            `SELECT 
                SUM(input_tokens) as total_input,
                SUM(output_tokens) as total_output,
                SUM(input_tokens + output_tokens) as total_tokens
             FROM api_logs 
             WHERE user_id = ?`,
            [userId]
        );
        
        res.json({
            success: true,
            data: {
                inputTokens: tokens && tokens.length > 0 ? tokens[0].total_input || 0 : 0,
                outputTokens: tokens && tokens.length > 0 ? tokens[0].total_output || 0 : 0,
                totalTokens: tokens && tokens.length > 0 ? tokens[0].total_tokens || 0 : 0
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
