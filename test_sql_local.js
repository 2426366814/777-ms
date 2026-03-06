/**
 * 本地测试SQL注入检测
 */

const { detectSQLInjection, sanitizeSearchQuery } = require('./src/utils/security');

const payloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1; SELECT * FROM users",
    "' UNION SELECT * FROM memories --",
    "normal search",
    "hello world",
    "test'; --",
    "admin'--"
];

console.log('测试SQL注入检测:\n');

for (const payload of payloads) {
    const result = detectSQLInjection(payload);
    const sanitized = sanitizeSearchQuery(payload);
    console.log(`输入: "${payload}"`);
    console.log(`  检测结果: ${result.isSQLInjection ? '❌ SQL注入' : '✅ 安全'}`);
    if (result.patterns.length > 0) {
        console.log(`  匹配模式: ${result.patterns.length}个`);
    }
    console.log(`  净化结果: "${sanitized}"`);
    console.log();
}
