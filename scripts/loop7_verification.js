const https = require('https');

const BASE_URL = 'memory.91wz.org';

function makeRequest(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (token) {
            options.headers['Authorization'] = 'Bearer ' + token;
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function loop7Verification() {
    console.log('=== Phase 9: 循环7次验证 ===\n');
    
    // 创建测试用户
    const timestamp = Date.now();
    const userData = {
        username: 'loopuser' + timestamp,
        password: 'TestPass123!',
        email: 'loopuser' + timestamp + '@test.com'
    };
    
    const regResult = await makeRequest('/api/v1/users/register', 'POST', userData);
    if (regResult.status !== 201) {
        console.log('用户创建失败');
        return;
    }
    
    const loginResult = await makeRequest('/api/v1/users/login', 'POST', {
        username: userData.username,
        password: userData.password
    });
    
    const token = loginResult.data?.data?.token;
    if (!token) {
        console.log('登录失败');
        return;
    }
    
    console.log('测试用户创建成功\n');
    
    const results = [];
    
    for (let i = 1; i <= 7; i++) {
        console.log('--- 第 ' + i + ' 轮验证 ---');
        
        // CREATE
        const createResult = await makeRequest('/api/v1/memories', 'POST', {
            content: '循环验证记忆-第' + i + '轮-' + timestamp,
            tags: ['循环验证', '第' + i + '轮'],
            importance: i
        }, token);
        const createSuccess = createResult.status === 201;
        console.log('  CREATE: ' + (createSuccess ? '✅' : '❌') + ' (' + createResult.status + ')');
        
        // READ
        const readResult = await makeRequest('/api/v1/memories?limit=10', 'GET', null, token);
        const readSuccess = readResult.status === 200;
        console.log('  READ: ' + (readSuccess ? '✅' : '❌') + ' (' + readResult.status + ')');
        
        // UPDATE
        let updateSuccess = false;
        if (readResult.data?.data?.memories?.[0]) {
            const memoryId = readResult.data.data.memories[0].id;
            const updateResult = await makeRequest('/api/v1/memories/' + memoryId, 'PUT', {
                content: '已更新-第' + i + '轮',
                importance: 10
            }, token);
            updateSuccess = updateResult.status === 200;
            console.log('  UPDATE: ' + (updateSuccess ? '✅' : '❌') + ' (' + updateResult.status + ')');
        }
        
        // SEARCH
        const searchResult = await makeRequest('/api/v1/memories?search=' + encodeURIComponent('循环验证'), 'GET', null, token);
        const searchSuccess = searchResult.status === 200;
        console.log('  SEARCH: ' + (searchSuccess ? '✅' : '❌') + ' (' + searchResult.status + ')');
        
        // TAGS
        const tagsResult = await makeRequest('/api/v1/tags', 'GET', null, token);
        const tagsSuccess = tagsResult.status === 200;
        console.log('  TAGS: ' + (tagsSuccess ? '✅' : '❌') + ' (' + tagsResult.status + ')');
        
        results.push({
            round: i,
            create: createSuccess,
            read: readSuccess,
            update: updateSuccess,
            search: searchSuccess,
            tags: tagsSuccess
        });
        
        console.log('');
    }
    
    // 汇总
    console.log('=== 循环验证结果汇总 ===\n');
    
    const allPassed = results.every(r => r.create && r.read && r.update && r.search && r.tags);
    
    console.log('轮次 | CREATE | READ | UPDATE | SEARCH | TAGS');
    console.log('------|--------|------|--------|--------|------');
    results.forEach(r => {
        console.log('  ' + r.round + '   |   ' + (r.create ? '✅' : '❌') + '   |  ' + (r.read ? '✅' : '❌') + '  |   ' + (r.update ? '✅' : '❌') + '   |   ' + (r.search ? '✅' : '❌') + '   |  ' + (r.tags ? '✅' : '❌'));
    });
    
    console.log('\n7轮验证: ' + (allPassed ? '✅ 全部通过' : '❌ 存在失败'));
    
    // 最终统计
    const finalStats = await makeRequest('/api/v1/memories?limit=1', 'GET', null, token);
    if (finalStats.data?.data?.pagination) {
        console.log('最终记忆总数: ' + finalStats.data.data.pagination.total);
    }
}

loop7Verification().catch(console.error);
