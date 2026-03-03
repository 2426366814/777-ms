const llmService = require('./LLMService');
const db = require('../utils/database');

class MemoryExtractor {
    constructor() {
        this.systemPrompt = `你是一个记忆提取专家。你的任务是从对话中提取重要信息并结构化存储。

提取规则：
1. 识别用户提到的个人信息、偏好、重要事件
2. 提取事实性信息（日期、地点、人物、事件）
3. 识别用户的习惯、喜好、厌恶
4. 注意重要的关系信息

输出格式（JSON数组）：
[
  {
    "type": "personal_info|preference|event|fact|relationship|habit",
    "content": "提取的记忆内容",
    "importance": 0.1-1.0,
    "tags": ["标签1", "标签2"],
    "context": "原始上下文"
  }
]

注意：
- 只提取有价值的信息，忽略闲聊
- importance 根据信息的重要性评分
- tags 用于分类和检索
- 如果没有值得记忆的内容，返回空数组 []`;
    }

    async extractFromMessage(userId, message, providerId = 'openai', model = null) {
        try {
            const messages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: `请从以下对话中提取记忆：\n\n${message}` }
            ];
            
            const response = await llmService.chat(userId, providerId, messages, {
                model,
                temperature: 0.3,
                maxTokens: 1000
            });
            
            const memories = this.parseResponse(response.content);
            
            return {
                success: true,
                memories,
                tokensUsed: response.usage?.total_tokens || 0
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                memories: []
            };
        }
    }

    async extractFromConversation(userId, messages, providerId = 'openai', model = null) {
        try {
            const conversationText = messages
                .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
                .join('\n\n');
            
            const chatMessages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: `请从以下对话中提取记忆：\n\n${conversationText}` }
            ];
            
            const response = await llmService.chat(userId, providerId, chatMessages, {
                model,
                temperature: 0.3,
                maxTokens: 2000
            });
            
            const memories = this.parseResponse(response.content);
            
            return {
                success: true,
                memories,
                tokensUsed: response.usage?.total_tokens || 0
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                memories: []
            };
        }
    }

    parseResponse(content) {
        try {
            let jsonStr = content;
            
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            const memories = JSON.parse(jsonStr);
            
            return memories.filter(m => 
                m.content && 
                m.content.length > 5 &&
                m.importance >= 0.3
            );
        } catch (error) {
            console.error('Failed to parse memory extraction response:', error);
            return [];
        }
    }

    async saveMemories(userId, memories, sessionId = null) {
        const savedMemories = [];
        
        for (const memory of memories) {
            try {
                const result = await db.query(
                    'INSERT INTO memories (user_id, content, importance_score, session_id) VALUES (?, ?, ?, ?)',
                    [userId, memory.content, memory.importance || 0.5, sessionId]
                );
                
                const memoryId = result.insertId;
                
                if (memory.tags && memory.tags.length > 0) {
                    for (const tag of memory.tags) {
                        await db.query(
                            'INSERT IGNORE INTO memory_tags (memory_id, tag_name) VALUES (?, ?)',
                            [memoryId, tag.trim()]
                        );
                    }
                }
                
                savedMemories.push({
                    id: memoryId,
                    content: memory.content,
                    type: memory.type,
                    importance: memory.importance,
                    tags: memory.tags
                });
            } catch (error) {
                console.error('Failed to save memory:', error);
            }
        }
        
        return savedMemories;
    }

    async summarizeMemories(userId, memoryIds, providerId = 'openai', model = null) {
        try {
            const memories = await db.query(
                'SELECT content FROM memories WHERE id IN (?) AND user_id = ?',
                [memoryIds, userId]
            );
            
            if (memories.length === 0) {
                return { success: false, error: 'No memories found' };
            }
            
            const memoryText = memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n');
            
            const messages = [
                { role: 'system', content: '你是一个记忆总结专家。请将多条相关记忆合并为一条简洁的总结，保留关键信息。' },
                { role: 'user', content: `请总结以下记忆：\n\n${memoryText}` }
            ];
            
            const response = await llmService.chat(userId, providerId, messages, {
                model,
                temperature: 0.3,
                maxTokens: 500
            });
            
            return {
                success: true,
                summary: response.content,
                originalCount: memories.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generateTags(userId, content, providerId = 'openai', model = null) {
        try {
            const messages = [
                { role: 'system', content: '你是一个标签生成专家。为给定的内容生成3-5个相关标签。只输出标签，用逗号分隔。' },
                { role: 'user', content: `请为以下内容生成标签：\n\n${content}` }
            ];
            
            const response = await llmService.chat(userId, providerId, messages, {
                model,
                temperature: 0.3,
                maxTokens: 100
            });
            
            const tags = response.content
                .split(/[,，、\n]/)
                .map(t => t.trim().replace(/^#/, ''))
                .filter(t => t.length > 0 && t.length < 20);
            
            return {
                success: true,
                tags
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                tags: []
            };
        }
    }

    async assessImportance(userId, content, providerId = 'openai', model = null) {
        try {
            const messages = [
                { 
                    role: 'system', 
                    content: '你是一个记忆重要性评估专家。评估给定内容的重要性，返回0.0到1.0之间的分数。\n' +
                             '评分标准：\n' +
                             '- 0.9-1.0: 非常重要（关键个人信息、重大事件）\n' +
                             '- 0.7-0.9: 重要（偏好、习惯、关系）\n' +
                             '- 0.5-0.7: 一般（日常信息）\n' +
                             '- 0.3-0.5: 较低（琐碎信息）\n' +
                             '- 0.0-0.3: 不重要（无价值信息）\n\n' +
                             '只输出分数，不要其他内容。'
                },
                { role: 'user', content: `请评估以下记忆的重要性：\n\n${content}` }
            ];
            
            const response = await llmService.chat(userId, providerId, messages, {
                model,
                temperature: 0.1,
                maxTokens: 10
            });
            
            const score = parseFloat(response.content.trim());
            
            return {
                success: true,
                importance: isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                importance: 0.5
            };
        }
    }
}

const memoryExtractor = new MemoryExtractor();

module.exports = memoryExtractor;
