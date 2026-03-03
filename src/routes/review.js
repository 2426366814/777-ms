const express = require('express');
const router = express.Router();
const forgettingCurveService = require('../services/ForgettingCurveService');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/due', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const memories = await forgettingCurveService.getMemoriesForReview(req.user.id, limit);
        res.json({ success: true, memories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/record', async (req, res) => {
    try {
        const { memoryId, quality, provider } = req.body;
        const result = await forgettingCurveService.recordReview(
            req.user.id, 
            memoryId, 
            quality, 
            provider || 'openai'
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/questions/:memoryId', async (req, res) => {
    try {
        const { provider } = req.query;
        const result = await forgettingCurveService.generateReviewQuestions(
            req.user.id, 
            parseInt(req.params.memoryId), 
            provider || 'openai'
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const stats = await forgettingCurveService.getReviewStats(req.user.id);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/curve', async (req, res) => {
    try {
        const curve = await forgettingCurveService.getForgettingCurveData(req.user.id);
        res.json({ success: true, curve });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/schedule', async (req, res) => {
    try {
        const result = await forgettingCurveService.scheduleReviewReminder(req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/schedule', async (req, res) => {
    try {
        const db = require('../utils/database');
        const upcoming = await db.query(`
            SELECT r.*, m.content
            FROM memory_reviews r
            JOIN memories m ON r.memory_id = m.id
            WHERE r.user_id = ? AND r.next_review_at >= NOW()
            ORDER BY r.next_review_at ASC
            LIMIT 20
        `, [req.user.id]);
        res.json({ success: true, upcoming });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/history', async (req, res) => {
    try {
        const db = require('../utils/database');
        const limit = parseInt(req.query.limit) || 50;
        const history = await db.query(`
            SELECT r.*, m.content
            FROM memory_reviews r
            JOIN memories m ON r.memory_id = m.id
            WHERE r.user_id = ?
            ORDER BY r.last_review_at DESC
            LIMIT ?
        `, [req.user.id, limit]);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
