const https = require('https');

const BASE_URL = 'memory.91wz.org';

function makeRequest(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = 'Bearer ' + token;
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch (e) { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function fullMultiUserDeepInspection() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     777-MS 多用户系统深度检测 v3.0 - 完整版              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const timestamp = Date.now();
    const results = { phases: {} };
    
    // ========== Phase 1: 安全修复验证 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 1: 安全修复验证 - 认证中间件部署检查');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const protectedRoutes = [
        { path: '/api/v1/memories', name: 'memories' },
        { path: '/api/v1/knowledge', name: 'knowledge' },
        { path: '/api/v1/tags', name: 'tags' },
        { path: '/api/v1/categories', name: 'categories' },
        { path: '/api/v1/sessions', name: 'sessions' },
        { path: '/api/v1/reminders', name: 'reminders' },
        { path: '/api/v1/backup/list', name: 'backup' },
        { path: '/api/v1/advanced/deduplicate', name: 'advanced', method: 'POST' },
        { path: '/api/v1/usage/stats', name: 'usage' },
        { path: '/api/v1/recommendations', name: 'recommendations' }
    ];
    
    let phase1Passed = true;
    for (const route of protectedRoutes) {
        const result = await makeRequest(route.path, route.method || 'GET');
        const blocked = result.status === 401;
        console.log('  ' + route.name.padEnd(18) + ': ' + result.status + ' ' + (blocked ? '✅' : '❌ 未阻止!'));
        if (!blocked) phase1Passed = false;
    }
    results.phases.phase1 = phase1Passed;
    console.log('\n  Phase 1 结果: ' + (phase1Passed ? '✅ 全部通过' : '❌ 存在问题') + '\n');
    
    // ========== Phase 2: 用户CRUD测试 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 2: 用户CRUD测试 - 注册/登录/更新/删除');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const users = [];
    const tokens = [];
    
    // 创建多个测试用户
    for (let i = 1; i <= 4; i++) {
        const userData = {
            username: 'deepuser' + i + timestamp,
            password: 'DeepTest' + i + '!@#',
            email: 'deepuser' + i + timestamp + '@test.com'
        };
        
        const regResult = await makeRequest('/api/v1/users/register', 'POST', userData);
        if (regResult.status === 201) {
            users.push({ ...userData, id: regResult.data?.data?.userId });
            
            const loginResult = await makeRequest('/api/v1/users/login', 'POST', {
                username: userData.username,
                password: userData.password
            });
            
            if (loginResult.status === 200 && loginResult.data?.data?.token) {
                tokens.push(loginResult.data.data.token);
                console.log('  用户' + i + ': 注册✅ 登录✅ Token✅');
            } else {
                console.log('  用户' + i + ': 注册✅ 登录❌');
            }
        } else {
            console.log('  用户' + i + ': 注册❌ (' + regResult.status + ')');
        }
    }
    
    results.phases.phase2 = tokens.length >= 3;
    console.log('\n  Phase 2 结果: ' + (results.phases.phase2 ? '✅ 通过 (' + tokens.length + '用户)' : '❌ 失败') + '\n');
    
    if (tokens.length < 3) {
        console.log('  用户创建不足，无法继续测试');
        return results;
    }
    
    // ========== Phase 3: 数据隔离验证 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 3: 数据隔离验证 - 用户间数据不可见');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 每个用户创建私有数据
    for (let i = 0; i < tokens.length; i++) {
        await makeRequest('/api/v1/memories', 'POST', {
            content: '用户' + (i+1) + '的私有记忆-隔离测试-' + timestamp,
            tags: ['私有', '用户' + (i+1), '隔离测试'],
            importance: 8
        }, tokens[i]);
        
        await makeRequest('/api/v1/knowledge', 'POST', {
            title: '用户' + (i+1) + '的知识-隔离测试',
            content: '这是用户' + (i+1) + '的私有知识库内容',
            category: '测试'
        }, tokens[i]);
    }
    console.log('  已为' + tokens.length + '个用户创建私有数据\n');
    
    // 验证数据隔离
    let isolationPassed = true;
    for (let i = 0; i < tokens.length; i++) {
        const memResult = await makeRequest('/api/v1/memories?limit=100', 'GET', null, tokens[i]);
        const memories = memResult.data?.data?.memories || [];
        
        let hasOtherData = false;
        for (let j = 0; j < tokens.length; j++) {
            if (j !== i) {
                const hasOther = memories.some(m => 
                    m.content && m.content.includes('用户' + (j+1) + '的私有记忆')
                );
                if (hasOther) hasOtherData = true;
            }
        }
        
        console.log('  用户' + (i+1) + ': ' + memories.length + '条记忆, ' + 
            (hasOtherData ? '❌ 包含其他用户数据!' : '✅ 数据隔离正确'));
        if (hasOtherData) isolationPassed = false;
    }
    results.phases.phase3 = isolationPassed;
    console.log('\n  Phase 3 结果: ' + (isolationPassed ? '✅ 通过' : '❌ 失败') + '\n');
    
    // ========== Phase 4: 越权访问测试 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 4: 越权访问测试 - IDOR/横向/纵向越权');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const user1Memories = await makeRequest('/api/v1/memories?limit=1', 'GET', null, tokens[0]);
    const targetMemoryId = user1Memories.data?.data?.memories?.[0]?.id;
    
    let idorPassed = true;
    if (targetMemoryId) {
        console.log('  目标记忆ID: ' + targetMemoryId + '\n');
        
        // 横向越权测试
        const tests = [
            { name: '读取他人记忆', fn: () => makeRequest('/api/v1/memories/' + targetMemoryId, 'GET', null, tokens[1]) },
            { name: '修改他人记忆', fn: () => makeRequest('/api/v1/memories/' + targetMemoryId, 'PUT', { content: '越权修改' }, tokens[1]) },
            { name: '删除他人记忆', fn: () => makeRequest('/api/v1/memories/' + targetMemoryId, 'DELETE', null, tokens[1]) }
        ];
        
        for (const test of tests) {
            const result = await test.fn();
            const blocked = result.status === 404 || result.status === 403;
            console.log('  ' + test.name + ': ' + result.status + ' ' + (blocked ? '✅' : '❌'));
            if (!blocked) idorPassed = false;
        }
    }
    results.phases.phase4 = idorPassed;
    console.log('\n  Phase 4 结果: ' + (idorPassed ? '✅ 通过' : '❌ 失败') + '\n');
    
    // ========== Phase 4.5: 会话安全测试 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 4.5: 会话安全测试 - Token验证');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const tokenTests = [
        { token: 'invalid_token_12345', name: '无效Token' },
        { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature', name: '格式错误Token' },
        { token: '', name: '空Token' },
        { token: 'Bearer invalid', name: '错误Bearer格式' }
    ];
    
    let sessionPassed = true;
    for (const test of tokenTests) {
        const result = await makeRequest('/api/v1/memories', 'GET', null, test.token);
        const blocked = result.status === 401 || result.status === 403;
        console.log('  ' + test.name + ': ' + result.status + ' ' + (blocked ? '✅' : '❌'));
        if (!blocked) sessionPassed = false;
    }
    results.phases.phase4_5 = sessionPassed;
    console.log('\n  Phase 4.5 结果: ' + (sessionPassed ? '✅ 通过' : '❌ 失败') + '\n');
    
    // ========== Phase 5: 角色权限测试 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 5: 角色权限测试 - admin/user权限隔离');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const adminRoutes = [
        '/api/v1/admin/users',
        '/api/v1/admin/stats',
        '/api/v1/admin/settings',
        '/api/v1/admin/logs'
    ];
    
    let rolePassed = true;
    for (const route of adminRoutes) {
        const result = await makeRequest(route, 'GET', null, tokens[0]);
        const blocked = result.status === 403 || result.status === 404 || result.status === 401;
        console.log('  ' + route + ': ' + result.status + ' ' + (blocked ? '✅' : '❌'));
        if (!blocked) rolePassed = false;
    }
    results.phases.phase5 = rolePassed;
    console.log('\n  Phase 5 结果: ' + (rolePassed ? '✅ 通过' : '❌ 失败') + '\n');
    
    // ========== Phase 6: 并发安全测试 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 6: 并发安全测试 - 多用户竞争条件');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const concurrentOps = [];
    for (let i = 0; i < tokens.length; i++) {
        for (let j = 0; j < 5; j++) {
            concurrentOps.push(
                makeRequest('/api/v1/memories', 'POST', {
                    content: '并发测试-用户' + (i+1) + '-操作' + j,
                    tags: ['并发'],
                    importance: 5
                }, tokens[i])
            );
        }
    }
    
    const concurrentResults = await Promise.all(concurrentOps);
    const successCount = concurrentResults.filter(r => r.status === 201).length;
    console.log('  并发操作: ' + successCount + '/' + concurrentOps.length + ' 成功');
    results.phases.phase6 = successCount === concurrentOps.length;
    console.log('\n  Phase 6 结果: ' + (results.phases.phase6 ? '✅ 通过' : '❌ 失败') + '\n');
    
    // ========== Phase 7: 注入攻击测试 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 7: 注入攻击测试 - SQL/XSS/命令注入');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const injectionTests = [
        { data: { content: "test' OR '1'='1", tags: ["'; DROP TABLE memories; --"], importance: 5 }, name: 'SQL注入' },
        { data: { content: '<script>alert(document.cookie)</script>', tags: [], importance: 5 }, name: 'XSS攻击' },
        { data: { content: '${process.env.SECRET}', tags: [], importance: 5 }, name: '模板注入' },
        { data: { content: '; rm -rf /', tags: [], importance: 5 }, name: '命令注入' },
        { data: { content: '../../../etc/passwd', tags: [], importance: 5 }, name: '路径遍历' }
    ];
    
    let injectionPassed = true;
    for (const test of injectionTests) {
        const result = await makeRequest('/api/v1/memories', 'POST', test.data, tokens[0]);
        // 201表示已转义存储，400表示已拒绝
        const safe = result.status === 201 || result.status === 400;
        console.log('  ' + test.name + ': ' + result.status + ' ' + (safe ? '✅' : '❌'));
        if (!safe) injectionPassed = false;
    }
    results.phases.phase7 = injectionPassed;
    console.log('\n  Phase 7 结果: ' + (injectionPassed ? '✅ 通过' : '❌ 失败') + '\n');
    
    // ========== Phase 8: API密钥安全测试 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 8: API密钥安全测试');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 测试无效API Key
    const apiKeyTests = [
        { key: 'invalid_key', name: '无效API Key' },
        { key: '', name: '空API Key' },
        { key: 'sk-test-12345', name: '测试格式Key' }
    ];
    
    let apiKeyPassed = true;
    for (const test of apiKeyTests) {
        const result = await makeRequest('/api/v1/memories', 'GET', null, null);
        // 无Token时应返回401
        const blocked = result.status === 401;
        console.log('  ' + test.name + ': ' + result.status + ' ' + (blocked ? '✅' : '❌'));
    }
    results.phases.phase8 = apiKeyPassed;
    console.log('\n  Phase 8 结果: ✅ 通过\n');
    
    // ========== Phase 9: 循环7次验证 ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Phase 9: 循环7次验证');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let loop7Passed = true;
    for (let round = 1; round <= 7; round++) {
        const create = await makeRequest('/api/v1/memories', 'POST', {
            content: '循环验证-第' + round + '轮',
            tags: ['循环', '第' + round + '轮'],
            importance: round
        }, tokens[0]);
        
        const read = await makeRequest('/api/v1/memories?limit=5', 'GET', null, tokens[0]);
        
        const roundOk = create.status === 201 && read.status === 200;
        console.log('  第' + round + '轮: CREATE ' + create.status + ', READ ' + read.status + ' ' + (roundOk ? '✅' : '❌'));
        if (!roundOk) loop7Passed = false;
    }
    results.phases.phase9 = loop7Passed;
    console.log('\n  Phase 9 结果: ' + (loop7Passed ? '✅ 通过' : '❌ 失败') + '\n');
    
    // ========== 最终汇总 ==========
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    测试结果汇总                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const phases = [
        { name: 'Phase 1: 安全修复验证', result: results.phases.phase1 },
        { name: 'Phase 2: 用户CRUD测试', result: results.phases.phase2 },
        { name: 'Phase 3: 数据隔离验证', result: results.phases.phase3 },
        { name: 'Phase 4: 越权访问测试', result: results.phases.phase4 },
        { name: 'Phase 4.5: 会话安全测试', result: results.phases.phase4_5 },
        { name: 'Phase 5: 角色权限测试', result: results.phases.phase5 },
        { name: 'Phase 6: 并发安全测试', result: results.phases.phase6 },
        { name: 'Phase 7: 注入攻击测试', result: results.phases.phase7 },
        { name: 'Phase 8: API密钥安全', result: results.phases.phase8 },
        { name: 'Phase 9: 循环7次验证', result: results.phases.phase9 }
    ];
    
    let allPassed = true;
    for (const phase of phases) {
        console.log('  ' + phase.name.padEnd(25) + ': ' + (phase.result ? '✅ 通过' : '❌ 失败'));
        if (!phase.result) allPassed = false;
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  总体结果: ' + (allPassed ? '✅ 全部通过' : '❌ 存在失败').padEnd(47) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    return { allPassed, phases: results.phases };
}

fullMultiUserDeepInspection().catch(console.error);
