/**
 * Chat路由
 * 处理AI对话接口
 * 支持对话控制记忆体管理
 */

const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const LLMService = require('../services/LLMService');
const memoryService = require('../services/memoryService');
const knowledgeService = require('../services/KnowledgeService');
const reviewService = require('../services/ReviewService');
const autoManager = require('../services/AutoManager');

const MEMORY_COMMANDS = {
    '/save': 'saveMemory',
    '/remember': 'saveMemory',
    '/记忆': 'saveMemory',
    '/search': 'searchMemory',
    '/find': 'searchMemory',
    '/查找': 'searchMemory',
    '/forget': 'deleteMemory',
    '/删除': 'deleteMemory',
    '/list': 'listMemories',
    '/列表': 'listMemories',
    '/review': 'startReview',
    '/复习': 'startReview',
    '/stats': 'getStats',
    '/统计': 'getStats',
    '/extract': 'extractMemory',
    '/提取': 'extractMemory',
    '/help': 'showHelp',
    '/帮助': 'showHelp'
};

const chatSchema = Joi.object({
    message: Joi.string().min(1).max(10000).required(),
    sessionId: Joi.string().optional(),
    model: Joi.string().optional(),
    provider: Joi.string().optional(),
    providerId: Joi.string().optional(),
    stream: Joi.boolean().default(false),
    includeMemory: Joi.boolean().default(true),
    memoryOptions: Joi.object({
        includeRecent: Joi.boolean().default(true),
        includeImportant: Joi.boolean().default(true),
        includeRelevant: Joi.boolean().default(true),
        recentLimit: Joi.number().default(3),
        importantLimit: Joi.number().default(3),
        relevantLimit: Joi.number().default(5)
    }).optional()
});

function parseCommand(message) {
    const trimmed = message.trim();
    for (const [cmd, action] of Object.entries(MEMORY_COMMANDS)) {
        if (trimmed.startsWith(cmd + ' ') || trimmed === cmd) {
            const args = trimmed.slice(cmd.length).trim();
            return { command: cmd, action, args };
        }
    }
    return null;
}

async function handleMemoryCommand(userId, command, args, provider) {
    switch (command.action) {
        case 'saveMemory':
            if (!args) return { success: false, message: '请提供要保存的记忆内容' };
            const savedMemory = await memoryService.createMemory(userId, {
                content: args,
                category: 'user-saved',
                importance: 7,
                tags: ['手动保存']
            });
            return { 
                success: true, 
                message: `✅ 记忆已保存 (ID: ${savedMemory.id})`,
                data: savedMemory 
            };

        case 'searchMemory':
            if (!args) return { success: false, message: '请提供搜索关键词' };
            const searchResults = await memoryService.searchRelevantMemories(userId, args, 5);
            return {
                success: true,
                message: `找到 ${searchResults.length} 条相关记忆`,
                data: { memories: searchResults }
            };

        case 'deleteMemory':
            if (!args) return { success: false, message: '请提供要删除的记忆ID' };
            const memoryId = parseInt(args);
            if (isNaN(memoryId)) return { success: false, message: '无效的记忆ID' };
            const deleted = await memoryService.deleteMemory(userId, memoryId);
            return {
                success: deleted,
                message: deleted ? `✅ 记忆 ${memoryId} 已删除` : '记忆不存在或无权删除'
            };

        case 'listMemories':
            const limit = args ? parseInt(args) || 10 : 10;
            const memories = await memoryService.getRecentMemories(userId, limit);
            return {
                success: true,
                message: `最近 ${memories.length} 条记忆`,
                data: { memories }
            };

        case 'startReview':
            const dueReviews = await reviewService.getDueReviews(userId, 5);
            if (dueReviews.length === 0) {
                return { success: true, message: '暂无待复习的记忆' };
            }
            const reviewQuestion = await reviewService.generateReviewQuestion(userId, dueReviews[0].id, provider);
            return {
                success: true,
                message: '📚 复习开始',
                data: { 
                    review: reviewQuestion,
                    total: dueReviews.length 
                }
            };

        case 'getStats':
            const stats = await memoryService.getMemoryStats(userId);
            const reviewStats = await reviewService.getReviewStats(userId);
            return {
                success: true,
                message: '📊 记忆统计',
                data: { 
                    memory: stats,
                    review: reviewStats
                }
            };

        case 'extractMemory':
            if (!args) return { success: false, message: '请提供要提取的内容' };
            const extracted = await autoManager.triggerManualExtraction(userId, [{ role: 'user', content: args }], provider);
            return {
                success: true,
                message: `✅ 提取并保存了 ${extracted.length} 条记忆`,
                data: { memories: extracted }
            };

        case 'showHelp':
            return {
                success: true,
                message: `📖 记忆控制命令帮助

**保存记忆:**
/save <内容> 或 /记忆 <内容>

**搜索记忆:**
/search <关键词> 或 /查找 <关键词>

**列出记忆:**
/list [数量] 或 /列表 [数量]

**删除记忆:**
/forget <ID> 或 /删除 <ID>

**开始复习:**
/review 或 /复习

**查看统计:**
/stats 或 /统计

**提取记忆:**
/extract <内容> 或 /提取 <内容>`
            };

        default:
            return { success: false, message: '未知命令' };
    }
}

