/**
 * 用户公共知识库路由
 * 用户只能查看公共知识，不能修改
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const PublicKnowledgeService = require('../services/PublicKnowledgeService');
const { authenticate } = require('../middleware/auth');

const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, message: '搜索次数过多，请稍后再试' }
});

router.use(authenticate);

/**
 * @route   GET /api/v1/public-knowledge
 * @desc    获取公共知识列表
 * @access  Private
 */
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, category, search, sortBy, sortOrder } = req.query;
        
        const result = await PublicKnowledgeService.list({
            page,
            limit,
            category,
            search,
            sortBy,
            sortOrder
        });
        
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/public-knowledge/categories
 * @desc    获取公共知识分类
 * @access  Private
 */
router.get('/categories', async (req, res, next) => {
    try {
        const categories = await PublicKnowledgeService.getCategories();
        res.json({ success: true, data: { categories } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/public-knowledge/search
 * @desc    搜索公共知识（用于对话上下文）
 * @access  Private
 */
router.get('/search', searchLimiter, async (req, res, next) => {
    try {
        const { q, limit = 5 } = req.query;
        
        if (!q || q.trim().length === 0) {
            return res.status(400).json({ success: false, message: '请提供搜索关键词' });
        }
        
        const results = await PublicKnowledgeService.searchForContext(q, parseInt(limit));
        
        res.json({ success: true, data: { results, query: q } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/public-knowledge/:id
 * @desc    获取公共知识详情
 * @access  Private
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const knowledge = await PublicKnowledgeService.getById(id, true);
        
        if (!knowledge) {
            return res.status(404).json({ success: false, message: '知识不存在' });
        }
        
        res.json({ success: true, data: knowledge });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
