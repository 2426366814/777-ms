require('dotenv').config();
const db = require('./src/utils/database');
const crypto = require('crypto');

const hashApiKey = (apiKey) => {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
};

async function migrateApiKeys() {
    console.log('开始数据库迁移...');
    
    try {
        await db.query("ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64)");
        console.log('✅ api_key_hash 列已添加或已存在');
        
        const rows = await db.query(
            "SELECT id, api_key FROM user_api_keys WHERE api_key IS NOT NULL AND (api_key_hash IS NULL OR api_key_hash = '')"
        );
        
        console.log(`发现 ${rows ? rows.length : 0} 条需要迁移的记录`);
        
        if (rows && rows.length > 0) {
            for (const row of rows) {
                if (row.api_key) {
                    const hashedKey = hashApiKey(row.api_key);
                    await db.query(
                        "UPDATE user_api_keys SET api_key_hash = ? WHERE id = ?",
                        [hashedKey, row.id]
                    );
                    console.log(`✅ 已迁移记录 ${row.id}`);
                }
            }
        }
        
        console.log('✅ API Key 哈希迁移完成！');
        process.exit(0);
    } catch (error) {
        console.error('迁移失败:', error.message);
        console.error(error);
        process.exit(1);
    }
}

migrateApiKeys();
