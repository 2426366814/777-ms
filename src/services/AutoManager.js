/**
 * Auto Manager Service - 统一自动功能管理器
 * 整合所有LLM自动管理记忆体功能，避免重复和冲突
 * 
 * 功能列表:
 * 1. 自动上下文载入 - 对话时自动注入相关记忆和知识
 * 2. 自动记忆提取 - 从对话中提取重要信息
 * 3. 自动记忆关联 - 创建记忆时关联相似记忆
 * 4. 自动复习调度 - 艾宾浩斯遗忘曲线复习
 * 5. 自动重要性评估 - LLM评估记忆重要性
 * 6. 自动清理 - 清理低重要性长期未访问记忆
 * 7. 自动摘要 - 周期性生成记忆摘要
 * 8. 自动标签/分类 - LLM自动生成标签和分类
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
        
        this.config = {
            autoExtract: process.env.AUTO_EXTRACT_ENABLED !== 'false',
            autoReview: process.env.AUTO_REVIEW_ENABLED !== 'false',
            autoCleanup: process.env.AUTO_CLEANUP_ENABLED !== 'false',
            autoConvert: process.env.AUTO_CONVERT_ENABLED !== 'false',
            autoLink: process.env.AUTO_LINK_ENABLED !== 'false',
            autoSummarize: process.env.AUTO_SUMMARIZE_ENABLED !== 'false',
            autoTag: process.env.AUTO_TAG_ENABLED !== 'false',
            autoContextLoad: process.env.AUTO_CONTEXT_LOAD !== 'false'
        };
        
        this.limits = {
            maxContextLength: parseInt(process.env.MAX_CONTEXT_LENGTH) || 4000,
            maxLinksPerMemory: parseInt(process.env.MAX_LINKS_PER_MEMORY) || 5,
            similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.3,
            minMemoriesToSummarize: parseInt(process.env.MIN_MEMORIES_TO_SUMMARIZE) || 5,
            maxMemoriesPerSummary: parseInt(process.env.MAX_MEMORIES_PER_SUMMARY) || 20
        };
    }

    start() {
        if (this.isRunning) {
            logger.warn('AutoManager is already running');
            return;
        }

        logger.info('Starting AutoManager with all auto features...');
        logger.info('Features enabled: ' + Object.entries(this.config).filter(([,v]) => v).map(([k]) => k).join(', '));

        this.jobs.push(cron.schedule('0 * * * *', async () => {
            await this.runAutoReviewSchedule();
        }));

        this.jobs.push(cron.schedule('0 2 * * *', async () => {
            await this.runAutoCleanup();
        }));

        this.jobs.push(cron.schedule('0 */6 * * *', async () => {
            await this.runImportanceAssessment();
        }));

        this.jobs.push(cron.schedule('*/15 * * * *', async () => {
            await this.processPendingTasks();
        }));

        this.jobs.push(cron.schedule('0 3 * * 0', async () => {
            await this.runWeeklySummary();
        }));

        this.jobs.push(cron.schedule('0 4 1 * *', async () => {
            await this.runMonthlySummary();
        }));

        this.jobs.push(cron.schedule('0 5 * * *', async () => {
            await this.runAutoLinkBatch();
        }));

        this.isRunning = true;
        logger.info(`AutoManager started with ${this.jobs.length} scheduled jobs`);
    }

    stop() {
        for (const job of this.jobs) {
            job.stop();
        }
        this.jobs = [];
        this.isRunning = false;
        logger.info('AutoManager stopped');
    }

    async buildSmartContext(userId, query, options = {}) {
        if (!this.config.autoContextLoad) {
            return { context: '', sources: [] };
        }

        const {
            includeMemory = true,
            includeKnowledge = true,
            memoryLimit = 5,
            knowledgeLimit = 3
        } = options;

        const sources = [];
        let context = '';
        let currentLength = 0;

        if (includeMemory && query) {
            const memories = await memoryService.searchRelevantMemories(userId, query, memoryLimit);
            if (memories.length > 0) {
                const memoryContext = this._formatMemories(memories);
                if (currentLength + memoryContext.length <= this.limits.maxContextLength) {
                    context += memoryContext;
                    currentLength += memoryContext.length;
                    sources.push({ type: 'memory', count: memories.length });
                }
            }
        }

        if (includeKnowledge && query) {
            try {
                const knowledge = await knowledgeService.searchKnowledge(userId, query, knowledgeLimit);
                if (knowledge.length > 0) {
                    const knowledgeContext = this._formatKnowledge(knowledge);
                    if (currentLength + knowledgeContext.length <= this.limits.maxContextLength) {
                        context += knowledgeContext;
                        currentLength += knowledgeContext.length;
                        sources.push({ type: 'knowledge', count: knowledge.length });
                    }
                }
            } catch (err) {
                logger.warn('Knowledge search failed:', err.message);
            }
        }

        return { context, sources };
    }

    _formatMemories(memories) {
        if (!memories || memories.length === 0) return '';
        let context = '\n[相关记忆上下文]\n';
        for (const m of memories) {
            context += `- [${m.category || 'general'}] ${m.content.substring(0, 200)}\n`;
        }
        context += '[/相关记忆上下文]\n';
        return context;
    }

    _formatKnowledge(knowledge) {
        if (!knowledge || knowledge.length === 0) return '';
        let context = '\n[相关知识库内容]\n';
        for (const k of knowledge) {
            context += `- [${k.category || 'general'}] ${k.title}: ${k.content?.substring(0, 200)}\n`;
        }
        context += '[/相关知识库内容]\n';
        return context;
    }

    async injectContextIntoMessages(userId, messages, query) {
        if (!this.config.autoContextLoad || !query) {
            return messages;
        }

        const { context } = await this.buildSmartContext(userId, query);
        
        if (!context || context.trim().length === 0) {
            return messages;
        }

        const systemIndex = messages.findIndex(m => m.role === 'system');
        
        if (systemIndex >= 0) {
            messages[systemIndex].content += '\n\n' + context;
        } else {
            messages.unshift({
                role: 'system',
                content: '你是一个智能助手，可以根据用户的记忆和知识库提供个性化回答。\n' + context
            });
        }

        return messages;
    }

    async autoLinkMemory(userId, memoryId, content) {
        if (!this.config.autoLink) {
            return { linked: 0, links: [] };
        }

        try {
            const similar = await db.query(
                `SELECT m.id, m.content, m.category,
                        MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE) as similarity
                 FROM memories m
                 WHERE m.user_id = ? AND m.id != ?
                 AND MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE)
                 HAVING similarity >= ?
                 ORDER BY similarity DESC
                 LIMIT ?`,
                [content, userId, memoryId, content, this.limits.similarityThreshold, this.limits.maxLinksPerMemory]
            );

            const links = [];
            for (const s of similar) {
                await db.query(
                    `INSERT IGNORE INTO memory_links (memory_id, related_id, similarity, created_at)
                     VALUES (?, ?, ?, NOW())`,
                    [memoryId, s.id, s.similarity]
                );
                await db.query(
                    `INSERT IGNORE INTO memory_links (memory_id, related_id, similarity, created_at)
                     VALUES (?, ?, ?, NOW())`,
                    [s.id, memoryId, s.similarity]
                );
                links.push({ memoryId: s.id, similarity: s.similarity });
            }

            if (links.length > 0) {
                logger.info(`Auto-linked memory ${memoryId} with ${links.length} similar memories`);
            }

            return { linked: links.length, links };
        } catch (error) {
            logger.warn('Auto-link failed:', error.message);
            return { linked: 0, links: [] };
        }
    }

    async runAutoLinkBatch() {
        if (!this.config.autoLink) return;

        logger.info('Running batch auto-link...');

        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            for (const user of users) {
                const unlinked = await db.query(
                    `SELECT m.id, m.content FROM memories m
                     WHERE m.user_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                     AND NOT EXISTS (SELECT 1 FROM memory_links WHERE memory_id = m.id)
                     LIMIT 20`,
                    [user.user_id]
                );

                for (const m of unlinked) {
                    await this.autoLinkMemory(user.user_id, m.id, m.content);
                }
            }
        } catch (error) {
            logger.error('Batch auto-link failed:', error);
        }
    }

    async runWeeklySummary() {
        if (!this.config.autoSummarize) return;

        logger.info('Running weekly memory summary...');

        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            for (const user of users) {
                await this._generateUserSummary(user.user_id, 'weekly', 7);
            }
        } catch (error) {
            logger.error('Weekly summary failed:', error);
        }
    }

    async runMonthlySummary() {
        if (!this.config.autoSummarize) return;

        logger.info('Running monthly memory summary...');

        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            for (const user of users) {
                await this._generateUserSummary(user.user_id, 'monthly', 30);
            }
        } catch (error) {
            logger.error('Monthly summary failed:', error);
        }
    }

    async _generateUserSummary(userId, type, days) {
        const memories = await db.query(
            `SELECT id, content, category, importance FROM memories
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             ORDER BY importance DESC, created_at DESC
             LIMIT ?`,
            [userId, days, this.limits.maxMemoriesPerSummary]
        );

        if (memories.length < this.limits.minMemoriesToSummarize) {
            return { summarized: 0, reason: 'Not enough memories' };
        }

        const memoryText = memories.map((m, i) => 
            `${i + 1}. [${m.category}] ${m.content.substring(0, 100)}`
        ).join('\n');

        const periodText = type === 'monthly' ? '本月' : '本周';

        try {
            const response = await LLMService.chat(userId, DEFAULT_PROVIDER, [
                { role: 'user', content: `请为以下${periodText}记忆生成一个简洁的总结（不超过200字）：

${memoryText}

总结要点：主要主题、重要事件、关键信息

${periodText}总结：` }
            ], { maxTokens: 300 });

            const summaryContent = response.content.trim();

            await db.query(
                `INSERT INTO memories (user_id, content, category, importance, metadata, created_at)
                 VALUES (?, ?, ?, 8, ?, NOW())`,
                [userId, summaryContent, `${type}-summary`, JSON.stringify({
                    type: `${type}-summary`,
                    period: `${days}-days`,
                    memoryCount: memories.length,
                    memoryIds: memories.map(m => m.id)
                })]
            );

            logger.info(`Created ${type} summary for user ${userId} with ${memories.length} memories`);
            return { summarized: memories.length };
        } catch (error) {
            logger.error(`Failed to generate ${type} summary:`, error.message);
            return { summarized: 0, reason: error.message };
        }
    }

    async runAutoReviewSchedule() {
        if (!this.config.autoReview) return;

        logger.info('Running auto review schedule...');

        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            for (const user of users) {
                try {
                    const result = await reviewService.autoScheduleReviews(user.user_id);
                    logger.info(`Auto-scheduled ${result.scheduled} reviews for user ${user.user_id}`);
                    
                    await this._sendReviewReminder(user.user_id);
                } catch (err) {
                    logger.error(`Failed to schedule reviews for user ${user.user_id}:`, err.message);
                }
            }
        } catch (error) {
            logger.error('Auto review schedule failed:', error);
        }
    }

    async _sendReviewReminder(userId) {
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
        if (!this.config.autoCleanup) return;

        logger.info('Running auto cleanup...');

        try {
            const result = await db.query(
                `DELETE FROM memories 
                 WHERE last_accessed_at < DATE_SUB(NOW(), INTERVAL 30 DAY) 
                 AND importance < 3 
                 AND access_count < 2`
            );

            logger.info(`Auto cleanup removed ${result.affectedRows} low-importance memories`);

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
            const memories = await db.query(
                `SELECT m.id, m.content, m.user_id, m.importance
                 FROM memories m
                 WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                 AND m.importance = 5
                 LIMIT 20`
            );

            for (const memory of memories) {
                try {
                    const importance = await this._assessMemoryImportance(memory.user_id, memory.content);
                    
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

    async _assessMemoryImportance(userId, content) {
        try {
            const response = await LLMService.chat(userId, DEFAULT_PROVIDER, [
                { role: 'user', content: `评估以下记忆内容的重要性，返回1-10的数字（1=不重要，10=非常重要）：

记忆内容: ${content.substring(0, 500)}

只返回数字，不要其他内容。` }
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
            const pendingExtractions = await db.query(
                `SELECT * FROM pending_extractions 
                 WHERE status = 'pending' 
                 ORDER BY created_at ASC 
                 LIMIT 5`
            );

            for (const task of pendingExtractions || []) {
                try {
                    await this._processExtractionTask(task);
                } catch (err) {
                    logger.error(`Failed to process extraction task ${task.id}:`, err.message);
                }
            }

            const pendingConversions = await db.query(
                `SELECT * FROM pending_conversions 
                 WHERE status = 'pending' 
                 ORDER BY created_at ASC 
                 LIMIT 5`
            );

            for (const task of pendingConversions || []) {
                try {
                    await this._processConversionTask(task);
                } catch (err) {
                    logger.error(`Failed to process conversion task ${task.id}:`, err.message);
                }
            }
        } catch (error) {
            // Table may not exist
        }
    }

    async _processExtractionTask(task) {
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

    async _processConversionTask(task) {
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
            features: this.config,
            limits: this.limits
        };
    }
}

const autoManager = new AutoManager();
module.exports = autoManager;
