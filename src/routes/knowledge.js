/**
 * 知识库路由
 * 处理知识库相关的 CRUD 操作和文件上传
 */

const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const DocumentConverter = require('../services/DocumentConverter');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

const createKnowledgeSchema = Joi.object({
    title: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).max(50000).required(),
    category: Joi.string().max(50).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    source: Joi.string().max(255).optional(),
    metadata: Joi.object().optional()
});

const updateKnowledgeSchema = Joi.object({
    title: Joi.string().min(1).max(255).optional(),
    content: Joi.string().min(1).max(50000).optional(),
    category: Joi.string().max(50).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    source: Joi.string().max(255).optional(),
    metadata: Joi.object().optional()
});

const querySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().optional(),
    tag: Joi.string().optional(),
    search: Joi.string().optional(),
    sortBy: Joi.string().valid('created_at', 'updated_at', 'title').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

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

        const { page, limit, category, tag, search, sortBy, sortOrder } = value;
        const userId = req.user?.id || 'default-user';
        const offset = (page - 1) * limit;

        let sql = 'SELECT * FROM knowledge WHERE user_id = ?';
        const params = [userId];

        if (category) {
            sql += ' AND category_id = ?';
            params.push(category);
        }

        if (search) {
            sql += ' AND (title LIKE ? OR content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const knowledge = await db.query(sql, params);

        const countSql = 'SELECT COUNT(*) as total FROM knowledge WHERE user_id = ?';
        const countResult = await db.query(countSql, [userId]);
        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

        res.json({
            success: true,
            data: {
                knowledge: knowledge || [],
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';

        const knowledge = await db.query(
            'SELECT * FROM knowledge WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (!knowledge || knowledge.length === 0) {
            return res.status(404).json({
                success: false,
                message: '知识条目不存在'
            });
        }

        res.json({
            success: true,
            data: { knowledge: knowledge[0] }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const { error, value } = createKnowledgeSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const userId = req.user?.id || 'default-user';
        const knowledgeId = uuidv4();

        await db.query(
            'INSERT INTO knowledge (id, user_id, title, content, category_id, source, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [knowledgeId, userId, value.title, value.content, value.category || null, value.source || 'manual', JSON.stringify(value.metadata || {})]
        );

        logger.info(`用户 ${userId} 创建知识条目: ${knowledgeId}`);

        res.status(201).json({
            success: true,
            message: '知识条目创建成功',
            data: { 
                knowledge: {
                    id: knowledgeId,
                    userId,
                    ...value,
                    createdAt: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const { error, value } = updateKnowledgeSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '输入数据无效',
                errors: error.details
            });
        }

        const { id } = req.params;
        const userId = req.user?.id || 'default-user';

        const existing = await db.query(
            'SELECT id FROM knowledge WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (!existing || existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: '知识条目不存在'
            });
        }

        await db.query(
            'UPDATE knowledge SET title = ?, content = ?, category_id = ?, source = ?, metadata = ?, updated_at = NOW() WHERE id = ?',
            [value.title, value.content, value.category || null, value.source || 'manual', JSON.stringify(value.metadata || {}), id]
        );

        logger.info(`用户 ${userId} 更新知识条目: ${id}`);

        res.json({
            success: true,
            message: '知识条目更新成功'
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';

        const existing = await db.query(
            'SELECT id FROM knowledge WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (!existing || existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: '知识条目不存在'
            });
        }

        await db.query('DELETE FROM knowledge WHERE id = ?', [id]);

        logger.info(`用户 ${userId} 删除知识条目: ${id}`);

        res.json({
            success: true,
            message: '知识条目删除成功'
        });
    } catch (error) {
        next(error);
    }
});

router.post('/search', async (req, res, next) => {
    try {
        const { query, limit = 10 } = req.body;
        const userId = req.user?.id || 'default-user';

        if (!query) {
            return res.status(400).json({
                success: false,
                message: '搜索关键词不能为空'
            });
        }

        const results = await db.query(
            'SELECT id, title, content, category_id, source, created_at FROM knowledge WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY created_at DESC LIMIT ?',
            [userId, `%${query}%`, `%${query}%`, limit]
        );

        res.json({
            success: true,
            data: {
                query,
                results: results || [],
                total: results ? results.length : 0
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请选择要上传的文件'
            });
        }

        const userId = req.user?.id || 'default-user';
        const fileInfo = DocumentConverter.getFileInfo(req.file.originalname);

        if (!fileInfo.supported) {
            return res.status(400).json({
                success: false,
                message: `不支持的文件格式: ${fileInfo.extension}`,
                supportedFormats: DocumentConverter.getSupportedFormats()
            });
        }

        logger.info(`用户 ${userId} 上传文档: ${req.file.originalname} (${req.file.size} 字节)`);

        const result = await DocumentConverter.convert(req.file, userId);

        if (result.status === 'completed' && result.content) {
            const knowledgeId = uuidv4();
            const title = req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname));
            
            await db.query(
                'INSERT INTO knowledge (id, user_id, title, content, source, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [knowledgeId, userId, title, result.content, 'upload', JSON.stringify({
                    originalName: req.file.originalname,
                    format: result.format,
                    size: req.file.size,
                    contentLength: result.contentLength
                })]
            );

            logger.info(`文档已转化并存储: ${knowledgeId}`);

            res.status(201).json({
                success: true,
                message: '文档上传并转化成功',
                data: {
                    id: knowledgeId,
                    title,
                    format: result.format,
                    contentLength: result.contentLength,
                    originalName: req.file.originalname,
                    originalDeleted: true
                }
            });
        } else {
            res.status(202).json({
                success: true,
                message: '文档上传成功，转化处理中',
                data: {
                    jobId: result.jobId,
                    status: result.status
                }
            });
        }
    } catch (error) {
        logger.error(`文档上传失败: ${error.message}`);
        next(error);
    }
});

router.get('/formats/supported', (req, res) => {
    res.json({
        success: true,
        data: {
            formats: DocumentConverter.getSupportedFormats()
        }
    });
});

module.exports = router;
