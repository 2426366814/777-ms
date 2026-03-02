/**
 * Auto Manager Service
 * LLM自动管理记忆体 - 无需对话触发
 * 包括：自动提取、自动复习、自动清理、自动转化
 */

const cron = require('node-cron');
const db = require('../utils/database');
const logger = require('../utils/logger');
const memoryService = require('./memoryService');
const knowledgeService = require('./KnowledgeService');
const reviewService = require('./ReviewService');
const LLMService = require('./LLMService');

const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER || 'deepseek';

class AutoManager {
    constructor() {
        this.isRunning = false;
        this.jobs = [];
        this.autoExtractEnabled = process.env.AUTO_EXTRACT_ENABLED !== 'false';
        this.autoReviewEnabled = process.env.AUTO_REVIEW_ENABLED !== 'false';
        this.autoCleanupEnabled = process.env.AUTO_CLEANUP_ENABLED !== 'false';
        this.autoConvertEnabled = process.env.AUTO_CONVERT_ENABLED !== 'false';
    }

    start() {
        if (this.isRunning) {
            logger.warn('AutoManager is already running');
            return;
        }

        logger.info('Starting AutoManager...');

        // 每小时执行一次自动复习调度
        this.jobs.push(cron.schedule('0 * * * *', async () => {
            await this.runAutoReviewSchedule();
        }));

        // 每天凌晨2点执行自动清理
        this.jobs.push(cron.schedule('0 2 * * *', async () => {
            await this.runAutoCleanup();
        }));

        // 每6小时执行一次记忆重要性评估
        this.jobs.push(cron.schedule('0 */6 * * *', async () => {
            await this.runImportanceAssessment();
        }));

        // 每15分钟检查待处理任务
        this.jobs.push(cron.schedule('*/15 * * * *', async () => {
            await this.processPendingTasks();
        }));

        this.isRunning = true;
        logger.info('AutoManager started with ' + this.jobs.length + ' scheduled jobs');
    }

    stop() {
        for (const job of this.jobs) {
            job.stop();
        }
        this.jobs = [];
        this.isRunning = false;
        logger.info('AutoManager stopped');
    }