/**
 * @route   POST /api/v1/chat
 * @desc    发送消息并获取AI回复（支持记忆体自动载入和命令控制）
 * @access  Private
 */
router.post('/', async (req, res, next) => {
    try {
        const { error, value } = chatSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }

        const userId = req.user?.id || 'default-user';
        const { message, sessionId, model, provider, providerId, stream, includeMemory, memoryOptions } = value;
        const actualProvider = providerId || provider || 'deepseek';

        const command = parseCommand(message);
        if (command) {
            const result = await handleMemoryCommand(userId, command, command.args, actualProvider);
            return res.json({
                success: result.success,
                data: {
                    response: result.message,
                    isCommand: true,
                    command: command.command,
                    data: result.data
                }
            });
        }

        let session = null;
        if (sessionId) {
            const sessions = await db.query('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
            session = sessions && sessions.length > 0 ? sessions[0] : null;
        }

        if (!session) {
            const newSessionId = uuidv4();
            await db.query(
                'INSERT INTO sessions (id, user_id, title, messages, created_at) VALUES (?, ?, ?, ?, NOW())',
                [newSessionId, userId, message.substring(0, 50), JSON.stringify([])]
            );
            session = { id: newSessionId };
        }

        let memoryContext = '';
        let loadedMemories = [];
        
        if (includeMemory) {
            try {
                memoryContext = await memoryService.buildContextForQuery(userId, message, memoryOptions || {});
                logger.info(`为用户 ${userId} 加载记忆上下文`);
            } catch (memError) {
                logger.warn('加载记忆上下文失败:', memError.message);
            }
        }

        const messages = session.messages ? JSON.parse(session.messages) : [];
        
        const systemPrompt = `你是一个智能助手，可以帮助用户管理记忆和知识。你拥有持久记忆能力，可以记住用户的偏好、重要信息和历史对话。

${memoryContext ? `以下是用户的相关记忆，请在回答时参考这些信息：\n${memoryContext}` : ''}

重要提示：
1. 用户的记忆和知识库是严格隔离的，每个用户只能访问自己的数据
2. 如果用户提到重要信息，可以建议使用 /save 命令保存
3. 用户可以使用 /help 查看所有可用命令`;
        
        const chatMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message }
        ];

        const response = await LLMService.chat(userId, actualProvider, chatMessages, {
            model: model || undefined,
            maxTokens: 2000
        });

        messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
        messages.push({ role: 'assistant', content: response.content, timestamp: new Date().toISOString() });

        await db.query(
            'UPDATE sessions SET messages = ?, updated_at = NOW() WHERE id = ?',
            [JSON.stringify(messages), session.id]
        );

        if (includeMemory && message.length > 20) {
            try {
                await autoManager.submitExtractionTask(userId, chatMessages);
            } catch (extractError) {
                logger.warn('自动提取任务提交失败:', extractError.message);
            }
        }

        logger.info(`用户 ${userId} 发送消息到会话 ${session.id}`);

        res.json({
            success: true,
            data: {
                sessionId: session.id,
                response: response.content,
                model: response.model,
                provider: actualProvider,
                memoryLoaded: includeMemory && memoryContext.length > 0
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/chat/models
 * @desc    获取可用的AI模型列表
 * @access  Public
 */
router.get('/models', async (req, res, next) => {
    try {
        const models = await LLMService.getAvailableModels();
        res.json({ success: true, data: { models } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/chat/providers
 * @desc    获取可用的提供商列表
 * @access  Public
 */
router.get('/providers', async (req, res, next) => {
    try {
        const providers = await db.query('SELECT id, name, display_name, models FROM llm_providers WHERE is_active = 1');
        res.json({ success: true, data: { providers: providers || [] } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
