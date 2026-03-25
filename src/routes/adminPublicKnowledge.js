/**
 * 管理员公共知识库路由
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const router = express.Router();
const logger = require('../utils/logger');
const PublicKnowledgeService = require('../services/PublicKnowledgeService');
const { authenticate, requireRole, isAdmin } = require('../middleware/auth');

const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: { success: false, message: '创建次数过多，请稍后再试' }
});

const importLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: '导入次数过多，请稍后再试' }
});

const createSchema = Joi.object({
    title: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).required(),
    category: Joi.string().max(100),
    tags: Joi.array().items(Joi.string()),
    source: Joi.string().max(255),
    metadata: Joi.object(),
    priority: Joi.number().integer().min(0).max(100)
});

const updateSchema = Joi.object({
    title: Joi.string().min(1).max(255),
    content: Joi.string().min(1),
    category: Joi.string().max(100),
    tags: Joi.array().items(Joi.string()),
    source: Joi.string().max(255),
    metadata: Joi.object(),
    priority: Joi.number().integer().min(0).max(100),
    is_active: Joi.boolean()
});

router.use(authenticate, requireRole(['admin']));

/**
 * @route   POST /api/v1/admin/public-knowledge
 * @desc    创建公共知识
 * @access  Admin
 */
router.post('/', createLimiter, async (req, res, next) => {
    try {
        const { error, value } = createSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const adminId = req.user.id;
        const knowledge = await PublicKnowledgeService.create(value, adminId);
        
        res.status(201).json({ success: true, message: '创建成功', data: knowledge });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/admin/public-knowledge/:id
 * @desc    更新公共知识
 * @access  Admin
 */
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { error, value } = updateSchema.validate(req.body);
        
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const adminId = req.user.id;
        await PublicKnowledgeService.update(id, value, adminId);
        
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/admin/public-knowledge/:id
 * @desc    删除公共知识
 * @access  Admin
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        
        await PublicKnowledgeService.delete(id, adminId);
        
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/admin/public-knowledge/import
 * @desc    批量导入公共知识
 * @access  Admin
 */
router.post('/import', importLimiter, async (req, res, next) => {
    try {
        const { items } = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: '请提供知识数组' });
        }
        
        if (items.length > 100) {
            return res.status(400).json({ success: false, message: '单次最多导入100条' });
        }
        
        const adminId = req.user.id;
        const result = await PublicKnowledgeService.batchImport(items, adminId);
        
        res.json({ success: true, message: '导入完成', data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/admin/public-knowledge
 * @desc    获取公共知识列表（管理员视图，包含禁用的）
 * @access  Admin
 */
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, category, search, sortBy, sortOrder, includeInactive } = req.query;
        
        const options = { page, limit, category, search, sortBy, sortOrder };
        
        if (includeInactive === 'true') {
            const result = await PublicKnowledgeService.listAll(options);
            return res.json({ success: true, data: result });
        }
        
        const result = await PublicKnowledgeService.list(options);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/admin/public-knowledge/stats
 * @desc    获取公共知识统计
 * @access  Admin
 */
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await PublicKnowledgeService.getStats();
        const categories = await PublicKnowledgeService.getCategories();
        
        res.json({ success: true, data: { stats, categories } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/admin/public-knowledge/:id
 * @desc    获取公共知识详情
 * @access  Admin
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const knowledge = await PublicKnowledgeService.getById(id, false);
        
        if (!knowledge) {
            return res.status(404).json({ success: false, message: '知识不存在' });
        }
        
        res.json({ success: true, data: knowledge });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
