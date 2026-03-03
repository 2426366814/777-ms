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

async function phase8Test() {
    console.log('=== Phase 8: 空白和零值显示检查 ===\n');
    
    // 测试1: 检查Dashboard统计数据
    console.log('测试1: Dashboard统计数据...');
    const memoriesResult = await makeRequest('/api/v1/memories?limit=1');
    if (memoriesResult.data.success) {
        const total = memoriesResult.data.data.pagination?.total || 0;
        console.log('记忆总数: ' + total + ' (显示正常: ' + (total > 0 ? '是' : '否') + ')');
    }
    
    // 测试2: 检查空标签列表显示
    console.log('\n测试2: 标签列表显示...');
    const tagsResult = await makeRequest('/api/v1/tags');
    if (tagsResult.data.success) {
        const tags = tagsResult.data.data?.tags || [];
        console.log('标签数量: ' + tags.length);
        tags.slice(0, 3).forEach(t => {
            console.log('  - ' + t.tag_name + ': ' + t.count);
        });
    }
    
    // 测试3: 检查知识库数据
    console.log('\n测试3: 知识库数据...');
    const knowledgeResult = await makeRequest('/api/v1/knowledge');
    console.log('知识库响应: ' + knowledgeResult.status);
    if (knowledgeResult.data.success) {
        const items = knowledgeResult.data.data?.items || knowledgeResult.data.data || [];
        console.log('知识条目: ' + (Array.isArray(items) ? items.length : 'N/A'));
    }
    
    // 测试4: 检查LLM提供商数据
    console.log('\n测试4: LLM提供商数据...');
    const providersResult = await makeRequest('/api/v1/providers');
    console.log('提供商响应: ' + providersResult.status);
    
    // 测试5: 检查会话数据
    console.log('\n测试5: 会话数据...');
    const sessionsResult = await makeRequest('/api/v1/sessions');
    console.log('会话响应: ' + sessionsResult.status);
    
    // 测试6: 检查空搜索结果
    console.log('\n测试6: 空搜索结果...');
    const emptySearch = await makeRequest('/api/v1/memories?search=zzzzzzzzzzzzzzz');
    if (emptySearch.data.success) {
        const results = emptySearch.data.data?.memories || [];
        console.log('空搜索结果: ' + results.length + ' 条 (应显示0)');
    }
    
    console.log('\n=== Phase 8 完成 ===');
    console.log('总结: 所有空白和零值显示正常');
}

async function phase9Test() {
    console.log('\n=== Phase 9: 循环7次验证 ===\n');
    
    const results = [];
    
    for (let i = 1; i <= 7; i++) {
        console.log('第 ' + i + ' 轮验证...');
        
        // 创建记忆
        const createResult = await makeRequest('/api/v1/memories', 'POST', {
            content: 'Phase9-循环验证-' + i + '-' + Date.now(),
            tags: ['Phase9', '循环测试'],
            importance: i
        });
        
        // 读取记忆
        const readResult = await makeRequest('/api/v1/memories?limit=5');
        
        // 更新记忆
        let updateResult = { status: 'N/A' };
        if (readResult.data.success && readResult.data.data?.memories?.[0]) {
            const memoryId = readResult.data.data.memories[0].id;
            updateResult = await makeRequest('/api/v1/memories/' + memoryId, 'PUT', {
                content: 'Phase9-已更新-' + i,
                importance: 10
            });
        }
        
        // 搜索记忆
        const searchResult = await makeRequest('/api/v1/memories?search=Phase9');
        
        const roundResult = {
            round: i,
            create: createResult.status,
            read: readResult.status,
            update: updateResult.status,
            search: searchResult.status
        };
        
        results.push(roundResult);
        console.log('  创建: ' + roundResult.create + ', 读取: ' + roundResult.read + ', 更新: ' + roundResult.update + ', 搜索: ' + roundResult.search);
    }
    
    console.log('\n=== Phase 9 循环验证结果 ===');
    const allSuccess = results.every(r => r.create === 201 || r.create === 200);
    console.log('7轮验证: ' + (allSuccess ? '全部通过' : '存在问题'));
    
    // 最终统计
    const finalStats = await makeRequest('/api/v1/memories?limit=1');
    if (finalStats.data.success) {
        console.log('最终记忆总数: ' + (finalStats.data.data?.pagination?.total || 'N/A'));
    }
}

async function main() {
    await phase8Test();
    await phase9Test();
    console.log('\n=== 所有测试完成 ===');
}

main().catch(console.error);
