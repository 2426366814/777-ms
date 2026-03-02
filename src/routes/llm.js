/**
 * LLM路由
 * 处理LLM服务配置和调用
 */

const express = require('express');
const Joi = require('joi');

const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const LLMService = require('../services/LLMService');

const configSchema = Joi.object({
    provider: Joi.string().required(),
    model: Joi.string().optional(),
    apiKey: Joi.string().optional(),
    baseUrl: Joi.string().uri().optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    maxTokens: Joi.number().min(1).max(128000).optional()
});

/**
 * @route   GET /api/v1/llm/configs
 * @desc    获取用户的LLM配置
 * @access  Private
 */
router.get('/configs', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const configs = await db.query(
            'SELECT * FROM user_llm_configs WHERE user_id = ?',
            [userId]
        );
        
        res.json({ success: true, data: { configs: configs || [] } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/llm/configs
 * @desc    创建或更新LLM配置
 * @access  Private
 */
router.post('/configs', async (req, res, next) => {
    try {
        const { error, value } = configSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const userId = req.user?.id || 'default-user';
        const { provider, model, apiKey, baseUrl, temperature, maxTokens } = value;
        
        const existing = await db.query(
            'SELECT id FROM user_llm_configs WHERE user_id = ? AND provider = ?',
            [userId, provider]
        );
        
        if (existing && existing.length > 0) {
            await db.query(
                'UPDATE user_llm_configs SET model = ?, api_key = ?, base_url = ?, temperature = ?, max_tokens = ?, updated_at = NOW() WHERE id = ?',
                [model, apiKey, baseUrl, temperature, maxTokens, existing[0].id]
            );
        } else {
            const { v4: uuidv4 } = require('uuid');
            await db.query(
                'INSERT INTO user_llm_configs (id, user_id, provider, model, api_key, base_url, temperature, max_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [uuidv4(), userId, provider, model, apiKey, baseUrl, temperature, maxTokens]
            );
        }
        
        logger.info(`用户 ${userId} 配置LLM: ${provider}`);
        
        res.json({ success: true, message: 'LLM配置保存成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/llm/providers
 * @desc    获取所有LLM提供商
 * @access  Public
 */
router.get('/providers', async (req, res, next) => {
    try {
        const providers = await db.query(
            'SELECT id, name, display_name, base_url, default_model, models, is_active FROM llm_providers ORDER BY sort_order'
        );
        
        res.json({ success: true, data: { providers: providers || [] } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/llm/providers/:id/models
 * @desc    获取提供商支持的模型
 * @access  Public
 */
router.get('/providers/:id/models', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const models = await db.query(
            'SELECT * FROM provider_models WHERE provider_id = ? AND is_available = 1',
            [id]
        );
        
        res.json({ success: true, data: { models: models || [] } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/llm/usage
 * @desc    获取用户LLM使用统计
 * @access  Private
 */
router.get('/usage', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const usage = await db.query(
            `SELECT 
                provider,
                COUNT(*) as total_requests,
                MAX(created_at) as last_used
            FROM llm_usage_logs 
            WHERE user_id = ?
            GROUP BY provider`,
            [userId]
        );
        
        res.json({ success: true, data: { usage: usage || [] } });
    } catch (error) {
        res.json({ success: true, data: { usage: [] } });
    }
});

/**
 * @route   POST /api/v1/llm/test
 * @desc    测试LLM连接
 * @access  Private
 */
router.post('/test', async (req, res, next) => {
    try {
        const { provider, model, apiKey, baseUrl } = req.body;
        
        const result = await LLMService.testConnection({
            provider,
            model,
            apiKey,
            baseUrl
        });
        
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
