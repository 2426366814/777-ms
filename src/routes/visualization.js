const express = require('express');
const router = express.Router();
const visualizationService = require('../services/VisualizationService');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', async (req, res) => {
    try {
        const db = require('../utils/database');
        const memories = await db.query('SELECT COUNT(*) as count FROM memories WHERE user_id = ?', [req.user.id]);
        const knowledge = await db.query('SELECT COUNT(*) as count FROM knowledge WHERE user_id = ?', [req.user.id]).catch(() => [{ count: 0 }]);
        const sessions = await db.query('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?', [req.user.id]).catch(() => [{ count: 0 }]);
        
        res.json({
            success: true,
            data: {
                memories: memories?.[0]?.count || 0,
                knowledge: knowledge?.[0]?.count || 0,
                sessions: sessions?.[0]?.count || 0,
                visualizations: ['heatmap', 'timeline', 'wordcloud', 'growth-trend', 'retention-curve']
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/heatmap', async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const data = await visualizationService.getActivityHeatmap(req.user.id, year);
        res.json({ success: true, heatmap: Object.entries(data.data).map(([date, info]) => ({ date, ...info })), summary: data.summary });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/activity/hour', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const data = await visualizationService.getActivityByHour(req.user.id, days);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/activity/day-of-week', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const data = await visualizationService.getActivityByDayOfWeek(req.user.id, days);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/wordcloud/tags', async (req, res) => {
    try {
        const words = await visualizationService.getTagWordCloud(req.user.id);
        res.json({ success: true, words });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/wordcloud/content', async (req, res) => {
    try {
        const words = await visualizationService.getContentWordCloud(req.user.id);
        res.json({ success: true, words });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/timeline', async (req, res) => {
    try {
        const timeline = await visualizationService.getMemoryTimeline(req.user.id);
        res.json({ success: true, timeline });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/importance-distribution', async (req, res) => {
    try {
        const distribution = await visualizationService.getImportanceDistribution(req.user.id);
        res.json({ success: true, distribution });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/growth-trend', async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 6;
        const data = await visualizationService.getMemoryGrowthTrend(req.user.id, months);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/retention-curve', async (req, res) => {
    try {
        const curve = await visualizationService.getRetentionCurve(req.user.id);
        res.json({ success: true, curve });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/knowledge-network', async (req, res) => {
    try {
        const data = await visualizationService.getKnowledgeNetwork(req.user.id);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/emotion-trend', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const trend = await visualizationService.getEmotionTrend(req.user.id, days);
        res.json({ success: true, trend });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/dashboard', async (req, res) => {
    try {
        const stats = await visualizationService.getDashboardStats(req.user.id);
        res.json({ success: true, ...stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/activity-sunburst', async (req, res) => {
    try {
        const db = require('../utils/database');
        const data = await db.query(`
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as value
            FROM memories WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
            GROUP BY month ORDER BY month
        `, [req.user.id]);
        res.json({ success: true, sunburst: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/activity-radar', async (req, res) => {
    try {
        const hourData = await visualizationService.getActivityByHour(req.user.id, 30);
        res.json({ 
            success: true, 
            radar: { 
                timeDistribution: { 
                    labels: hourData.labels, 
                    data: hourData.data 
                } 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/memory-river', async (req, res) => {
    try {
        const growth = await visualizationService.getMemoryGrowthTrend(req.user.id, 6);
        res.json({ 
            success: true, 
            river: { 
                labels: growth.labels, 
                datasets: [
                    { name: '新增记忆', data: growth.datasets.newMemories, color: '#6366f1' },
                    { name: '重要记忆', data: growth.datasets.importantMemories, color: '#a855f7' }
                ]
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
