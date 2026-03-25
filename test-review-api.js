const https = require('https');

async function request(path, token, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'memory.91wz.org',
            path: '/api/v1' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[${method}] ${path} -> Status: ${res.statusCode}`);
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ raw: data.substring(0, 500) });
                }
            });
        });
        
        req.on('error', (e) => {
            console.log('Request Error:', e.message);
            resolve({ error: e.message });
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    // 登录
    const loginRes = await request('/user/login', null, 'POST', {
        username: '2426366814',
        password: 'ck123456@'
    });
    
    console.log('Login Success:', loginRes.success);
    
    const token = loginRes.data?.token || loginRes.token;
    
    if (!token) {
        console.log('Login failed');
        return;
    }
    
    console.log('Token obtained');
    
    // 获取用户记忆
    const memoriesRes = await request('/memories?limit=5', token);
    console.log('Memories:', memoriesRes.success ? (memoriesRes.data?.length || 0) + ' found' : 'Failed');
    
    if (memoriesRes.data && memoriesRes.data.length > 0) {
        const memoryId = memoriesRes.data[0].id;
        console.log('Testing with memory ID:', memoryId);
        
        // 测试生成复习问题（使用 zhipu）
        console.log('\n=== Testing Review Questions with zhipu ===');
        const questionsRes = await request(`/review/questions/${memoryId}?provider=zhipu`, token);
        console.log('Questions Result:', JSON.stringify(questionsRes, null, 2));
    } else {
        console.log('No memories found');
    }
})();
