const db = require('../utils/database');

class VisualizationService {
    async getActivityHeatmap(userId, year = null) {
        const targetYear = year || new Date().getFullYear();
        
        const data = await db.query(`
            SELECT DATE(created_at) as date, 'memory' as type, COUNT(*) as count
            FROM memories WHERE user_id = ? AND YEAR(created_at) = ?
            GROUP BY DATE(created_at)
            UNION ALL
            SELECT DATE(created_at) as date, 'knowledge' as type, COUNT(*) as count
            FROM knowledge WHERE user_id = ? AND YEAR(created_at) = ?
            GROUP BY DATE(created_at)
            UNION ALL
            SELECT DATE(created_at) as date, 'session' as type, COUNT(*) as count
            FROM sessions WHERE user_id = ? AND YEAR(created_at) = ?
            GROUP BY DATE(created_at)
        `, [userId, targetYear, userId, targetYear, userId, targetYear]);

        const heatmapData = {};
        for (const item of (data || [])) {
            if (item.date) {
                const key = item.date.toISOString ? item.date.toISOString().split('T')[0] : String(item.date);
                if (!heatmapData[key]) {
                    heatmapData[key] = { total: 0, types: {} };
                }
                heatmapData[key].total += item.count;
                heatmapData[key].types[item.type] = item.count;
            }
        }

        return {
            year: targetYear,
            data: heatmapData,
            summary: {
                totalDays: Object.keys(heatmapData).length,
                totalActivities: Object.values(heatmapData).reduce((sum, d) => sum + d.total, 0),
                maxDaily: Math.max(...Object.values(heatmapData).map(d => d.total), 0)
            }
        };
    }

    async getActivityByHour(userId, days = 30) {
        const data = await db.query(`
            SELECT HOUR(created_at) as hour, COUNT(*) as count
            FROM memories
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY HOUR(created_at)
            ORDER BY hour
        `, [userId, days]);

        const hourData = Array(24).fill(0);
        for (const item of (data || [])) {
            hourData[item.hour] = item.count;
        }

        return {
            labels: Array(24).fill(0).map((_, i) => `${i}:00`),
            data: hourData,
            peakHour: hourData.indexOf(Math.max(...hourData))
        };
    }

    async getActivityByDayOfWeek(userId, days = 30) {
        const data = await db.query(`
            SELECT DAYOFWEEK(created_at) as day, COUNT(*) as count
            FROM memories
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DAYOFWEEK(created_at)
            ORDER BY day
        `, [userId, days]);

        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dayData = Array(7).fill(0);
        
        for (const item of (data || [])) {
            dayData[item.day - 1] = item.count;
        }

        return {
            labels: dayNames,
            data: dayData
        };
    }

    async getTagWordCloud(userId) {
        const tags = await db.query(`
            SELECT tag_name, COUNT(*) as count
            FROM memory_tags mt
            JOIN memories m ON mt.memory_id = m.id
            WHERE m.user_id = ?
            GROUP BY tag_name
            ORDER BY count DESC
            LIMIT 50
        `, [userId]);

        return (tags || []).map(t => ({
            text: t.tag_name,
            size: Math.min(50, 10 + t.count * 3),
            count: t.count
        }));
    }

