/**
 * 去重服务
 * 使用 Jaccard 相似度检测重复记忆
 */

class DeduplicationService {
    constructor() {
        this.similarityThreshold = 0.7;
        this.minWordsForComparison = 3;
    }
    
    tokenize(text) {
        if (!text) return new Set();
        
        const cleanText = text.toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        const words = cleanText.split(' ').filter(w => w.length > 0);
        const ngrams = new Set();
        
        for (let i = 0; i < words.length; i++) {
            ngrams.add(words[i]);
            if (i < words.length - 1) {
                ngrams.add(words[i] + words[i + 1]);
            }
        }
        
        return ngrams;
    }
    
    jaccardSimilarity(set1, set2) {
        if (set1.size === 0 || set2.size === 0) return 0;
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }
    
    calculateSimilarity(text1, text2) {
        const tokens1 = this.tokenize(text1);
        const tokens2 = this.tokenize(text2);
        
        if (tokens1.size < this.minWordsForComparison || tokens2.size < this.minWordsForComparison) {
            return 0;
        }
        
        return this.jaccardSimilarity(tokens1, tokens2);
    }
    
    async findDuplicates(newMemory, existingMemories) {
        const duplicates = [];
        const newTokens = this.tokenize(newMemory.content);
        
        for (const existing of existingMemories) {
            const existingTokens = this.tokenize(existing.content);
            const similarity = this.jaccardSimilarity(newTokens, existingTokens);
            
            if (similarity >= this.similarityThreshold) {
                duplicates.push({
                    memory: existing,
                    similarity,
                    isExact: similarity >= 0.95
                });
            }
        }
        
        return duplicates.sort((a, b) => b.similarity - a.similarity);
    }
    
    async deduplicate(memories) {
        const unique = [];
        const duplicates = [];
        const seen = new Map();
        
        for (const memory of memories) {
            const tokens = this.tokenize(memory.content);
            let isDuplicate = false;
            
            for (const [id, existingTokens] of seen) {
                const similarity = this.jaccardSimilarity(tokens, existingTokens);
                if (similarity >= this.similarityThreshold) {
                    duplicates.push({
                        duplicate: memory,
                        originalId: id,
                        similarity
                    });
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                unique.push(memory);
                seen.set(memory.id, tokens);
            }
        }
        
        return { unique, duplicates };
    }
    
    async mergeDuplicates(duplicates, original) {
        const merged = { ...original };
        
        for (const dup of duplicates) {
            if (dup.memory.tags) {
                merged.tags = [...new Set([...(merged.tags || []), ...dup.memory.tags])];
            }
            if (dup.memory.importance_score > merged.importance_score) {
                merged.importance_score = dup.memory.importance_score;
            }
            merged.access_count = (merged.access_count || 0) + (dup.memory.access_count || 0);
        }
        
        return merged;
    }
    
    setThreshold(threshold) {
        this.similarityThreshold = Math.max(0, Math.min(1, threshold));
    }
}

module.exports = new DeduplicationService();
