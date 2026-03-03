/**
 * 记忆路由
 * 处理记忆相关的 CRUD 操作
 */

const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const logger = require('../utils/logger');
const memoryService = require('../services/memoryService');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const createMemorySchema = Joi.object({
    content: Joi.string().min(1).max(10000).required(),
    category: Joi.string().max(50).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    importance: Joi.number().integer().min(1).max(10).optional(),
    metadata: Joi.object().optional()
});

const updateMemorySchema = Joi.object({
    content: Joi.string().min(1).max(10000).optional(),
    category: Joi.string().max(50).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    importance: Joi.number().integer().min(1).max(10).optional(),
    metadata: Joi.object().optional()
});

const querySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().optional(),
    tag: Joi.string().optional(),
    search: Joi.string().optional(),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'importance').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * @route   GET /api/v1/memories
 * @desc    获取记忆列表
 * @access  Private
 */
router.get('/', async (req, res, next) => {
    try {
        const { error, value } = querySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '查询参数无效',
                errors: error.details
            });
        }

        const userId = req.user.id;
        const result = await memoryService.getMemories(userId, {
            page: value.page,
            limit: value.limit,
            category: value.category,
            tag: value.tag,
            search: value.search,
            sortBy: value.sortBy === 'createdAt' ? 'created_at' : value.sortBy,
            sortOrder: value.sortOrder
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/memories/stats
 * @desc    获取记忆统计信息
 * @access  Private
 */
router.get('/stats', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const stats = await memoryService.getMemoryStats(userId);
        res.json({ success: true, data: { stats } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/memories/:id
 * @desc    获取单个记忆详情
 * @access  Private
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const memory = await memoryService.getMemoryById(userId, id);

        if (!memory) {
            return res.status(404).json({
                success: false,
                message: '记忆不存在'
            });
        }

        await memoryService.updateAccessCount(id);

        res.json({
            success: true,
            data: { memory }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/memories
 * @desc    创建新记忆
 * @access  Private
 */
router.post('/', async (req, res, next) => {
    try {
        const { error, value } = createMemorySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const userId = req.user.id;
        const memory = await memoryService.createMemory(userId, value);

        logger.info(`用户 ${userId} 创建记忆: ${memory.id}`);

        res.status(201).json({
            success: true,
            message: '记忆创建成功',
            data: { memory }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/memories/:id
 * @desc    更新记忆
 * @access  Private
 */
router.put('/:id', async (req, res, next) => {
    try {
        const { error, value } = updateMemorySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const { id } = req.params;
        const userId = req.user.id;

        logger.info(`用户 ${userId} 更新记忆: ${id}`);

        const memory = await memoryService.updateMemory(userId, id, value);

        if (!memory) {
            return res.status(404).json({
                success: false,
                message: '记忆不存在'
            });
        }

        res.json({
            success: true,
            message: '记忆更新成功',
            data: { memory }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/memories/:id
 * @desc    删除记忆
 * @access  Private
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const deleted = await memoryService.deleteMemory(userId, id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: '记忆不存在'
            });
        }

        logger.info(`用户 ${userId} 删除记忆: ${id}`);

        res.json({
            success: true,
            message: '记忆删除成功'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/memories/search
 * @desc    搜索记忆
 * @access  Private
 */
router.post('/search', async (req, res, next) => {
    try {
        const { query, limit = 10 } = req.body;
        const userId = req.user.id;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: '搜索关键词不能为空'
            });
        }

        const results = await memoryService.searchRelevantMemories(userId, query, limit);

        res.json({
            success: true,
            data: {
                query,
                results,
                total: results.length
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
