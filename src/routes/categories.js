/**
 * 分类路由
 * 处理分类管理
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');

/**
 * @route   GET /api/v1/categories
 * @desc    获取所有分类
 * @access  Private
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const categories = await db.query(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM memories WHERE category = c.name AND user_id = ?) as memory_count
             FROM categories c
             WHERE c.user_id = ?
             ORDER BY c.sort_order ASC, c.created_at DESC`,
            [userId, userId]
        );
        
        res.json({ 
            success: true, 
            data: { categories: categories || [] } 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/categories/:id
 * @desc    获取单个分类详情
 * @access  Private
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        
        const categories = await db.query(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM memories WHERE category = c.name AND user_id = ?) as memory_count
             FROM categories c
             WHERE c.id = ? AND c.user_id = ?`,
            [userId, id, userId]
        );
        
        if (!categories || categories.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '分类不存在' 
            });
        }
        
        res.json({ 
            success: true, 
            data: { category: categories[0] } 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/categories
 * @desc    创建新分类
 * @access  Private
 */
router.post('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { name, parentId, sortOrder } = req.body;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: '分类名称不能为空' 
            });
        }
        
        const existing = await db.query(
            'SELECT id FROM categories WHERE name = ? AND user_id = ?',
            [name, userId]
        );
        
        if (existing && existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: '分类名称已存在' 
            });
        }
        
        const result = await db.query(
            `INSERT INTO categories (user_id, name, parent_id, sort_order, created_at) 
             VALUES (?, ?, ?, ?, NOW())`,
            [userId, name, parentId || null, sortOrder || 0]
        );
        
        const categoryId = result.insertId;
        
        logger.info(`用户 ${userId} 创建分类: ${name}`);
        
        res.status(201).json({ 
            success: true, 
            message: '分类创建成功',
            data: { 
                categoryId,
                name
            } 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/categories/:id
 * @desc    更新分类
 * @access  Private
 */
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        const { name, parentId, sortOrder } = req.body;
        
        const existing = await db.query(
            'SELECT * FROM categories WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        if (!existing || existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '分类不存在或无权限修改' 
            });
        }
        
        if (name) {
            const duplicate = await db.query(
                'SELECT id FROM categories WHERE name = ? AND user_id = ? AND id != ?',
                [name, userId, id]
            );
            
            if (duplicate && duplicate.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '分类名称已存在' 
                });
            }
        }
        
        await db.query(
            `UPDATE categories 
             SET name = COALESCE(?, name), 
                 parent_id = COALESCE(?, parent_id), 
                 sort_order = COALESCE(?, sort_order)
             WHERE id = ? AND user_id = ?`,
            [name, parentId, sortOrder, id, userId]
        );
        
        logger.info(`用户 ${userId} 更新分类: ${id}`);
        
        res.json({ 
            success: true, 
            message: '分类更新成功' 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    删除分类
 * @access  Private
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        
        const existing = await db.query(
            'SELECT * FROM categories WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        if (!existing || existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '分类不存在或无权限删除' 
            });
        }
        
        await db.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
        
        logger.info(`用户 ${userId} 删除分类: ${id}`);
        
        res.json({ 
            success: true, 
            message: '分类删除成功' 
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/categories/:id/memories
 * @desc    获取分类下的记忆
 * @access  Private
 */
router.get('/:id/memories', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const category = await db.query(
            'SELECT name FROM categories WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        if (!category || category.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '分类不存在' 
            });
        }
        
        const categoryName = category[0].name;
        
        const memories = await db.query(
            `SELECT * FROM memories 
             WHERE category = ? AND user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [categoryName, userId, limit, offset]
        );
        
        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM memories WHERE category = ? AND user_id = ?',
            [categoryName, userId]
        );
        
        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
        
        res.json({ 
            success: true, 
            data: { 
                memories: memories || [],
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

/**
 * @route   POST /api/v1/categories/reorder
 * @desc    重新排序分类
 * @access  Private
 */
router.post('/reorder', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { orders } = req.body;
        
        if (!orders || !Array.isArray(orders)) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的排序数据' 
            });
        }
        
        for (const item of orders) {
            await db.query(
                'UPDATE categories SET sort_order = ? WHERE id = ? AND user_id = ?',
                [item.sortOrder, item.id, userId]
            );
        }
        
        logger.info(`用户 ${userId} 重新排序分类`);
        
        res.json({ 
            success: true, 
            message: '分类排序更新成功' 
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
