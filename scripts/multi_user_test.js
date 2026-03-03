const https = require('https');

const BASE_URL = 'memory.91wz.org';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

async function multiUserTest() {
    console.log('=== Phase 2: 多用户功能完整性检查 ===\n');
    
    // 测试1: 未认证访问应该被拒绝
    console.log('测试1: 未认证访问应该被拒绝...');
    const unauthResult = await makeRequest('/api/v1/memories');
    console.log('未认证访问: ' + unauthResult.status + ' - ' + (unauthResult.status === 401 ? '正确拒绝' : '安全漏洞!'));
    
    // 测试2: 用户注册
    console.log('\n测试2: 用户注册...');
    const timestamp = Date.now();
    const user1Data = {
        username: 'testuser1' + timestamp,
        password: 'Test123456',
        email: 'test1' + timestamp + '@test.com'
    };
    console.log('注册数据: ' + JSON.stringify(user1Data));
    const user1 = await makeRequest('/api/v1/users/register', 'POST', user1Data);
    console.log('用户1注册: ' + user1.status + ' - ' + JSON.stringify(user1.data));
    
    const user2Data = {
        username: 'testuser2' + timestamp,
        password: 'Test123456',
        email: 'test2' + timestamp + '@test.com'
    };
    const user2 = await makeRequest('/api/v1/users/register', 'POST', user2Data);
    console.log('用户2注册: ' + user2.status + ' - ' + JSON.stringify(user2.data));
    
    // 测试3: 用户登录
    console.log('\n测试3: 用户登录...');
    const login1 = await makeRequest('/api/v1/users/login', 'POST', {
        username: 'testuser1' + timestamp,
        password: 'Test123456'
    });
    console.log('用户1登录: ' + login1.status);
    const token1 = login1.data?.data?.token;
    
    const login2 = await makeRequest('/api/v1/users/login', 'POST', {
        username: 'testuser2' + timestamp,
        password: 'Test123456'
    });
    console.log('用户2登录: ' + login2.status);
    const token2 = login2.data?.data?.token;
    
    if (!token1 || !token2) {
        console.log('登录失败，无法继续测试');
        return;
    }
    
    // 测试4: 用户1创建记忆
    console.log('\n测试4: 用户1创建记忆...');
    const create1 = await makeRequest('/api/v1/memories', 'POST', {
        content: '用户1的私有记忆-' + timestamp,
        tags: ['用户1', '私有'],
        importance: 8
    }, token1);
    console.log('用户1创建记忆: ' + create1.status + ' - ' + (create1.data.success ? '成功' : create1.data.message));
    
    // 测试5: 用户2创建记忆
    console.log('\n测试5: 用户2创建记忆...');
    const create2 = await makeRequest('/api/v1/memories', 'POST', {
        content: '用户2的私有记忆-' + timestamp,
        tags: ['用户2', '私有'],
        importance: 7
    }, token2);
    console.log('用户2创建记忆: ' + create2.status + ' - ' + (create2.data.success ? '成功' : create2.data.message));
    
    // 测试6: 数据隔离验证 - 用户1只能看到自己的记忆
    console.log('\n测试6: 数据隔离验证...');
    const list1 = await makeRequest('/api/v1/memories?limit=100', 'GET', null, token1);
    const memories1 = list1.data?.data?.memories || [];
    const hasUser2Memory = memories1.some(m => m.content && m.content.includes('用户2的私有记忆'));
    console.log('用户1看到的记忆数: ' + memories1.length);
    console.log('用户1能看到用户2的记忆: ' + (hasUser2Memory ? '数据隔离失败!' : '数据隔离正确'));
    
    const list2 = await makeRequest('/api/v1/memories?limit=100', 'GET', null, token2);
    const memories2 = list2.data?.data?.memories || [];
    const hasUser1Memory = memories2.some(m => m.content && m.content.includes('用户1的私有记忆'));
    console.log('用户2看到的记忆数: ' + memories2.length);
    console.log('用户2能看到用户1的记忆: ' + (hasUser1Memory ? '数据隔离失败!' : '数据隔离正确'));
    
    // 测试7: 越权访问测试
    console.log('\n测试7: 越权访问测试...');
    if (memories1.length > 0) {
        const memoryId1 = memories1[0].id;
        // 用户2尝试访问用户1的记忆
        const accessOther = await makeRequest('/api/v1/memories/' + memoryId1, 'GET', null, token2);
        console.log('用户2访问用户1的记忆: ' + accessOther.status + ' - ' + (accessOther.status === 404 ? '正确拒绝' : '越权漏洞!'));
    }
    
    // 测试8: 标签隔离测试
    console.log('\n测试8: 标签隔离测试...');
    const tags1 = await makeRequest('/api/v1/tags', 'GET', null, token1);
    console.log('用户1标签: ' + (tags1.data?.data?.tags?.length || 0) + '个');
    
    const tags2 = await makeRequest('/api/v1/tags', 'GET', null, token2);
    console.log('用户2标签: ' + (tags2.data?.data?.tags?.length || 0) + '个');
    
    // 测试9: 知识库隔离测试
    console.log('\n测试9: 知识库隔离测试...');
    const knowledge1 = await makeRequest('/api/v1/knowledge', 'GET', null, token1);
    console.log('用户1知识库访问: ' + knowledge1.status);
    
    const knowledge2 = await makeRequest('/api/v1/knowledge', 'GET', null, token2);
    console.log('用户2知识库访问: ' + knowledge2.status);
    
    // 测试10: 会话隔离测试
    console.log('\n测试10: 会话隔离测试...');
    const sessions1 = await makeRequest('/api/v1/sessions', 'GET', null, token1);
    console.log('用户1会话访问: ' + sessions1.status);
    
    const sessions2 = await makeRequest('/api/v1/sessions', 'GET', null, token2);
    console.log('用户2会话访问: ' + sessions2.status);
    
    console.log('\n=== Phase 2 多用户功能测试完成 ===');
    
    // 汇总结果
    const results = {
        unauthBlocked: unauthResult.status === 401,
        registration: user1.status === 201 && user2.status === 201,
        login: login1.status === 200 && login2.status === 200,
        dataIsolation: !hasUser1Memory && !hasUser2Memory,
        authWorking: true
    };
    
    console.log('\n测试结果汇总:');
    console.log('- 未认证访问被阻止: ' + (results.unauthBlocked ? '✅' : '❌'));
    console.log('- 用户注册功能: ' + (results.registration ? '✅' : '❌'));
    console.log('- 用户登录功能: ' + (results.login ? '✅' : '❌'));
    console.log('- 数据隔离正确: ' + (results.dataIsolation ? '✅' : '❌'));
}

multiUserTest().catch(console.error);
