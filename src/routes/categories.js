/**
 * 分类路由
 * 处理知识分类管理
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const [categories] = await db.query(
            'SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order, created_at',
            [userId]
        );
        res.json({ success: true, data: { categories: categories || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const { name, parentId, sortOrder } = req.body;
        
        const [result] = await db.query(
            'INSERT INTO categories (user_id, name, parent_id, sort_order, created_at) VALUES (?, ?, ?, ?, NOW())',
            [userId, name, parentId || null, sortOrder || 0]
        );
        
        res.status(201).json({ 
            success: true, 
            data: { categoryId: result.insertId, name } 
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        const { name, parentId, sortOrder } = req.body;
        
        await db.query(
            'UPDATE categories SET name = ?, parent_id = ?, sort_order = ? WHERE id = ? AND user_id = ?',
            [name, parentId || null, sortOrder || 0, id, userId]
        );
        
        res.json({ success: true, message: '分类更新成功' });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        
        await db.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
        
        res.json({ success: true, message: '分类删除成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/knowledge', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        
        const [knowledge] = await db.query(
            'SELECT * FROM knowledge WHERE category_id = ? AND user_id = ? ORDER BY created_at DESC',
            [id, userId]
        );
        
        res.json({ success: true, data: { knowledge: knowledge || [] } });
    } catch (error) {
        next(error);
    }
});

router.get('/tree', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const [categories] = await db.query(
            'SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order, created_at',
            [userId]
        );
        
        const buildTree = (items, parentId = null) => {
            return items
                .filter(item => item.parent_id === parentId)
                .map(item => ({
                    ...item,
                    children: buildTree(items, item.id)
                }));
        };
        
        const tree = buildTree(categories || []);
        
        res.json({ success: true, data: { tree } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
