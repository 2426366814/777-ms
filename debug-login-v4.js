/**
 * 登录调试脚本 v4
 * 详细调试登录过程
 */

const { chromium } = require('D:\\NodeJS\\node_global\\node_modules\\patchright');

const BASE_URL = 'https://memory.91wz.org';
const TEST_USER = { username: '2426366814', password: 'ck123456@' };

async function debugLogin() {
    console.log('🔍 开始调试登录过程...\n');

    let browser, page;
    try {
        browser = await chromium.launch({ 
            headless: false,
            args: ['--disable-font-loading-timeout']
        });
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        page = await context.newPage();

        // 监听所有请求和响应
        page.on('request', request => {
            if (request.url().includes('/api/')) {
                console.log(`[请求] ${request.method()} ${request.url()}`);
            }
        });

        page.on('response', async response => {
            if (response.url().includes('/api/v1/user/login')) {
                try {
                    const data = await response.json();
                    console.log(`[登录响应] success=${data.success}, message=${data.message}`);
                    if (data.data && data.data.token) {
                        console.log(`[Token] ${data.data.token.substring(0, 30)}...`);
                    }
                } catch (e) {
                    console.log(`[登录响应] 解析失败: ${e.message}`);
                }
            }
        });

        page.on('console', msg => {
            console.log(`[浏览器控制台] ${msg.type()}: ${msg.text()}`);
        });

        // 访问登录页
        console.log('\n=== 步骤1: 访问登录页 ===');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60000 });
        console.log(`当前URL: ${page.url()}`);

        // 检查表单
        console.log('\n=== 步骤2: 检查表单 ===');
        const formInfo = await page.evaluate(() => {
            const form = document.getElementById('loginForm');
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const submitBtn = document.querySelector('button[type="submit"]');
            
            return {
                formExists: !!form,
                usernameExists: !!usernameInput,
                passwordExists: !!passwordInput,
                submitBtnExists: !!submitBtn,
                submitBtnText: submitBtn ? submitBtn.textContent : null
            };
        });
        console.log('表单信息:', JSON.stringify(formInfo, null, 2));

        // 填写表单
        console.log('\n=== 步骤3: 填写表单 ===');
        await page.fill('#username', TEST_USER.username);
        await page.fill('#password', TEST_USER.password);
        console.log('已填写用户名和密码');

        // 点击登录按钮
        console.log('\n=== 步骤4: 点击登录按钮 ===');
        
        // 使用JavaScript直接触发登录
        const loginResult = await page.evaluate(async (credentials) => {
            try {
                const response = await fetch('/api/v1/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('token', data.data.token);
                    localStorage.setItem('user', JSON.stringify(data.data.user));
                    return { success: true, token: data.data.token.substring(0, 30) + '...' };
                }
                return { success: false, message: data.message };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, TEST_USER);
        
        console.log('登录结果:', JSON.stringify(loginResult, null, 2));

        // 检查localStorage
        console.log('\n=== 步骤5: 检查localStorage ===');
        const storage = await page.evaluate(() => ({
            token: localStorage.getItem('token'),
            user: localStorage.getItem('user')
        }));
        console.log(`Token: ${storage.token ? storage.token.substring(0, 30) + '...' : '不存在'}`);
        console.log(`User: ${storage.user ? '存在' : '不存在'}`);

        // 跳转到dashboard
        console.log('\n=== 步骤6: 跳转到dashboard ===');
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
        console.log(`当前URL: ${page.url()}`);

        // 检查API请求
        console.log('\n=== 步骤7: 测试API请求 ===');
        const apiResult = await page.evaluate(async (token) => {
            try {
                const response = await fetch('/api/v1/memories', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                return { status: response.status, success: data.success };
            } catch (err) {
                return { error: err.message };
            }
        }, storage.token);
        console.log('API结果:', JSON.stringify(apiResult, null, 2));

        // 保持浏览器打开
        console.log('\n=== 调试完成，浏览器保持打开15秒 ===');
        await page.waitForTimeout(15000);

    } catch (error) {
        console.error('❌ 调试过程出错:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

debugLogin().catch(console.error);
