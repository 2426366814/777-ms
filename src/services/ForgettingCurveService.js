const db = require('../utils/database');
const llmService = require('./LLMService');

class ForgettingCurveService {
    constructor() {
        this.reviewIntervals = [1, 3, 7, 14, 30, 60, 120];
        
        this.difficultyFactors = {
            easy: 2.5,
            normal: 2.0,
            hard: 1.3
        };
    }

    calculateNextReview(currentInterval, quality, difficulty = 'normal') {
        const factor = this.difficultyFactors[difficulty] || 2.0;
        
        let newInterval;
        if (quality < 3) {
            newInterval = 1;
        } else {
            newInterval = Math.round(currentInterval * factor * (quality / 5));
        }
        
        return Math.min(newInterval, 365);
    }

    calculateRetentionScore(createdAt, lastReviewAt, reviewCount, importance) {
        const now = Date.now();
        const age = (now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
        
        const daysSinceReview = lastReviewAt 
            ? (now - new Date(lastReviewAt).getTime()) / (1000 * 60 * 60 * 24)
            : age;
        
        const baseRetention = Math.exp(-daysSinceReview / (10 + reviewCount * 5));
        
        const importanceBonus = importance * 0.1;
        
        return Math.min(1, Math.max(0, baseRetention + importanceBonus));
    }

    async getMemoriesForReview(userId, limit = 20) {
        const memories = await db.query(`
            SELECT m.*, 
                   COALESCE(r.review_count, 0) as review_count,
                   COALESCE(r.last_review_at, m.created_at) as last_review_at,
                   COALESCE(r.next_review_at, DATE_ADD(m.created_at, INTERVAL 1 DAY)) as next_review_at,
                   COALESCE(r.difficulty, 'normal') as difficulty
            FROM memories m
            LEFT JOIN memory_reviews r ON m.id = r.memory_id
            WHERE m.user_id = ? 
            AND (r.next_review_at IS NULL OR r.next_review_at <= NOW())
            ORDER BY m.importance_score DESC, r.next_review_at ASC
            LIMIT ?
        `, [userId, limit]);

        return (memories || []).map(m => ({
            ...m,
            retentionScore: this.calculateRetentionScore(
                m.created_at, 
                m.last_review_at, 
                m.review_count, 
                m.importance_score || 0.5
            )
        }));
    }

    async recordReview(userId, memoryId, quality, providerId = 'openai') {
        const existing = await db.query(
            'SELECT * FROM memory_reviews WHERE user_id = ? AND memory_id = ?',
            [userId, memoryId]
        );

        let currentInterval = 1;
        let reviewCount = 0;
        let difficulty = 'normal';

        if (existing && existing.length > 0) {
            currentInterval = existing[0].current_interval || 1;
            reviewCount = existing[0].review_count || 0;
            difficulty = existing[0].difficulty || 'normal';
        }

        const newInterval = this.calculateNextReview(currentInterval, quality, difficulty);
        const nextReviewAt = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000);

        if (quality < 3) {
            difficulty = 'hard';
        } else if (quality > 4 && existing && existing.length > 0 && existing[0].difficulty === 'hard') {
            difficulty = 'normal';
        } else if (quality === 5 && existing && existing.length > 0 && existing[0].difficulty === 'normal' && reviewCount > 3) {
            difficulty = 'easy';
        }

        await db.query(`
            INSERT INTO memory_reviews (user_id, memory_id, review_count, current_interval, next_review_at, last_review_at, difficulty)
            VALUES (?, ?, ?, ?, ?, NOW(), ?)
            ON DUPLICATE KEY UPDATE 
                review_count = review_count + 1,
                current_interval = VALUES(current_interval),
                next_review_at = VALUES(next_review_at),
                last_review_at = NOW(),
                difficulty = VALUES(difficulty)
        `, [userId, memoryId, reviewCount + 1, newInterval, nextReviewAt, difficulty]);

        await db.query(`
            UPDATE memories SET access_count = access_count + 1, last_accessed_at = NOW()
            WHERE id = ?
        `, [memoryId]);

        return {
            success: true,
            nextReviewAt,
            newInterval,
            difficulty
        };
    }

