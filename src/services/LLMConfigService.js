/**
 * LLM 配置服务
 * 统一管理 LLM 提供商默认配置
 * 避免硬编码问题
 */

const db = require('../utils/database');
const logger = require('../utils/logger');

class LLMConfigService {
    constructor() {
        this._defaultProvider = null;
        this._cacheExpiry = 0;
        this._cacheTTL = 60000;
    }

    async getDefaultProvider() {
        if (this._defaultProvider && Date.now() < this._cacheExpiry) {
            return this._defaultProvider;
        }

        const envDefault = process.env.DEFAULT_LLM_PROVIDER;
        if (envDefault) {
            this._defaultProvider = envDefault;
            this._cacheExpiry = Date.now() + this._cacheTTL;
            return envDefault;
        }

        try {
            const providers = await db.query(
                'SELECT id FROM llm_providers WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC LIMIT 1'
            );
            
            if (providers && providers.length > 0) {
                this._defaultProvider = providers[0].id;
                this._cacheExpiry = Date.now() + this._cacheTTL;
                return this._defaultProvider;
            }
        } catch (error) {
            logger.warn('获取默认提供商失败:', error.message);
        }

        try {
            const sharedKeys = await db.query(
                'SELECT provider_id FROM provider_api_keys WHERE is_active = 1 LIMIT 1'
            );
            
            if (sharedKeys && sharedKeys.length > 0) {
                this._defaultProvider = sharedKeys[0].provider_id;
                this._cacheExpiry = Date.now() + this._cacheTTL;
                return this._defaultProvider;
            }
        } catch (error) {
            logger.warn('获取共享 API Key 提供商失败:', error.message);
        }

        return null;
    }

    async getProviderOrDefault(userId, requestedProvider) {
        if (requestedProvider) {
            return requestedProvider;
        }

        if (userId && userId !== 'system') {
            try {
                const userConfig = await db.query(
                    'SELECT provider FROM user_llm_configs WHERE user_id = ? AND api_key_encrypted IS NOT NULL LIMIT 1',
                    [userId]
                );
                
                if (userConfig && userConfig.length > 0) {
                    return userConfig[0].provider;
                }
            } catch (error) {
                logger.warn('获取用户提供商配置失败:', error.message);
            }
        }

        return await this.getDefaultProvider();
    }

    async hasAvailableProvider(userId) {
        const provider = await this.getProviderOrDefault(userId, null);
        return provider !== null;
    }

    clearCache() {
        this._defaultProvider = null;
        this._cacheExpiry = 0;
    }
}

const llmConfigService = new LLMConfigService();
module.exports = llmConfigService;
