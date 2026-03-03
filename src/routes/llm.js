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
const { authenticate } = require('../middleware/auth');

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
router.get('/configs', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const configs = await db.query(
            'SELECT provider, custom_base_url, custom_model, is_verified FROM user_llm_configs WHERE user_id = ?',
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
router.post('/configs', authenticate, async (req, res, next) => {
    try {
        const { error, value } = configSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: '输入数据无效', errors: error.details });
        }
        
        const userId = req.user.id;
        const { provider, model, apiKey, baseUrl, temperature, maxTokens } = value;
        
        const existing = await db.queryOne(
            'SELECT id FROM user_llm_configs WHERE user_id = ? AND provider = ?',
            [userId, provider]
        );
        
        if (existing) {
            await db.query(
                'UPDATE user_llm_configs SET api_key_encrypted = ?, custom_base_url = ?, custom_model = ?, updated_at = NOW() WHERE id = ?',
                [apiKey, baseUrl, model, existing.id]
            );
        } else {
            const { v4: uuidv4 } = require('uuid');
            await db.query(
                'INSERT INTO user_llm_configs (id, user_id, provider, api_key_encrypted, custom_base_url, custom_model) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), userId, provider, apiKey, baseUrl, model]
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
            'SELECT id, name, display_name, base_url, default_model, models, is_active FROM llm_providers WHERE is_active = 1 ORDER BY sort_order'
        );
        
        const result = providers.map(p => ({
            id: p.id,
            name: p.name,
            displayName: p.display_name,
            baseUrl: p.base_url,
            defaultModel: p.default_model,
            models: p.models ? (typeof p.models === 'string' ? JSON.parse(p.models) : p.models) : [],
            isActive: p.is_active
        }));
        
        res.json({ success: true, data: { providers: result } });
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
router.get('/usage', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
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
 * @route   GET /api/v1/llm/user-configs
 * @desc    获取用户的所有LLM配置
 * @access  Private
 */
router.get('/user-configs', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const configs = await db.query(
            'SELECT provider, api_key_encrypted, custom_base_url, custom_model FROM user_llm_configs WHERE user_id = ?',
            [userId]
        );
        
        const result = {};
        (configs || []).forEach(c => {
            result[c.provider] = {
                hasApiKey: !!c.api_key_encrypted,
                customBaseUrl: c.custom_base_url,
                customModel: c.custom_model
            };
        });
        
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/llm/user-config
 * @desc    保存用户的LLM配置
 * @access  Private
 */
router.post('/user-config', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const { providerId, apiKey, customBaseUrl, customModel } = req.body;
        
        if (!providerId) {
            return res.status(400).json({ success: false, message: '缺少providerId' });
        }
        
        const existing = await db.queryOne(
            'SELECT id FROM user_llm_configs WHERE user_id = ? AND provider = ?',
            [userId, providerId]
        );
        
        if (existing) {
            await db.query(
                'UPDATE user_llm_configs SET api_key_encrypted = ?, custom_base_url = ?, custom_model = ?, updated_at = NOW() WHERE id = ?',
                [apiKey, customBaseUrl, customModel, existing.id]
            );
        } else {
            const { v4: uuidv4 } = require('uuid');
            await db.query(
                'INSERT INTO user_llm_configs (id, user_id, provider, api_key_encrypted, custom_base_url, custom_model) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), userId, providerId, apiKey, customBaseUrl, customModel]
            );
        }
        
        logger.info(`用户 ${userId} 配置LLM: ${providerId}`);
        
        res.json({ success: true, message: '配置保存成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/llm/user-config/:providerId
 * @desc    删除用户的LLM配置
 * @access  Private
 */
router.delete('/user-config/:providerId', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { providerId } = req.params;
        
        await db.query(
            'DELETE FROM user_llm_configs WHERE user_id = ? AND provider = ?',
            [userId, providerId]
        );
        
        logger.info(`用户 ${userId} 删除LLM配置: ${providerId}`);
        
        res.json({ success: true, message: '配置删除成功' });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/llm/test
 * @desc    测试LLM连接
 * @access  Private
 */
router.post('/test', authenticate, async (req, res, next) => {
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
