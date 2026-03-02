/**
 * 重要性评分服务
 * 基于关键词和访问频率评估记忆重要性
 */

class ImportanceScorer {
    constructor() {
        this.importantKeywords = [
            '重要', '关键', '核心', '必须', '紧急', '优先',
            '密码', '账号', '密钥', 'token', 'api', 'key',
            '项目', '任务', '目标', '计划', 'deadline',
            '会议', '约定', '截止', '提醒'
        ];
        
        this.decayFactor = 0.95;
        this.accessBonus = 0.1;
        this.keywordBonus = 0.15;
        this.recencyBonus = 0.1;
    }
    
    calculateScore(memory, options = {}) {
        let score = memory.importance_score || 5;
        
        score += this._calculateKeywordScore(memory.content);
        score += this._calculateAccessScore(memory.access_count || 0);
        score += this._calculateRecencyScore(memory.created_at, memory.last_accessed_at);
        
        if (options.tags && options.tags.length > 0) {
            score += Math.min(options.tags.length * 0.1, 0.5);
        }
        
        return Math.min(Math.max(score, 1), 10);
    }
    
    _calculateKeywordScore(content) {
        if (!content) return 0;
        
        let keywordCount = 0;
        const lowerContent = content.toLowerCase();
        
        for (const keyword of this.importantKeywords) {
            if (lowerContent.includes(keyword.toLowerCase())) {
                keywordCount++;
            }
        }
        
        return Math.min(keywordCount * this.keywordBonus, 1.5);
    }
    
    _calculateAccessScore(accessCount) {
        return Math.min(accessCount * this.accessBonus, 2);
    }
    
    _calculateRecencyScore(createdAt, lastAccessedAt) {
        const now = Date.now();
        let recencyScore = 0;
        
        if (createdAt) {
            const createdDays = (now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
            if (createdDays < 7) {
                recencyScore += this.recencyBonus;
            }
        }
        
        if (lastAccessedAt) {
            const accessedDays = (now - new Date(lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24);
            if (accessedDays < 1) {
                recencyScore += this.recencyBonus * 2;
            } else if (accessedDays < 7) {
                recencyScore += this.recencyBonus;
            }
        }
        
        return recencyScore;
    }
    
    async batchScore(memories) {
        return memories.map(memory => ({
            ...memory,
            calculatedScore: this.calculateScore(memory)
        }));
    }
    
    decayScore(currentScore, daysSinceAccess) {
        const decayedScore = currentScore * Math.pow(this.decayFactor, daysSinceAccess);
        return Math.max(decayedScore, 1);
    }
    
    shouldPromote(memory) {
        const score = this.calculateScore(memory);
        return score >= 7;
    }
    
    shouldArchive(memory) {
        const score = this.calculateScore(memory);
        return score < 3;
    }
}

module.exports = new ImportanceScorer();
