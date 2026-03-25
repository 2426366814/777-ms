/**
 * 登录问题调试脚本 v2
 * 详细捕获API响应
 */

const { chromium } = require('D:\\NodeJS\\node_global\\node_modules\\patchright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'e:\\ai本地应用\\记忆体\\777-ms\\reports\\screenshots';
const BASE_URL = 'https://memory.91wz.org';

const TEST_USER = { username: '2426366814', password: 'ck123456@' };

async function debugLogin() {
    console.log('🔍 开始调试登录问题 v2...\n');

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
            if (request.url().includes('/api/')) {
                console.log(`[请求] ${request.method()} ${request.url()}`);
                if (request.postData()) {
                    console.log(`  POST数据: ${request.postData()}`);
                }
            }
        });

        // 监听所有响应
        page.on('response', async response => {
            if (response.url().includes('/api/')) {
                console.log(`[响应] ${response.status()} ${response.url()}`);
                try {
                    const text = await response.text();
                    console.log(`  响应内容: ${text.substring(0, 500)}`);
                } catch (err) {
                    console.log(`  无法读取响应: ${err.message}`);
                }
            }
        });

        // 监听控制台
        page.on('console', msg => {
            console.log(`[浏览器控制台] ${msg.text()}`);
        });

        // 1. 访问登录页
        console.log('\n=== 步骤1: 访问登录页 ===');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        // 2. 填写表单
        console.log('\n=== 步骤2: 填写表单 ===');
        await page.fill('input[name="username"], #username, input[type="text"]', TEST_USER.username);
        await page.fill('input[name="password"], #password, input[type="password"]', TEST_USER.password);
        console.log(`  用户名: ${TEST_USER.username}`);
        console.log(`  密码: ${TEST_USER.password}`);

        // 3. 点击登录
        console.log('\n=== 步骤3: 点击登录 ===');
        await page.click('button[type="submit"], button');

        // 4. 等待响应
        console.log('\n=== 步骤4: 等待响应 ===');
        await page.waitForTimeout(8000);

        // 5. 检查结果
        console.log('\n=== 步骤5: 检查结果 ===');
        const currentUrl = page.url();
        console.log(`  当前URL: ${currentUrl}`);

        const token = await page.evaluate(() => localStorage.getItem('token'));
        const user = await page.evaluate(() => localStorage.getItem('user'));
        console.log(`  Token: ${token ? token.substring(0, 50) + '...' : '不存在'}`);
        console.log(`  User: ${user || '不存在'}`);

        // 检查错误显示
        const errorDiv = await page.$('#errorMessage, .error-message');
        if (errorDiv) {
            const isVisible = await errorDiv.isVisible();
            const text = await errorDiv.textContent();
            console.log(`  错误框可见: ${isVisible}, 内容: "${text}"`);
        }

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
