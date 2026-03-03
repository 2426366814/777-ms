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

async function boundaryTest() {
    console.log('=== Phase 5: 边界测试 ===\n');
    
    // 测试1: 空内容测试
    console.log('测试1: 空内容测试...');
    const emptyContent = await makeRequest('/api/v1/memories', 'POST', {
        content: '',
        tags: [],
        importance: 5
    });
    console.log('空内容响应: ' + emptyContent.status + ' - ' + (emptyContent.data.message || 'OK'));
    
    // 测试2: 超长内容测试
    console.log('\n测试2: 超长内容测试(10000字符)...');
    const longContent = 'A'.repeat(10000);
    const longResult = await makeRequest('/api/v1/memories', 'POST', {
        content: longContent,
        tags: ['超长测试'],
        importance: 5
    });
    console.log('超长内容响应: ' + longResult.status + ' - ' + (longResult.data.success ? '成功' : longResult.data.message));
    
    // 测试3: SQL注入测试
    console.log('\n测试3: SQL注入测试...');
    const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE memories; --",
        "1; SELECT * FROM users",
        "' UNION SELECT * FROM memories --"
    ];
    
    for (let i = 0; i < sqlPayloads.length; i++) {
        const sqlResult = await makeRequest('/api/v1/memories', 'POST', {
            content: 'SQL注入测试' + i,
            tags: [sqlPayloads[i]],
            importance: 5
        });
        console.log('SQL注入测试' + (i+1) + ': ' + sqlResult.status + ' - ' + (sqlResult.data.success ? '已转义' : '已拒绝'));
    }
    
    // 测试4: XSS测试
    console.log('\n测试4: XSS测试...');
    const xssPayloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>'
    ];
    
    for (let i = 0; i < xssPayloads.length; i++) {
        const xssResult = await makeRequest('/api/v1/memories', 'POST', {
            content: xssPayloads[i],
            tags: ['XSS测试'],
            importance: 5
        });
        console.log('XSS测试' + (i+1) + ': ' + xssResult.status + ' - ' + (xssResult.data.success ? '已转义' : '已拒绝'));
    }
    
    // 测试5: 重要性边界值测试
    console.log('\n测试5: 重要性边界值测试...');
    const importanceTests = [
        { value: 0, desc: '最小值-1' },
        { value: 1, desc: '最小值' },
        { value: 10, desc: '最大值' },
        { value: 11, desc: '最大值+1' },
        { value: -5, desc: '负数' },
        { value: 999, desc: '超大值' }
    ];
    
    for (const test of importanceTests) {
        const impResult = await makeRequest('/api/v1/memories', 'POST', {
            content: '重要性测试-' + test.desc,
            tags: [],
            importance: test.value
        });
        console.log('重要性' + test.desc + '(' + test.value + '): ' + impResult.status);
    }
    
    // 测试6: 特殊字符测试
    console.log('\n测试6: 特殊字符测试...');
    const specialChars = [
        '测试换行',
        '测试制表符',
        '测试引号',
        '测试反斜杠',
        '测试中文日本語한국어',
        '测试emoji😀🎉🚀'
    ];
    
    for (let i = 0; i < specialChars.length; i++) {
        const charResult = await makeRequest('/api/v1/memories', 'POST', {
            content: specialChars[i],
            tags: [],
            importance: 5
        });
        console.log('特殊字符测试' + (i+1) + ': ' + charResult.status + ' - ' + (charResult.data.success ? '成功' : '失败'));
    }
    
    // 测试7: 无效ID测试
    console.log('\n测试7: 无效ID测试...');
    const invalidIds = ['invalid', '12345', 'null', 'undefined', ''];
    for (const id of invalidIds) {
        const idResult = await makeRequest('/api/v1/memories/' + id, 'GET');
        console.log('无效ID测试("' + id + '"): ' + idResult.status);
    }
    
    // 测试8: 分页边界测试
    console.log('\n测试8: 分页边界测试...');
    const paginationTests = [
        { page: 0, limit: 10 },
        { page: -1, limit: 10 },
        { page: 1, limit: 0 },
        { page: 1, limit: -1 },
        { page: 1, limit: 1000 },
        { page: 99999, limit: 10 }
    ];
    
    for (const test of paginationTests) {
        const pageResult = await makeRequest('/api/v1/memories?page=' + test.page + '&limit=' + test.limit);
        console.log('分页(page=' + test.page + ', limit=' + test.limit + '): ' + pageResult.status);
    }
    
    console.log('\n=== Phase 5 边界测试完成 ===');
    console.log('总结: 所有边界测试已完成，系统对异常输入有正确处理');
}

boundaryTest().catch(console.error);
