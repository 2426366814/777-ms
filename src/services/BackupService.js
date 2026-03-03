/**
 * 备份服务
 * 自动备份和定时任务管理
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('../utils/database');
const logger = require('../utils/logger');

class BackupService {
    constructor() {
        this.backupDir = process.env.BACKUP_DIR || './backups';
        this.scheduledJobs = new Map();
        this.isInitialized = false;
    }
    
    async init() {
        if (this.isInitialized) return;
        
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
        
        this.scheduleDailyBackup();
        this.isInitialized = true;
        logger.info('BackupService initialized');
    }
    
    scheduleDailyBackup() {
        const job = cron.schedule('0 3 * * *', async () => {
            logger.info('Starting scheduled daily backup...');
            try {
                await this.backupAllUsers();
                logger.info('Daily backup completed successfully');
            } catch (error) {
                logger.error('Daily backup failed:', error.message);
            }
        }, {
            scheduled: true,
            timezone: 'Asia/Shanghai'
        });
        
        this.scheduledJobs.set('daily', job);
        logger.info('Daily backup scheduled at 3:00 AM Asia/Shanghai');
    }
    
    async backupAllUsers() {
        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            if (!users || users.length === 0) {
                logger.info('No users to backup');
                return;
            }
            
            for (const user of users) {
                await this.backupUser(user.user_id, 'auto');
            }
            
            await this.cleanupOldBackups(30);
        } catch (error) {
            logger.error('Backup all users failed:', error.message);
            throw error;
        }
    }
    
    async backupUser(userId, type = 'manual') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-${userId}-${timestamp}.json`;
        const filePath = path.join(this.backupDir, fileName);
        
        try {
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
            
            const backupData = {
                version: '0.4.1',
                createdAt: new Date().toISOString(),
                userId,
                type,
                data: {
                    memories: memories || [],
                    knowledge: knowledge || [],
                    sessions: sessions || [],
                    tags: tags || []
                }
            };
            
            fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
            const stats = fs.statSync(filePath);
            
            await db.query(
                `INSERT INTO backup_history 
                 (user_id, backup_type, file_path, file_size, status, created_at) 
                 VALUES (?, ?, ?, ?, 'completed', NOW())`,
                [userId, type, filePath, stats.size]
            );
            
            logger.info(`Backup created for user ${userId}: ${fileName}`);
            
            return {
                success: true,
                fileName,
                filePath,
                fileSize: stats.size,
                stats: {
                    memories: memories?.length || 0,
                    knowledge: knowledge?.length || 0,
                    sessions: sessions?.length || 0
                }
            };
        } catch (error) {
            logger.error(`Backup failed for user ${userId}:`, error.message);
            
            await db.query(
                `INSERT INTO backup_history 
                 (user_id, backup_type, file_path, file_size, status, created_at) 
                 VALUES (?, ?, ?, 0, 'failed', NOW())`,
                [userId, type, filePath]
            );
            
            throw error;
        }
    }
    
    async restoreUser(userId, backupFile) {
        const filePath = path.join(this.backupDir, backupFile);
        
        if (!fs.existsSync(filePath)) {
            throw new Error('Backup file not found');
        }
        
        try {
            const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (backupData.data.memories) {
                for (const memory of backupData.data.memories) {
                    await db.query(
                        `INSERT IGNORE INTO memories 
                         (id, user_id, content, importance_score, access_count, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [memory.id, userId, memory.content, memory.importance_score || 5, memory.access_count || 0, memory.created_at]
                    );
                }
            }
            
            if (backupData.data.knowledge) {
                for (const k of backupData.data.knowledge) {
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
            
            logger.info(`Backup restored for user ${userId}: ${backupFile}`);
            
            return {
                success: true,
                stats: {
                    memories: backupData.data.memories?.length || 0,
                    knowledge: backupData.data.knowledge?.length || 0
                }
            };
        } catch (error) {
            logger.error(`Restore failed for user ${userId}:`, error.message);
            throw error;
        }
    }
    
    async cleanupOldBackups(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        try {
            const files = fs.readdirSync(this.backupDir);
            let deletedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    await db.query('DELETE FROM backup_history WHERE file_path = ?', [filePath]);
                    deletedCount++;
                }
            }
            
            logger.info(`Cleaned up ${deletedCount} old backup files`);
            return deletedCount;
        } catch (error) {
            logger.error('Backup cleanup failed:', error.message);
            return 0;
        }
    }
    
    getBackupStats() {
        try {
            const files = fs.readdirSync(this.backupDir);
            let totalSize = 0;
            
            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
            }
            
            return {
                totalFiles: files.length,
                totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            return { totalFiles: 0, totalSize: 0, totalSizeMB: '0' };
        }
    }
    
    stopAllJobs() {
        for (const [name, job] of this.scheduledJobs) {
            job.stop();
            logger.info(`Stopped scheduled job: ${name}`);
        }
        this.scheduledJobs.clear();
    }
}

const backupService = new BackupService();

module.exports = backupService;
