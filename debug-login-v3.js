/**
 * 登录问题调试脚本 v3
 * 检查表单元素和事件绑定
 */

const { chromium } = require('D:\\NodeJS\\node_global\\node_modules\\patchright');

const BASE_URL = 'https://memory.91wz.org';
const TEST_USER = { username: '2426366814', password: 'ck123456@' };

async function debugLogin() {
    console.log('🔍 开始调试登录问题 v3...\n');

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

        // 监听所有网络请求
        page.on('request', request => {
            console.log(`[请求] ${request.method()} ${request.url()}`);
        });

        // 监听所有响应
        page.on('response', async response => {
            console.log(`[响应] ${response.status()} ${response.url()}`);
        });

        // 监听控制台
        page.on('console', msg => {
            console.log(`[控制台] ${msg.type()}: ${msg.text()}`);
        });

        // 访问登录页
        console.log('\n=== 访问登录页 ===');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60000 });

        // 检查表单元素
        console.log('\n=== 检查表单元素 ===');
        const formInfo = await page.evaluate(() => {
            const form = document.getElementById('loginForm');
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const submitBtn = document.querySelector('button[type="submit"]');
            
            return {
                formExists: !!form,
                formId: form ? form.id : null,
                usernameExists: !!usernameInput,
                usernameId: usernameInput ? usernameInput.id : null,
                usernameName: usernameInput ? usernameInput.name : null,
                passwordExists: !!passwordInput,
                passwordId: passwordInput ? passwordInput.id : null,
                passwordName: passwordInput ? passwordInput.name : null,
                submitBtnExists: !!submitBtn,
                submitBtnType: submitBtn ? submitBtn.type : null,
                submitBtnText: submitBtn ? submitBtn.textContent : null
            };
        });
        console.log('表单信息:', JSON.stringify(formInfo, null, 2));

        // 手动触发登录
        console.log('\n=== 手动触发登录 ===');
        
        // 使用evaluate在页面内执行登录
        const loginResult = await page.evaluate(async (credentials) => {
            try {
                const response = await fetch('/api/v1/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });
                const data = await response.json();
                return { 
                    status: response.status, 
                    ok: response.ok,
                    data: data 
                };
            } catch (err) {
                return { error: err.message };
            }
        }, TEST_USER);
        
        console.log('登录结果:', JSON.stringify(loginResult, null, 2));

        if (loginResult.data && loginResult.data.success) {
            console.log('\n=== 登录成功，存储token ===');
            await page.evaluate((data) => {
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('user', JSON.stringify(data.data.user));
            }, loginResult.data);
            
            // 跳转到dashboard
            await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
            console.log(`当前URL: ${page.url()}`);
        }

        // 保持浏览器打开
        console.log('\n=== 调试完成，浏览器保持打开10秒 ===');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error('❌ 调试过程出错:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

debugLogin().catch(console.error);