    async getContentWordCloud(userId) {
        const memories = await db.query(
            'SELECT content FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
            [userId]
        );

        const wordFreq = {};
        const stopWords = new Set(['的', '是', '在', '了', '和', '有', '我', '不', '这', '就', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '那', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once']);

        for (const m of (memories || [])) {
            const words = m.content.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
            for (const word of words) {
                const lowerWord = word.toLowerCase();
                if (word.length >= 2 && !stopWords.has(lowerWord)) {
                    wordFreq[lowerWord] = (wordFreq[lowerWord] || 0) + 1;
                }
            }
        }

        return Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([text, count]) => ({
                text,
                size: Math.min(50, 10 + count * 2),
                count
            }));
    }

    async getMemoryTimeline(userId, startDate = null, endDate = null) {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate || new Date();

        const memories = await db.query(`
            SELECT m.id, m.content, m.importance_score, m.created_at,
                   GROUP_CONCAT(mt.tag_name) as tags
            FROM memories m
            LEFT JOIN memory_tags mt ON m.id = mt.memory_id
            WHERE m.user_id = ? AND m.created_at BETWEEN ? AND ?
            GROUP BY m.id
            ORDER BY m.created_at
        `, [userId, start, end]);

        const timeline = [];
        let currentDate = null;
        let currentGroup = null;

        for (const m of (memories || [])) {
            const date = m.created_at.toISOString ? m.created_at.toISOString().split('T')[0] : String(m.created_at);
            
            if (date !== currentDate) {
                currentDate = date;
                currentGroup = {
                    date,
                    displayDate: new Date(m.created_at).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long'
                    }),
                    memories: [],
                    stats: { count: 0, avgImportance: 0 }
                };
                timeline.push(currentGroup);
            }

            currentGroup.memories.push({
                id: m.id,
                content: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
                importance: m.importance_score || 0.5,
                tags: m.tags ? m.tags.split(',') : [],
                time: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            });

            currentGroup.stats.count++;
            currentGroup.stats.avgImportance += m.importance_score || 0.5;
        }

        for (const group of timeline) {
            group.stats.avgImportance = (group.stats.avgImportance / group.stats.count).toFixed(2);
        }