    async runAutoReviewSchedule() {
        if (!this.autoReviewEnabled) return;

        logger.info('Running auto review schedule...');

        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            for (const user of users) {
                try {
                    const result = await reviewService.autoScheduleReviews(user.user_id);
                    logger.info(`Auto-scheduled ${result.scheduled} reviews for user ${user.user_id}`);
                    
                    await this.sendReviewReminder(user.user_id);
                } catch (err) {
                    logger.error(`Failed to schedule reviews for user ${user.user_id}:`, err.message);
                }
            }
        } catch (error) {
            logger.error('Auto review schedule failed:', error);
        }
    }

    async sendReviewReminder(userId) {
        try {
            const dueReviews = await db.query(
                `SELECT COUNT(*) as count FROM review_queue 
                 WHERE user_id = ? AND next_review <= NOW() AND status = 'pending'`,
                [userId]
            );

            const count = dueReviews[0]?.count || 0;
            if (count > 0) {
                await db.query(
                    `INSERT INTO notifications (user_id, type, title, content, created_at)
                     VALUES (?, 'review', '复习提醒', ?, NOW())
                     ON DUPLICATE KEY UPDATE content = VALUES(content), created_at = NOW()`,
                    [userId, `您有 ${count} 条记忆需要复习`]
                );
                logger.info(`Sent review reminder to user ${userId}: ${count} items due`);
            }
        } catch (error) {
            logger.warn('Failed to send review reminder:', error.message);
        }
    }

    async runAutoCleanup() {
        if (!this.autoCleanupEnabled) return;

        logger.info('Running auto cleanup...');

        try {
            // 清理30天未访问且重要性低于3的记忆
            const result = await db.query(
                `DELETE FROM memories 
                 WHERE last_accessed_at < DATE_SUB(NOW(), INTERVAL 30 DAY) 
                 AND importance < 3 
                 AND access_count < 2`
            );

            logger.info(`Auto cleanup removed ${result.affectedRows} low-importance memories`);

            // 清理空的或无效的知识库条目
            const knowledgeResult = await db.query(
                `DELETE FROM knowledge 
                 WHERE content IS NULL OR content = '' OR LENGTH(content) < 10`
            );

            logger.info(`Auto cleanup removed ${knowledgeResult.affectedRows} invalid knowledge entries`);
        } catch (error) {
            logger.error('Auto cleanup failed:', error);
        }
    }

    async runImportanceAssessment() {
        logger.info('Running importance assessment...');

        try {
            // 获取最近创建但未评估的记忆
            const memories = await db.query(
                `SELECT m.id, m.content, m.user_id, m.importance
                 FROM memories m
                 WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                 AND m.importance = 5
                 LIMIT 20`
            );

            for (const memory of memories) {
                try {
                    const importance = await this.assessMemoryImportance(memory.user_id, memory.content);
                    
                    if (importance !== 5) {
                        await db.query(
                            'UPDATE memories SET importance = ? WHERE id = ?',
                            [importance, memory.id]
                        );
                        logger.info(`Updated memory ${memory.id} importance to ${importance}`);
                    }
                } catch (err) {
                    logger.warn(`Failed to assess memory ${memory.id}:`, err.message);
                }
            }
        } catch (error) {
            logger.error('Importance assessment failed:', error);
        }
    }

    async assessMemoryImportance(userId, content) {
        try {
            const prompt = `评估以下记忆内容的重要性，返回1-10的数字（1=不重要，10=非常重要）：

记忆内容: ${content.substring(0, 500)}

只返回数字，不要其他内容。`;

            const response = await LLMService.chat(userId, DEFAULT_PROVIDER, [
                { role: 'user', content: prompt }
            ], { maxTokens: 10 });

            const importance = parseInt(response.content.trim());
            return isNaN(importance) ? 5 : Math.min(10, Math.max(1, importance));
        } catch (error) {
            logger.warn('Importance assessment failed:', error.message);
            return 5;
        }
    }

    async processPendingTasks() {
        try {
            // 处理待提取的对话
            const pendingExtractions = await db.query(
                `SELECT * FROM pending_extractions 
                 WHERE status = 'pending' 
                 ORDER BY created_at ASC 
                 LIMIT 5`
            );

            for (const task of pendingExtractions || []) {
                try {
                    await this.processExtractionTask(task);
                } catch (err) {
                    logger.error(`Failed to process extraction task ${task.id}:`, err.message);
                }
            }

            // 处理待转化的内容
            const pendingConversions = await db.query(
                `SELECT * FROM pending_conversions 
                 WHERE status = 'pending' 
                 ORDER BY created_at ASC 
                 LIMIT 5`
            );

            for (const task of pendingConversions || []) {
                try {
                    await this.processConversionTask(task);
                } catch (err) {
                    logger.error(`Failed to process conversion task ${task.id}:`, err.message);
                }
            }
        } catch (error) {
            // 表可能不存在，忽略错误
        }
    }

    async processExtractionTask(task) {
        const MemoryExtractor = require('./MemoryExtractor');
        
        try {
            const extraction = await MemoryExtractor.extractFromConversation(
                task.user_id,
                JSON.parse(task.content),
                { provider: DEFAULT_PROVIDER }
            );

            if (extraction && extraction.memories) {
                for (const mem of extraction.memories) {
                    await memoryService.createMemory(task.user_id, {
                        content: mem.content,
                        category: mem.type || 'auto-extracted',
                        importance: mem.importance || 5,
                        tags: mem.tags || []
                    });
                }
            }

            await db.query(
                'UPDATE pending_extractions SET status = ? WHERE id = ?',
                ['completed', task.id]
            );

            logger.info(`Completed extraction task ${task.id}`);
        } catch (error) {
            await db.query(
                'UPDATE pending_extractions SET status = ?, error = ? WHERE id = ?',
                ['failed', error.message, task.id]
            );
            throw error;
        }
    }

    async processConversionTask(task) {
        try {
            await knowledgeService.autoConvert(
                task.user_id,
                task.content,
                task.type || 'text'
            );

            await db.query(
                'UPDATE pending_conversions SET status = ? WHERE id = ?',
                ['completed', task.id]
            );

            logger.info(`Completed conversion task ${task.id}`);
        } catch (error) {
            await db.query(
                'UPDATE pending_conversions SET status = ?, error = ? WHERE id = ?',
                ['failed', error.message, task.id]
            );
            throw error;
        }
    }

    async submitExtractionTask(userId, content) {
        try {
            await db.query(
                `INSERT INTO pending_extractions (user_id, content, status, created_at)
                 VALUES (?, ?, 'pending', NOW())`,
                [userId, JSON.stringify(content)]
            );
            logger.info(`Submitted extraction task for user ${userId}`);
        } catch (error) {
            // 表不存在时直接处理
            const MemoryExtractor = require('./MemoryExtractor');
            const extraction = await MemoryExtractor.extractFromConversation(
                userId,
                content,
                { provider: DEFAULT_PROVIDER }
            );

            if (extraction && extraction.memories) {
                for (const mem of extraction.memories) {
                    await memoryService.createMemory(userId, {
                        content: mem.content,
                        category: mem.type || 'auto-extracted',
                        importance: mem.importance || 5,
                        tags: mem.tags || []
                    });
                }
            }
        }
    }

    async submitConversionTask(userId, content, type) {
        try {
            await db.query(
                `INSERT INTO pending_conversions (user_id, content, type, status, created_at)
                 VALUES (?, ?, ?, 'pending', NOW())`,
                [userId, content, type]
            );
            logger.info(`Submitted conversion task for user ${userId}`);
        } catch (error) {
            // 表不存在时直接处理
            await knowledgeService.autoConvert(userId, content, type);
        }
    }

    async triggerManualExtraction(userId, content, provider) {
        const MemoryExtractor = require('./MemoryExtractor');
        
        const extraction = await MemoryExtractor.extractFromConversation(
            userId,
            content,
            { provider: provider || DEFAULT_PROVIDER }
        );

        const createdMemories = [];
        if (extraction && extraction.memories) {
            for (const mem of extraction.memories) {
                const memory = await memoryService.createMemory(userId, {
                    content: mem.content,
                    category: mem.type || 'manual-extracted',
                    importance: mem.importance || 5,
                    tags: mem.tags || []
                });
                createdMemories.push(memory);
            }
        }

        return createdMemories;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            jobs: this.jobs.length,
            features: {
                autoExtract: this.autoExtractEnabled,
                autoReview: this.autoReviewEnabled,
                autoCleanup: this.autoCleanupEnabled,
                autoConvert: this.autoConvertEnabled
            }
        };
    }
}

const autoManager = new AutoManager();
module.exports = autoManager;
