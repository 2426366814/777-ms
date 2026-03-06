/**
 * Memory Summarizer Service
 * Automatically summarizes old memories periodically
 */

const cron = require('node-cron');
const db = require('../utils/database');
const logger = require('../utils/logger');
const LLMService = require('./LLMService');

const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER || 'deepseek';

class MemorySummarizer {
    constructor() {
        this.autoSummarizeEnabled = process.env.AUTO_SUMMARIZE_ENABLED !== 'false';
        this.summaryIntervalDays = parseInt(process.env.SUMMARY_INTERVAL_DAYS) || 7;
        this.minMemoriesToSummarize = parseInt(process.env.MIN_MEMORIES_TO_SUMMARIZE) || 5;
        this.maxMemoriesPerSummary = parseInt(process.env.MAX_MEMORIES_PER_SUMMARY) || 20;
        this.jobs = [];
    }

    start() {
        if (!this.autoSummarizeEnabled) {
            logger.info('Memory summarizer is disabled');
            return;
        }

        logger.info('Starting Memory Summarizer...');

        this.jobs.push(cron.schedule('0 3 * * 0', async () => {
            await this.runWeeklySummary();
        }));

        this.jobs.push(cron.schedule('0 4 1 * *', async () => {
            await this.runMonthlySummary();
        }));

        logger.info(`Memory Summarizer started with ${this.jobs.length} scheduled jobs`);
    }

    stop() {
        for (const job of this.jobs) {
            job.stop();
        }
        this.jobs = [];
        logger.info('Memory Summarizer stopped');
    }

    async runWeeklySummary() {
        logger.info('Running weekly memory summary...');

        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            for (const user of users) {
                try {
                    await this.summarizeUserWeek(user.user_id);
                } catch (err) {
                    logger.error(`Failed to summarize week for user ${user.user_id}:`, err.message);
                }
            }
        } catch (error) {
            logger.error('Weekly summary failed:', error);
        }
    }

    async runMonthlySummary() {
        logger.info('Running monthly memory summary...');

        try {
            const users = await db.query('SELECT DISTINCT user_id FROM memories');
            
            for (const user of users) {
                try {
                    await this.summarizeUserMonth(user.user_id);
                } catch (err) {
                    logger.error(`Failed to summarize month for user ${user.user_id}:`, err.message);
                }
            }
        } catch (error) {
            logger.error('Monthly summary failed:', error);
        }
    }

    async summarizeUserWeek(userId) {
        const memories = await db.query(
            `SELECT id, content, category, importance, created_at
             FROM memories
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY importance DESC, created_at DESC
             LIMIT ?`,
            [userId, this.maxMemoriesPerSummary]
        );

        if (memories.length < this.minMemoriesToSummarize) {
            return { summarized: 0, reason: 'Not enough memories' };
        }

        const summary = await this.generateSummary(memories);
        
        if (summary) {
            await db.query(
                `INSERT INTO memories (user_id, content, category, importance, metadata, created_at)
                 VALUES (?, ?, 'weekly-summary', 8, ?, NOW())`,
                [userId, summary.content, JSON.stringify({
                    type: 'weekly-summary',
                    period: '7-days',
                    memoryCount: memories.length,
                    memoryIds: memories.map(m => m.id)
                })]
            );

            logger.info(`Created weekly summary for user ${userId} with ${memories.length} memories`);
            return { summarized: memories.length, summary };
        }

        return { summarized: 0, reason: 'Summary generation failed' };
    }

    async summarizeUserMonth(userId) {
        const memories = await db.query(
            `SELECT id, content, category, importance, created_at
             FROM memories
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY importance DESC, created_at DESC
             LIMIT ?`,
            [userId, this.maxMemoriesPerSummary * 2]
        );

        if (memories.length < this.minMemoriesToSummarize) {
            return { summarized: 0, reason: 'Not enough memories' };
        }

        const summary = await this.generateSummary(memories, 'monthly');
        
        if (summary) {
            await db.query(
                `INSERT INTO memories (user_id, content, category, importance, metadata, created_at)
                 VALUES (?, ?, 'monthly-summary', 9, ?, NOW())`,
                [userId, summary.content, JSON.stringify({
                    type: 'monthly-summary',
                    period: '30-days',
                    memoryCount: memories.length,
                    memoryIds: memories.map(m => m.id)
                })]
            );

            logger.info(`Created monthly summary for user ${userId} with ${memories.length} memories`);
            return { summarized: memories.length, summary };
        }

        return { summarized: 0, reason: 'Summary generation failed' };
    }

    async generateSummary(memories, type = 'weekly') {
        const memoryText = memories.map((m, i) => 
            `${i + 1}. [${m.category}] ${m.content.substring(0, 100)}`
        ).join('\n');

        const periodText = type === 'monthly' ? '本月' : '本周';

        const prompt = `请为以下${periodText}记忆生成一个简洁的总结（不超过200字），突出重要信息和关键主题：

${memoryText}

总结要点：
1. 主要主题
2. 重要事件
3. 关键信息

${periodText}总结：`;

        try {
            const response = await LLMService.chat('system', DEFAULT_PROVIDER, [
                { role: 'user', content: prompt }
            ], { maxTokens: 300 });

            return {
                content: response.content.trim(),
                memoryCount: memories.length,
                type
            };
        } catch (error) {
            logger.error('Summary generation failed:', error.message);
            return null;
        }
    }

    async summarizeMemoriesByIds(userId, memoryIds) {
        const memories = await db.query(
            `SELECT id, content, category, importance FROM memories WHERE id IN (?) AND user_id = ?`,
            [memoryIds, userId]
        );

        if (memories.length === 0) {
            return { success: false, error: 'No memories found' };
        }

        const summary = await this.generateSummary(memories, 'custom');

        if (summary) {
            const result = await db.query(
                `INSERT INTO memories (user_id, content, category, importance, metadata, created_at)
                 VALUES (?, ?, 'custom-summary', 7, ?, NOW())`,
                [userId, summary.content, JSON.stringify({
                    type: 'custom-summary',
                    memoryCount: memories.length,
                    memoryIds: memoryIds
                })]
            );

            return {
                success: true,
                summaryId: result.insertId,
                summary: summary.content
            };
        }

        return { success: false, error: 'Summary generation failed' };
    }

    async getSummaryHistory(userId, limit = 10) {
        const summaries = await db.query(
            `SELECT id, content, category, importance, metadata, created_at
             FROM memories
             WHERE user_id = ? AND category LIKE '%summary'
             ORDER BY created_at DESC
             LIMIT ?`,
            [userId, limit]
        );

        return summaries.map(s => ({
            id: s.id,
            content: s.content,
            type: s.category,
            importance: s.importance,
            metadata: s.metadata ? JSON.parse(s.metadata) : {},
            createdAt: s.created_at
        }));
    }

    getStatus() {
        return {
            enabled: this.autoSummarizeEnabled,
            summaryIntervalDays: this.summaryIntervalDays,
            minMemoriesToSummarize: this.minMemoriesToSummarize,
            maxMemoriesPerSummary: this.maxMemoriesPerSummary,
            scheduledJobs: this.jobs.length
        };
    }
}

const memorySummarizer = new MemorySummarizer();
module.exports = memorySummarizer;