        return timeline;
    }

    async getImportanceDistribution(userId) {
        const distribution = await db.query(`
            SELECT 
                CASE 
                    WHEN importance_score >= 0.9 THEN 'critical'
                    WHEN importance_score >= 0.7 THEN 'high'
                    WHEN importance_score >= 0.5 THEN 'medium'
                    WHEN importance_score >= 0.3 THEN 'low'
                    ELSE 'minimal'
                END as level,
                COUNT(*) as count
            FROM memories
            WHERE user_id = ?
            GROUP BY level
            ORDER BY FIELD(level, 'critical', 'high', 'medium', 'low', 'minimal')
        `, [userId]);

        return distribution || [];
    }

    async getMemoryGrowthTrend(userId, months = 6) {
        const data = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as new_memories,
                SUM(CASE WHEN importance_score >= 0.7 THEN 1 ELSE 0 END) as important_memories
            FROM memories
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
            GROUP BY month
            ORDER BY month
        `, [userId, months]);

        return {
            labels: (data || []).map(d => d.month),
            datasets: {
                newMemories: (data || []).map(d => d.new_memories),
                importantMemories: (data || []).map(d => d.important_memories)
            }
        };
    }

    async getRetentionCurve(userId) {
        const memories = await db.query(`
            SELECT 
                DATEDIFF(NOW(), created_at) as age_days,
                access_count,
                importance_score,
                last_accessed_at
            FROM memories
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        `, [userId]);

        const curveData = [];
        for (let day = 0; day <= 90; day += 5) {
            let totalRetention = 0;
            let count = 0;

            for (const m of (memories || [])) {
                if (m.age_days >= day) {
                    const daysSinceAccess = m.last_accessed_at 
                        ? Math.floor((Date.now() - new Date(m.last_accessed_at).getTime()) / (1000 * 60 * 60 * 24))
                        : m.age_days;
                    
                    const retention = Math.exp(-daysSinceAccess / (10 + (m.access_count || 0) * 5));
                    totalRetention += retention;
                    count++;
                }
            }

            curveData.push({
                day,
                retention: count > 0 ? (totalRetention / count).toFixed(3) : 0,
                sampleSize: count
            });
        }

        return curveData;
    }

    async getKnowledgeNetwork(userId) {
        const memories = await db.query(`
            SELECT m.id, m.content, m.importance_score,
                   GROUP_CONCAT(mt.tag_name) as tags
            FROM memories m
            LEFT JOIN memory_tags mt ON m.id = mt.memory_id
            WHERE m.user_id = ?
            GROUP BY m.id
            ORDER BY m.importance_score DESC
            LIMIT 50
        `, [userId]);

        const nodes = [];
        const edges = [];
        const tagNodes = {};
        const memoryNodes = {};

        for (const m of (memories || [])) {
            const memoryNode = {
                id: `memory_${m.id}`,
                label: m.content.substring(0, 30) + '...',
                type: 'memory',
                importance: m.importance_score || 0.5
            };
            nodes.push(memoryNode);
            memoryNodes[m.id] = memoryNode;

            if (m.tags) {
                const tags = m.tags.split(',');
                for (const tag of tags) {
                    if (!tagNodes[tag]) {
                        const tagNode = {
                            id: `tag_${tag}`,
                            label: tag,
                            type: 'tag',
                            weight: 0
                        };
                        nodes.push(tagNode);
                        tagNodes[tag] = tagNode;
                    }
                    tagNodes[tag].weight++;

                    edges.push({
                        source: `memory_${m.id}`,
                        target: `tag_${tag}`,
                        type: 'has_tag'
                    });
                }
            }
        }

        return { nodes, edges };
    }

    async getEmotionTrend(userId, days = 30) {
        const memories = await db.query(`
            SELECT DATE(created_at) as date, content
            FROM memories
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY date
        `, [userId, days]);

        const emotionKeywords = {
            positive: ['开心', '快乐', '高兴', '幸福', '喜欢', '爱', '棒', '好', '成功', '感谢', '美好', '精彩', '满意', 'happy', 'joy', 'love', 'great', 'wonderful', 'excellent'],
            negative: ['难过', '伤心', '痛苦', '讨厌', '恨', '烦', '累', '失败', '失望', '糟糕', '可怕', '悲伤', 'sad', 'angry', 'hate', 'terrible', 'awful', 'bad'],
            neutral: []
        };

        const trendData = {};
        for (const m of (memories || [])) {
            const date = m.date.toISOString ? m.date.toISOString().split('T')[0] : String(m.date);
            if (!trendData[date]) {
                trendData[date] = { positive: 0, negative: 0, neutral: 0 };
            }

            let positiveScore = 0;
            let negativeScore = 0;

            for (const word of emotionKeywords.positive) {
                if (m.content.includes(word)) positiveScore++;
            }
            for (const word of emotionKeywords.negative) {
                if (m.content.includes(word)) negativeScore++;
            }

            if (positiveScore > negativeScore) {
                trendData[date].positive++;
            } else if (negativeScore > positiveScore) {
                trendData[date].negative++;
            } else {
                trendData[date].neutral++;
            }
        }

        return Object.entries(trendData).map(([date, counts]) => ({
            date,
            ...counts
        }));
    }

    async getDashboardStats(userId) {
        const memoryStats = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month,
                AVG(importance_score) as avg_importance
            FROM memories WHERE user_id = ?
        `, [userId]);

        const knowledgeStats = await db.query(`
            SELECT COUNT(*) as total FROM knowledge WHERE user_id = ?
        `, [userId]);

        const sessionStats = await db.query(`
            SELECT COUNT(*) as total FROM sessions WHERE user_id = ?
        `, [userId]);

        const tagStats = await db.query(`
            SELECT COUNT(DISTINCT tag_name) as unique_tags
            FROM memory_tags mt
            JOIN memories m ON mt.memory_id = m.id
            WHERE m.user_id = ?
        `, [userId]);

        const recentActivity = await db.query(`
            SELECT 'memory' as type, created_at
            FROM memories WHERE user_id = ?
            UNION ALL
            SELECT 'knowledge' as type, created_at
            FROM knowledge WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `, [userId, userId]);

        return {
            memories: memoryStats && memoryStats.length > 0 ? memoryStats[0] : { total: 0, this_week: 0, this_month: 0, avg_importance: 0 },
            knowledge: knowledgeStats && knowledgeStats.length > 0 ? knowledgeStats[0] : { total: 0 },
            sessions: sessionStats && sessionStats.length > 0 ? sessionStats[0] : { total: 0 },
            tags: tagStats && tagStats.length > 0 ? tagStats[0] : { unique_tags: 0 },
            recentActivity: recentActivity || []
        };
    }
}

const visualizationService = new VisualizationService();
module.exports = visualizationService;
