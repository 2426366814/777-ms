/**
 * Review Service
 * Handles Ebbinghaus forgetting curve review system with LLM automation
 */

const db = require('../utils/database');
const logger = require('../utils/logger');
const LLMService = require('./LLMService');

const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60, 120];

class ReviewService {
    constructor() {
        this.autoReviewEnabled = process.env.AUTO_REVIEW_ENABLED !== 'false';
        this.defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'deepseek';
    }

    async createReviewItem(userId, memoryId, memoryContent) {
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + REVIEW_INTERVALS[0]);
        
        const result = await db.query(
            `INSERT INTO review_items 
             (user_id, memory_id, content, review_count, next_review_date, created_at) 
             VALUES (?, ?, ?, 0, ?, NOW())`,
            [userId, memoryId, memoryContent, nextReview]
        );
        
        logger.info(`Created review item ${result.insertId} for user ${userId}`);
        return { id: result.insertId, memoryId, nextReview };
    }

    async getDueReviews(userId, limit = 20) {
        const reviews = await db.query(
            `SELECT r.*, m.category, m.importance, m.tags
             FROM review_items r
             LEFT JOIN memories m ON r.memory_id = m.id
             WHERE r.user_id = ? AND r.next_review_date <= NOW()
             ORDER BY r.next_review_date ASC
             LIMIT ?`,
            [userId, limit]
        );
        
        return reviews.map(r => ({
            id: r.id,
            memoryId: r.memory_id,
            content: r.content,
            reviewCount: r.review_count,
            nextReview: r.next_review_date,
            category: r.category,
            importance: r.importance,
            tags: r.tags ? r.tags.split(',') : []
        }));
    }

    async getUpcomingReviews(userId, days = 7) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);
        
        const reviews = await db.query(
            `SELECT DATE(next_review_date) as review_date, COUNT(*) as count
             FROM review_items
             WHERE user_id = ? AND next_review_date BETWEEN NOW() AND ?
             GROUP BY DATE(next_review_date)
             ORDER BY review_date`,
            [userId, endDate]
        );
        
        return reviews;
    }

    async completeReview(userId, reviewId, success = true) {
        const review = await db.query(
            `SELECT * FROM review_items WHERE id = ? AND user_id = ?`,
            [reviewId, userId]
        );
        
        if (!review || review.length === 0) {
            return null;
        }
        
        const reviewItem = review[0];
        const newCount = reviewItem.review_count + 1;
        const intervalIndex = Math.min(newCount, REVIEW_INTERVALS.length - 1);
        const interval = success ? REVIEW_INTERVALS[intervalIndex] : REVIEW_INTERVALS[0];
        
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);
        
        await db.query(
            `UPDATE review_items 
             SET review_count = ?, next_review_date = ?, last_review_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [newCount, nextReview, reviewId]
        );
        
        logger.info(`Completed review ${reviewId} for user ${userId}, next in ${interval} days`);
        
        return { id: reviewId, newCount, nextReview, interval };
    }

    async generateReviewQuestion(userId, reviewId, provider) {
        const review = await db.query(
            `SELECT r.*, m.category, m.tags
             FROM review_items r
             LEFT JOIN memories m ON r.memory_id = m.id
             WHERE r.id = ? AND r.user_id = ?`,
            [reviewId, userId]
        );
        
        if (!review || review.length === 0) {
            return null;
        }
        
        const item = review[0];
        
        const prompt = `基于以下记忆内容，生成一个复习问题，帮助用户回忆和巩固这个记忆。问题应该简洁明了，能够引导用户回忆关键信息。

记忆内容: ${item.content}
分类: ${item.category || 'general'}
标签: ${item.tags || ''}

请只输出问题本身，不要包含其他内容。`;

        try {
            const response = await LLMService.chat(userId, provider || this.defaultProvider, [
                { role: 'user', content: prompt }
            ], { maxTokens: 200 });
            
            return {
                question: response.content.trim(),
                memoryId: item.memory_id,
                content: item.content
            };
        } catch (error) {
            logger.error('Failed to generate review question:', error);
            return {
                question: `请回忆以下内容：${item.content.substring(0, 100)}...`,
                memoryId: item.memory_id,
                content: item.content
            };
        }
    }

    async autoScheduleReviews(userId) {
        const memories = await db.query(
            `SELECT m.id, m.content, m.created_at
             FROM memories m
             LEFT JOIN review_items r ON m.id = r.memory_id
             WHERE m.user_id = ? AND r.id IS NULL
             LIMIT 50`,
            [userId]
        );
        
        let scheduled = 0;
        for (const memory of memories) {
            try {
                await this.createReviewItem(userId, memory.id, memory.content);
                scheduled++;
            } catch (err) {
                logger.warn(`Failed to schedule review for memory ${memory.id}:`, err.message);
            }
        }
        
        logger.info(`Auto-scheduled ${scheduled} reviews for user ${userId}`);
        return { scheduled };
    }

    async getReviewStats(userId) {
        const stats = await db.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN next_review_date <= NOW() THEN 1 ELSE 0 END) as due,
                SUM(CASE WHEN last_review_at IS NOT NULL THEN 1 ELSE 0 END) as reviewed,
                AVG(review_count) as avg_reviews
             FROM review_items WHERE user_id = ?`,
            [userId]
        );
        
        const streak = await db.query(
            `SELECT COUNT(DISTINCT DATE(last_review_at)) as streak
             FROM review_items
             WHERE user_id = ? AND last_review_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            [userId]
        );
        
        return {
            total: stats[0]?.total || 0,
            due: stats[0]?.due || 0,
            reviewed: stats[0]?.reviewed || 0,
            avgReviews: stats[0]?.avg_reviews || 0,
            streak: streak[0]?.streak || 0
        };
    }

    async processAutoReviews(userId, provider) {
        if (!this.autoReviewEnabled) {
            return { processed: 0, message: 'Auto review disabled' };
        }
        
        const dueReviews = await this.getDueReviews(userId, 5);
        
        if (dueReviews.length === 0) {
            return { processed: 0, message: 'No due reviews' };
        }
        
        let processed = 0;
        for (const review of dueReviews) {
            try {
                await this.generateReviewQuestion(userId, review.id, provider);
                processed++;
            } catch (err) {
                logger.warn(`Failed to process review ${review.id}:`, err.message);
            }
        }
        
        return { processed, total: dueReviews.length };
    }
}

const reviewService = new ReviewService();
module.exports = reviewService;
