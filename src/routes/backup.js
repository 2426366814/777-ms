/**
 * 备份路由
 * 处理数据备份和恢复
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

router.get('/list', async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const backups = await db.query(
            'SELECT * FROM backup_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [userId]
        );
        
        res.json({ success: true, data: { backups: backups || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/create', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const backupType = req.body.type || 'manual';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-${userId}-${timestamp}.json`;
        const filePath = path.join(BACKUP_DIR, fileName);
        
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        
        const memories = await db.query(
            'SELECT * FROM memories WHERE user_id = ?',
            [userId]
        );
        
        const knowledge = await db.query(
            'SELECT * FROM knowledge WHERE user_id = ?',
            [userId]
        );
        
        const sessions = await db.query(
            'SELECT * FROM sessions WHERE user_id = ?',
            [userId]
        );
        
        const backupData = {
            version: '0.4.1',
            createdAt: new Date().toISOString(),
            userId,
            memories: memories || [],
            knowledge: knowledge || [],
            sessions: sessions || []
        };
        
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
        const stats = fs.statSync(filePath);
        
        await db.query(
            `INSERT INTO backup_history 
             (user_id, backup_type, file_path, file_size, status, created_at) 
             VALUES (?, ?, ?, ?, 'completed', NOW())`,
            [userId, backupType, filePath, stats.size]
        );
        
        res.status(201).json({ 
            success: true, 
            message: '备份创建成功',
            data: { fileName, fileSize: stats.size }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/restore/:file', async (req, res, next) => {
    try {
        const { file } = req.params;
        const userId = req.user?.id || 'default-user';
        const filePath = path.join(BACKUP_DIR, file);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: '备份文件不存在' });
        }
        
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (backupData.memories && backupData.memories.length > 0) {
            for (const memory of backupData.memories) {
                await db.query(
                    `INSERT IGNORE INTO memories 
                     (id, user_id, content, importance_score, access_count, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [memory.id, userId, memory.content, memory.importance_score || 5, memory.access_count || 0, memory.created_at]
                );
            }
        }
        
        if (backupData.knowledge && backupData.knowledge.length > 0) {
            for (const k of backupData.knowledge) {
                await db.query(
                    `INSERT IGNORE INTO knowledge 
                     (id, user_id, title, content, category_id, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [k.id, userId, k.title, k.content, k.category_id, k.created_at]
                );
            }
        }
        
        await db.query(
            'UPDATE backup_history SET status = ? WHERE file_path = ?',
            ['restored', filePath]
        );
        
        res.json({ 
            success: true, 
            message: '备份恢复成功',
            data: {
                memoriesRestored: backupData.memories?.length || 0,
                knowledgeRestored: backupData.knowledge?.length || 0
            }
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/:file', async (req, res, next) => {
    try {
        const { file } = req.params;
        const userId = req.user?.id || 'default-user';
        const filePath = path.join(BACKUP_DIR, file);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        await db.query(
            'DELETE FROM backup_history WHERE file_path = ? AND user_id = ?',
            [filePath, userId]
        );
        
        res.json({ success: true, message: '备份删除成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/export', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const memories = await db.query(
            'SELECT * FROM memories WHERE user_id = ?',
            [userId]
        );
        
        const knowledge = await db.query(
            'SELECT * FROM knowledge WHERE user_id = ?',
            [userId]
        );
        
        const sessions = await db.query(
            'SELECT * FROM sessions WHERE user_id = ?',
            [userId]
        );
        
        const tags = await db.query(
            `SELECT mt.* FROM memory_tags mt 
             JOIN memories m ON mt.memory_id = m.id 
             WHERE m.user_id = ?`,
            [userId]
        );
        
        const exportData = {
            version: '0.4.1',
            exportedAt: new Date().toISOString(),
            userId,
            memories: memories || [],
            knowledge: knowledge || [],
            sessions: sessions || [],
            tags: tags || []
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="export-${userId}-${Date.now()}.json"`);
        res.json(exportData);
    } catch (error) {
        next(error);
    }
});

router.post('/import', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const importData = req.body;
        
        let memoriesImported = 0;
        let knowledgeImported = 0;
        
        if (importData.memories && Array.isArray(importData.memories)) {
            for (const memory of importData.memories) {
                await db.query(
                    `INSERT INTO memories (user_id, content, importance_score, created_at) 
                     VALUES (?, ?, ?, NOW())`,
                    [userId, memory.content, memory.importance_score || 5]
                );
                memoriesImported++;
            }
        }
        
        if (importData.knowledge && Array.isArray(importData.knowledge)) {
            for (const k of importData.knowledge) {
                await db.query(
                    `INSERT INTO knowledge (user_id, title, content, category_id, created_at) 
                     VALUES (?, ?, ?, ?, NOW())`,
                    [userId, k.title, k.content, k.category_id]
                );
                knowledgeImported++;
            }
        }
        
        res.json({ 
            success: true, 
            message: '数据导入成功',
            data: { memoriesImported, knowledgeImported }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
