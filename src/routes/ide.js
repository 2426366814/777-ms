/**
 * IDE 对接路由
 * 提供 MCP 协议支持，供 Trae/VS Code 等 IDE 调用
 * 自动载入记忆体和知识库上下文
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const logger = require('../utils/logger');
const memoryService = require('../services/memoryService');
const LLMService = require('../services/LLMService');

const AUTO_MEMORY_ENABLED = process.env.AUTO_MEMORY_ENABLED !== 'false';
const AUTO_KNOWLEDGE_ENABLED = process.env.AUTO_KNOWLEDGE_ENABLED !== 'false';
const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER || 'deepseek';

/**
 * @route   POST /api/v1/ide/chat
 * @desc    IDE 聊天接口 - 自动载入记忆和知识库
 * @access  Private (API Key)
 */
router.post('/chat', async (req, res, next) => {
    try {
        const { messages, context, stream = false, autoMemory = true, autoKnowledge = true, provider } = req.body;
        const userId = req.user.id;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                message: '消息列表不能为空'
            });
        }

        logger.info(`IDE 聊天请求 - 用户: ${userId}, 自动记忆: ${autoMemory}, 自动知识库: ${autoKnowledge}`);

        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const query = lastUserMessage?.content || '';

        let memoryContext = '';
        let knowledgeContext = '';
        let loadedMemories = [];
        let loadedKnowledge = [];

        if ((autoMemory && AUTO_MEMORY_ENABLED) || (autoKnowledge && AUTO_KNOWLEDGE_ENABLED)) {
            const contextResult = await buildAutoContext(userId, query, { autoMemory, autoKnowledge });
            memoryContext = contextResult.memoryContext;
            knowledgeContext = contextResult.knowledgeContext;
            loadedMemories = contextResult.loadedMemories;
            loadedKnowledge = contextResult.loadedKnowledge;
        }

        const systemPrompt = buildSystemPrompt(memoryContext, knowledgeContext);
        
        const chatMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10)
        ];

        const actualProvider = provider || DEFAULT_PROVIDER;
        let response;
        
        try {
            response = await LLMService.chat(userId, actualProvider, chatMessages, {
                maxTokens: 2000
            });
        } catch (llmError) {
            logger.error('LLM调用失败:', llmError);
            return res.status(500).json({
                success: false,
                message: 'LLM服务暂时不可用'
            });
        }

        if (autoMemory && AUTO_MEMORY_ENABLED && query.length > 10) {
            try {
                await autoExtractAndStore(userId, query, response.content, actualProvider);
            } catch (extractError) {
                logger.warn('自动提取记忆失败:', extractError.message);
            }
        }

        res.json({
            success: true,
            data: {
                response: {
                    id: 'chat-' + uuidv4(),
                    content: response.content,
                    role: 'assistant',
                    timestamp: new Date().toISOString(),
                    model: response.model
                },
                context: {
                    memoryUsed: loadedMemories.length,
                    knowledgeUsed: loadedKnowledge.length,
                    autoMemoryEnabled: autoMemory && AUTO_MEMORY_ENABLED,
                    autoKnowledgeEnabled: autoKnowledge && AUTO_KNOWLEDGE_ENABLED
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

async function buildAutoContext(userId, query, options) {
    const { autoMemory, autoKnowledge } = options;
    let memoryContext = '';
    let knowledgeContext = '';
    let loadedMemories = [];
    let loadedKnowledge = [];

    if (autoMemory && AUTO_MEMORY_ENABLED) {
        try {
            memoryContext = await memoryService.buildContextForQuery(userId, query, {
                includeRecent: true,
                includeImportant: true,
                includeRelevant: true,
                recentLimit: 3,
                importantLimit: 3,
                relevantLimit: 5
            });
            loadedMemories = await memoryService.searchRelevantMemories(userId, query, 5);
            logger.info(`自动载入 ${loadedMemories.length} 条记忆`);
        } catch (err) {
            logger.warn('载入记忆失败:', err.message);
        }
    }

    if (autoKnowledge && AUTO_KNOWLEDGE_ENABLED) {
        try {
            const knowledgeService = require('../services/KnowledgeService');
            const knowledgeResult = await knowledgeService.searchKnowledge(userId, query, 3);
            if (knowledgeResult && knowledgeResult.length > 0) {
                knowledgeContext = '\n[相关知识库内容]\n' + 
                    knowledgeResult.map((k, i) => `${i + 1}. ${k.title}: ${k.content?.substring(0, 200)}...`).join('\n') +
                    '\n[/相关知识库内容]\n';
                loadedKnowledge = knowledgeResult;
                logger.info(`自动载入 ${loadedKnowledge.length} 条知识`);
            }
        } catch (err) {
            logger.warn('载入知识库失败:', err.message);
        }
    }

    return { memoryContext, knowledgeContext, loadedMemories, loadedKnowledge };
}

function buildSystemPrompt(memoryContext, knowledgeContext) {
    let prompt = '你是一个智能助手，拥有持久记忆能力。';
    
    if (memoryContext) {
        prompt += '\n\n以下是与当前对话相关的记忆，请在回答时参考：\n' + memoryContext;
    }
    
    if (knowledgeContext) {
        prompt += '\n\n' + knowledgeContext;
    }
    
    prompt += '\n\n请注意：用户的记忆和知识库是严格隔离的，每个用户只能访问自己的数据。';
    
    return prompt;
}

async function autoExtractAndStore(userId, userMessage, assistantResponse, provider) {
    try {
        const MemoryExtractor = require('../services/MemoryExtractor');
        const extraction = await MemoryExtractor.extractFromConversation(
            userId,
            [{ role: 'user', content: userMessage }, { role: 'assistant', content: assistantResponse }],
            { provider }
        );
        
        if (extraction && extraction.memories && extraction.memories.length > 0) {
            for (const mem of extraction.memories.slice(0, 3)) {
                await memoryService.createMemory(userId, {
                    content: mem.content,
                    category: mem.type || 'auto-extracted',
                    importance: mem.importance || 5,
                    tags: mem.tags || []
                });
            }
            logger.info(`自动提取并存储 ${extraction.memories.length} 条记忆`);
        }
    } catch (err) {
        logger.warn('自动提取失败:', err.message);
    }
}

/**
 * @route   POST /api/v1/ide/memory
 * @desc    存储 IDE 中的记忆
 * @access  Private (API Key)
 */
router.post('/memory', async (req, res, next) => {
    try {
        const { content, type = 'code', metadata = {}, tags = [], importance = 5 } = req.body;
        const userId = req.user.id;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: '记忆内容不能为空'
            });
        }

        const memory = await memoryService.createMemory(userId, {
            content,
            category: 'ide-' + type,
            importance,
            tags: tags.length > 0 ? tags : ['ide', type],
            metadata: {
                ...metadata,
                source: 'ide',
                ide: metadata.ide || 'unknown'
            }
        });

        logger.info(`IDE 记忆存储 - 用户: ${userId}, 类型: ${type}`);

        res.status(201).json({
            success: true,
            message: '记忆已存储',
            data: {
                memoryId: memory.id,
                stored: true
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/ide/memory
 * @desc    检索相关记忆
 * @access  Private (API Key)
 */
router.get('/memory', async (req, res, next) => {
    try {
        const { query, limit = 5 } = req.query;
        const userId = req.user.id;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: '查询关键词不能为空'
            });
        }

        const memories = await memoryService.searchRelevantMemories(userId, query, parseInt(limit));

        res.json({
            success: true,
            data: {
                query,
                memories: memories.map(m => ({
                    id: m.id,
                    content: m.content,
                    category: m.category,
                    tags: m.tags,
                    relevance: m.relevance,
                    createdAt: m.created_at
                })),
                total: memories.length
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/ide/mcp
 * @desc    MCP 协议接口
 * @access  Private (API Key)
 */
router.post('/mcp', async (req, res, next) => {
    try {
        const { method, params } = req.body;
        const userId = req.user.id;

        logger.info(`MCP 调用 - 方法: ${method}, 用户: ${userId}`);

        switch (method) {
            case 'memory.create': {
                const { content, category, tags, importance } = params || {};
                const memory = await memoryService.createMemory(userId, {
                    content,
                    category: category || 'mcp',
                    tags: tags || [],
                    importance: importance || 5
                });
                res.json({
                    success: true,
                    data: {
                        memoryId: memory.id,
                        created: true
                    }
                });
                break;
            }

            case 'memory.search': {
                const { query, limit } = params || {};
                const results = await memoryService.searchRelevantMemories(userId, query, limit || 5);
                res.json({
                    success: true,
                    data: {
                        results: results.map(r => ({
                            id: r.id,
                            content: r.content,
                            relevance: r.relevance,
                            tags: r.tags
                        })),
                        total: results.length
                    }
                });
                break;
            }

            case 'knowledge.query': {
                const { query, limit } = params || {};
                try {
                    const knowledgeService = require('../services/KnowledgeService');
                    const results = await knowledgeService.searchKnowledge(userId, query, limit || 3);
                    res.json({
                        success: true,
                        data: {
                            results: results || [],
                            total: results?.length || 0
                        }
                    });
                } catch (err) {
                    res.json({
                        success: true,
                        data: {
                            results: [],
                            total: 0
                        }
                    });
                }
                break;
            }

            case 'context.get': {
                const { query } = params || {};
                const contextResult = await buildAutoContext(userId, query || '', {
                    autoMemory: true,
                    autoKnowledge: true
                });
                res.json({
                    success: true,
                    data: {
                        context: {
                            memoryContext: contextResult.memoryContext,
                            knowledgeContext: contextResult.knowledgeContext,
                            recentMemories: contextResult.loadedMemories.slice(0, 5),
                            relevantKnowledge: contextResult.loadedKnowledge.slice(0, 3)
                        }
                    }
                });
                break;
            }

            default:
                res.status(400).json({
                    success: false,
                    message: `未知方法: ${method}`
                });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/ide/status
 * @desc    获取系统状态
 * @access  Private (API Key)
 */
router.get('/status', async (req, res, next) => {
    try {
        const userId = req.user.id;

        const stats = await memoryService.getMemoryStats(userId);

        res.json({
            success: true,
            data: {
                status: 'healthy',
                version: '0.4.2',
                user: {
                    id: userId,
                    memoryCount: stats.total || 0,
                    knowledgeCount: 0
                },
                features: {
                    autoMemory: AUTO_MEMORY_ENABLED,
                    autoKnowledge: AUTO_KNOWLEDGE_ENABLED,
                    autoExtract: true,
                    autoReview: true
                },
                llm: {
                    provider: DEFAULT_PROVIDER,
                    status: 'connected'
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
