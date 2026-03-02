const express = require('express');
const router = express.Router();
const providerRouter = require('../services/ProviderRouterService');
const db = require('../utils/database');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT id, name, display_name, base_url, default_model, models, is_active, sort_order, created_at
            FROM llm_providers
            ORDER BY sort_order, name
        `);
        res.json({ success: true, providers: rows || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/status', async (req, res) => {
    try {
        const providers = await providerRouter.getAllProviders();
        const circuitBreakers = providerRouter.getCircuitBreakerStatus();
        const providerStats = providerRouter.getProviderStats();
        
        res.json({
            success: true,
            providers,
            circuitBreakers,
            providerStats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/providers', async (req, res) => {
    try {
        const providers = await providerRouter.getAllProviders();
        res.json({ success: true, providers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/providers/all', async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT id, name, display_name, base_url, default_model, models, is_active, sort_order, created_at
            FROM llm_providers
            ORDER BY sort_order, name
        `);
        res.json({ success: true, providers: rows || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/providers', async (req, res) => {
    try {
        const { name, display_name, base_url, default_model, models, api_key } = req.body;
        
        if (!name || !base_url) {
            return res.status(400).json({ success: false, message: '名称和基础URL为必填项' });
        }
        
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        await db.query(`
            INSERT INTO llm_providers (id, name, display_name, base_url, default_model, models, is_active, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, 1, 0)
        `, [id, name, display_name || name, base_url, default_model || '', JSON.stringify(models || [])]);
        
        if (api_key) {
            await db.query(`
                INSERT INTO provider_api_keys (provider_id, api_key, is_active)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE api_key = VALUES(api_key)
            `, [id, api_key]);
        }
        
        logger.info(`创建新提供商: ${name}`);
        res.json({ success: true, message: '提供商创建成功', id });
    } catch (error) {
        logger.error('创建提供商失败:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/providers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { display_name, base_url, default_model, models, is_active, api_key } = req.body;
        
        const updates = [];
        const params = [];
        
        if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
        if (base_url !== undefined) { updates.push('base_url = ?'); params.push(base_url); }
        if (default_model !== undefined) { updates.push('default_model = ?'); params.push(default_model); }
        if (models !== undefined) { updates.push('models = ?'); params.push(JSON.stringify(models)); }
        if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
        
        if (updates.length > 0) {
            params.push(id);
            await db.query(`UPDATE llm_providers SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        
        if (api_key !== undefined) {
            await db.query(`
                INSERT INTO provider_api_keys (provider_id, api_key, is_active)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE api_key = VALUES(api_key)
            `, [id, api_key]);
        }
        
        logger.info(`更新提供商: ${id}`);
        res.json({ success: true, message: '提供商更新成功' });
    } catch (error) {
        logger.error('更新提供商失败:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/providers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM provider_api_keys WHERE provider_id = ?', [id]);
        await db.query('DELETE FROM llm_providers WHERE id = ?', [id]);
        
        logger.info(`删除提供商: ${id}`);
        res.json({ success: true, message: '提供商删除成功' });
    } catch (error) {
        logger.error('删除提供商失败:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/providers/:id/api-key', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await db.query('SELECT api_key FROM provider_api_keys WHERE provider_id = ? AND is_active = 1', [id]);
        res.json({ success: true, apiKey: rows && rows.length > 0 ? rows[0].api_key : null });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/models', async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT m.id, m.provider_id, m.model_id, m.display_name, m.context_length, m.is_active,
                   p.display_name as provider_name
            FROM llm_models m
            LEFT JOIN llm_providers p ON m.provider_id = p.id
            WHERE m.is_active = 1
            ORDER BY p.sort_order, m.model_id
        `);
        res.json({ success: true, models: rows || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/models', async (req, res) => {
    try {
        const { provider_id, model_id, display_name, context_length } = req.body;
        
        if (!provider_id || !model_id) {
            return res.status(400).json({ success: false, message: '提供商ID和模型ID为必填项' });
        }
        
        const id = `${provider_id}_${model_id}`.replace(/[^a-z0-9_]/gi, '_');
        
        await db.query(`
            INSERT INTO llm_models (id, provider_id, model_id, display_name, context_length, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE 
                display_name = VALUES(display_name),
                context_length = VALUES(context_length)
        `, [id, provider_id, model_id, display_name || model_id, context_length || 4096]);
        
        res.json({ success: true, message: '模型添加成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/strategies', async (req, res) => {
    try {
        const strategies = await providerRouter.getStrategies();
        res.json({ success: true, strategies });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await providerRouter.getRoutingLogs(limit);
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/circuit/reset/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        providerRouter.resetCircuitBreaker(providerId);
        res.json({ success: true, message: `Circuit breaker for ${providerId} has been reset` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/preferences', async (req, res) => {
    try {
        const userId = req.user?.id || 1;
        const preferences = await providerRouter.getUserPreferences(userId);
        res.json({ success: true, preferences });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/preferences', async (req, res) => {
    try {
        const userId = req.user?.id || 1;
        await providerRouter.setUserPreferences(userId, req.body);
        res.json({ success: true, message: 'Preferences saved' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
