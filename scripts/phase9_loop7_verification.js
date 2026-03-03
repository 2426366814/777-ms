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

async function loop7Verification() {
    console.log('=== Phase 9: 循环7次验证 ===\n');
    
    const timestamp = Date.now();
    
    // 创建测试用户
    const regResult = await makeRequest('/api/v1/users/register', 'POST', {
        username: 'loop7user' + timestamp,
        password: 'TestPass123!@#',
        email: 'loop7user' + timestamp + '@test.com'
    });
    
    if (regResult.status !== 201) {
        console.log('用户创建失败');
        return;
    }
    
    const loginResult = await makeRequest('/api/v1/users/login', 'POST', {
        username: 'loop7user' + timestamp,
        password: 'TestPass123!@#'
    });
    
    const token = loginResult.data?.data?.token;
    if (!token) { console.log('登录失败'); return; }
    
    console.log('测试用户创建成功\n');
    
    const results = [];
    
    for (let round = 1; round <= 7; round++) {
        console.log('--- 第 ' + round + ' 轮 ---');
        const roundResult = { round, tests: {} };
        
        // CREATE
        const create = await makeRequest('/api/v1/memories', 'POST', {
            content: '循环验证-第' + round + '轮-' + timestamp,
            tags: ['循环验证', '第' + round + '轮'],
            importance: round
        }, token);
        roundResult.tests.create = create.status === 201;
        console.log('  CREATE: ' + create.status + ' ' + (roundResult.tests.create ? '✅' : '❌'));
        
        // READ
        const read = await makeRequest('/api/v1/memories?limit=10', 'GET', null, token);
        roundResult.tests.read = read.status === 200;
        console.log('  READ: ' + read.status + ' ' + (roundResult.tests.read ? '✅' : '❌'));
        
        // UPDATE
        if (read.data?.data?.memories?.[0]) {
            const update = await makeRequest('/api/v1/memories/' + read.data.data.memories[0].id, 'PUT', {
                content: '已更新-第' + round + '轮',
                importance: 10
            }, token);
            roundResult.tests.update = update.status === 200;
            console.log('  UPDATE: ' + update.status + ' ' + (roundResult.tests.update ? '✅' : '❌'));
        }
        
        // SEARCH
        const search = await makeRequest('/api/v1/memories?search=' + encodeURIComponent('循环验证'), 'GET', null, token);
        roundResult.tests.search = search.status === 200;
        console.log('  SEARCH: ' + search.status + ' ' + (roundResult.tests.search ? '✅' : '❌'));
        
        // TAGS
        const tags = await makeRequest('/api/v1/tags', 'GET', null, token);
        roundResult.tests.tags = tags.status === 200;
        console.log('  TAGS: ' + tags.status + ' ' + (roundResult.tests.tags ? '✅' : '❌'));
        
        // KNOWLEDGE
        const knowledge = await makeRequest('/api/v1/knowledge', 'GET', null, token);
        roundResult.tests.knowledge = knowledge.status === 200;
        console.log('  KNOWLEDGE: ' + knowledge.status + ' ' + (roundResult.tests.knowledge ? '✅' : '❌'));
        
        // SESSIONS
        const sessions = await makeRequest('/api/v1/sessions', 'GET', null, token);
        roundResult.tests.sessions = sessions.status === 200;
        console.log('  SESSIONS: ' + sessions.status + ' ' + (roundResult.tests.sessions ? '✅' : '❌'));
        
        results.push(roundResult);
        console.log('');
    }
    
    // 汇总
    console.log('=== 循环验证结果汇总 ===\n');
    console.log('轮次 | CREATE | READ | UPDATE | SEARCH | TAGS | KNOWLEDGE | SESSIONS');
    console.log('-----|--------|------|--------|--------|------|-----------|---------');
    
    let allPassed = true;
    for (const r of results) {
        const status = (r.tests.create && r.tests.read && r.tests.update && r.tests.search && r.tests.tags && r.tests.knowledge && r.tests.sessions);
        if (!status) allPassed = false;
        console.log('  ' + r.round + '  |   ' + (r.tests.create ? '✅' : '❌') + '   |  ' + 
            (r.tests.read ? '✅' : '❌') + '  |   ' + (r.tests.update ? '✅' : '❌') + '   |   ' + 
            (r.tests.search ? '✅' : '❌') + '   |  ' + (r.tests.tags ? '✅' : '❌') + '  |     ' + 
            (r.tests.knowledge ? '✅' : '❌') + '    |    ' + (r.tests.sessions ? '✅' : '❌'));
    }
    
    console.log('\n7轮验证: ' + (allPassed ? '✅ 全部通过' : '❌ 存在失败'));
    return allPassed;
}

loop7Verification().catch(console.error);
