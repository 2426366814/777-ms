/**
 * Context Auto-Loader Service
 * Automatically loads relevant memories and knowledge into LLM context
 * Enhanced version with smart context injection
 */

const memoryService = require('./memoryService');
const knowledgeService = require('./KnowledgeService');
const logger = require('../utils/logger');

class ContextAutoLoader {
    constructor() {
        this.maxContextLength = parseInt(process.env.MAX_CONTEXT_LENGTH) || 4000;
        this.memoryWeight = 0.6;
        this.knowledgeWeight = 0.4;
        this.autoLoadEnabled = process.env.AUTO_CONTEXT_LOAD !== 'false';
    }

    async buildSmartContext(userId, query, options = {}) {
        if (!this.autoLoadEnabled) {
            return { context: '', sources: [] };
        }

        const {
            includeMemory = true,
            includeKnowledge = true,
            memoryLimit = 5,
            knowledgeLimit = 3,
            maxContextLength = this.maxContextLength
        } = options;

        const sources = [];
        let context = '';
        let currentLength = 0;

        if (includeMemory) {
            const memories = await this.loadRelevantMemories(userId, query, memoryLimit);
            if (memories.length > 0) {
                const memoryContext = this.formatMemories(memories);
                if (currentLength + memoryContext.length <= maxContextLength) {
                    context += memoryContext;
                    currentLength += memoryContext.length;
                    sources.push({ type: 'memory', count: memories.length });
                }
            }
        }

        if (includeKnowledge) {
            const knowledge = await this.loadRelevantKnowledge(userId, query, knowledgeLimit);
            if (knowledge.length > 0) {
                const knowledgeContext = this.formatKnowledge(knowledge);
                if (currentLength + knowledgeContext.length <= maxContextLength) {
                    context += knowledgeContext;
                    currentLength += knowledgeContext.length;
                    sources.push({ type: 'knowledge', count: knowledge.length });
                }
            }
        }

        return { context, sources };
    }

    async loadRelevantMemories(userId, query, limit = 5) {
        try {
            const memories = await memoryService.searchRelevantMemories(userId, query, limit);
            return memories;
        } catch (error) {
            logger.warn('Failed to load relevant memories:', error.message);
            return [];
        }
    }

    async loadRelevantKnowledge(userId, query, limit = 3) {
        try {
            const knowledge = await knowledgeService.searchKnowledge(userId, query, limit);
            return knowledge;
        } catch (error) {
            logger.warn('Failed to load relevant knowledge:', error.message);
            return [];
        }
    }

    formatMemories(memories) {
        if (!memories || memories.length === 0) return '';

        let context = '\n[相关记忆上下文]\n';
        for (const m of memories) {
            const relevance = m.relevance ? ` (相关度: ${(m.relevance * 100).toFixed(0)}%)` : '';
            context += `- [${m.category || 'general'}] ${m.content.substring(0, 200)}${relevance}\n`;
        }
        context += '[/相关记忆上下文]\n';
        return context;
    }

    formatKnowledge(knowledge) {
        if (!knowledge || knowledge.length === 0) return '';

        let context = '\n[相关知识库内容]\n';
        for (const k of knowledge) {
            const relevance = k.relevance ? ` (相关度: ${(k.relevance * 100).toFixed(0)}%)` : '';
            context += `- [${k.category || 'general'}] ${k.title}: ${k.content?.substring(0, 200)}${relevance}\n`;
        }
        context += '[/相关知识库内容]\n';
        return context;
    }

    async injectContextIntoMessages(messages, context) {
        if (!context || context.trim().length === 0) {
            return messages;
        }

        const systemMessageIndex = messages.findIndex(m => m.role === 'system');
        
        if (systemMessageIndex >= 0) {
            messages[systemMessageIndex].content += '\n\n' + context;
        } else {
            messages.unshift({
                role: 'system',
                content: '你是一个智能助手，可以根据用户的记忆和知识库提供个性化回答。\n' + context
            });
        }

        return messages;
    }

    async prepareContextForChat(userId, message, options = {}) {
        const { context, sources } = await this.buildSmartContext(userId, message, options);
        
        return {
            context,
            sources,
            contextLength: context.length,
            autoLoaded: sources.length > 0
        };
    }

    getStatus() {
        return {
            enabled: this.autoLoadEnabled,
            maxContextLength: this.maxContextLength,
            memoryWeight: this.memoryWeight,
            knowledgeWeight: this.knowledgeWeight
        };
    }
}

const contextAutoLoader = new ContextAutoLoader();
module.exports = contextAutoLoader;
