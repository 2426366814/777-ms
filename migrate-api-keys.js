/**
 * 迁移脚本：加密数据库中明文存储的 API Key
 */

require('dotenv').config();
const db = require('./src/utils/database');
const EncryptionService = require('./src/services/EncryptionService');

async function migrateApiKeys() {
    console.log('开始迁移 API Key...');
    
    try {
        const providerKeys = await db.query('SELECT id, provider_id, api_key FROM provider_api_keys WHERE api_key IS NOT NULL');
        console.log(`找到 ${providerKeys.length} 条 provider_api_keys 记录`);
        
        for (const key of providerKeys) {
            const apiKey = key.api_key;
            if (apiKey && !apiKey.includes(':')) {
                console.log(`加密 provider_api_keys: ${key.provider_id}`);
                const encrypted = EncryptionService.encrypt(apiKey);
                await db.query('UPDATE provider_api_keys SET api_key = ? WHERE id = ?', [encrypted, key.id]);
            }
        }
        
        const poolKeys = await db.query('SELECT id, provider_name, api_key_encrypted FROM api_key_pool WHERE api_key_encrypted IS NOT NULL');
        console.log(`找到 ${poolKeys.length} 条 api_key_pool 记录`);
        
        for (const key of poolKeys) {
            const apiKey = key.api_key_encrypted;
            if (apiKey && !apiKey.includes(':')) {
                console.log(`加密 api_key_pool: ${key.provider_name}`);
                const encrypted = EncryptionService.encrypt(apiKey);
                await db.query('UPDATE api_key_pool SET api_key_encrypted = ? WHERE id = ?', [encrypted, key.id]);
            }
        }
        
        const userConfigs = await db.query('SELECT id, user_id, provider, api_key_encrypted FROM user_llm_configs WHERE api_key_encrypted IS NOT NULL');
        console.log(`找到 ${userConfigs.length} 条 user_llm_configs 记录`);
        
        for (const config of userConfigs) {
            const apiKey = config.api_key_encrypted;
            if (apiKey && !apiKey.includes(':')) {
                console.log(`加密 user_llm_configs: user=${config.user_id}, provider=${config.provider}`);
                const encrypted = EncryptionService.encrypt(apiKey);
                await db.query('UPDATE user_llm_configs SET api_key_encrypted = ? WHERE id = ?', [encrypted, config.id]);
            }
        }
        
        console.log('API Key 迁移完成！');
        process.exit(0);
    } catch (error) {
        console.error('迁移失败:', error);
        process.exit(1);
    }
}

migrateApiKeys();
