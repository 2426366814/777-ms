const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const logger = require('../utils/logger');
const forgettingCurveService = require('../services/ForgettingCurveService');
const { authenticate } = require('../middleware/auth');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const HISTORY_PAGE_SIZE = 50;
const ALLOWED_PROVIDERS = ['openai', 'anthropic', 'zhipu', 'deepseek', 'qwen', 'moonshot', 'baichuan', 'yi', 'minimax', 'baidu', 'spark', 'doubao', 'sensenova', 'cohere', 'mistral', 'perplexity', 'groq', 'grok', 'google', 'replicate', 'together', 'siliconflow', 'custom', 'local'];

router.use(authenticate);

function validateMemoryId(memoryId) {
    if (!memoryId) {
        return { valid: false, message: '无效的记忆ID' };
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(memoryId)) {
        return { valid: true, value: memoryId };
    }
    if (Number.isInteger(Number(memoryId)) && Number(memoryId) > 0) {
        return { valid: true, value: parseInt(memoryId) };
    }
    return { valid: false, message: '无效的记忆ID' };
}

function validateQuality(quality) {
    if (!quality || !Number.isInteger(Number(quality)) || Number(quality) < 1 || Number(quality) > 5) {
        return { valid: false, message: '质量评分必须在1-5之间' };
    }
    return { valid: true, value: parseInt(quality) };
}

async function getAvailableProvider(userId, requestedProvider) {
    if (requestedProvider && ALLOWED_PROVIDERS.includes(requestedProvider)) {
        return requestedProvider;
    }
    
    const userConfigs = await db.query(
        'SELECT provider FROM user_llm_configs WHERE user_id = ? AND api_key_encrypted IS NOT NULL',
        [userId]
    );
    
    if (userConfigs && userConfigs.length > 0) {
        return userConfigs[0].provider;
    }
    
    const sharedKeys = await db.query(
        'SELECT provider_id FROM provider_api_keys WHERE is_active = 1 LIMIT 1'
    );
    
    if (sharedKeys && sharedKeys.length > 0) {
        return sharedKeys[0].provider_id;
    }
    
    return null;
}

async function validateProvider(provider, userId) {
    if (provider && !ALLOWED_PROVIDERS.includes(provider)) {
        return { valid: false, message: '不支持的提供商' };
    }
    
    const availableProvider = await getAvailableProvider(userId, provider);
    
    if (!availableProvider) {
        return { 
            valid: false, 
            message: '没有可用的 LLM 提供商。请在个人设置中配置您的 API Key，或联系管理员添加共享 API Key。' 
        };
    }
    
    return { valid: true, value: availableProvider };
}

router.get('/due', async (req, res) => {
    try {
        const limit = Math.min(
            Math.max(1, parseInt(req.query.limit) || DEFAULT_PAGE_SIZE),
            MAX_PAGE_SIZE
        );
        const memories = await forgettingCurveService.getMemoriesForReview(req.user.id, limit);
        res.json({ success: true, memories });
    } catch (error) {
        logger.error('Get due memories error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/record', async (req, res) => {
    try {
        const { memoryId, quality, provider } = req.body;
        
        const memoryValidation = validateMemoryId(memoryId);
        if (!memoryValidation.valid) {
            return res.status(400).json({ success: false, message: memoryValidation.message });
        }
        
        const qualityValidation = validateQuality(quality);
        if (!qualityValidation.valid) {
            return res.status(400).json({ success: false, message: qualityValidation.message });
        }
        
        const providerValidation = await validateProvider(provider, req.user.id);
        if (!providerValidation.valid) {
            return res.status(400).json({ success: false, message: providerValidation.message });
        }
        
        const result = await forgettingCurveService.recordReview(
            req.user.id, 
            memoryValidation.value, 
            qualityValidation.value, 
            providerValidation.value
        );
        res.json(result);
    } catch (error) {
        logger.error('Record review error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/questions/:memoryId', async (req, res) => {
    try {
        const { provider } = req.query;
        
        const memoryValidation = validateMemoryId(req.params.memoryId);
        if (!memoryValidation.valid) {
            return res.status(400).json({ success: false, message: memoryValidation.message });
        }
        
        const providerValidation = await validateProvider(provider, req.user.id);
        if (!providerValidation.valid) {
            return res.status(400).json({ success: false, message: providerValidation.message });
        }
        
        const result = await forgettingCurveService.generateReviewQuestions(
            req.user.id, 
            memoryValidation.value, 
            providerValidation.value
        );
        res.json(result);
    } catch (error) {
        logger.error('Generate questions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const stats = await forgettingCurveService.getReviewStats(req.user.id);
        res.json({ success: true, stats });
    } catch (error) {
        logger.error('Get stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/curve', async (req, res) => {
    try {
        const curve = await forgettingCurveService.getForgettingCurveData(req.user.id);
        res.json({ success: true, curve });
    } catch (error) {
        logger.error('Get curve error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/schedule', async (req, res) => {
    try {
        const result = await forgettingCurveService.scheduleReviewReminder(req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Schedule review error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/schedule', async (req, res) => {
    try {
        const upcoming = await db.query(`
            SELECT r.*, m.content
            FROM review_items r
            JOIN memories m ON r.memory_id = m.id
            WHERE r.user_id = ?
            ORDER BY r.next_review_at ASC
            LIMIT 20
        `, [req.user.id]);
        res.json({ success: true, upcoming });
    } catch (error) {
        logger.error('Get schedule error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/history', async (req, res) => {
    try {
        const limit = Math.min(
            Math.max(1, parseInt(req.query.limit) || HISTORY_PAGE_SIZE),
            MAX_PAGE_SIZE
        );
        const history = await db.query(`
            SELECT r.*, m.content
            FROM review_items r
            JOIN memories m ON r.memory_id = m.id
            WHERE r.user_id = ? AND r.review_count > 0
            ORDER BY COALESCE(r.last_review_at, r.updated_at, r.created_at) DESC
            LIMIT ?
        `, [req.user.id, limit]);
        res.json({ success: true, history });
    } catch (error) {
        logger.error('Get history error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
