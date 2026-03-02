/**
 * 批量操作路由
 * 批量创建、更新、删除、导入导出
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.post('/create', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { memories } = req.body;
        
        if (!Array.isArray(memories) || memories.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供记忆数组'
            });
        }
        
        if (memories.length > 100) {
            return res.status(400).json({
                success: false,
                message: '单次最多创建100条记忆'
            });
        }
        
        const results = [];
        const errors = [];
        
        for (let i = 0; i < memories.length; i++) {
            try {
                const memory = memories[i];
                const id = uuidv4();
                
                await db.query(
                    'INSERT INTO memories (id, user_id, content, type, category, importance, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                    [id, userId, memory.content, memory.type || 'general', memory.category || null, memory.importance || 5, JSON.stringify(memory.tags || [])]
                );
                
                results.push({ index: i, id, success: true });
            } catch (error) {
                errors.push({ index: i, error: error.message });
            }
        }
        
        res.json({
            success: true,
            message: `成功创建 ${results.length} 条记忆`,
            data: {
                created: results.length,
                failed: errors.length,
                results,
                errors
            }
        });
    } catch (error) {
        logger.error('批量创建失败:', error);
        res.status(500).json({
            success: false,
            message: '批量创建失败'
        });
    }
});

router.put('/update', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { updates } = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供更新数组'
            });
        }
        
        const results = [];
        const errors = [];
        
        for (let i = 0; i < updates.length; i++) {
            try {
                const update = updates[i];
                
                const memory = await db.queryOne(
                    'SELECT id FROM memories WHERE id = ? AND user_id = ?',
                    [update.id, userId]
                );
                
                if (!memory) {
                    errors.push({ index: i, error: '记忆不存在或无权限' });
                    continue;
                }
                
                const fields = [];
                const values = [];
                
                if (update.content !== undefined) {
                    fields.push('content = ?');
                    values.push(update.content);
                }
                if (update.type !== undefined) {
                    fields.push('type = ?');
                    values.push(update.type);
                }
                if (update.category !== undefined) {
                    fields.push('category = ?');
                    values.push(update.category);
                }
                if (update.importance !== undefined) {
                    fields.push('importance = ?');
                    values.push(update.importance);
                }
                if (update.tags !== undefined) {
                    fields.push('tags = ?');
                    values.push(JSON.stringify(update.tags));
                }
                
                if (fields.length > 0) {
                    fields.push('updated_at = NOW()');
                    values.push(update.id);
                    
                    await db.query(
                        `UPDATE memories SET ${fields.join(', ')} WHERE id = ?`,
                        values
                    );
                }
                
                results.push({ index: i, id: update.id, success: true });
            } catch (error) {
                errors.push({ index: i, error: error.message });
            }
        }
        
        res.json({
            success: true,
            message: `成功更新 ${results.length} 条记忆`,
            data: {
                updated: results.length,
                failed: errors.length,
                results,
                errors
            }
        });
    } catch (error) {
        logger.error('批量更新失败:', error);
        res.status(500).json({
            success: false,
            message: '批量更新失败'
        });
    }
});

router.delete('/delete', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供记忆ID数组'
            });
        }
        
        if (ids.length > 100) {
            return res.status(400).json({
                success: false,
                message: '单次最多删除100条记忆'
            });
        }
        
        const placeholders = ids.map(() => '?').join(',');
        const result = await db.query(
            `DELETE FROM memories WHERE id IN (${placeholders}) AND user_id = ?`,
            [...ids, userId]
        );
        
        res.json({
            success: true,
            message: `成功删除 ${result.affectedRows} 条记忆`,
            data: {
                deleted: result.affectedRows,
                requested: ids.length
            }
        });
    } catch (error) {
        logger.error('批量删除失败:', error);
        res.status(500).json({
            success: false,
            message: '批量删除失败'
        });
    }
});

router.post('/export', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { format = 'json', ids } = req.body;
        
        let memories;
        if (ids && Array.isArray(ids) && ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            memories = await db.query(
                `SELECT * FROM memories WHERE id IN (${placeholders}) AND user_id = ?`,
                [...ids, userId]
            );
        } else {
            memories = await db.query(
                'SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC',
                [userId]
            );
        }
        
        if (format === 'csv') {
            const headers = ['ID', '类型', '分类', '内容', '重要性', '标签', '创建时间'];
            const rows = memories.map(m => [
                m.id,
                m.type || 'general',
                `"${(m.category || '').replace(/"/g, '""')}"`,
                `"${(m.content || '').replace(/"/g, '""')}"`,
                m.importance,
                `"${m.tags || '[]'}"`,
                m.created_at
            ]);
            
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=memories.csv');
            res.send('\ufeff' + csv);
        } else if (format === 'markdown') {
            const md = memories.map(m => {
                return `## ${m.type || 'general'}: ${m.category || '无分类'}\n\n${m.content}\n\n**重要性**: ${m.importance}/10  \n**创建时间**: ${m.created_at}\n\n---\n`;
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=memories.md');
            res.send(md);
        } else {
            res.json({
                success: true,
                data: memories,
                exportedAt: new Date().toISOString(),
                count: memories.length
            });
        }
    } catch (error) {
        logger.error('导出失败:', error);
        res.status(500).json({
            success: false,
            message: '导出失败'
        });
    }
});

router.post('/import', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { memories, format = 'json' } = req.body;
        
        if (!Array.isArray(memories) || memories.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供记忆数组'
            });
        }
        
        const results = [];
        const errors = [];
        
        for (let i = 0; i < memories.length; i++) {
            try {
                const memory = memories[i];
                const id = uuidv4();
                
                await db.query(
                    'INSERT INTO memories (id, user_id, content, type, category, importance, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                    [id, userId, memory.content || '', memory.type || 'general', memory.category || null, memory.importance || 5, JSON.stringify(memory.tags || [])]
                );
                
                results.push({ index: i, id, success: true });
            } catch (error) {
                errors.push({ index: i, error: error.message });
            }
        }
        
        res.json({
            success: true,
            message: `成功导入 ${results.length} 条记忆`,
            data: {
                imported: results.length,
                failed: errors.length,
                results,
                errors
            }
        });
    } catch (error) {
        logger.error('导入失败:', error);
        res.status(500).json({
            success: false,
            message: '导入失败'
        });
    }
});

module.exports = router;