    async generateReviewQuestions(userId, memoryId, providerId = 'openai') {
        const memory = await db.query(
            'SELECT content FROM memories WHERE id = ? AND user_id = ?',
            [memoryId, userId]
        );

        if (!memory || memory.length === 0) {
            return { success: false, error: 'Memory not found' };
        }

        const messages = [
            {
                role: 'system',
                content: `你是一个记忆复习专家。根据记忆内容生成复习问题，帮助用户巩固记忆。
输出JSON格式：
{
  "questions": [
    {
      "question": "问题",
      "type": "recall|recognition|application",
      "difficulty": "easy|medium|hard"
    }
  ],
  "keyPoints": ["关键点1", "关键点2"]
}`
            },
            {
                role: 'user',
                content: `为以下记忆生成3个复习问题：\n\n${memory[0].content}`
            }
        ];

        try {
            const response = await llmService.chat(userId, providerId, messages, {
                temperature: 0.5,
                maxTokens: 500
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return { success: true, ...JSON.parse(jsonMatch[0]) };
            }
            return { success: false, error: 'Failed to parse response' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getReviewStats(userId) {
        const stats = await db.query(`
            SELECT 
                COUNT(DISTINCT m.id) as total_memories,
                COUNT(DISTINCT CASE WHEN r.next_review_at <= NOW() THEN m.id END) as due_reviews,
                COUNT(DISTINCT CASE WHEN r.review_count > 0 THEN m.id END) as reviewed_memories,
                AVG(r.review_count) as avg_reviews
            FROM memories m
            LEFT JOIN memory_reviews r ON m.id = r.memory_id
            WHERE m.user_id = ?
        `, [userId]);

        const retentionByDay = await db.query(`
            SELECT 
                DATE(m.created_at) as date,
                COUNT(*) as total,
                AVG(CASE WHEN r.review_count > 0 THEN 1 ELSE 0 END) as reviewed_ratio
            FROM memories m
            LEFT JOIN memory_reviews r ON m.id = r.memory_id
            WHERE m.user_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(m.created_at)
            ORDER BY date
        `, [userId]);

        const difficultyDistribution = await db.query(`
            SELECT difficulty, COUNT(*) as count
            FROM memory_reviews
            WHERE user_id = ?
            GROUP BY difficulty
        `, [userId]);

        return {
            ...(stats && stats.length > 0 ? stats[0] : { total_memories: 0, due_reviews: 0, reviewed_memories: 0, avg_reviews: 0 }),
            retentionByDay: retentionByDay || [],
            difficultyDistribution: difficultyDistribution || []
        };
    }

    async getForgettingCurveData(userId) {
        const memories = await db.query(`
            SELECT m.created_at, m.importance_score, r.review_count, r.last_review_at
            FROM memories m
            LEFT JOIN memory_reviews r ON m.id = r.memory_id
            WHERE m.user_id = ?
            ORDER BY m.created_at DESC
            LIMIT 100
        `, [userId]);

        const curveData = [];
        for (let day = 0; day <= 30; day++) {
            let avgRetention = 0;
            let count = 0;

            for (const m of (memories || [])) {
                const retention = this.calculateRetentionScore(
                    m.created_at,
                    m.last_review_at || m.created_at,
                    m.review_count || 0,
                    m.importance_score || 0.5
                );
                
                const age = (Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24);
                const projectedRetention = retention * Math.exp(-day / (10 + (m.review_count || 0) * 5));
                
                avgRetention += projectedRetention;
                count++;
            }

            curveData.push({
                day,
                retention: count > 0 ? avgRetention / count : 0
            });
        }

        return curveData;
    }

    async scheduleReviewReminder(userId) {
        const dueReviews = await db.query(`
            SELECT m.id, m.content, r.next_review_at
            FROM memories m
            JOIN memory_reviews r ON m.id = r.memory_id
            WHERE m.user_id = ? AND r.next_review_at <= DATE_ADD(NOW(), INTERVAL 1 HOUR)
            AND NOT EXISTS (
                SELECT 1 FROM memory_reminders rem 
                WHERE rem.memory_id = m.id AND rem.remind_at >= NOW()
            )
        `, [userId]);

        for (const review of (dueReviews || [])) {
            await db.query(`
                INSERT INTO memory_reminders (user_id, memory_id, remind_at)
                VALUES (?, ?, ?)
            `, [userId, review.id, review.next_review_at]);
        }

        return { scheduled: dueReviews ? dueReviews.length : 0 };
    }
}

const forgettingCurveService = new ForgettingCurveService();
module.exports = forgettingCurveService;
