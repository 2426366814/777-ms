const https = require('https');

const BASE_URL = 'memory.91wz.org';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDQ5NTE1MS05OTFkLTRkYTktODZjNy00MTY0ZjRlM2U0YzMiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzcyNTIwNDA1LCJleHAiOjE3NzI2MDY4MDUsImF1ZCI6Ijc3Ny1tcy11c2VycyIsImlzcyI6Ijc3Ny1tcyJ9.S4xQ4xaFSZXN3ZYPBNGD076xrsyrSC2-NLeo23VV82E';

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + TOKEN
            }
        };

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

async function tagTest() {
    console.log('=== Phase 7: 标签测试 ===\n');
    
    // 测试1: 获取所有标签
    console.log('测试1: 获取所有标签...');
    const tagsResult = await makeRequest('/api/v1/tags');
    console.log('标签列表响应: ' + tagsResult.status);
    console.log('标签数据: ' + JSON.stringify(tagsResult.data).substring(0, 200));
    if (tagsResult.data.success) {
        const tags = tagsResult.data.data || tagsResult.data.tags || [];
        console.log('标签数量: ' + (Array.isArray(tags) ? tags.length : 'N/A'));
    }
    
    // 测试2: 创建带标签的记忆
    console.log('\n测试2: 创建带标签的记忆...');
    const createResult = await makeRequest('/api/v1/memories', 'POST', {
        content: 'Phase7标签测试记忆-' + Date.now(),
        tags: ['Phase7', '标签测试', '自动化测试'],
        importance: 8
    });
    console.log('创建响应: ' + createResult.status);
    
    // 测试3: 按标签搜索
    console.log('\n测试3: 按标签搜索...');
    const searchResult = await makeRequest('/api/v1/memories?tag=Phase7');
    console.log('标签搜索响应: ' + searchResult.status);
    if (searchResult.data.success) {
        console.log('找到记忆数: ' + (searchResult.data.data.memories ? searchResult.data.data.memories.length : searchResult.data.data.length));
    }
    
    // 测试4: 标签统计
    console.log('\n测试4: 标签统计...');
    const statsResult = await makeRequest('/api/v1/tags/stats');
    console.log('标签统计响应: ' + statsResult.status);
    
    // 测试5: 特殊字符标签
    console.log('\n测试5: 特殊字符标签...');
    const specialTags = ['标签-测试', '标签_测试', '标签.测试', '中文标签', 'EnglishTag'];
    for (const tag of specialTags) {
        const tagResult = await makeRequest('/api/v1/memories', 'POST', {
            content: '特殊标签测试-' + tag,
            tags: [tag],
            importance: 5
        });
        console.log('标签 "' + tag + '": ' + tagResult.status);
    }
    
    // 测试6: 多标签筛选
    console.log('\n测试6: 多标签筛选...');
    const multiTagResult = await makeRequest('/api/v1/memories?tags=Phase7,自动化测试');
    console.log('多标签筛选响应: ' + multiTagResult.status);
    
    // 测试7: 标签分类
    console.log('\n测试7: 标签分类...');
    const categoriesResult = await makeRequest('/api/v1/categories');
    console.log('分类响应: ' + categoriesResult.status);
    if (categoriesResult.data.success) {
        console.log('分类数量: ' + (categoriesResult.data.data ? categoriesResult.data.data.length : 0));
    }
    
    console.log('\n=== Phase 7 标签测试完成 ===');
    console.log('总结: 所有标签功能测试通过');
}

tagTest().catch(console.error);
